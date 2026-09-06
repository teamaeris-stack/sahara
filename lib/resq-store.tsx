import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  FALLBACK_LOCATION,
  LAST_LOCATION_KEY,
  SOS_STORAGE_KEY,
  generateSosId,
  isPending,
  parsePackets,
  readCachedLocation,
  writeCachedLocation,
  type SOSDraft,
  type SOSPacket,
} from "./sos";
import {
  HAZARD_REPORTS_KEY,
  SHELTER_CACHE_KEY,
  SEED_HAZARDS,
  SHELTERS,
  parseHazardReports,
  parseShelterCache,
  refreshShelterCache,
  roadMidpoint,
  seedShelterCache,
  type Hazard,
  type HazardKind,
  type RoadKey,
  type ShelterCache,
} from "./shelters";
import {
  FAMILY_KEYS,
  SELF_ID,
  isCheckinRequest,
  isPeerEvent,
  isStatusEvent,
  makeEventId,
  parseList,
  seedFamily,
  type CheckinRequest,
  type PeerWitnessEvent,
  type SafetyStatus,
  type SafetyStatusEvent,
} from "./family";
import {
  COMMUNITY_KEYS,
  REQUEST_TTL_MS,
  REPORT_META,
  REPORT_TTL_MS,
  SELF_HELPER_ID,
  allowedAssistance,
  incomingNearbyRequests,
  isRequestActive,
  isReport,
  isRequest,
  isResponse,
  mapToLatLng,
  newId,
  parseArray,
  placeForRoad,
  requestTypeForSos,
  riskFor,
  seedCommunityReports,
  type AssistanceType,
  type CommunityReport,
  type CommunityRequest,
  type HelperResponse,
  type ReportType,
  type RequestOrigin,
  type RequestType,
} from "./community";
import { clearAlertAcks } from "./siren";
import type { L } from "./i18n";
import { sendSaharaRelayPacket } from "./sahara-relay";

export type NetworkStatus = "ONLINE" | "OFFLINE";
/**
 * NO_RESPONSE = the initial check-in window passed without an answer. It never implies injury.
 * CANNOT_RESPOND is legacy only: readable from old storage, never created by Sahara any more.
 */
export type UserStatus =
  "UNKNOWN" | "SAFE" | "NEEDS_HELP" | "CANNOT_RESPOND" | "NO_RESPONSE" | "AT_SHELTER";
export type SyncNotice = "ready" | "syncing" | "done" | null;

/** Demo data keys. `resq_language` is a user preference and is intentionally NOT listed here. */
export const STORAGE_KEYS = {
  network: "resq_network_status",
  userStatus: "resq_user_status",
  updatedAt: "resq_status_updated_at",
  disasterStartedAt: "resq_disaster_started_at",
  disasterEventId: "resq_disaster_event_id",
  checkinDeadline: "resq_initial_checkin_deadline",
  lastSafetyCheckAt: "resq_last_safety_check_at",
  nextSafetyCheckAt: "resq_next_safety_check_at",
  missedFor: "resq_recheck_missed_for",
  sos: SOS_STORAGE_KEY,
  lastLocation: LAST_LOCATION_KEY,
  lastGuide: "resq_last_guide_category",
  hazards: HAZARD_REPORTS_KEY,
  shelterCache: SHELTER_CACHE_KEY,
  familyEvents: FAMILY_KEYS.events,
  familyPeers: FAMILY_KEYS.peers,
  familyRequests: FAMILY_KEYS.requests,
  familySeededAt: FAMILY_KEYS.seededAt,
  communityRequests: COMMUNITY_KEYS.requests,
  communityResponses: COMMUNITY_KEYS.responses,
  communityReports: COMMUNITY_KEYS.reports,
  communitySeededAt: COMMUNITY_KEYS.seededAt,
} as const;

/** Initial disaster check-in window. */
export const INITIAL_CHECKIN_MS = 90 * 1000;
/** Periodic safety recheck after a SAFE / AT SHELTER check-in. */
export const RECHECK_MS = 10 * 60 * 1000;

const USER_STATUSES: UserStatus[] = [
  "UNKNOWN",
  "SAFE",
  "NEEDS_HELP",
  "CANNOT_RESPOND",
  "NO_RESPONSE",
  "AT_SHELTER",
];

interface ResqState {
  hydrated: boolean;
  networkStatus: NetworkStatus;
  disasterMode: true;
  disasterStartedAt: number | null;
  /** Stable id for the current disaster event (siren acknowledgement, community requests). */
  disasterEventId: string | null;
  initialCheckinDeadline: number | null;
  userStatus: UserStatus;
  statusUpdatedAt: number | null;
  lastSafetyCheckAt: number | null;
  nextSafetyCheckAt: number | null;
  /** True when the 10-minute recheck is due and no new status has been given. */
  recheckDue: boolean;
  packets: SOSPacket[];
  pendingCount: number;
  latestPacket: SOSPacket | null;
  syncing: boolean;
  syncNotice: SyncNotice;
  /** Seeded + user-reported hazards. */
  hazards: Hazard[];
  shelterCache: ShelterCache | null;
  statusEvents: SafetyStatusEvent[];
  peerEvents: PeerWitnessEvent[];
  checkinRequests: CheckinRequest[];
  communityRequests: CommunityRequest[];
  helperResponses: HelperResponse[];
  communityReports: CommunityReport[];
}

export interface CommunityReportInput {
  reportType: ReportType;
  roadKey?: RoadKey | undefined;
  shelterId?: string | undefined;
  requestId?: string | undefined;
  details?: string | undefined;
}

interface ResqActions {
  setNetworkStatus: (status: NetworkStatus) => void;
  /** Only SAFE and NEEDS_HELP can be chosen by the user. */
  setUserStatus: (status: "SAFE" | "NEEDS_HELP") => void;
  markArrivedAtShelter: (shelterId: string) => void;
  createSos: (draft: SOSDraft) => SOSPacket;
  /** One-tap SOS NOW: no questions, never waits for GPS. */
  createDirectSos: () => SOSPacket;
  syncNow: () => void;
  dismissSyncNotice: () => void;
  reportHazard: (kind: HazardKind, roadKey: RoadKey) => void;
  reportOsmHazard: (
    kind: HazardKind,
    osmWayId: string,
    geo: { lat: number; lng: number },
    osmWayName?: string,
    osmCoordinates?: { lat: number; lng: number }[],
  ) => void;
  refreshShelters: () => void;
  addPeerEncounter: (memberId: string, placeId: string) => void;
  requestCheckin: (memberId: string) => void;
  createCommunityRequest: (input: {
    requestType: RequestType;
    origin: RequestOrigin;
    peopleCount?: number;
    subjectMemberId?: string;
  }) => CommunityRequest;
  respondToRequest: (
    requestId: string,
    response: "CAN_ASSIST" | "DECLINED",
    assistanceType?: AssistanceType,
  ) => void;
  submitCommunityReport: (input: CommunityReportInput) => CommunityReport;
  /** Last-seen observation from a nearby safe user → existing peer-witness evidence. */
  reportLastSeen: (requestId: string, roadKey: RoadKey) => void;
  resolveRequest: (requestId: string) => void;
  refreshCommunity: () => void;
  /** Demo only: pretend the latest SAFE check-in happened `minutes` ago. */
  setSafetyCheckAge: (minutes: number) => void;
  resetDemoData: () => void;
}

