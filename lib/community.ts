import {
  Ban,
  Building2,
  Compass,
  Construction,
  Droplets,
  Eye,
  Flag,
  HeartPulse,
  Mountain,
  Package,
  Route,
  Search,
  Siren,
  Users,
  UtensilsCrossed,
  Waves,
  type LucideIcon,
} from "lucide-react";
import type { L, TKey } from "./i18n";
import type { EmergencyType, PeopleRange, SOSPacket } from "./sos";
import { FALLBACK_LOCATION } from "./sos";
import {
  SHELTERS,
  USER_POS,
  type HazardKind,
  type Point,
  type RoadKey,
  type ShelterStatus,
} from "./shelters";
import { FAMILY_PLACES, RECENT_MS } from "./family";
import type { UserStatus } from "./resq-store";

/**
 * Phase 6 — Community Alert + Nearby Safe Users. Local-first: every record carries a
 * clientEventId (idempotent retries) and a sync flag for the existing queue.
 * Nothing here talks to a backend directly; the store flushes queued records when online.
 */

export type SyncState = "QUEUED" | "SYNCED_DEMO";

export type RequestType =
  | "URGENT_UNKNOWN"
  | "ROUTE_INFORMATION"
  | "SHELTER_INFORMATION"
  | "MISSING_PERSON_INFO"
  | "SUPPLY_INFORMATION"
  | "MOBILITY_SUPPORT"
  | "LOCAL_VERIFICATION";

export type RequestStatus = "ACTIVE" | "ASSISTANCE_ACCEPTED" | "RESOLVED" | "EXPIRED";
export type RiskLevel = "HIGH" | "MODERATE" | "LOW";
export type RequestOrigin =
  | "DOCUMENTED_SOS"
  | "DIRECT_SOS"
  | "NEEDS_HELP_STATUS"
  | "ROUTE_ASSISTANCE"
  | "MISSING_PERSON"
  | "DEMO";

/** Structured, safety-gated assistance actions. Nothing here asks a civilian to enter danger. */
export type AssistanceType =
  | "REPORT_OBSERVATION"
  | "REPORT_PASSABLE_ROAD"
  | "REPORT_FLOODED_ROAD"
  | "REPORT_BLOCKED_ROAD"
  | "REPORT_SAFE_ALTERNATIVE_ROUTE"
  | "SHARE_SHELTER_INFO"
  | "VERIFY_SHELTER_OPEN"
  | "VERIFY_ASSEMBLY_POINT"
  | "VERIFY_HIGH_GROUND"
  | "REPORT_SUPPLY_POINT"
  | "SHARE_ROUTE_INFO"
  | "CONTACT_RESPONDER"
  | "SAW_PERSON"
  | "REPORT_LAST_SEEN"
  | "GUIDE_FROM_SAFE_AREA";

export interface CommunityRequest {
  id: string;
  clientEventId: string;
  disasterEventId: string;
  /** "self" for requests created on this device; opaque ids for others (never a name). */
  requesterId: string;
  requestType: RequestType;
  disasterType: EmergencyType | null;
  origin: RequestOrigin;
  approxLatitude: number;
  approxLongitude: number;
  approxLocationLabel: L;
  peopleCount: number;
  peopleRange?: PeopleRange | undefined;
  riskLevel: RiskLevel;
  allowedAssistanceTypes: AssistanceType[];
  status: RequestStatus;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  /** Family member this missing-person request is about (own device only; never sent to helpers). */
  subjectMemberId?: string | undefined;
  sourcePacketId?: string | undefined;
  sync: SyncState;
}

export interface HelperResponse {
  id: string;
  clientEventId: string;
  requestId: string;
  helperId: string;
  response: "CAN_ASSIST" | "DECLINED";
  assistanceType?: AssistanceType | undefined;
  createdAt: number;
  status: "PENDING_DELIVERY" | "DELIVERED_DEMO";
  sync: SyncState;
}

export type ReportType =
  | "ROAD_PASSABLE"
  | "ROAD_BLOCKED"
  | "FLOODING"
  | "LANDSLIDE"
  | "DAMAGED_BRIDGE"
  | "SHELTER_OPEN"
  | "SHELTER_FULL"
  | "WATER_AVAILABLE"
  | "FOOD_AVAILABLE"
  | "MEDICAL_POINT"
  | "SAFE_ASSEMBLY_POINT";

