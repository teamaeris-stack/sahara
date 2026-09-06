import {
  Accessibility,
  Bath,
  Droplets,
  Flag,
  HeartPulse,
  Stethoscope,
  TreePine,
  Utensils,
  Waves,
  Construction,
  TriangleAlert,
  Building,
  Mountain,
  Ban,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";
import type { L, TKey } from "./i18n";

/**
 * Local shelter + map + route + hazard data. Everything here is stored on-device;
 * nothing is fetched. Map coordinates are in a 0–100 SVG space.
 */

export type ShelterStatus = "AVAILABLE" | "LIMITED" | "FULL";
export type ShelterType = "UNIVERSAL_SHELTER" | "SAFE_ASSEMBLY_ZONE" | "MEDICAL_SAFE_POINT";
export type Facility =
  | "WATER"
  | "FOOD"
  | "FIRST_AID"
  | "WHEELCHAIR_ACCESS"
  | "TOILETS"
  | "MEDICAL_SUPPORT"
  | "OPEN_SPACE"
  | "ASSEMBLY_POINT"
  | "ACCESSIBILITY";
export type Confidence = "HIGH" | "MEDIUM" | "LOW";

/** Route problems are part of Sahara's data model, not a demo toggle. */
export type HazardKind =
  | "FLOODING"
  | "LANDSLIDE"
  | "ROAD_BLOCKED"
  | "BRIDGE_INACCESSIBLE"
  | "DEBRIS"
  | "STRUCTURAL_DAMAGE"
  | "OTHER";

export type RoadKey = "mainRoad" | "schoolRoad" | "templeRoad" | "northStreet" | "eastStreet" | "stationRoad";
export type SyncState = "QUEUED" | "SYNCED_DEMO";

export const HAZARD_REPORTS_KEY = "resq_hazard_reports";
export const SHELTER_CACHE_KEY = "resq_shelter_cache";
/** Shelter status refresh cadence while online and the shelter screen is open. */
export const SHELTER_REFRESH_MS = 45_000;

export interface Point {
  x: number;
  y: number;
}

export interface RouteDef {
  id: "A" | "B";
  /** Ordered waypoint names (translation keys). */
  via: TKey[];
  /** Roads this route actually travels on. */
  roads: RoadKey[];
  /** Polyline in map space, starting at the user's position. */
  points: Point[];
  distanceKm: number;
}

export interface Shelter {
  id: string;
  name: L;
  type: ShelterType;
  distanceKm: number;
  capacity: number | null;
  availableSpaces: number | null;
  status: ShelterStatus;
  facilities: Facility[];
  /** Age of the seed verification when the cache is first created. */
  lastVerifiedMin: number;
  pos: Point;
  /** Real OSM geographic position used by the offline Leaflet map and A* router. */
  geo: { lat: number; lng: number };
  routeA: RouteDef;
  /** Alternate route to the same shelter. */
  routeB?: RouteDef;
}

export interface Hazard {
  id: string;
  kind: HazardKind;
  pos: Point;
  /** Road affected; undefined = point hazard that does not block travel. */
  roadKey?: RoadKey;
  /** Exact locally packaged OSM way blocked by a report made during guidance. */
  osmWayId?: string;
  /** Human-readable OSM road name shown directly on the real map. */
  osmWayName?: string;
  /** Route geometry that was active when the affected road was selected. */
  osmCoordinates?: { lat: number; lng: number }[];
  /** Nearby connected edges are also closed so the alternate route visibly detours. */
  closureRadiusM?: number;
  /** Geographic marker position for the real offline map. */
  geo?: { lat: number; lng: number };
  /** Reported by this user (vs. seeded map data). */
  reported?: boolean;
  reportedAt?: number;
  clientEventId?: string;
  sync?: SyncState;
}

/** Live per-shelter cache entry: absolute verification time + latest spaces. */
export interface ShelterCacheEntry {
  verifiedAt: number;
  availableSpaces: number | null;
}
export type ShelterCache = Record<string, ShelterCacheEntry>;

export const USER_POS: Point = { x: 50, y: 88 };

/** Map roads: simple named polylines. */
export const ROADS: { key: RoadKey; points: Point[] }[] = [
  { key: "mainRoad", points: [{ x: 50, y: 96 }, { x: 50, y: 48 }] },
  { key: "schoolRoad", points: [{ x: 8, y: 48 }, { x: 92, y: 48 }] },
  { key: "templeRoad", points: [{ x: 8, y: 88 }, { x: 92, y: 88 }] },
  { key: "northStreet", points: [{ x: 24, y: 88 }, { x: 24, y: 30 }] },
  { key: "eastStreet", points: [{ x: 50, y: 70 }, { x: 92, y: 70 }] },
  { key: "stationRoad", points: [{ x: 76, y: 96 }, { x: 76, y: 20 }] },
];

/** Seeded map hazards. None of these lie on a cached route, so they are informational. */
export const SEED_HAZARDS: Hazard[] = [
  { id: "bridge", kind: "BRIDGE_INACCESSIBLE", pos: { x: 88, y: 70 } },
  { id: "debris", kind: "DEBRIS", pos: { x: 40, y: 30 } },
  { id: "structure", kind: "STRUCTURAL_DAMAGE", pos: { x: 62, y: 80 } },
];

export const SHELTERS: Shelter[] = [
  {
    id: "govt-school",
    name: { en: "West Aluva Demo Shelter", hi: "पश्चिम अलुवा डेमो आश्रय" },
    type: "UNIVERSAL_SHELTER",
    distanceKm: 1.46,
    capacity: 250,
    availableSpaces: 142,
    status: "AVAILABLE",
    facilities: ["WATER", "FOOD", "FIRST_AID", "WHEELCHAIR_ACCESS", "TOILETS"],
    lastVerifiedMin: 6,
    pos: { x: 24, y: 40 },
    geo: { lat: 10.10761, lng: 76.343001 },
    routeA: {
      id: "A",
      via: ["mainRoad", "marketJunction", "schoolRoad"],
      roads: ["mainRoad", "schoolRoad"],
      points: [USER_POS, { x: 50, y: 48 }, { x: 24, y: 48 }, { x: 24, y: 40 }],
      distanceKm: 1.46,
    },
    routeB: {
      id: "B",
      via: ["templeRoad", "northStreet", "schoolRoad"],
      roads: ["templeRoad", "northStreet", "schoolRoad"],
      points: [USER_POS, { x: 24, y: 88 }, { x: 24, y: 48 }, { x: 24, y: 40 }],
      distanceKm: 4.95,
    },
  },
  {
    id: "community-hall",
    name: { en: "North Aluva Demo Shelter", hi: "उत्तर अलुवा डेमो आश्रय" },
    type: "UNIVERSAL_SHELTER",
    distanceKm: 2.40,
    capacity: 120,
    availableSpaces: 18,
    status: "LIMITED",
    facilities: ["WATER", "FOOD", "MEDICAL_SUPPORT", "TOILETS"],
    lastVerifiedMin: 18,
    pos: { x: 80, y: 62 },
    geo: { lat: 10.121115, lng: 76.348579 },
    routeA: {
      id: "A",
      via: ["mainRoad", "eastStreet"],
      roads: ["mainRoad", "eastStreet"],
      points: [USER_POS, { x: 50, y: 70 }, { x: 80, y: 70 }, { x: 80, y: 62 }],
      distanceKm: 2.40,
    },
  },
  {
    id: "sports-complex",
    name: { en: "UC College Relief Centre", hi: "यूसी कॉलेज राहत केंद्र" },
    type: "UNIVERSAL_SHELTER",
    distanceKm: 3.24,
    capacity: 400,
    availableSpaces: 0,
    status: "FULL",
    facilities: ["WATER", "FOOD", "FIRST_AID"],
    lastVerifiedMin: 4,
    pos: { x: 84, y: 26 },
    geo: { lat: 10.12636, lng: 76.334276 },
    routeA: {
      id: "A",
      via: ["mainRoad", "marketJunction", "schoolRoad", "stationRoad"],
      roads: ["mainRoad", "schoolRoad", "stationRoad"],
      points: [USER_POS, { x: 50, y: 48 }, { x: 76, y: 48 }, { x: 76, y: 26 }, { x: 84, y: 26 }],
      distanceKm: 3.24,
    },
    routeB: {
      id: "B",
      via: ["templeRoad", "stationRoad"],
      roads: ["templeRoad", "stationRoad"],
      points: [USER_POS, { x: 76, y: 88 }, { x: 76, y: 26 }, { x: 84, y: 26 }],
      distanceKm: 3.48,
    },
  },
  {
    id: "open-ground",
    name: { en: "East Aluva Demo Assembly Point", hi: "पूर्व अलुवा डेमो सभा स्थल" },
    type: "SAFE_ASSEMBLY_ZONE",
    distanceKm: 1.72,
    capacity: null,
    availableSpaces: null,
    status: "AVAILABLE",
    facilities: ["OPEN_SPACE", "ASSEMBLY_POINT"],
    lastVerifiedMin: 25,
    pos: { x: 34, y: 74 },
    geo: { lat: 10.107456, lng: 76.364648 },
    routeA: {
      id: "A",
      via: ["templeRoad"],
      roads: ["templeRoad"],
      points: [USER_POS, { x: 34, y: 88 }, { x: 34, y: 74 }],
      distanceKm: 1.72,
    },
  },
  {
    id: "phc",
    name: { en: "South Aluva Demo Aid Point", hi: "दक्षिण अलुवा डेमो सहायता स्थल" },
    type: "MEDICAL_SAFE_POINT",
    distanceKm: 1.53,
    capacity: 60,
    availableSpaces: 9,
    status: "LIMITED",
    facilities: ["MEDICAL_SUPPORT", "FIRST_AID", "WATER", "ACCESSIBILITY"],
    lastVerifiedMin: 12,
    pos: { x: 64, y: 36 },
    geo: { lat: 10.097706, lng: 76.351736 },
    routeA: {
      id: "A",
      via: ["mainRoad", "marketJunction", "schoolRoad"],
      roads: ["mainRoad", "schoolRoad"],
      points: [USER_POS, { x: 50, y: 48 }, { x: 64, y: 48 }, { x: 64, y: 36 }],
      distanceKm: 1.53,
    },
    routeB: {
      id: "B",
      via: ["templeRoad", "stationRoad", "schoolRoad"],
      roads: ["templeRoad", "stationRoad", "schoolRoad"],
      points: [USER_POS, { x: 76, y: 88 }, { x: 76, y: 48 }, { x: 64, y: 48 }, { x: 64, y: 36 }],
      distanceKm: 3.8,
    },
  },
];

export const FACILITY_META: Record<Facility, { key: TKey; icon: LucideIcon }> = {
  WATER: { key: "water", icon: Droplets },
  FOOD: { key: "food", icon: Utensils },
  FIRST_AID: { key: "firstAid", icon: HeartPulse },
  WHEELCHAIR_ACCESS: { key: "wheelchairAccess", icon: Accessibility },
  TOILETS: { key: "toilets", icon: Bath },
  MEDICAL_SUPPORT: { key: "medicalSupport", icon: Stethoscope },
  OPEN_SPACE: { key: "openSpace", icon: TreePine },
  ASSEMBLY_POINT: { key: "assemblyPoint", icon: Flag },
  ACCESSIBILITY: { key: "accessibility", icon: Accessibility },
};

export const SHELTER_TYPE_KEY: Record<ShelterType, TKey> = {
  UNIVERSAL_SHELTER: "universalShelter",
  SAFE_ASSEMBLY_ZONE: "safeAssemblyZone",
  MEDICAL_SAFE_POINT: "medicalSafePoint",
};

export const HAZARD_META: Record<HazardKind, { key: TKey; icon: LucideIcon }> = {
  FLOODING: { key: "hzFlooding", icon: Waves },
  LANDSLIDE: { key: "hzLandslide", icon: Mountain },
  ROAD_BLOCKED: { key: "hzRoadBlocked", icon: Ban },
  BRIDGE_INACCESSIBLE: { key: "hzBridge", icon: Construction },
  DEBRIS: { key: "hzDebris", icon: TriangleAlert },
  STRUCTURAL_DAMAGE: { key: "hzStructural", icon: Building },
  OTHER: { key: "hzOther", icon: HelpCircle },
};

/** Options offered by REPORT ROUTE PROBLEM. */
export const REPORTABLE_HAZARDS: HazardKind[] = ["FLOODING", "LANDSLIDE", "ROAD_BLOCKED", "BRIDGE_INACCESSIBLE", "DEBRIS", "OTHER"];

export const STATUS_KEY: Record<ShelterStatus, TKey> = { AVAILABLE: "available", LIMITED: "limited", FULL: "full" };
export const CONFIDENCE_KEY: Record<Confidence, TKey> = { HIGH: "high", MEDIUM: "medium", LOW: "low" };

/** Deterministic freshness: 0–20 min HIGH, 21–60 MEDIUM, 60+ LOW. */
export function confidenceFor(minutes: number): Confidence {
  if (minutes <= 20) return "HIGH";
  if (minutes <= 60) return "MEDIUM";
  return "LOW";
}

export function isAccessible(s: Shelter): boolean {
  return s.facilities.includes("WHEELCHAIR_ACCESS") || s.facilities.includes("ACCESSIBILITY");
}

export function hasMedical(s: Shelter): boolean {
  return s.type === "MEDICAL_SAFE_POINT" || s.facilities.includes("MEDICAL_SUPPORT") || s.facilities.includes("FIRST_AID");
}

export function findShelter(id: string | undefined): Shelter | null {
  return SHELTERS.find((s) => s.id === id) ?? null;
}

/** Average walking speed 4.5 km/h. */
export function walkMinutes(km: number): number {
  return Math.max(1, Math.round((km / 4.5) * 60));
}

export function toPath(points: Point[]): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ");
}

