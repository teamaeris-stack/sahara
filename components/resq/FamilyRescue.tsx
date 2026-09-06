import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useFamilySync } from "@/lib/family-sync";
import { X, Users } from "lucide-react";
import { Sheet } from "./Sheet";
import { FamilyMembersEditor } from "./FamilyMembersEditor";
import { useNow, useResq } from "@/lib/resq-store";
import { useLang } from "@/lib/i18n";
import { calculateWalkingRoute, haversineMetres } from "@/lib/offline-routing";
import { liveShelters } from "@/lib/shelters";
import { OfflineMap, shelterPoint, useOfflineNavigation } from "./OfflineMap";

const button =
  "tap-target rounded-xl border-2 border-input bg-card px-4 py-3 text-sm font-extrabold hover:bg-muted";
const time = (at: number | undefined) => (at ? new Date(at).toLocaleString() : "Not confirmed");
const inside = (p: { lat: number; lng: number }) =>
  haversineMetres(p, { lat: 10.1076, lng: 76.3516 }) <= 5000;

export function FamilyRescue({ id }: { id?: string }) {
  const family = useFamilySync();
  const resq = useResq();
  const { tx } = useLang();
  const navigate = useNavigate();
  const now = useNow(15000);
  const navigation = useOfflineNavigation();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [manageOpen, setManageOpen] = useState(false);
  const [setupMode, setSetupMode] = useState<"create" | "join">("create");
  const [endpoint, setEndpoint] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [destination, setDestination] = useState<"member" | "shelter" | null>(null);
  useEffect(() => setDestination(null), [id]);
  const [placeName, setPlaceName] = useState("Home");
  const shelters = useMemo(() => liveShelters(resq.shelterCache), [resq.shelterCache]);
  const blocked = useMemo(
    () => new Set(resq.hazards.filter((h) => h.reported && h.osmWayId).map((h) => h.osmWayId!)),
    [resq.hazards],
  );
  const intelligence = useMemo(
    () =>
      family.members.map((member) => {
        const point = member.location;
        const hazardDistance = point
          ? Math.min(
              ...resq.hazards
                .filter((h) => h.reported && h.geo)
                .map((h) => haversineMetres(point, h.geo!)),
            )
          : Infinity;
        const risk = member.demo
          ? member.id === "dad"
            ? "High (demo)"
            : member.id === "mom"
              ? "Moderate (demo)"
              : "Low (demo)"
          : !point
            ? "Unknown"
            : hazardDistance < 200
              ? "High — near reported hazard"
              : hazardDistance < 500
                ? "Moderate — nearby report"
                : "No nearby reported hazards";
        const request = [...family.requests].reverse().find((q) => q.to === member.id);
        const missed = !!request && !request.respondedAt && now - request.at > 120000;
        const stale = !point || now - point.at > 10 * 60000;
        const priority =
          (member.sos ? 1000 : 0) +
          (member.status === "NEEDS_HELP" ? 500 : 0) +
          (risk.startsWith("High") ? 200 : 0) +
          (missed || member.status === "NO_RESPONSE" ? 100 : 0) +
          (stale ? 50 : 0);
        const nearest =
          point && inside(point) && navigation.map
            ? shelters
                .filter(
                  (s) =>
                    s.status !== "FULL" &&
                    (s.availableSpaces === null || s.availableSpaces > 0) &&
                    haversineMetres(point, shelterPoint(s)) <= 5000,
                )
                .map((s) => ({
                  s,
                  route: calculateWalkingRoute(navigation.map!, point, shelterPoint(s), blocked),
                }))
                .filter((r) => r.route && r.route.distanceKm <= 5)
                .sort((a, b) => a.route!.distanceKm - b.route!.distanceKm)[0]
            : undefined;
        return { member, risk, priority, missed, stale, request, nearest };
      }),
    [family.members, family.requests, resq.hazards, now, navigation.map, shelters, blocked],
  );
  const selected = intelligence.find((r) => r.member.id === id);
  const me = family.members.find((m) => m.id === family.identity?.memberId);
  const activePoint =
    me?.location && inside(me.location) ? me.location : navigation.location?.point;
  const lat = activePoint?.lat;
  const lng = activePoint?.lng;
  const demoLocation =
    me?.demo === true || (!me?.location && navigation.location?.source === "demo");
  const mapLocation = useMemo(
    () =>
      lat !== undefined && lng !== undefined
        ? { point: { lat, lng }, source: demoLocation ? ("demo" as const) : ("cached" as const) }
        : null,
    [lat, lng, demoLocation],
  );
  const route = useMemo(() => {
    if (
      !selected ||
      !destination ||
      !navigation.map ||
      !activePoint ||
      !selected.member.location ||
      !inside(selected.member.location)
    )
      return null;
    if (destination === "shelter") return selected.nearest?.route || null;
    // A confirmed out-of-area device position must not be replaced silently by Aluva demo GPS.
    if (me?.location && !inside(me.location)) return null;
    return calculateWalkingRoute(navigation.map, activePoint, selected.member.location, blocked);
  }, [selected, destination, navigation.map, activePoint, blocked, me?.location]);
  const markers = family.members
    .filter((m) => m.location && inside(m.location))
    .map((m) => ({
      id: m.id,
      label: `${m.name} · ${m.demo ? "DEMO · " : ""}${m.status || "UNKNOWN"} · Last confirmed ${time(m.location!.at)}`,
      point: m.location!,
      urgent: m.status === "NEEDS_HELP" || !!m.sos,
    }));
  const setup = async (action: "create" | "join") => {
    setSaving(true);
    setError("");
    try {
      await family.setup(action, name, code, endpoint);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Setup failed");
    } finally {
      setSaving(false);
    }
  };
  if (!family.hydrated) return <p>Loading saved family…</p>;
  if (!family.identity)
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-extrabold">My family</h1>
          <Link to="/" aria-label="Close family" className={button}>
            <X className="h-5 w-5" />
          </Link>
        </div>
        <p>Add the people you care about and keep their last confirmed information together.</p>
        <label className="font-bold">
          Your name
          <input
            className={button + " mt-1 w-full font-normal"}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            maxLength={40}
          />
        </label>
        <button
          className={button + " bg-primary text-primary-foreground"}
          disabled={!name.trim()}
          onClick={() => family.startLocal(name)}
        >
          Start on this device
        </button>
        <p className="text-xs text-muted-foreground">
          Works offline. You can add, rename and remove members.
        </p>
        <details className="resq-card p-4">
          <summary className="cursor-pointer font-bold">Connect with other phones</summary>
          <div className="mt-3 space-y-3">
            <div className="flex gap-2">
              <button
                className={button}
                aria-pressed={setupMode === "create"}
                onClick={() => setSetupMode("create")}
              >
                Create family
              </button>
              <button
                className={button}
                aria-pressed={setupMode === "join"}
                onClick={() => setSetupMode("join")}
              >
                Join family
              </button>
            </div>
            {setupMode === "join" && (
              <label className="block">
                Family code
                <input
                  className={button + " w-full"}
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  maxLength={12}
                />
                <small>Use the exact member name added by your family.</small>
              </label>
            )}
            <label className="block">
              Server address
              <input
                className={button + " w-full"}
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder="Leave blank for this website"
              />
            </label>
            <button
              className={button}
              disabled={saving || !name.trim() || (setupMode === "join" && !code)}
              onClick={() => void setup(setupMode)}
            >
              {saving
                ? "Connecting…"
                : setupMode === "create"
                  ? "Create shared family"
                  : "Join shared family"}
            </button>
            <p className="text-xs">Requires your shared family server.</p>
          </div>
        </details>
        <button className={button} onClick={() => family.startDemo("me")}>
          Try a labelled demo
        </button>
        {error && <p role="alert">{error}</p>}
      </div>
    );
  const memberCard = (row: (typeof intelligence)[number]) => {
    const m = row.member;
    return (
      <article
        key={m.id}
        className={"resq-card p-4 " + (row.priority >= 500 ? "border-red-500" : "")}
      >
        <div className="flex justify-between gap-2">
          <h2 className="text-xl font-extrabold">
            {m.name}
            {m.id === family.identity?.memberId ? " · THIS PHONE" : ""}
          </h2>
          <strong>{m.sos ? "SOS ACTIVE" : m.status || "NOT JOINED"}</strong>
        </div>
        {m.demo && (
          <p className="font-bold text-amber-700">DEMO — simulated status/location/risk</p>
        )}
        <p className="mt-2">Last confirmed location: {m.location?.label || "Unknown"}</p>
        <p className="text-xs">
          Last updated: {time(m.location?.at)} ·{" "}
          {row.stale ? "STALE / LAST KNOWN" : "Last known — not live tracking"}
        </p>
        {m.location && !inside(m.location) && (
          <p className="text-amber-700">Outside the Aluva map — routing unavailable.</p>
        )}
        <p className="mt-2 font-bold">Risk: {row.risk}</p>
        <p className="text-xs">
          Priority: {row.priority >= 500 ? "URGENT" : row.priority >= 100 ? "ATTENTION" : "ROUTINE"}{" "}
          · Missing reports do not establish safety.
        </p>
        <p className="mt-2">
          Nearest available demo shelter:{" "}
          {row.nearest
            ? `${tx(row.nearest.s.name)} · ${row.nearest.route!.distanceKm} km · ${row.nearest.route!.walkingMinutes} min walk`
            : "No reachable shelter known within 5 km"}
        </p>
        {row.request && (
          <p className="mt-2 text-sm">
            {row.request.respondedAt
              ? `Responded ${time(row.request.respondedAt)}`
              : row.missed
                ? "CHECK-IN OVERDUE"
                : `Check-in requested ${Math.max(0, Math.floor((now - row.request.at) / 60000))} min ago`}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {!id && (
            <Link to="/family/$id" params={{ id: m.id }} className={button}>
              Rescue details / View on map
            </Link>
          )}
          {m.id !== family.identity?.memberId && (
            <button className={button} onClick={() => family.request(m.id)}>
              Request check-in
            </button>
          )}
        </div>
      </article>
    );
  };
  return (
    <div className="flex flex-col gap-4 pb-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">{tx({ en: "My family", hi: "मेरा परिवार" })}</h1>
        <Link to="/" aria-label="Close family" className={button}>
          <X className="h-5 w-5" />
        </Link>
      </div>
      <button
        className={button + " flex items-center justify-center gap-2"}
        onClick={() => setManageOpen(true)}
      >
        <Users className="h-5 w-5" />
        Add / manage members
      </button>
      <Sheet
        open={manageOpen}
        onOpenChange={setManageOpen}
        title="Family members"
        description="Add names, edit or remove members."
      >
        <FamilyMembersEditor />
      </Sheet>
      <p className="text-sm">
        Family: {family.identity.code} · This phone: {me?.name} ·{" "}
        {family.connected ? "SERVER CONNECTED" : "CACHED / OFFLINE"} · {family.queue.length} pending
      </p>
      <p role="status" className="text-xs">
        {family.message}
      </p>
      {family.identity.code === "LOCAL" && (
        <p className="rounded-xl bg-muted p-3 text-sm">
          Saved on this device · not shared with other phones
        </p>
      )}
      {family.identity.code === "LOCAL-DEMO" && (
        <details className="resq-card border-amber-500 p-3">
          <summary className="cursor-pointer font-bold">DEMO MODE · switch demo person</summary>
          <div className="mt-2 flex flex-wrap gap-2">
            {family.members.map((m) => (
              <button className={button} key={m.id} onClick={() => family.startDemo(m.id)}>
                {m.name}
              </button>
            ))}
          </div>
        </details>
      )}
      <div className="flex flex-wrap gap-2">
        <button className={button} onClick={family.locate}>
          Update my GPS
        </button>
        <button className={button} onClick={family.respondSafe}>
          Respond: I am safe
        </button>
        <Link className={button} to="/sos-now">
          SOS NOW
        </Link>
        <Link className={button} to="/sos">
          I NEED HELP
        </Link>
      </div>
      {id && (
        <Link className={button} to="/family">
          Back to family
        </Link>
      )}
      {id && !selected && <p>This member is no longer in your family.</p>}
      {selected
        ? memberCard(selected)
        : !id && [...intelligence].sort((a, b) => b.priority - a.priority).map(memberCard)}
      {selected && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <button className={button} onClick={() => setDestination("member")}>
              Find Safest Route
            </button>
            <button className={button} onClick={() => setDestination("shelter")}>
              Find Safe Shelter
            </button>
          </div>
          {destination && (
            <p className="font-bold">
              {destination === "member"
                ? `You → ${selected.member.name}'s last confirmed location`
                : `${selected.member.name}'s last confirmed location → nearest available shelter`}
            </p>
          )}
          {destination && !route && (
            <p role="alert">
              No connected route available, location missing, or outside Aluva. No straight-line
              substitute is shown.
            </p>
          )}
          {route && (
            <p>
              {route.distanceKm} km · {route.walkingMinutes} min walk · Avoids {blocked.size}{" "}
              reported OSM closures
            </p>
          )}
          {selected.member.sos && (
            <section className="resq-card p-3">
              <h2>SOS ACTIVE</h2>
              <p>
                {selected.member.sos.type} · {time(selected.member.sos.at)}
              </p>
              <p>
                {selected.member.sos.id} · Shared SOS summary, not proof of emergency-service
                delivery.
              </p>
            </section>
          )}
          <section className="resq-card p-4">
            <h2 className="font-extrabold">Recent Confirmed Locations</h2>
            <ol>
              {(selected.member.history || []).map((p, i) => (
                <li className="mt-2" key={i}>
                  {p.label} · {time(p.at)}
                  {selected.member.demo ? " · DEMO" : ""}
                </li>
              ))}
            </ol>
            <p className="text-xs">
              At most eight foreground confirmations; not continuous tracking.
            </p>
          </section>
          <section className="resq-card p-4">
            <h2 className="font-extrabold">Important places</h2>
            {(selected.member.places || []).map((p, i) => (
              <p key={i}>
                {p.label} · {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
              </p>
            ))}
            {selected.member.id === family.identity.memberId && (
              <>
                <input
                  aria-label="Place name"
                  className={button + " w-full"}
                  value={placeName}
                  onChange={(e) => setPlaceName(e.target.value)}
                  maxLength={80}
                />
                <button className={button} onClick={() => family.savePlace(placeName)}>
                  Save my confirmed location as place
                </button>
              </>
            )}
          </section>
        </>
      )}
      <OfflineMap
        navigation={{ ...navigation, route, location: mapLocation }}
        hazards={resq.hazards}
        familyMarkers={markers}
        onFamilySelect={(memberId) =>
          void navigate({ to: "/family/$id", params: { id: memberId } })
        }
      />
      <p className="rounded-xl bg-muted p-3 text-xs">
        Routes avoid known reported closures only. Shelter locations are demo candidates, not
        verified evacuation centres. Do not enter danger to attempt a rescue; share information with
        trained responders. There is no live tracking or predictive flood model.
      </p>
    </div>
  );
}