export interface CommunityReport {
  id: string;
  clientEventId: string;
  reporterId: string;
  reportType: ReportType;
  latitude: number;
  longitude: number;
  locationLabel: L;
  /** Road / shelter the report is about (feeds the existing hazard & shelter systems). */
  roadKey?: RoadKey | undefined;
  shelterId?: string | undefined;
  details?: string | undefined;
  createdAt: number;
  status: "ACTIVE" | "EXPIRED";
  /** Set when the report answered a specific request. */
  requestId?: string | undefined;
  sync: SyncState;
}

export const COMMUNITY_KEYS = {
  requests: "resq_community_requests",
  responses: "resq_community_helper_responses",
  reports: "resq_community_reports",
  seededAt: "resq_community_seeded_at",
} as const;

export const SELF_HELPER_ID = "self";
export const REQUEST_TTL_MS = 20 * 60_000;
export const REPORT_TTL_MS = 60 * 60_000;
export const NEARBY_RADIUS_M = 1500;
export const COMMUNITY_REFRESH_MS = 45_000;

// ---------------------------------------------------------------------------
// Geography (local / demo coordinates, no map API)
// ---------------------------------------------------------------------------

/** Map space (0–100) → approximate metres. Calibrated so the school shelter (0.8 km) matches. */
const METRES_PER_UNIT = 15;
const ORIGIN = { lat: FALLBACK_LOCATION.latitude, lng: FALLBACK_LOCATION.longitude };

export function mapToLatLng(p: Point): { latitude: number; longitude: number } {
  const dxM = (p.x - USER_POS.x) * METRES_PER_UNIT;
  const dyM = (USER_POS.y - p.y) * METRES_PER_UNIT; // map y grows downward
  return {
    latitude: ORIGIN.lat + dyM / 111_320,
    longitude: ORIGIN.lng + dxM / (111_320 * Math.cos((ORIGIN.lat * Math.PI) / 180)),
  };
}