// ---------------------------------------------------------------------------
// Shelter cache (local-first, ages in real time, refreshed while online)
// ---------------------------------------------------------------------------

export function seedShelterCache(now = Date.now()): ShelterCache {
  const cache: ShelterCache = {};
  for (const s of SHELTERS) cache[s.id] = { verifiedAt: now - s.lastVerifiedMin * 60_000, availableSpaces: s.availableSpaces };
  return cache;
}

export function parseShelterCache(raw: string | null): ShelterCache | null {
  if (!raw) return null;
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object") return null;
    const out: ShelterCache = {};
    for (const s of SHELTERS) {
      const e = (data as Record<string, unknown>)[s.id] as Partial<ShelterCacheEntry> | undefined;
      if (!e || typeof e.verifiedAt !== "number") return null;
      out[s.id] = { verifiedAt: e.verifiedAt, availableSpaces: typeof e.availableSpaces === "number" ? e.availableSpaces : s.availableSpaces === null ? null : s.availableSpaces };
    }
    return out;
  } catch {
    return null;
  }
}

/**
 * Simulated periodic verification while online. Deterministic drift so the
 * screen visibly updates without pretending to talk to real responders.
 */
export function refreshShelterCache(prev: ShelterCache, now = Date.now()): ShelterCache {
  const next: ShelterCache = {};
  for (const s of SHELTERS) {
    const e = prev[s.id] ?? { verifiedAt: now, availableSpaces: s.availableSpaces };
    let spaces = e.availableSpaces;
    if (spaces !== null && s.status !== "FULL") {
      const drift = ((now / SHELTER_REFRESH_MS) | 0) % 3 === 0 ? -1 : 0;
      spaces = Math.max(1, spaces + drift);
    }
    next[s.id] = { verifiedAt: now, availableSpaces: spaces };
  }
  return next;
}