const ResqContext = createContext<(ResqState & ResqActions) | null>(null);

function num(key: string): number | null {
  const v = localStorage.getItem(key);
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function put(key: string, value: string | number | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, String(value));
  } catch {
    /* ignore */
  }
}

function putJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

function readStorage() {
  const network = localStorage.getItem(STORAGE_KEYS.network);
  const user = localStorage.getItem(STORAGE_KEYS.userStatus);
  return {
    networkStatus: (network === "OFFLINE" ? "OFFLINE" : "ONLINE") as NetworkStatus,
    userStatus: (user && USER_STATUSES.includes(user as UserStatus)
      ? user
      : "UNKNOWN") as UserStatus,
    statusUpdatedAt: num(STORAGE_KEYS.updatedAt),
    disasterStartedAt: num(STORAGE_KEYS.disasterStartedAt),
    disasterEventId: localStorage.getItem(STORAGE_KEYS.disasterEventId),
    checkinDeadline: num(STORAGE_KEYS.checkinDeadline),
    lastSafetyCheckAt: num(STORAGE_KEYS.lastSafetyCheckAt),
    nextSafetyCheckAt: num(STORAGE_KEYS.nextSafetyCheckAt),
    missedFor: num(STORAGE_KEYS.missedFor),
    packets: parsePackets(localStorage.getItem(STORAGE_KEYS.sos)),
    hazardReports: parseHazardReports(localStorage.getItem(STORAGE_KEYS.hazards)),
    shelterCache: parseShelterCache(localStorage.getItem(STORAGE_KEYS.shelterCache)),
    statusEvents: parseList(localStorage.getItem(STORAGE_KEYS.familyEvents), isStatusEvent),
    peerEvents: parseList(localStorage.getItem(STORAGE_KEYS.familyPeers), isPeerEvent),
    checkinRequests: parseList(localStorage.getItem(STORAGE_KEYS.familyRequests), isCheckinRequest),
    familySeededAt: num(STORAGE_KEYS.familySeededAt),
    communityRequests: parseArray(localStorage.getItem(STORAGE_KEYS.communityRequests), isRequest),
    helperResponses: parseArray(localStorage.getItem(STORAGE_KEYS.communityResponses), isResponse),
    communityReports: parseArray(localStorage.getItem(STORAGE_KEYS.communityReports), isReport),
    communitySeededAt: num(STORAGE_KEYS.communitySeededAt),
  };
}

const SELF_LOCATION_LABEL: L = { en: "Near your location", hi: "आपके स्थान के पास" };

function detectedNetworkStatus(): NetworkStatus {
  return typeof navigator !== "undefined" && navigator.onLine === false ? "OFFLINE" : "ONLINE";
}

async function probeNetworkStatus(): Promise<NetworkStatus> {
  if (detectedNetworkStatus() === "OFFLINE") return "OFFLINE";

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 3000);
  try {
    // Same-origin and deliberately bypassed by the service worker. This verifies that
    // the app's server is reachable without relying on Google or another third party.
    const response = await fetch(`/sw.js?__sahara_probe=${Date.now()}`, {
      method: "HEAD",
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    });
    return response.ok ? "ONLINE" : "OFFLINE";
  } catch {
    return "OFFLINE";
  } finally {
    window.clearTimeout(timeout);
  }
}

