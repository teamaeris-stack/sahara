import type { L } from "./i18n";
import type { Point } from "./shelters";

/**
 * Family Safety data model — local-first. Every syncable record carries a
 * clientEventId so retries never create duplicates. Peer encounters are
 * SIMULATED in this web prototype (no Bluetooth); a future relay writes real
 * encounters into the same event shape.
 */

export type SafetyStatus = "SAFE" | "NEEDS_HELP" | "CANNOT_RESPOND" | "NO_RESPONSE" | "RECHECK_MISSED" | "AT_SHELTER";
export type EventSource = "SELF_CHECKIN" | "SELF_SOS" | "AUTO_TIMER" | "SHELTER_ARRIVAL" | "SIMULATED_PEER" | "COMMUNITY_WITNESS" | "DEMO_SEED";
/** Legacy: CANNOT_RESPOND is only ever read from old stored records — Sahara no longer creates it. */
export type SyncState = "QUEUED" | "SYNCED_DEMO";

export interface SafetyStatusEvent {
  clientEventId: string;
  memberId: string; // "self" for this device
  status: SafetyStatus;
  at: number;
  source: EventSource;
  placeId?: string | undefined;
  sync: SyncState;
}

export interface PeerWitnessEvent {
  clientEventId: string;
  subjectMemberId: string;
  encounteredAt: number;
  placeId: string;
  /** SIMULATED_PEER = demo control; COMMUNITY_WITNESS = a nearby safe user's last-seen report (Phase 6). */
  source: "SIMULATED_PEER" | "COMMUNITY_WITNESS";
  sync: SyncState;
}

export interface CheckinRequest {
  clientEventId: string;
  memberId: string;
  requestedAt: number;
  sync: SyncState;
}

export interface FamilyMember {
  id: string;
  name: L;
  relation: L;
  /** Used to prefill the Missing Person SOS. */
  personType: "CHILD" | "ELDERLY" | "ADULT";
}

export interface FamilyPlace {
  id: string;
  name: L;
  pos: Point;
  /** Shelter id when this place is a shelter. */
  shelterId?: string;
}

export const FAMILY_KEYS = {
  events: "resq_family_status_events",
  peers: "resq_family_peer_events",
  requests: "resq_family_checkin_requests",
  seededAt: "resq_family_seeded_at",
} as const;

export const RECENT_MS = 10 * 60_000;
export const OVERDUE_MS = 20 * 60_000;

export const SELF_ID = "self";

export const FAMILY_MEMBERS: FamilyMember[] = [
  { id: "dad", name: { en: "Dad", hi: "पापा" }, relation: { en: "Father", hi: "पिता" }, personType: "ADULT" },
  { id: "mom", name: { en: "Mom", hi: "माँ" }, relation: { en: "Mother", hi: "माँ" }, personType: "ADULT" },
];

export const FAMILY_PLACES: FamilyPlace[] = [
  { id: "govt-school", shelterId: "govt-school", name: { en: "Government School Relief Shelter", hi: "सरकारी स्कूल राहत आश्रय" }, pos: { x: 24, y: 40 } },
  { id: "community-hall", shelterId: "community-hall", name: { en: "Community Hall Shelter", hi: "सामुदायिक भवन आश्रय" }, pos: { x: 80, y: 62 } },
  { id: "phc", shelterId: "phc", name: { en: "Primary Health Centre Safe Point", hi: "प्राथमिक स्वास्थ्य केंद्र" }, pos: { x: 64, y: 36 } },
  { id: "open-ground", shelterId: "open-ground", name: { en: "Open Ground Safe Zone", hi: "खुला मैदान सुरक्षित क्षेत्र" }, pos: { x: 34, y: 74 } },
  { id: "market-road", name: { en: "Market Road", hi: "मार्केट रोड" }, pos: { x: 50, y: 56 } },
  { id: "north-evac", name: { en: "North Evacuation Route", hi: "उत्तरी निकासी मार्ग" }, pos: { x: 24, y: 58 } },
  { id: "school-area", name: { en: "Government School Area", hi: "सरकारी स्कूल क्षेत्र" }, pos: { x: 30, y: 46 } },
  { id: "phc-road", name: { en: "Health Centre Road", hi: "स्वास्थ्य केंद्र रोड" }, pos: { x: 64, y: 44 } },
  { id: "low-area", name: { en: "Riverside Low Area (flood zone)", hi: "नदी किनारे निचला क्षेत्र (बाढ़ क्षेत्र)" }, pos: { x: 70, y: 90 } },
  { id: "current", name: { en: "Current location", hi: "वर्तमान स्थान" }, pos: { x: 50, y: 88 } },
];