export function minutesSince(ts: number, now = Date.now()): number {
  return Math.max(0, Math.round((now - ts) / 60_000));
}

/** Shelter view with live cache applied. */
export interface LiveShelter extends Shelter {
  verifiedMin: number;
}

export function liveShelters(cache: ShelterCache | null, now = Date.now()): LiveShelter[] {
  return SHELTERS.map((s) => {
    const e = cache?.[s.id];
    return {
      ...s,
      availableSpaces: e ? e.availableSpaces : s.availableSpaces,
      verifiedMin: e ? minutesSince(e.verifiedAt, now) : s.lastVerifiedMin,
    };
  });
}

// ---------------------------------------------------------------------------
// Hazards & routing
// ---------------------------------------------------------------------------

export function parseHazardReports(raw: string | null): Hazard[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter((h): h is Hazard => {
      if (!h || typeof h !== "object") return false;
      const x = h as Partial<Hazard>;
      return (
        typeof x.id === "string" &&
        typeof x.kind === "string" &&
        x.kind in HAZARD_META &&
        !!x.pos &&
        (typeof x.roadKey === "string" || typeof x.osmWayId === "string")
      );
    });
  } catch {
    return [];
  }
}

export function roadMidpoint(roadKey: RoadKey): Point {
  const r = ROADS.find((x) => x.key === roadKey)!;
  const a = r.points[0]!;
  const b = r.points[r.points.length - 1]!;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function routeBlockedBy(route: RouteDef, hazards: Hazard[]): Hazard | null {
  return hazards.find((h) => h.roadKey && route.roads.includes(h.roadKey)) ?? null;
}

export interface RouteResult {
  /** null = no cached route to this shelter avoids the reported hazards. */
  route: RouteDef | null;
  rerouted: boolean;
  minutes: number;
  /** Hazard that closed Route A (if any). */
  blockedBy: Hazard | null;
}

/** Deterministic routing: Route A unless a hazard sits on it, then Route B, else unreachable. */
export function computeRoute(shelter: Shelter, hazards: Hazard[]): RouteResult {
  const aBlock = routeBlockedBy(shelter.routeA, hazards);
  if (!aBlock) return { route: shelter.routeA, rerouted: false, minutes: walkMinutes(shelter.routeA.distanceKm), blockedBy: null };
  if (shelter.routeB && !routeBlockedBy(shelter.routeB, hazards)) {
    return { route: shelter.routeB, rerouted: true, minutes: walkMinutes(shelter.routeB.distanceKm), blockedBy: aBlock };
  }
  return { route: null, rerouted: false, minutes: 0, blockedBy: aBlock };
}

export interface Needs {
  accessible: boolean;
  medical: boolean;
}

export interface RankedShelter {
  shelter: LiveShelter;
  result: RouteResult;
  reachable: boolean;
}

/**
 * Simple deterministic ranking (no AI):
 * 1 reachable route · 2 not FULL · 3 suits needs (accessibility / medical) · 4 distance · 5 freshness.
 */
export function rankShelters(list: LiveShelter[], hazards: Hazard[], needs: Needs, excludeId?: string): RankedShelter[] {
  const rows: RankedShelter[] = list
    .filter((s) => s.id !== excludeId)
    .map((s) => {
      const result = computeRoute(s, hazards);
      return { shelter: s, result, reachable: result.route !== null };
    });
  const score = (r: RankedShelter) => {
    let n = 0;
    if (r.reachable) n += 1000;
    if (r.shelter.status !== "FULL") n += 500;
    if (needs.medical && hasMedical(r.shelter)) n += 120;
    if (needs.accessible && isAccessible(r.shelter)) n += 120;
    if (r.shelter.status === "AVAILABLE") n += 60;
    if (r.shelter.type !== "SAFE_ASSEMBLY_ZONE") n += 30;
    return n;
  };
  rows.sort((a, b) => {
    const d = score(b) - score(a);
    if (d !== 0) return d;
    const da = a.result.route?.distanceKm ?? a.shelter.distanceKm;
    const db = b.result.route?.distanceKm ?? b.shelter.distanceKm;
    if (da !== db) return da - db;
    return a.shelter.verifiedMin - b.shelter.verifiedMin;
  });
  return rows;
}

/** Best reachable alternative with space, or null. */
export function rerouteTarget(list: LiveShelter[], hazards: Hazard[], needs: Needs, excludeId: string): RankedShelter | null {
  const top = rankShelters(list, hazards, needs, excludeId)[0];
  return top && top.reachable && top.shelter.status !== "FULL" ? top : null;
}