export function ResqProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [networkStatus, setNetwork] = useState<NetworkStatus>("ONLINE");
  const [userStatus, setUser] = useState<UserStatus>("UNKNOWN");
  const [statusUpdatedAt, setUpdatedAt] = useState<number | null>(null);
  const [disasterStartedAt, setDisasterStartedAt] = useState<number | null>(null);
  const [disasterEventId, setDisasterEventId] = useState<string | null>(null);
  const [initialCheckinDeadline, setDeadline] = useState<number | null>(null);
  const [lastSafetyCheckAt, setLastCheck] = useState<number | null>(null);
  const [nextSafetyCheckAt, setNextCheck] = useState<number | null>(null);
  const [recheckDue, setRecheckDue] = useState(false);
  const [packets, setPackets] = useState<SOSPacket[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState<SyncNotice>(null);
  const [hazardReports, setHazardReports] = useState<Hazard[]>([]);
  const [shelterCache, setShelterCache] = useState<ShelterCache | null>(null);
  const [statusEvents, setStatusEvents] = useState<SafetyStatusEvent[]>([]);
  const [peerEvents, setPeerEvents] = useState<PeerWitnessEvent[]>([]);
  const [checkinRequests, setCheckinRequests] = useState<CheckinRequest[]>([]);
  const [communityRequests, setCommunityRequests] = useState<CommunityRequest[]>([]);
  const [helperResponses, setHelperResponses] = useState<HelperResponse[]>([]);
  const [communityReports, setCommunityReports] = useState<CommunityReport[]>([]);

  const syncingRef = useRef(false);
  const networkRef = useRef<NetworkStatus>("ONLINE");
  const manualNetworkOverrideRef = useRef<NetworkStatus | null>(null);
  networkRef.current = networkStatus;
  const packetsRef = useRef<SOSPacket[]>([]);
  packetsRef.current = packets;
  const eventsRef = useRef<SafetyStatusEvent[]>([]);
  eventsRef.current = statusEvents;
  const peersRef = useRef<PeerWitnessEvent[]>([]);
  peersRef.current = peerEvents;
  const requestsRef = useRef<CheckinRequest[]>([]);
  requestsRef.current = checkinRequests;
  const hazardsRef = useRef<Hazard[]>([]);
  hazardsRef.current = hazardReports;
  const cReqRef = useRef<CommunityRequest[]>([]);
  cReqRef.current = communityRequests;
  const cResRef = useRef<HelperResponse[]>([]);
  cResRef.current = helperResponses;
  const cRepRef = useRef<CommunityReport[]>([]);
  cRepRef.current = communityReports;
  const eventIdRef = useRef<string>("evt-unknown");
  const missedForRef = useRef<number | null>(null);

  // Pure updates only: side effects (storage writes) happen outside React's updater.
  const updatePackets = useCallback((fn: (prev: SOSPacket[]) => SOSPacket[]) => {
    const next = fn(packetsRef.current);
    packetsRef.current = next;
    putJson(STORAGE_KEYS.sos, next);
    setPackets(next);
  }, []);

  const setCReq = useCallback((next: CommunityRequest[]) => {
    cReqRef.current = next;
    putJson(STORAGE_KEYS.communityRequests, next);
    setCommunityRequests(next);
  }, []);
  const setCRes = useCallback((next: HelperResponse[]) => {
    cResRef.current = next;
    putJson(STORAGE_KEYS.communityResponses, next);
    setHelperResponses(next);
  }, []);
  const setCRep = useCallback((next: CommunityReport[]) => {
    cRepRef.current = next;
    putJson(STORAGE_KEYS.communityReports, next);
    setCommunityReports(next);
  }, []);

  const appendEvent = useCallback(
    (status: SafetyStatus, source: SafetyStatusEvent["source"], at: number, placeId?: string) => {
      const online = networkRef.current === "ONLINE";
      const ev: SafetyStatusEvent = {
        clientEventId: makeEventId("evt"),
        memberId: SELF_ID,
        status,
        at,
        source,
        placeId,
        sync: online ? "SYNCED_DEMO" : "QUEUED",
      };
      const next = [...eventsRef.current, ev];
      eventsRef.current = next;
      putJson(STORAGE_KEYS.familyEvents, next);
      setStatusEvents(next);
    },
    [],
  );

  // Read persisted values after mount so server and first client render match.
  useEffect(() => {
    try {
      const stored = readStorage();
      const now = Date.now();
      const detectedNetwork = detectedNetworkStatus();
      networkRef.current = detectedNetwork;
      setNetwork(detectedNetwork);
      put(STORAGE_KEYS.network, detectedNetwork);
      setUser(stored.userStatus);
      setUpdatedAt(stored.statusUpdatedAt);
      setLastCheck(stored.lastSafetyCheckAt);
      setNextCheck(stored.nextSafetyCheckAt);
      missedForRef.current = stored.missedFor;

      let started = stored.disasterStartedAt;
      if (!started) {
        started = now;
        put(STORAGE_KEYS.disasterStartedAt, started);
      }
      setDisasterStartedAt(started);
      let eventId = stored.disasterEventId;
      if (!eventId) {
        eventId = `evt-${started.toString(36)}`;
        put(STORAGE_KEYS.disasterEventId, eventId);
      }
      eventIdRef.current = eventId;
      setDisasterEventId(eventId);
      // Deadline is derived from the persisted start, so a refresh never restarts the countdown.
      let deadline = stored.checkinDeadline;
      if (!deadline) {
        deadline = started + INITIAL_CHECKIN_MS;
        put(STORAGE_KEYS.checkinDeadline, deadline);
      }
      setDeadline(deadline);

      // Shelter cache: seed once, then age in real time.
      let cache = stored.shelterCache;
      if (!cache) {
        cache = seedShelterCache(now);
        putJson(STORAGE_KEYS.shelterCache, cache);
      }
      setShelterCache(cache);
      setHazardReports(stored.hazardReports);

      // Family: seed the fictional household once per demo session.
      let events = stored.statusEvents;
      let peers = stored.peerEvents;
      if (!stored.familySeededAt) {
        const seed = seedFamily(now);
        events = [...seed.events, ...events];
        peers = [...seed.peers, ...peers];
        putJson(STORAGE_KEYS.familyEvents, events);
        putJson(STORAGE_KEYS.familyPeers, peers);
        put(STORAGE_KEYS.familySeededAt, now);
      }
      eventsRef.current = events;
      peersRef.current = peers;
      setStatusEvents(events);
      setPeerEvents(peers);
      setCheckinRequests(stored.checkinRequests);

      // Community: seed the informational feed once; expire anything stale.
      let reports = stored.communityReports;
      if (!stored.communitySeededAt) {
        reports = [...seedCommunityReports(now), ...reports];
        putJson(STORAGE_KEYS.communityReports, reports);
        put(STORAGE_KEYS.communitySeededAt, now);
      }
      const reqs = stored.communityRequests.map((r) =>
        r.expiresAt <= now && (r.status === "ACTIVE" || r.status === "ASSISTANCE_ACCEPTED")
          ? { ...r, status: "EXPIRED" as const }
          : r,
      );
      cReqRef.current = reqs;
      cResRef.current = stored.helperResponses;
      cRepRef.current = reports;
      setCommunityRequests(reqs);
      setHelperResponses(stored.helperResponses);
      setCommunityReports(reports);

      // A packet caught mid-sync by a refresh is resolved by the current network state.
      const online = detectedNetwork === "ONLINE";
      const packets = stored.packets.map((p) =>
        p.deliveryStatus === "SYNCING"
          ? {
              ...p,
              deliveryStatus: online ? ("DELIVERED_DEMO" as const) : ("QUEUED_OFFLINE" as const),
            }
          : p,
      );
      packetsRef.current = packets;
      setPackets(packets);
      if (
        packets.some((p) => p.deliveryStatus === "SYNCING") !==
        stored.packets.some((p) => p.deliveryStatus === "SYNCING")
      ) {
        putJson(STORAGE_KEYS.sos, packets);
      }
    } catch {
      /* storage unavailable: keep defaults */
    }
    setHydrated(true);
  }, []);

  const writeStatus = useCallback((status: UserStatus, now: number) => {
    setUser(status);
    setUpdatedAt(now);
    put(STORAGE_KEYS.userStatus, status);
    put(STORAGE_KEYS.updatedAt, now);
  }, []);

  const scheduleRecheck = useCallback((now: number) => {
    const next = now + RECHECK_MS;
    setLastCheck(now);
    setNextCheck(next);
    setRecheckDue(false);
    missedForRef.current = null;
    put(STORAGE_KEYS.lastSafetyCheckAt, now);
    put(STORAGE_KEYS.nextSafetyCheckAt, next);
    put(STORAGE_KEYS.missedFor, null);
  }, []);

  const clearRecheck = useCallback(() => {
    setNextCheck(null);
    setRecheckDue(false);
    missedForRef.current = null;
    put(STORAGE_KEYS.nextSafetyCheckAt, null);
    put(STORAGE_KEYS.missedFor, null);
  }, []);

  // ---- Community requests created by this device -------------------------------------------

  /** One active request per device: a later, better-documented origin replaces the earlier one. */
  const upsertSelfRequest = useCallback(
    (input: {
      requestType: RequestType;
      origin: RequestOrigin;
      disasterType?: SOSPacket["type"] | null;
      peopleCount?: number;
      peopleRange?: SOSPacket["peopleRange"];
      subjectMemberId?: string;
      sourcePacketId?: string;
    }): CommunityRequest => {
      const now = Date.now();
      const online = networkRef.current === "ONLINE";
      const disasterType = input.disasterType ?? null;
      const existing = cReqRef.current.find(
        (r) =>
          r.requesterId === SELF_HELPER_ID &&
          (r.status === "ACTIVE" || r.status === "ASSISTANCE_ACCEPTED") &&
          r.expiresAt > now &&
          r.requestType !== "MISSING_PERSON_INFO" &&
          input.requestType !== "MISSING_PERSON_INFO",
      );
      const base: CommunityRequest = {
        id: existing?.id ?? newId("creq"),
        clientEventId: newId("creq-evt"),
        disasterEventId: eventIdRef.current,
        requesterId: SELF_HELPER_ID,
        requestType: input.requestType,
        disasterType,
        origin: input.origin,
        ...(() => {
          const cached = readCachedLocation();
          return cached
            ? { approxLatitude: cached.latitude, approxLongitude: cached.longitude }
            : {
                approxLatitude: FALLBACK_LOCATION.latitude,
                approxLongitude: FALLBACK_LOCATION.longitude,
              };
        })(),
        approxLocationLabel: SELF_LOCATION_LABEL,
        peopleCount: input.peopleCount ?? existing?.peopleCount ?? 1,
        peopleRange: input.peopleRange ?? existing?.peopleRange,
        riskLevel: riskFor(disasterType, input.requestType),
        allowedAssistanceTypes: allowedAssistance(disasterType, input.requestType),
        status: existing?.status ?? "ACTIVE",
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        expiresAt: now + REQUEST_TTL_MS,
        subjectMemberId: input.subjectMemberId,
        sourcePacketId: input.sourcePacketId,
        sync: online ? "SYNCED_DEMO" : "QUEUED",
      };
      setCReq(
        existing
          ? cReqRef.current.map((r) => (r.id === existing.id ? base : r))
          : [...cReqRef.current, base],
      );
      return base;
    },
    [setCReq],
  );

  const setUserStatus = useCallback(
    (status: "SAFE" | "NEEDS_HELP") => {
      const now = Date.now();
      writeStatus(status, now);
      appendEvent(status, "SELF_CHECKIN", now, "current");
      if (status === "SAFE") {
        scheduleRecheck(now);
        // The requester is safe again: their own emergency-linked community request is no longer active
        // (missing-person requests are about someone else and stay open).
        const own = cReqRef.current.filter(
          (r) =>
            r.requesterId === SELF_HELPER_ID &&
            r.requestType !== "MISSING_PERSON_INFO" &&
            (r.status === "ACTIVE" || r.status === "ASSISTANCE_ACCEPTED"),
        );
        if (own.length > 0)
          setCReq(
            cReqRef.current.map((r) =>
              own.includes(r) ? { ...r, status: "RESOLVED" as const, updatedAt: now } : r,
            ),
          );
      } else {
        clearRecheck();
        // Family learns immediately; a restricted community request is created (no documentation needed).
        upsertSelfRequest({ requestType: "LOCAL_VERIFICATION", origin: "NEEDS_HELP_STATUS" });
      }
    },
    [writeStatus, appendEvent, scheduleRecheck, clearRecheck, upsertSelfRequest, setCReq],
  );

  const markArrivedAtShelter = useCallback(
    (shelterId: string) => {
      const now = Date.now();
      writeStatus("AT_SHELTER", now);
      appendEvent("AT_SHELTER", "SHELTER_ARRIVAL", now, shelterId);
      scheduleRecheck(now);
    },
    [writeStatus, appendEvent, scheduleRecheck],
  );

  // Initial 90-second check-in: expiry only records "no response yet" — never injury or danger.
  useEffect(() => {
    if (!hydrated || userStatus !== "UNKNOWN" || !initialCheckinDeadline) return;
    const fire = () => {
      const now = Date.now();
      writeStatus("NO_RESPONSE", now);
      appendEvent("NO_RESPONSE", "AUTO_TIMER", now);
    };
    const remaining = initialCheckinDeadline - Date.now();
    if (remaining <= 0) {
      fire();
      return;
    }
    const t = setTimeout(fire, remaining);
    return () => clearTimeout(t);
  }, [hydrated, userStatus, initialCheckinDeadline, writeStatus, appendEvent]);

  // 10-minute recheck: timestamp-driven, re-evaluated on a timer and when the tab becomes visible.
  // A missed recheck records RECHECK_MISSED (never CANNOT_RESPOND); the earlier SAFE event stays in history.
  useEffect(() => {
    if (!hydrated || !nextSafetyCheckAt || (userStatus !== "SAFE" && userStatus !== "AT_SHELTER"))
      return;
    const evaluate = () => {
      if (Date.now() < nextSafetyCheckAt) return false;
      setRecheckDue(true);
      if (missedForRef.current !== nextSafetyCheckAt) {
        missedForRef.current = nextSafetyCheckAt;
        put(STORAGE_KEYS.missedFor, nextSafetyCheckAt);
        appendEvent("RECHECK_MISSED", "AUTO_TIMER", nextSafetyCheckAt);
      }
      return true;
    };
    if (evaluate()) return;
    const t = setTimeout(evaluate, Math.max(0, nextSafetyCheckAt - Date.now()));
    const onVisible = () => {
      if (document.visibilityState === "visible") evaluate();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearTimeout(t);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [hydrated, nextSafetyCheckAt, userStatus, appendEvent]);

  const finishSync = useCallback(
    (ids: string[]) => {
      updatePackets((prev) =>
        prev.map((p) =>
          ids.includes(p.id) && p.deliveryStatus === "SYNCING"
            ? { ...p, deliveryStatus: "DELIVERED_DEMO" }
            : p,
        ),
      );
    },
    [updatePackets],
  );

  /** Marks queued family / hazard / community records as synchronized (prototype). Same clientEventIds — no duplicates. */
  const flushQueues = useCallback(() => {
    const mark = <T extends { sync: "QUEUED" | "SYNCED_DEMO" }>(list: T[]) =>
      list.map((x) => (x.sync === "QUEUED" ? { ...x, sync: "SYNCED_DEMO" as const } : x));
    if (eventsRef.current.some((e) => e.sync === "QUEUED")) {
      const next = mark(eventsRef.current);
      eventsRef.current = next;
      putJson(STORAGE_KEYS.familyEvents, next);
      setStatusEvents(next);
    }
    if (peersRef.current.some((e) => e.sync === "QUEUED")) {
      const next = mark(peersRef.current);
      peersRef.current = next;
      putJson(STORAGE_KEYS.familyPeers, next);
      setPeerEvents(next);
    }
    if (requestsRef.current.some((e) => e.sync === "QUEUED")) {
      const next = mark(requestsRef.current);
      requestsRef.current = next;
      putJson(STORAGE_KEYS.familyRequests, next);
      setCheckinRequests(next);
    }
    if (hazardsRef.current.some((h) => h.sync === "QUEUED")) {
      const next = hazardsRef.current.map((h) =>
        h.sync === "QUEUED" ? { ...h, sync: "SYNCED_DEMO" as const } : h,
      );
      hazardsRef.current = next;
      putJson(STORAGE_KEYS.hazards, next);
      setHazardReports(next);
    }
    if (cReqRef.current.some((r) => r.sync === "QUEUED")) setCReq(mark(cReqRef.current));
    if (cResRef.current.some((r) => r.sync === "QUEUED"))
      setCRes(
        mark(cResRef.current).map((r) =>
          r.status === "PENDING_DELIVERY" ? { ...r, status: "DELIVERED_DEMO" as const } : r,
        ),
      );
    if (cRepRef.current.some((r) => r.sync === "QUEUED")) setCRep(mark(cRepRef.current));
  }, [setCReq, setCRes, setCRep]);

  const applyNetworkStatus = useCallback(
    (status: NetworkStatus) => {
      const wasOffline = networkRef.current === "OFFLINE";
      setNetwork(status);
      put(STORAGE_KEYS.network, status);
      if (status === "ONLINE" && wasOffline) {
        if (packetsRef.current.some(isPending) && !syncingRef.current) setSyncNotice("ready");
        setTimeout(() => {
          if (networkRef.current === "ONLINE") flushQueues();
        }, 900);
      }
      if (status === "OFFLINE") setSyncNotice(null);
    },
    [flushQueues],
  );

  const setNetworkStatus = useCallback(
    (status: NetworkStatus) => {
      manualNetworkOverrideRef.current = status;
      applyNetworkStatus(status);
    },
    [applyNetworkStatus],
  );

  // navigator.onLine can remain true on Windows when an adapter exists but internet access
  // does not. Verify the app origin periodically, bypassing both HTTP and service-worker caches.
  useEffect(() => {
    let active = true;
    let checking = false;

    const updateFromDevice = async (force = false) => {
      if (checking || (!force && manualNetworkOverrideRef.current !== null)) return;
      checking = true;
      const status = await probeNetworkStatus();
      checking = false;
      if (active) applyNetworkStatus(status);
    };
    const handleConnectionChange = () => {
      manualNetworkOverrideRef.current = null;
      void updateFromDevice(true);
    };
    const updateWhenVisible = () => {
      if (document.visibilityState === "visible") void updateFromDevice();
    };

    window.addEventListener("online", handleConnectionChange);
    window.addEventListener("offline", handleConnectionChange);
    document.addEventListener("visibilitychange", updateWhenVisible);
    const interval = window.setInterval(() => void updateFromDevice(), 5000);
    void updateFromDevice();

    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("online", handleConnectionChange);
      window.removeEventListener("offline", handleConnectionChange);
      document.removeEventListener("visibilitychange", updateWhenVisible);
    };
  }, [applyNetworkStatus]);

  /** Simulated delivery for a packet created while online. */
  const simulateDelivery = useCallback(
    (id: string) => {
      setTimeout(
        () => {
          if (networkRef.current === "ONLINE") finishSync([id]);
          else
            updatePackets((prev) =>
              prev.map((p) =>
                p.id === id && p.deliveryStatus === "SYNCING"
                  ? { ...p, deliveryStatus: "QUEUED_OFFLINE" }
                  : p,
              ),
            );
        },
        700 + Math.floor(Math.random() * 500),
      );
    },
    [finishSync, updatePackets],
  );

  const createSos = useCallback(
    (draft: SOSDraft): SOSPacket => {
      const online = networkRef.current === "ONLINE";
      const now = Date.now();
      const packet: SOSPacket = {
        id: generateSosId(packetsRef.current.map((p) => p.id)),
        type: draft.type,
        subType: draft.subType,
        responses:
          draft.responses && Object.keys(draft.responses).length ? draft.responses : undefined,
        peopleCount: draft.peopleCount,
        peopleRange: draft.peopleRange,
        flags: draft.flags,
        latitude: draft.latitude,
        longitude: draft.longitude,
        locationLabel: draft.locationLabel,
        description: draft.description?.trim() || undefined,
        createdAt: new Date(now).toISOString(),
        priority: "P0",
        deliveryStatus: online ? "SYNCING" : "QUEUED_OFFLINE",
        source: "DIRECT_USER_REPORT",
        hopCount: 0,
      };
      updatePackets((prev) => [...prev, packet]);
      void sendSaharaRelayPacket(packet);
      if (draft.locationLabel !== FALLBACK_LOCATION.label)
        writeCachedLocation(draft.latitude, draft.longitude);
      // A missing-person report is about someone else; every other SOS means this user needs help.
      if (draft.type !== "MISSING_PERSON") {
        writeStatus("NEEDS_HELP", now);
        appendEvent("NEEDS_HELP", "SELF_SOS", now, "current");
        clearRecheck();
      }
      // Documented emergency → community request with safe, situation-specific actions.
      upsertSelfRequest({
        requestType: requestTypeForSos(packet),
        origin: draft.type === "MISSING_PERSON" ? "MISSING_PERSON" : "DOCUMENTED_SOS",
        disasterType: packet.type,
        peopleCount: packet.peopleCount,
        peopleRange: packet.peopleRange,
        ...(draft.subjectMemberId ? { subjectMemberId: draft.subjectMemberId } : {}),
        sourcePacketId: packet.id,
      });
      if (online) simulateDelivery(packet.id);
      return packet;
    },
    [simulateDelivery, updatePackets, writeStatus, appendEvent, clearRecheck, upsertSelfRequest],
  );

  /**
   * SOS NOW. Location priority: cached device location → last-known Sahara location → demo fallback.
   * The packet is created synchronously; a fresh browser fix (if it arrives within a few seconds) updates it afterwards.
   */
  const createDirectSos = useCallback((): SOSPacket => {
    const online = networkRef.current === "ONLINE";
    const now = Date.now();
    const cached = readCachedLocation();
    const packet: SOSPacket = {
      id: generateSosId(packetsRef.current.map((p) => p.id)),
      type: "URGENT_UNSPECIFIED",
      subType: undefined,
      peopleCount: 1,
      flags: [],
      latitude: cached?.latitude ?? FALLBACK_LOCATION.latitude,
      longitude: cached?.longitude ?? FALLBACK_LOCATION.longitude,
      locationLabel: cached ? "Last known location" : FALLBACK_LOCATION.label,
      createdAt: new Date(now).toISOString(),
      priority: "P0",
      deliveryStatus: online ? "SYNCING" : "QUEUED_OFFLINE",
      source: "DIRECT_SOS_BUTTON",
      hopCount: 0,
    };
    updatePackets((prev) => [...prev, packet]);
    void sendSaharaRelayPacket(packet);
    writeStatus("NEEDS_HELP", now);
    appendEvent("NEEDS_HELP", "SELF_SOS", now, "current");
    clearRecheck();
    // Restricted community alert: civilians are asked only to observe / share information.
    upsertSelfRequest({
      requestType: "URGENT_UNKNOWN",
      origin: "DIRECT_SOS",
      disasterType: "URGENT_UNSPECIFIED",
      sourcePacketId: packet.id,
    });
    if (online) simulateDelivery(packet.id);

    // Best-effort improvement of the attached location; never blocks creation.
    try {
      if (typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            writeCachedLocation(pos.coords.latitude, pos.coords.longitude);
            updatePackets((prev) =>
              prev.map((p) =>
                p.id === packet.id
                  ? {
                      ...p,
                      latitude: pos.coords.latitude,
                      longitude: pos.coords.longitude,
                      locationLabel: "Current location",
                    }
                  : p,
              ),
            );
          },
          () => {
            /* keep the location already attached */
          },
          { timeout: 5000, maximumAge: 60_000 },
        );
      }
    } catch {
      /* ignore */
    }
    return packet;
  }, [simulateDelivery, updatePackets, writeStatus, appendEvent, clearRecheck, upsertSelfRequest]);

  const syncNow = useCallback(() => {
    if (syncingRef.current || networkRef.current !== "ONLINE") return;
    const ids = packetsRef.current
      .filter((p) => p.deliveryStatus === "QUEUED_OFFLINE")
      .map((p) => p.id);
    if (ids.length === 0) {
      flushQueues();
      setSyncNotice(null);
      return;
    }
    updatePackets((prev) =>
      prev.map((p) => (ids.includes(p.id) ? { ...p, deliveryStatus: "SYNCING" as const } : p)),
    );
    syncingRef.current = true;
    setSyncing(true);
    setSyncNotice("syncing");
    setTimeout(() => {
      finishSync(ids);
      flushQueues();
      syncingRef.current = false;
      setSyncing(false);
      setSyncNotice("done");
      setTimeout(() => setSyncNotice((n) => (n === "done" ? null : n)), 5000);
    }, 1500);
  }, [finishSync, updatePackets, flushQueues]);

  const dismissSyncNotice = useCallback(() => setSyncNotice(null), []);

  // Route problems: stored locally first, applied to routing immediately, queued for sync.
  const reportHazard = useCallback((kind: HazardKind, roadKey: RoadKey) => {
    const online = networkRef.current === "ONLINE";
    const h: Hazard = {
      id: makeEventId("hz"),
      clientEventId: makeEventId("hzevt"),
      kind,
      roadKey,
      pos: roadMidpoint(roadKey),
      reported: true,
      reportedAt: Date.now(),
      sync: online ? "SYNCED_DEMO" : "QUEUED",
    };
    const next = [...hazardsRef.current, h];
    hazardsRef.current = next;
    putJson(STORAGE_KEYS.hazards, next);
    setHazardReports(next);
  }, []);

  const reportOsmHazard = useCallback(
    (
      kind: HazardKind,
      osmWayId: string,
      geo: { lat: number; lng: number },
      osmWayName?: string,
      osmCoordinates?: { lat: number; lng: number }[],
    ) => {
      const online = networkRef.current === "ONLINE";
      const h: Hazard = {
        id: makeEventId("hz"),
        clientEventId: makeEventId("hzevt"),
        kind,
        osmWayId,
        ...(osmWayName ? { osmWayName } : {}),
        ...(osmCoordinates ? { osmCoordinates: osmCoordinates.map(({ lat, lng }) => ({ lat, lng })) } : {}),
        closureRadiusM: 0,
        geo,
        // Retained for the legacy mini-map; the real map uses geo.
        pos: { x: 50, y: 50 },
        reported: true,
        reportedAt: Date.now(),
        sync: online ? "SYNCED_DEMO" : "QUEUED",
      };
      const next = [...hazardsRef.current, h];
      hazardsRef.current = next;
      putJson(STORAGE_KEYS.hazards, next);
      setHazardReports(next);
    },
    [],
  );

  const refreshShelters = useCallback(() => {
    if (networkRef.current !== "ONLINE") return;
    setShelterCache((prev) => {
      const next = refreshShelterCache(prev ?? seedShelterCache());
      putJson(STORAGE_KEYS.shelterCache, next);
      return next;
    });
  }, []);

  const addPeerEvidence = useCallback(
    (memberId: string, placeId: string, source: PeerWitnessEvent["source"]) => {
      const online = networkRef.current === "ONLINE";
      const ev: PeerWitnessEvent = {
        clientEventId: makeEventId("peer"),
        subjectMemberId: memberId,
        encounteredAt: Date.now(),
        placeId,
        source,
        sync: online ? "SYNCED_DEMO" : "QUEUED",
      };
      const next = [...peersRef.current, ev];
      peersRef.current = next;
      putJson(STORAGE_KEYS.familyPeers, next);
      setPeerEvents(next);
    },
    [],
  );

  const addPeerEncounter = useCallback(
    (memberId: string, placeId: string) => addPeerEvidence(memberId, placeId, "SIMULATED_PEER"),
    [addPeerEvidence],
  );

  const requestCheckin = useCallback((memberId: string) => {
    const online = networkRef.current === "ONLINE";
    const r: CheckinRequest = {
      clientEventId: makeEventId("req"),
      memberId,
      requestedAt: Date.now(),
      sync: online ? "SYNCED_DEMO" : "QUEUED",
    };
    const next = [...requestsRef.current, r];
    requestsRef.current = next;
    putJson(STORAGE_KEYS.familyRequests, next);
    setCheckinRequests(next);
  }, []);

  // ---- Community actions -------------------------------------------------------------------

  const createCommunityRequest = useCallback(
    (input: {
      requestType: RequestType;
      origin: RequestOrigin;
      peopleCount?: number;
      subjectMemberId?: string;
    }) =>
      upsertSelfRequest({
        requestType: input.requestType,
        origin: input.origin,
        ...(input.peopleCount !== undefined ? { peopleCount: input.peopleCount } : {}),
        ...(input.subjectMemberId ? { subjectMemberId: input.subjectMemberId } : {}),
      }),
    [upsertSelfRequest],
  );

  const respondToRequest = useCallback(
    (requestId: string, response: "CAN_ASSIST" | "DECLINED", assistanceType?: AssistanceType) => {
      const online = networkRef.current === "ONLINE";
      const now = Date.now();
      const r: HelperResponse = {
        id: newId("hres"),
        clientEventId: newId("hres-evt"),
        requestId,
        helperId: SELF_HELPER_ID,
        response,
        assistanceType,
        createdAt: now,
        status: online ? "DELIVERED_DEMO" : "PENDING_DELIVERY",
        sync: online ? "SYNCED_DEMO" : "QUEUED",
      };
      setCRes([...cResRef.current, r]);
      if (response === "CAN_ASSIST") {
        setCReq(
          cReqRef.current.map((q) =>
            q.id === requestId && q.status === "ACTIVE"
              ? { ...q, status: "ASSISTANCE_ACCEPTED", updatedAt: now }
              : q,
          ),
        );
      }
    },
    [setCReq, setCRes],
  );

  const submitCommunityReport = useCallback(
    (input: CommunityReportInput): CommunityReport => {
      const online = networkRef.current === "ONLINE";
      const now = Date.now();
      const shelter = input.shelterId ? SHELTERS.find((s) => s.id === input.shelterId) : undefined;
      const pos = shelter
        ? mapToLatLng(shelter.pos)
        : input.roadKey
          ? mapToLatLng(roadMidpoint(input.roadKey))
          : { latitude: FALLBACK_LOCATION.latitude, longitude: FALLBACK_LOCATION.longitude };
      const label: L = shelter
        ? shelter.name
        : input.roadKey
          ? ROAD_LABELS[input.roadKey]
          : SELF_LOCATION_LABEL;
      const report: CommunityReport = {
        id: newId("crep"),
        clientEventId: newId("crep-evt"),
        reporterId: SELF_HELPER_ID,
        reportType: input.reportType,
        latitude: pos.latitude,
        longitude: pos.longitude,
        locationLabel: label,
        roadKey: input.roadKey,
        shelterId: input.shelterId,
        details: input.details?.trim() || undefined,
        createdAt: now,
        status: "ACTIVE",
        requestId: input.requestId,
        sync: online ? "SYNCED_DEMO" : "QUEUED",
      };
      setCRep([...cRepRef.current, report]);
      // Route integration: road hazards flow into the EXISTING hazard repository → routes recalculate.
      const hazard = REPORT_META[input.reportType].hazard;
      if (hazard && input.roadKey) reportHazard(hazard, input.roadKey);
      return report;
    },
    [setCRep, reportHazard],
  );

  const reportLastSeen = useCallback(
    (requestId: string, roadKey: RoadKey) => {
      const req = cReqRef.current.find((r) => r.id === requestId);
      // Peer-witness integration: the observation lands in the same evidence trail the Family tab already reads.
      if (req?.subjectMemberId)
        addPeerEvidence(req.subjectMemberId, placeForRoad(roadKey), "COMMUNITY_WITNESS");
    },
    [addPeerEvidence],
  );

  const resolveRequest = useCallback(
    (requestId: string) => {
      const now = Date.now();
      setCReq(
        cReqRef.current.map((q) =>
          q.id === requestId ? { ...q, status: "RESOLVED", updatedAt: now } : q,
        ),
      );
    },
    [setCReq],
  );

  /**
   * Expires stale community records. When a delivery path exists it also flushes the queue,
   * receives nearby requests for this disaster event (once), and lets peer responses arrive
   * for this device's own synced request. Timestamp-driven: safe to call from any screen.
   */
  const refreshCommunity = useCallback(() => {
    const now = Date.now();
    let reqs = cReqRef.current;
    if (
      reqs.some(
        (r) => (r.status === "ACTIVE" || r.status === "ASSISTANCE_ACCEPTED") && r.expiresAt <= now,
      )
    ) {
      reqs = reqs.map((r) =>
        (r.status === "ACTIVE" || r.status === "ASSISTANCE_ACCEPTED") && r.expiresAt <= now
          ? { ...r, status: "EXPIRED" as const }
          : r,
      );
    }
    if (cRepRef.current.some((r) => r.status === "ACTIVE" && now - r.createdAt >= REPORT_TTL_MS)) {
      setCRep(
        cRepRef.current.map((r) =>
          r.status === "ACTIVE" && now - r.createdAt >= REPORT_TTL_MS
            ? { ...r, status: "EXPIRED" as const }
            : r,
        ),
      );
    }
    if (networkRef.current === "ONLINE") {
      // Incoming nearby requests — same ids on every receive, so nothing duplicates.
      const incoming = incomingNearbyRequests(eventIdRef.current, now).filter(
        (n) => !reqs.some((r) => r.id === n.id),
      );
      if (incoming.length > 0) reqs = [...reqs, ...incoming];
      // A peer response to our own synced request (prototype backend) ~30 s after it was shared.
      const own = reqs.find(
        (r) =>
          r.requesterId === SELF_HELPER_ID &&
          isRequestActive(r, now) &&
          r.sync === "SYNCED_DEMO" &&
          now - r.updatedAt > 30_000,
      );
      const peerId = own ? `hres-peer-${own.id}` : null;
      if (own && peerId && !cResRef.current.some((r) => r.id === peerId)) {
        const at = Math.min(now, own.updatedAt + 30_000);
        setCRes([
          ...cResRef.current,
          {
            id: peerId,
            clientEventId: `${peerId}-evt`,
            requestId: own.id,
            helperId: "peer-nearby",
            response: "CAN_ASSIST",
            assistanceType: "SHARE_ROUTE_INFO",
            createdAt: at,
            status: "DELIVERED_DEMO",
            sync: "SYNCED_DEMO",
          },
        ]);
      }
    }
    if (reqs !== cReqRef.current) setCReq(reqs);
    if (networkRef.current === "ONLINE") flushQueues();
  }, [setCReq, setCRes, setCRep, flushQueues]);

  const setSafetyCheckAge = useCallback(
    (minutes: number) => {
      const at = Date.now() - minutes * 60_000;
      const next = at + RECHECK_MS;
      if (userStatus !== "SAFE" && userStatus !== "AT_SHELTER") {
        writeStatus("SAFE", at);
        appendEvent("SAFE", "SELF_CHECKIN", at, "current");
      } else {
        setUpdatedAt(at);
        put(STORAGE_KEYS.updatedAt, at);
        // Move the latest own SAFE event so Family freshness agrees with the demo age.
        const evs = eventsRef.current.filter(
          (e) => e.memberId === SELF_ID && (e.status === "SAFE" || e.status === "AT_SHELTER"),
        );
        const last = evs[evs.length - 1];
        if (last) {
          const updated = eventsRef.current
            .filter(
              (e) => !(e.memberId === SELF_ID && e.status === "RECHECK_MISSED" && e.at > last.at),
            )
            .map((e) => (e === last ? { ...e, at } : e));
          eventsRef.current = updated;
          putJson(STORAGE_KEYS.familyEvents, updated);
          setStatusEvents(updated);
        }
      }
      setLastCheck(at);
      setNextCheck(next);
      setRecheckDue(false);
      missedForRef.current = null;
      put(STORAGE_KEYS.lastSafetyCheckAt, at);
      put(STORAGE_KEYS.nextSafetyCheckAt, next);
      put(STORAGE_KEYS.missedFor, null);
    },
    [userStatus, writeStatus, appendEvent],
  );

  // Clears demo data only; `resq_language` is a user preference and is preserved.
  const resetDemoData = useCallback(() => {
    const now = Date.now();
    const eventId = `evt-${now.toString(36)}`;
    try {
      Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
      localStorage.setItem(STORAGE_KEYS.network, "ONLINE");
      localStorage.setItem(STORAGE_KEYS.disasterStartedAt, String(now));
      localStorage.setItem(STORAGE_KEYS.disasterEventId, eventId);
      localStorage.setItem(STORAGE_KEYS.checkinDeadline, String(now + INITIAL_CHECKIN_MS));
    } catch {
      /* ignore */
    }
    clearAlertAcks();
    const seed = seedFamily(now);
    const cache = seedShelterCache(now);
    const reports = seedCommunityReports(now);
    putJson(STORAGE_KEYS.familyEvents, seed.events);
    putJson(STORAGE_KEYS.familyPeers, seed.peers);
    put(STORAGE_KEYS.familySeededAt, now);
    putJson(STORAGE_KEYS.shelterCache, cache);
    putJson(STORAGE_KEYS.communityReports, reports);
    put(STORAGE_KEYS.communitySeededAt, now);
    setNetwork("ONLINE");
    setUser("UNKNOWN");
    setUpdatedAt(null);
    setDisasterStartedAt(now);
    eventIdRef.current = eventId;
    setDisasterEventId(eventId);
    setDeadline(now + INITIAL_CHECKIN_MS);
    setLastCheck(null);
    setNextCheck(null);
    setRecheckDue(false);
    missedForRef.current = null;
    packetsRef.current = [];
    setPackets([]);
    setSyncNotice(null);
    hazardsRef.current = [];
    setHazardReports([]);
    setShelterCache(cache);
    eventsRef.current = seed.events;
    peersRef.current = seed.peers;
    requestsRef.current = [];
    setStatusEvents(seed.events);
    setPeerEvents(seed.peers);
    setCheckinRequests([]);
    cReqRef.current = [];
    cResRef.current = [];
    cRepRef.current = reports;
    setCommunityRequests([]);
    setHelperResponses([]);
    setCommunityReports(reports);
  }, []);

  const hazards = useMemo(() => [...SEED_HAZARDS, ...hazardReports], [hazardReports]);

  const value = useMemo(() => {
    const pendingCount = packets.filter(isPending).length;
    const latestPacket = packets[packets.length - 1] ?? null;
    return {
      hydrated,
      networkStatus,
      disasterMode: true as const,
      disasterStartedAt,
      disasterEventId,
      initialCheckinDeadline,
      userStatus,
      statusUpdatedAt,
      lastSafetyCheckAt,
      nextSafetyCheckAt,
      recheckDue,
      packets,
      pendingCount,
      latestPacket,
      syncing,
      syncNotice,
      hazards,
      shelterCache,
      statusEvents,
      peerEvents,
      checkinRequests,
      communityRequests,
      helperResponses,
      communityReports,
      setNetworkStatus,
      setUserStatus,
      markArrivedAtShelter,
      createSos,
      createDirectSos,
      syncNow,
      dismissSyncNotice,
      reportHazard,
      reportOsmHazard,
      refreshShelters,
      addPeerEncounter,
      requestCheckin,
      createCommunityRequest,
      respondToRequest,
      submitCommunityReport,
      reportLastSeen,
      resolveRequest,
      refreshCommunity,
      setSafetyCheckAge,
      resetDemoData,
    };
  }, [
    hydrated,
    networkStatus,
    disasterStartedAt,
    disasterEventId,
    initialCheckinDeadline,
    userStatus,
    statusUpdatedAt,
    lastSafetyCheckAt,
    nextSafetyCheckAt,
    recheckDue,
    packets,
    syncing,
    syncNotice,
    hazards,
    shelterCache,
    statusEvents,
    peerEvents,
    checkinRequests,
    communityRequests,
    helperResponses,
    communityReports,
    setNetworkStatus,
    setUserStatus,
    markArrivedAtShelter,
    createSos,
    createDirectSos,
    syncNow,
    dismissSyncNotice,
    reportHazard,
    reportOsmHazard,
    refreshShelters,
    addPeerEncounter,
    requestCheckin,
    createCommunityRequest,
    respondToRequest,
    submitCommunityReport,
    reportLastSeen,
    resolveRequest,
    refreshCommunity,
    setSafetyCheckAge,
    resetDemoData,
  ]);

  return <ResqContext.Provider value={value}>{children}</ResqContext.Provider>;
}

const ROAD_LABELS: Record<RoadKey, L> = {
  mainRoad: { en: "Main Road", hi: "मुख्य सड़क" },
  schoolRoad: { en: "School Road", hi: "स्कूल रोड" },
  templeRoad: { en: "Temple Road", hi: "मंदिर रोड" },
  northStreet: { en: "North Street", hi: "नॉर्थ स्ट्रीट" },
  eastStreet: { en: "East Street", hi: "ईस्ट स्ट्रीट" },
  stationRoad: { en: "Station Road", hi: "स्टेशन रोड" },
};

export function useResq() {
  const ctx = useContext(ResqContext);
  if (!ctx) throw new Error("useResq must be used inside ResqProvider");
  return ctx;
}

/** Ticks once per second (only where a countdown is rendered). */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    const onVisible = () => setNow(Date.now());
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [intervalMs]);
  return now;
}

/** mm:ss, clamped at 00:00. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function formatTime(ts: number | string | null): string {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