export function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Rounded, privacy-preserving distance text: 350 m · 900 m · 1.2 km. */
export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.max(50, Math.round(m / 50) * 50)} m`;
  return `${(Math.round(m / 100) / 10).toFixed(1)} km`;
}

/** Offsets a point from the user's location by `metres` at `bearingDeg` (0 = north). */
export function offsetFromUser(
  metres: number,
  bearingDeg: number,
): { latitude: number; longitude: number } {
  const b = (bearingDeg * Math.PI) / 180;
  const dN = metres * Math.cos(b);
  const dE = metres * Math.sin(b);
  return {
    latitude: ORIGIN.lat + dN / 111_320,
    longitude: ORIGIN.lng + dE / (111_320 * Math.cos((ORIGIN.lat * Math.PI) / 180)),
  };
}

export function distanceFromUserM(
  r: { approxLatitude: number; approxLongitude: number },
  user?: { latitude: number; longitude: number } | null,
): number {
  const u = user ?? { latitude: ORIGIN.lat, longitude: ORIGIN.lng };
  return haversineM(u.latitude, u.longitude, r.approxLatitude, r.approxLongitude);
}

// ---------------------------------------------------------------------------
// Safety gate: which assistance is allowed per situation
// ---------------------------------------------------------------------------

const HIGH_RISK_TYPES = new Set<EmergencyType>([
  "FLOOD",
  "LANDSLIDE",
  "FIRE",
  "CYCLONE",
  "EARTHQUAKE",
  "TRAPPED",
]);

export function riskFor(disaster: EmergencyType | null, requestType: RequestType): RiskLevel {
  if (requestType === "URGENT_UNKNOWN") return "HIGH";
  if (disaster && HIGH_RISK_TYPES.has(disaster)) return "HIGH";
  if (requestType === "MOBILITY_SUPPORT") return "MODERATE";
  return "LOW";
}

/** Allowed actions are chosen from the documented emergency; a direct SOS gets the restricted set. */
export function allowedAssistance(
  disaster: EmergencyType | null,
  requestType: RequestType,
): AssistanceType[] {
  if (requestType === "URGENT_UNKNOWN")
    return ["REPORT_OBSERVATION", "SHARE_ROUTE_INFO", "CONTACT_RESPONDER"];
  if (requestType === "MISSING_PERSON_INFO")
    return ["SAW_PERSON", "REPORT_LAST_SEEN", "SHARE_ROUTE_INFO"];
  switch (disaster) {
    case "FLOOD":
      return [
        "REPORT_PASSABLE_ROAD",
        "REPORT_FLOODED_ROAD",
        "SHARE_SHELTER_INFO",
        "VERIFY_HIGH_GROUND",
        "REPORT_OBSERVATION",
      ];
    case "CYCLONE":
      return ["VERIFY_SHELTER_OPEN", "REPORT_BLOCKED_ROAD", "REPORT_SUPPLY_POINT"];
    case "LANDSLIDE":
      return ["REPORT_BLOCKED_ROAD", "REPORT_SAFE_ALTERNATIVE_ROUTE", "REPORT_OBSERVATION"];
    case "EARTHQUAKE":
      return [
        "VERIFY_ASSEMBLY_POINT",
        "REPORT_BLOCKED_ROAD",
        "SHARE_SHELTER_INFO",
        "REPORT_OBSERVATION",
      ];
    case "FIRE":
    case "TRAPPED":
      return ["REPORT_OBSERVATION", "REPORT_BLOCKED_ROAD", "CONTACT_RESPONDER"];
    default:
      break;
  }
  switch (requestType) {
    case "ROUTE_INFORMATION":
      return ["REPORT_PASSABLE_ROAD", "REPORT_BLOCKED_ROAD", "SHARE_ROUTE_INFO"];
    case "SHELTER_INFORMATION":
      return ["VERIFY_SHELTER_OPEN", "SHARE_SHELTER_INFO", "VERIFY_ASSEMBLY_POINT"];
    case "SUPPLY_INFORMATION":
      return ["REPORT_SUPPLY_POINT", "SHARE_SHELTER_INFO"];
    case "MOBILITY_SUPPORT":
      return ["GUIDE_FROM_SAFE_AREA", "SHARE_ROUTE_INFO", "SHARE_SHELTER_INFO"];
    default:
      return ["REPORT_OBSERVATION", "SHARE_ROUTE_INFO", "SHARE_SHELTER_INFO"];
  }
}

export function requestTypeForSos(p: SOSPacket): RequestType {
  if (p.source === "DIRECT_SOS_BUTTON" || p.type === "URGENT_UNSPECIFIED") return "URGENT_UNKNOWN";
  if (p.type === "MISSING_PERSON") return "MISSING_PERSON_INFO";
  if (p.type === "FLOOD" || p.type === "LANDSLIDE") return "ROUTE_INFORMATION";
  if (p.type === "CYCLONE" || p.type === "EARTHQUAKE") return "SHELTER_INFORMATION";
  if (
    p.flags.some(
      (f) =>
        f === "CANNOT_MOVE" ||
        f === "MOBILITY_LIMITATION" ||
        f === "ACCESSIBILITY" ||
        f === "ELDERLY",
    )
  )
    return "MOBILITY_SUPPORT";
  return "LOCAL_VERIFICATION";
}

export const ASSISTANCE_META: Record<
  AssistanceType,
  { key: TKey; icon: LucideIcon; reportType?: ReportType }
> = {
  REPORT_OBSERVATION: { key: "aReportObservation", icon: Eye },
  REPORT_PASSABLE_ROAD: { key: "aReportPassableRoad", icon: Route, reportType: "ROAD_PASSABLE" },
  REPORT_FLOODED_ROAD: { key: "aReportFloodedRoad", icon: Waves, reportType: "FLOODING" },
  REPORT_BLOCKED_ROAD: { key: "aReportBlockedRoad", icon: Ban, reportType: "ROAD_BLOCKED" },
  REPORT_SAFE_ALTERNATIVE_ROUTE: {
    key: "aReportSafeAltRoute",
    icon: Compass,
    reportType: "ROAD_PASSABLE",
  },
  SHARE_SHELTER_INFO: { key: "aShareShelterInfo", icon: Building2, reportType: "SHELTER_OPEN" },
  VERIFY_SHELTER_OPEN: { key: "aVerifyShelterOpen", icon: Building2, reportType: "SHELTER_OPEN" },
  VERIFY_ASSEMBLY_POINT: {
    key: "aVerifyAssemblyPoint",
    icon: Flag,
    reportType: "SAFE_ASSEMBLY_POINT",
  },
  VERIFY_HIGH_GROUND: {
    key: "aVerifyHighGround",
    icon: Mountain,
    reportType: "SAFE_ASSEMBLY_POINT",
  },
  REPORT_SUPPLY_POINT: { key: "aReportSupplyPoint", icon: Package, reportType: "WATER_AVAILABLE" },
  SHARE_ROUTE_INFO: { key: "aShareRouteInfo", icon: Route, reportType: "ROAD_PASSABLE" },
  CONTACT_RESPONDER: { key: "aContactResponder", icon: Siren },
  SAW_PERSON: { key: "aSawPerson", icon: Search },
  REPORT_LAST_SEEN: { key: "aReportLastSeen", icon: Eye },
  GUIDE_FROM_SAFE_AREA: { key: "aGuideFromSafeArea", icon: Users },
};

export const REQUEST_TYPE_KEY: Record<RequestType, TKey> = {
  URGENT_UNKNOWN: "rqUrgentUnknown",
  ROUTE_INFORMATION: "rqRouteInfo",
  SHELTER_INFORMATION: "rqShelterInfo",
  MISSING_PERSON_INFO: "rqMissingInfo",
  SUPPLY_INFORMATION: "rqSupplyInfo",
  MOBILITY_SUPPORT: "rqMobility",
  LOCAL_VERIFICATION: "rqLocalVerification",
};

/** REPORT LOCAL CONDITION options (natural-disaster first). */
export const REPORT_OPTIONS: {
  type: ReportType;
  key: TKey;
  icon: LucideIcon;
  target: "road" | "shelter";
  hazard?: HazardKind;
}[] = [
  { type: "FLOODING", key: "rpFlooding", icon: Waves, target: "road", hazard: "FLOODING" },
  { type: "LANDSLIDE", key: "rpLandslide", icon: Mountain, target: "road", hazard: "LANDSLIDE" },
  { type: "ROAD_BLOCKED", key: "rpRoadBlocked", icon: Ban, target: "road", hazard: "ROAD_BLOCKED" },
  {
    type: "DAMAGED_BRIDGE",
    key: "rpDamagedBridge",
    icon: Construction,
    target: "road",
    hazard: "BRIDGE_INACCESSIBLE",
  },
  { type: "ROAD_PASSABLE", key: "rpSafeRoad", icon: Route, target: "road" },
  { type: "SHELTER_OPEN", key: "rpShelterStatus", icon: Building2, target: "shelter" },
  { type: "WATER_AVAILABLE", key: "rpWaterSupplies", icon: Droplets, target: "shelter" },
  { type: "MEDICAL_POINT", key: "rpMedicalPoint", icon: HeartPulse, target: "shelter" },
];

export const REPORT_META: Record<
  ReportType,
  { key: TKey; icon: LucideIcon; hazard?: HazardKind; shelterStatus?: ShelterStatus }
> = {
  ROAD_PASSABLE: { key: "rpSafeRoad", icon: Route },
  ROAD_BLOCKED: { key: "rpRoadBlocked", icon: Ban, hazard: "ROAD_BLOCKED" },
  FLOODING: { key: "rpFlooding", icon: Waves, hazard: "FLOODING" },
  LANDSLIDE: { key: "rpLandslide", icon: Mountain, hazard: "LANDSLIDE" },
  DAMAGED_BRIDGE: { key: "rpDamagedBridge", icon: Construction, hazard: "BRIDGE_INACCESSIBLE" },
  SHELTER_OPEN: { key: "rpShelterOpen", icon: Building2, shelterStatus: "AVAILABLE" },
  SHELTER_FULL: { key: "rpShelterFull", icon: Building2, shelterStatus: "FULL" },
  WATER_AVAILABLE: { key: "rpWaterAvailable", icon: Droplets },
  FOOD_AVAILABLE: { key: "rpFoodAvailable", icon: UtensilsCrossed },
  MEDICAL_POINT: { key: "rpMedicalPoint", icon: HeartPulse },
  SAFE_ASSEMBLY_POINT: { key: "rpAssemblyPoint", icon: Flag },
};

export const ROAD_KEYS: RoadKey[] = [
  "mainRoad",
  "schoolRoad",
  "templeRoad",
  "northStreet",
  "eastStreet",
  "stationRoad",
];

// ---------------------------------------------------------------------------
// Eligibility — the core Phase 6 principle
// ---------------------------------------------------------------------------

export type Ineligibility = "NEEDS_HELP" | "STALE" | "RECHECK_OVERDUE" | "UNKNOWN" | "ACTIVE_SOS";

export interface Eligibility {
  eligible: boolean;
  reason: Ineligibility | null;
  safeAgeMin: number | null;
}

/**
 * Eligible only when: latest status SAFE/AT_SHELTER · SAFE confirmation ≤ 10 min ·
 * recheck not overdue · no active own SOS since that SAFE · not NEEDS_HELP.
 */
export function helperEligibility(args: {
  userStatus: UserStatus;
  lastSafetyCheckAt: number | null;
  recheckDue: boolean;
  packets: SOSPacket[];
  now: number;
}): Eligibility {
  const { userStatus, lastSafetyCheckAt, recheckDue, packets, now } = args;
  const safeAgeMin = lastSafetyCheckAt ? Math.round((now - lastSafetyCheckAt) / 60_000) : null;
  if (userStatus === "NEEDS_HELP") return { eligible: false, reason: "NEEDS_HELP", safeAgeMin };
  if (userStatus !== "SAFE" && userStatus !== "AT_SHELTER")
    return { eligible: false, reason: "UNKNOWN", safeAgeMin };
  if (recheckDue) return { eligible: false, reason: "RECHECK_OVERDUE", safeAgeMin };
  if (!lastSafetyCheckAt || now - lastSafetyCheckAt > RECENT_MS)
    return { eligible: false, reason: "STALE", safeAgeMin };
  const activeSos = packets.some(
    (p) => p.type !== "MISSING_PERSON" && new Date(p.createdAt).getTime() > lastSafetyCheckAt,
  );
  if (activeSos) return { eligible: false, reason: "ACTIVE_SOS", safeAgeMin };
  return { eligible: true, reason: null, safeAgeMin };
}

// ---------------------------------------------------------------------------
// Sorting / filtering
// ---------------------------------------------------------------------------

export function isRequestActive(r: CommunityRequest, now: number): boolean {
  return (r.status === "ACTIVE" || r.status === "ASSISTANCE_ACCEPTED") && r.expiresAt > now;
}

export function declinedIds(responses: HelperResponse[]): Set<string> {
  return new Set(
    responses
      .filter((r) => r.helperId === SELF_HELPER_ID && r.response === "DECLINED")
      .map((r) => r.requestId),
  );
}

export function acceptedIds(responses: HelperResponse[]): Set<string> {
  return new Set(
    responses
      .filter((r) => r.helperId === SELF_HELPER_ID && r.response === "CAN_ASSIST")
      .map((r) => r.requestId),
  );
}

/** Nearby requests from others: 1 urgency · 2 safe ability to assist · 3 distance · 4 freshness. */
export function nearbyRequests(
  requests: CommunityRequest[],
  responses: HelperResponse[],
  now: number,
): (CommunityRequest & { distanceM: number })[] {
  const declined = declinedIds(responses);
  const urgency = (r: CommunityRequest) =>
    r.requestType === "URGENT_UNKNOWN"
      ? 3
      : r.requestType === "MISSING_PERSON_INFO" || r.requestType === "MOBILITY_SUPPORT"
        ? 2
        : 1;
  const safeAbility = (r: CommunityRequest) =>
    r.riskLevel === "LOW" ? 2 : r.riskLevel === "MODERATE" ? 1 : 0;
  return requests
    .filter(
      (r) => r.requesterId !== SELF_HELPER_ID && isRequestActive(r, now) && !declined.has(r.id),
    )
    .map((r) => ({ ...r, distanceM: distanceFromUserM(r) }))
    .filter((r) => r.distanceM <= NEARBY_RADIUS_M)
    .sort(
      (a, b) =>
        urgency(b) - urgency(a) ||
        safeAbility(b) - safeAbility(a) ||
        a.distanceM - b.distanceM ||
        b.updatedAt - a.updatedAt,
    );
}

export function activeReports(reports: CommunityReport[], now: number): CommunityReport[] {
  return reports
    .filter((r) => r.status === "ACTIVE" && now - r.createdAt < REPORT_TTL_MS)
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** Latest community observation about a shelter's status, if any. */
export function latestShelterObservation(
  reports: CommunityReport[],
  shelterId: string,
  now: number,
): CommunityReport | null {
  return (
    activeReports(reports, now).find(
      (r) =>
        r.shelterId === shelterId &&
        (r.reportType === "SHELTER_OPEN" || r.reportType === "SHELTER_FULL"),
    ) ?? null
  );
}

// ---------------------------------------------------------------------------
// Parsing & seeds
// ---------------------------------------------------------------------------

export function parseArray<T>(raw: string | null, guard: (v: unknown) => v is T): T[] {
  if (!raw) return [];
  try {
    const d: unknown = JSON.parse(raw);
    return Array.isArray(d) ? d.filter(guard) : [];
  } catch {
    return [];
  }
}

export const isRequest = (v: unknown): v is CommunityRequest => {
  if (!v || typeof v !== "object") return false;
  const r = v as Partial<CommunityRequest>;
  return (
    typeof r.id === "string" &&
    typeof r.requestType === "string" &&
    typeof r.approxLatitude === "number" &&
    typeof r.expiresAt === "number" &&
    typeof r.status === "string"
  );
};
export const isResponse = (v: unknown): v is HelperResponse => {
  if (!v || typeof v !== "object") return false;
  const r = v as Partial<HelperResponse>;
  return (
    typeof r.id === "string" && typeof r.requestId === "string" && typeof r.response === "string"
  );
};
export const isReport = (v: unknown): v is CommunityReport => {
  if (!v || typeof v !== "object") return false;
  const r = v as Partial<CommunityReport>;
  return (
    typeof r.id === "string" &&
    typeof r.reportType === "string" &&
    r.reportType in REPORT_META &&
    typeof r.createdAt === "number"
  );
};

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function shelterLatLng(id: string) {
  const s = SHELTERS.find((x) => x.id === id)!;
  return mapToLatLng(s.pos);
}

/** Seeded community feed — informational only; none of these map to a routed road, so routing is untouched. */
export function seedCommunityReports(now: number): CommunityReport[] {
  const m = (min: number) => now - min * 60_000;
  const mk = (
    id: string,
    reportType: ReportType,
    shelterId: string,
    min: number,
  ): CommunityReport => ({
    id: `seed-${id}`,
    clientEventId: `seed-${id}`,
    reporterId: "peer-a1",
    reportType,
    ...shelterLatLng(shelterId),
    locationLabel: SHELTERS.find((s) => s.id === shelterId)!.name,
    shelterId,
    createdAt: m(min),
    status: "ACTIVE",
    sync: "SYNCED_DEMO",
  });
  return [
    mk("water-school", "WATER_AVAILABLE", "govt-school", 8),
    mk("assembly-ground", "SAFE_ASSEMBLY_POINT", "open-ground", 12),
    mk("medical-phc", "MEDICAL_POINT", "phc", 15),
  ];
}

export type NearbyRequestKind = "FLOOD_ROUTE" | "MISSING_PERSON" | "SHELTER_INFO";

const NEARBY_LABELS: Record<NearbyRequestKind, L> = {
  FLOOD_ROUTE: { en: "Flood evacuation area", hi: "बाढ़ निकासी क्षेत्र" },
  MISSING_PERSON: { en: "Near Market Road", hi: "मार्केट रोड के पास" },
  SHELTER_INFO: { en: "Near Health Centre Road", hi: "स्वास्थ्य केंद्र रोड के पास" },
};

/** Builds a nearby-assistance request from another (anonymous) Sahara user, as received over the network. */
export function buildNearbyRequest(
  kind: NearbyRequestKind,
  distanceM: number,
  disasterEventId: string,
  now: number,
): CommunityRequest {
  const disasterType: EmergencyType | null =
    kind === "FLOOD_ROUTE" ? "FLOOD" : kind === "MISSING_PERSON" ? "MISSING_PERSON" : "CYCLONE";
  const requestType: RequestType =
    kind === "FLOOD_ROUTE"
      ? "ROUTE_INFORMATION"
      : kind === "MISSING_PERSON"
        ? "MISSING_PERSON_INFO"
        : "SHELTER_INFORMATION";
  const bearing = kind === "FLOOD_ROUTE" ? 300 : kind === "MISSING_PERSON" ? 20 : 80;
  const pos = offsetFromUser(distanceM, bearing);
  // Stable ids per disaster event: receiving the same request twice never duplicates it.
  const id = `creq-${disasterEventId}-${kind.toLowerCase()}`;
  return {
    id,
    clientEventId: `${id}-evt`,
    disasterEventId,
    requesterId: `peer-${kind.toLowerCase()}`,
    requestType,
    disasterType,
    origin: kind === "MISSING_PERSON" ? "MISSING_PERSON" : "DOCUMENTED_SOS",
    approxLatitude: pos.latitude,
    approxLongitude: pos.longitude,
    approxLocationLabel: NEARBY_LABELS[kind],
    peopleCount: kind === "FLOOD_ROUTE" ? 2 : 1,
    riskLevel: riskFor(disasterType, requestType),
    allowedAssistanceTypes: allowedAssistance(disasterType, requestType),
    status: "ACTIVE",
    createdAt: now - 2 * 60_000,
    updatedAt: now - 2 * 60_000,
    expiresAt: now + REQUEST_TTL_MS,
    // The missing-person request concerns Sameer so last-seen reports feed the Family evidence trail.
    ...(kind === "MISSING_PERSON" ? { subjectMemberId: "dad" } : {}),
    sync: "SYNCED_DEMO",
  };
}

/**
 * Requests from nearby users that the network delivers for the current disaster event (prototype backend).
 * Delivered once per event, only while a delivery path exists; the UI still applies eligibility before showing them.
 */
export function incomingNearbyRequests(disasterEventId: string, now: number): CommunityRequest[] {
  return [
    buildNearbyRequest("FLOOD_ROUTE", 350, disasterEventId, now),
    buildNearbyRequest("SHELTER_INFO", 900, disasterEventId, now),
  ];
}

/** Prototype summary of the community signal for the requester's own request. */
export interface CommunitySignal {
  state: "STORED" | "ACTIVE" | "RESOLVED";
  radiusM: number;
  eligibleNearby: number;
  responses: number;
  reportsReceived: number;
}

export function communitySignal(
  request: CommunityRequest,
  responses: HelperResponse[],
  reports: CommunityReport[],
  now: number,
): CommunitySignal {
  const live = isRequestActive(request, now);
  const peerResponses = responses.filter(
    (r) =>
      r.requestId === request.id && r.helperId !== SELF_HELPER_ID && r.response === "CAN_ASSIST",
  ).length;
  const reportsReceived = reports.filter(
    (r) => r.requestId === request.id && r.reporterId !== SELF_HELPER_ID,
  ).length;
  const delivered = request.sync === "SYNCED_DEMO";
  return {
    state: !live ? "RESOLVED" : delivered ? "ACTIVE" : "STORED",
    radiusM: NEARBY_RADIUS_M,
    eligibleNearby: delivered ? 3 : 0,
    responses: peerResponses,
    reportsReceived,
  };
}

/** Family place nearest to a road, for turning a last-seen report into peer evidence. */
export function placeForRoad(roadKey: RoadKey): string {
  const map: Record<RoadKey, string> = {
    mainRoad: "market-road",
    schoolRoad: "school-area",
    templeRoad: "current",
    northStreet: "north-evac",
    eastStreet: "phc-road",
    stationRoad: "phc-road",
  };
  return FAMILY_PLACES.some((p) => p.id === map[roadKey]) ? map[roadKey] : "market-road";
}
