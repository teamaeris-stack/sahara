import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useResq } from "./resq-store";
import { foregroundLocation } from "./foreground-location";

export type MemberId = string;
export interface ConfirmedPoint {
  lat: number;
  lng: number;
  at: number;
  label: string;
}
export interface SharedMember {
  id: MemberId;
  name: string;
  status?: string;
  updatedAt?: number;
  location?: ConfirmedPoint | null;
  history?: ConfirmedPoint[];
  places?: ConfirmedPoint[];
  sos?: { id: string; type: string; at: number } | null;
  demo?: boolean;
}
interface Request {
  id: string;
  from: MemberId;
  to: MemberId;
  at: number;
  respondedAt: number | null;
}
interface Identity {
  memberId: MemberId;
  code: string;
  token: string;
  endpoint: string;
  demo: boolean;
}
interface Command {
  action: "update" | "checkin" | "addMember" | "renameMember" | "removeMember";
  sequence?: number;
  record?: SharedMember;
  to?: MemberId;
  eventId?: string;
  target?: string;
  name?: string;
}
interface FamilyState {
  identity: Identity | null;
  members: SharedMember[];
  requests: Request[];
  queue: Command[];
  sequence: number;
}
const KEY = "sahara_family_shared_v1";
export const THREE_MEMBERS: SharedMember[] = [
  { id: "me", name: "Me" },
  { id: "dad", name: "Dad" },
  { id: "mom", name: "Mom" },
];
const empty = (): FamilyState => ({
  identity: null,
  members: THREE_MEMBERS,
  requests: [],
  queue: [],
  sequence: 0,
});
const demoPoint = (id: MemberId): ConfirmedPoint => ({
  ...((
    {
      me: { lat: 10.1076, lng: 76.3516, label: "Aluva demo centre" },
      dad: { lat: 10.1133, lng: 76.3495, label: "Aluva riverside demo area" },
      mom: { lat: 10.10761, lng: 76.343001, label: "West Aluva demo point" },
    } as Record<string, { lat: number; lng: number; label: string }>
  )[id] || { lat: 10.1076, lng: 76.3516, label: "Aluva demo centre" }),
  at: Date.now(),
});
interface FamilyActions {
  setup: (action: "create" | "join", name: string, code: string, endpoint: string) => Promise<void>;
  manage: (
    action: "addMember" | "renameMember" | "removeMember",
    target: string,
    name?: string,
  ) => void;
  startLocal: (name: string) => void;
  startDemo: (memberId: MemberId, reset?: boolean) => void;
  locate: () => void;
  request: (to: MemberId) => void;
  respondSafe: () => void;
  savePlace: (label: string) => void;
  message: string;
  connected: boolean;
  hydrated: boolean;
}
const Context = createContext<(FamilyState & FamilyActions) | null>(null);
export function FamilySyncProvider({ children }: { children: ReactNode }) {
  const resq = useResq();
  const [state, setState] = useState<FamilyState>(empty);
  const ref = useRef(state);
  ref.current = state;
  const [hydrated, setHydrated] = useState(false);
  const [message, setMessage] = useState("");
  const [connected, setConnected] = useState(false);
  const busy = useRef(false);
  const commit = (next: FamilyState) => {
    ref.current = next;
    setState(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      setMessage("Device storage unavailable: changes may be lost on refresh.");
    }
  };
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const value = JSON.parse(raw) as FamilyState;
        if (Array.isArray(value.members) && Array.isArray(value.queue)) {
          ref.current = value;
          setState(value);
        }
      }
    } catch {
      setMessage("Saved family data could not be read.");
    }
    setHydrated(true);
  }, []);
  const update = (changes: Partial<SharedMember>) => {
    const current = ref.current;
    const identity = current.identity;
    if (!identity) return;
    const member = current.members.find((m) => m.id === identity.memberId)!;
    if (!member) return;
    const record = { ...member, ...changes, updatedAt: Date.now() };
    if (changes.location) record.history = [...(member.history || []), changes.location].slice(-8);
    const sequence = current.sequence + 1;
    const requests =
      identity.demo && changes.status === "SAFE"
        ? current.requests.map((q) =>
            q.to === identity.memberId && !q.respondedAt ? { ...q, respondedAt: Date.now() } : q,
          )
        : current.requests;
    commit({
      ...current,
      sequence,
      requests,
      members: current.members.map((m) => (m.id === record.id ? record : m)),
      queue: identity.demo
        ? []
        : [
            ...current.queue.filter((q) => q.action !== "update"),
            { action: "update", sequence, record },
          ],
    });
  };
  const api = async (identity: Identity, command: Record<string, unknown>) => {
    const response = await fetch(identity.endpoint + "/api/family", {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + identity.token },
      body: JSON.stringify({ ...command, code: identity.code, memberId: identity.memberId }),
      signal: AbortSignal.timeout(6000),
    });
    const body = await response.json();
    if (!response.ok)
      throw Object.assign(new Error(body.error || "Family server unavailable"), {
        status: response.status,
      });
    return body;
  };
  useEffect(() => {
    if (!hydrated) return;
    let active = true;
    const sync = async () => {
      const identity = ref.current.identity;
      if (!identity || identity.demo || busy.current) return;
      if (!navigator.onLine) {
        setConnected(false);
        return;
      }
      busy.current = true;
      try {
        const pending = [...ref.current.queue];
        for (const command of pending) {
          try {
            await api(identity, command as unknown as Record<string, unknown>);
          } catch (error) {
            const status = (error as { status?: number }).status;
            if (status === 400 || status === 404 || status === 409) {
              commit({ ...ref.current, queue: ref.current.queue.filter((q) => q !== command) });
              setMessage("A family change was rejected: " + (error as Error).message);
              continue;
            }
            throw error;
          }
          if (!active) return;
          const current = ref.current;
          commit({ ...current, queue: current.queue.filter((q) => q !== command) });
        }
        const data = await api(identity, { action: "pull" });
        if (!active) return;
        const current = ref.current;
        let members: SharedMember[] = data.members;
        for (const q of current.queue) {
          if (q.action === "update")
            members = members.map((m) =>
              m.id === identity.memberId ? { ...q.record!, name: m.name } : m,
            );
          if (q.action === "addMember" && !members.some((m) => m.id === q.target))
            members = [...members, { id: q.target!, name: q.name! }];
          if (q.action === "renameMember")
            members = members.map((m) => (m.id === q.target ? { ...m, name: q.name! } : m));
          if (q.action === "removeMember") members = members.filter((m) => m.id !== q.target);
        }
        const queuedIds = new Set(
          current.queue.filter((q) => q.action === "checkin").map((q) => q.eventId),
        );
        commit({
          ...current,
          members,
          requests: [
            ...data.requests,
            ...current.requests.filter(
              (q) => queuedIds.has(q.id) && !data.requests.some((r: Request) => r.id === q.id),
            ),
          ],
        });
        setConnected(true);
        setMessage("Shared family data synchronized");
      } catch (error) {
        if (active) {
          setConnected(false);
          setMessage(
            (error instanceof Error ? error.message : "Sync unavailable") +
              " — cached data retained; pending updates stay queued.",
          );
        }
      } finally {
        busy.current = false;
      }
    };
    void sync();
    const timer = setInterval(() => void sync(), 5000);
    window.addEventListener("online", sync);
    const offline = () => setConnected(false);
    window.addEventListener("offline", offline);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", offline);
    };
    // Identity and queue changes are picked up from the ref, without restarting an in-flight sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);
  useEffect(() => {
    if (!hydrated || !resq.hydrated || !ref.current.identity) return;
    if (ref.current.identity.demo && resq.userStatus === "UNKNOWN") return;
    const latest = resq.latestPacket;
    const member = ref.current.members.find((m) => m.id === ref.current.identity!.memberId)!;
    if (!member) return;
    const activeSos =
      resq.userStatus === "NEEDS_HELP" && latest
        ? { id: latest.id, type: latest.type, at: Date.parse(latest.createdAt) }
        : null;
    if (member.status !== resq.userStatus || member.sos?.id !== activeSos?.id)
      update({
        status: resq.userStatus,
        sos: activeSos,
        demo: ref.current.identity.code === "LOCAL-DEMO",
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, resq.hydrated, resq.userStatus, resq.latestPacket, state.identity?.memberId]);
  const setup: FamilyActions["setup"] = async (action, name, code, endpoint) => {
    if (!name.trim()) throw new Error("Enter your name");
    const memberId = crypto.randomUUID();
    const clean = endpoint.trim().replace(/\/$/, "");
    if (
      clean &&
      !/^https:\/\//.test(clean) &&
      !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(clean)
    )
      throw new Error("Use HTTPS for a shared family server.");
    const identity: Identity = {
      memberId,
      code: code.trim().toUpperCase(),
      token: "",
      endpoint: clean,
      demo: false,
    };
    const data = await api(identity, { action, name: name.trim().slice(0, 40) });
    identity.code = data.code || identity.code;
    identity.token = data.token;
    identity.memberId = data.memberId;
    commit({ ...empty(), identity, members: data.members, requests: data.requests });
    setMessage("Family connected. Tap Update my GPS to share a location.");
  };
  const startDemo = (memberId: MemberId, reset = false) => {
    if (ref.current.identity && !ref.current.identity.demo) {
      setMessage("Keep this real family identity. Demo cannot replace a joined phone.");
      return;
    }
    if (ref.current.identity?.demo && !reset) {
      commit({ ...ref.current, identity: { ...ref.current.identity, memberId } });
      return;
    }
    commit({
      ...empty(),
      identity: { memberId, code: "LOCAL-DEMO", token: "", endpoint: "", demo: true },
      members: THREE_MEMBERS.map((m) => ({
        ...m,
        status: m.id === "dad" ? "NEEDS_HELP" : m.id === "mom" ? "NO_RESPONSE" : "SAFE",
        demo: true,
        updatedAt: Date.now(),
        location: demoPoint(m.id),
        history: [demoPoint(m.id)],
        sos: null,
      })),
    });
    setConnected(false);
    setMessage("DEMO MODE — simulated locations and risk; not shared between phones.");
  };
  const locate = () => {
    setMessage("Requesting GPS permission…");
    void foregroundLocation()
      .then((p) => {
        update({
          location: { ...p, at: Date.now(), label: "Foreground GPS confirmation" },
          demo: false,
        });
        setMessage(
          "GPS saved. Locations outside Aluva are retained but cannot be routed on this map.",
        );
      })
      .catch(() =>
        setMessage(
          "GPS denied or unavailable. Last confirmed location retained; no fake GPS update saved.",
        ),
      );
  };
  const request = (to: MemberId) => {
    const current = ref.current;
    if (!current.identity) return;
    const event = {
      id: crypto.randomUUID(),
      from: current.identity.memberId,
      to,
      at: Date.now(),
      respondedAt: null,
    };
    commit({
      ...current,
      requests: [...current.requests, event].slice(-30),
      queue: current.identity.demo
        ? []
        : [...current.queue, { action: "checkin", to, eventId: event.id }],
    });
  };
  const savePlace = (label: string) => {
    const m = ref.current.members.find((m) => m.id === ref.current.identity?.memberId);
    if (!m?.location) {
      setMessage("Confirm GPS before saving a place.");
      return;
    }
    update({
      places: [...(m.places || []), { ...m.location, label: label.slice(0, 80) }].slice(-5),
    });
  };
  const respondSafe = () => {
    resq.setUserStatus("SAFE");
    update({ status: "SAFE", sos: null });
  };
  const startLocal = (name: string) => {
    if (!name.trim()) throw new Error("Enter your name");
    const memberId = crypto.randomUUID();
    commit({
      ...empty(),
      identity: { memberId, code: "LOCAL", token: "", endpoint: "", demo: true },
      members: [{ id: memberId, name: name.trim().slice(0, 40), status: "UNKNOWN" }],
    });
    setMessage("Saved on this device. Shared families require a server connection.");
  };
  const manage: FamilyActions["manage"] = (action, target, name = "") => {
    const current = ref.current;
    if (!current.identity) throw new Error("Set up your family first");
    const clean = name.trim().slice(0, 40);
    if (action !== "removeMember" && !clean) throw new Error("Enter a member name");
    if (
      action !== "removeMember" &&
      current.members.some((m) => m.id !== target && m.name.toLowerCase() === clean.toLowerCase())
    )
      throw new Error("Use a distinct name, such as Dad — Ahmed");
    if (action === "removeMember" && target === current.identity.memberId)
      throw new Error("You cannot remove this phone from here");
    const members =
      action === "addMember"
        ? [...current.members, { id: target, name: clean }]
        : action === "renameMember"
          ? current.members.map((m) => (m.id === target ? { ...m, name: clean } : m))
          : current.members.filter((m) => m.id !== target);
    commit({
      ...current,
      members,
      requests: current.requests.filter(
        (q) => action !== "removeMember" || (q.to !== target && q.from !== target),
      ),
      queue: current.identity.demo ? [] : [...current.queue, { action, target, name: clean }],
    });
  };
  return (
    <Context.Provider
      value={{
        ...state,
        setup,
        startDemo,
        startLocal,
        manage,
        locate,
        request,
        respondSafe,
        savePlace,
        message,
        connected,
        hydrated,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useFamilySync() {
  const value = useContext(Context);
  if (!value) throw new Error("Family provider missing");
  return value;
}