/** Places offered by the SIMULATE PEER ENCOUNTER demo control. */
export const PEER_DEMO_PLACES = ["market-road", "north-evac", "school-area", "phc-road"] as const;

export function findPlace(id: string | undefined): FamilyPlace | null {
  return FAMILY_PLACES.find((p) => p.id === id) ?? null;
}

export function findMember(id: string | undefined): FamilyMember | null {
  return FAMILY_MEMBERS.find((m) => m.id === id) ?? null;
}

export function makeEventId(prefix: string): string {
  const rnd = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${rnd}`;
}

/** Fictional natural-disaster scenario, seeded relative to `now`. */
export function seedFamily(now: number): { events: SafetyStatusEvent[]; peers: PeerWitnessEvent[] } {
  const m = (min: number) => now - min * 60_000;
  const ev = (memberId: string, status: SafetyStatus, min: number, placeId?: string): SafetyStatusEvent => ({
    clientEventId: `seed-${memberId}-${status}-${min}`,
    memberId,
    status,
    at: m(min),
    source: "DEMO_SEED",
    placeId,
    sync: "SYNCED_DEMO",
  });
  const events: SafetyStatusEvent[] = [
    // Aisha — flood evacuation, safe at the school shelter.
    ev("dad", "SAFE", 34, "low-area"),
    ev("dad", "SAFE", 24, "market-road"),
    ev("dad", "SAFE", 14, "govt-school"),
    ev("dad", "SAFE", 4, "govt-school"),
    // Amma — reached the cyclone shelter.
    ev("mom", "SAFE", 28, "current"),
    ev("mom", "AT_SHELTER", 8, "community-hall"),
    // Rahul — checked safe at the earthquake assembly point, then missed the recheck.
    // Sameer — last direct update 24 min ago, moving along the flood evacuation route.
  ];
  const peers: PeerWitnessEvent[] = [
    { clientEventId: "seed-peer-dad-1", subjectMemberId: "dad", encounteredAt: m(17), placeId: "market-road", source: "SIMULATED_PEER", sync: "SYNCED_DEMO" },
    { clientEventId: "seed-peer-dad-2", subjectMemberId: "dad", encounteredAt: m(7), placeId: "north-evac", source: "SIMULATED_PEER", sync: "SYNCED_DEMO" },
  ];
  return { events, peers };
}

export function parseList<T>(raw: string | null, guard: (v: unknown) => v is T): T[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    return Array.isArray(data) ? data.filter(guard) : [];
  } catch {
    return [];
  }
}

export const isStatusEvent = (v: unknown): v is SafetyStatusEvent => {
  if (!v || typeof v !== "object") return false;
  const e = v as Partial<SafetyStatusEvent>;
  return typeof e.clientEventId === "string" && typeof e.memberId === "string" && typeof e.status === "string" && typeof e.at === "number";
};
export const isPeerEvent = (v: unknown): v is PeerWitnessEvent => {
  if (!v || typeof v !== "object") return false;
  const e = v as Partial<PeerWitnessEvent>;
  return typeof e.clientEventId === "string" && typeof e.subjectMemberId === "string" && typeof e.encounteredAt === "number" && typeof e.placeId === "string";
};
export const isCheckinRequest = (v: unknown): v is CheckinRequest => {
  if (!v || typeof v !== "object") return false;
  const e = v as Partial<CheckinRequest>;
  return typeof e.clientEventId === "string" && typeof e.memberId === "string" && typeof e.requestedAt === "number";
};

// ---------------------------------------------------------------------------
// Derived family status
// ---------------------------------------------------------------------------

export type DisplayStatus =
  | "SAFE_RECENT"
  | "NEEDS_HELP"
  | "CANNOT_RESPOND"
  | "RECHECK_OVERDUE"
  | "NO_RESPONSE_YET"
  | "AT_SHELTER"
  | "NO_RECENT_CONTACT"
  | "UNKNOWN";

export interface EvidencePoint {
  kind: "CHECKIN" | "PEER";
  at: number;
  placeId: string;
  status?: SafetyStatus;
}

export interface MemberView {
  memberId: string;
  display: DisplayStatus;
  lastEvent: SafetyStatusEvent | null;
  lastSafeAt: number | null;
  lastPeer: PeerWitnessEvent | null;
  /** Most recent evidence of any kind (drives "last update"). */
  latestAt: number | null;
  lastPlaceId: string | null;
  source: EventSource | null;
  /** Chronological evidence trail (oldest → newest). */
  trail: EvidencePoint[];
  /** Estimated heading from the last two trail points, if any. */
  heading: "N" | "S" | "E" | "W" | null;
  stale: boolean;
}

/**
 * Freshness-aware status. A SAFE update older than the 10-minute recheck window
 * is no longer shown as confidently current; the SAFE event itself is preserved.
 */
export function deriveMember(memberId: string, events: SafetyStatusEvent[], peers: PeerWitnessEvent[], now: number, opts?: { initialPending?: boolean }): MemberView {
  const mine = events.filter((e) => e.memberId === memberId).sort((a, b) => a.at - b.at);
  const myPeers = peers.filter((p) => p.subjectMemberId === memberId).sort((a, b) => a.encounteredAt - b.encounteredAt);
  const last = mine[mine.length - 1] ?? null;
  const lastPeer = myPeers[myPeers.length - 1] ?? null;
  const lastSafe = [...mine].reverse().find((e) => e.status === "SAFE" || e.status === "AT_SHELTER") ?? null;

  const trail: EvidencePoint[] = [
    ...mine.filter((e) => e.placeId).map((e): EvidencePoint => ({ kind: "CHECKIN", at: e.at, placeId: e.placeId!, status: e.status })),
    ...myPeers.map((p): EvidencePoint => ({ kind: "PEER", at: p.encounteredAt, placeId: p.placeId })),
  ].sort((a, b) => a.at - b.at);

  const latestAt = Math.max(last?.at ?? 0, lastPeer?.encounteredAt ?? 0) || null;
  const age = last ? now - last.at : Infinity;

  let display: DisplayStatus = "UNKNOWN";
  if (!last) display = opts?.initialPending ? "NO_RESPONSE_YET" : "UNKNOWN";
  else if (last.status === "NEEDS_HELP") display = "NEEDS_HELP";
  else if (last.status === "CANNOT_RESPOND") display = "CANNOT_RESPOND";
  else if (last.status === "NO_RESPONSE") display = "NO_RESPONSE_YET";
  else if (last.status === "RECHECK_MISSED") display = age < OVERDUE_MS ? "RECHECK_OVERDUE" : "NO_RECENT_CONTACT";
  else if (last.status === "AT_SHELTER") display = age < OVERDUE_MS ? "AT_SHELTER" : "NO_RECENT_CONTACT";
  else if (last.status === "SAFE") display = age < RECENT_MS ? "SAFE_RECENT" : age < OVERDUE_MS ? "RECHECK_OVERDUE" : "NO_RECENT_CONTACT";

  const lastPlaceId = trail[trail.length - 1]?.placeId ?? null;
  const source: EventSource | null = trail[trail.length - 1]?.kind === "PEER" ? (lastPeer?.source ?? "SIMULATED_PEER") : (last?.source ?? null);

  let heading: MemberView["heading"] = null;
  if (trail.length >= 2) {
    const a = findPlace(trail[trail.length - 2]!.placeId)?.pos;
    const b = findPlace(trail[trail.length - 1]!.placeId)?.pos;
    if (a && b) {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      heading = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "E" : "W") : dy > 0 ? "S" : "N";
    }
  }

  return {
    memberId,
    display,
    lastEvent: last,
    lastSafeAt: lastSafe?.at ?? null,
    lastPeer,
    latestAt,
    lastPlaceId,
    source,
    trail,
    heading,
    stale: display === "NO_RECENT_CONTACT" || display === "RECHECK_OVERDUE" || display === "NO_RESPONSE_YET",
  };
}

export function minutesAgo(ts: number | null, now: number): number | null {
  return ts === null ? null : Math.max(0, Math.round((now - ts) / 60_000));
}

/** Map minutes-ago into the Missing Person "last seen" enum. */
export function lastSeenBucket(min: number | null): string {
  if (min === null) return "UNSURE";
  if (min < 15) return "LT_15_MIN";
  if (min <= 60) return "15_60_MIN";
  if (min <= 180) return "1_3_HOURS";
  return "GT_3_HOURS";
}

export function headingValue(h: MemberView["heading"]): string {
  return h === "N" ? "NORTH" : h === "S" ? "SOUTH" : h === "E" ? "EAST" : h === "W" ? "WEST" : "UNKNOWN";
}
