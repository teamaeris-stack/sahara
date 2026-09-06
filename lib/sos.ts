import {
  Accessibility,
  Baby,
  Boxes,
  Droplets,
  Flame,
  HeartPulse,
  HelpCircle,
  PersonStanding,
  Bandage,
  UserSearch,
  Stethoscope,
  Pill,
  Mountain,
  Tornado,
  Activity,
  type LucideIcon,
} from "lucide-react";
import type { L, Lang } from "./i18n";

export type SOSDeliveryStatus = "QUEUED_OFFLINE" | "SYNCING" | "DELIVERED_DEMO";

export type EmergencyType =
  | "EARTHQUAKE"
  | "FLOOD"
  | "CYCLONE"
  | "LANDSLIDE"
  | "FIRE"
  | "TRAPPED"
  | "MEDICAL"
  | "INJURY"
  | "MISSING_PERSON"
  | "OTHER"
  /** One-tap SOS NOW: no questions asked. Never offered in the documented flow. */
  | "URGENT_UNSPECIFIED";

export type SOSFlag =
  | "MEDICAL_HELP"
  | "CANNOT_MOVE"
  | "CHILD"
  | "ELDERLY"
  | "ACCESSIBILITY"
  | "TRAPPED"
  | "PREGNANT"
  | "MOBILITY_LIMITATION"
  | "MEDICAL_DEPENDENCY";

/** Machine-readable answers keyed by question id; values are English enum strings or short free text. */
export type SOSResponses = Record<string, string>;

export type PeopleRange = "1-5" | "6-20" | "21-50" | "51+";

export const PEOPLE_RANGES: { value: PeopleRange; label: string; minimum: number }[] = [
  { value: "1-5", label: "1–5", minimum: 1 },
  { value: "6-20", label: "6–20", minimum: 6 },
  { value: "21-50", label: "21–50", minimum: 21 },
  { value: "51+", label: "51+", minimum: 51 },
];

export function peopleRangeLabel(range: PeopleRange | undefined, count: number): string {
  return range
    ? (PEOPLE_RANGES.find((option) => option.value === range)?.label ?? range)
    : String(count);
}

export interface SOSPacket {
  id: string;
  type: EmergencyType;
  /** Emergency-specific sub-category (Phase 4+). Older packets omit it. */
  subType?: string | undefined;
  /** Branching-question answers (Phase 4+). Older packets omit it. */
  responses?: SOSResponses | undefined;
  peopleCount: number;
  /** Selected group-size band. peopleCount remains the minimum for older consumers. */
  peopleRange?: PeopleRange | undefined;
  flags: SOSFlag[];
  latitude: number;
  longitude: number;
  locationLabel: string;
  description?: string | undefined;
  createdAt: string;
  priority: "P0";
  deliveryStatus: SOSDeliveryStatus;
  source: SOSSource;
  hopCount: number;
}

/** DIRECT_USER_REPORT = documented flow; DIRECT_SOS_BUTTON = one-tap SOS NOW. */
export type SOSSource = "DIRECT_USER_REPORT" | "DIRECT_SOS_BUTTON";

export interface SOSDraft {
  type: EmergencyType;
  subType?: string | undefined;
  responses?: SOSResponses | undefined;
  peopleCount: number;
  peopleRange?: PeopleRange | undefined;
  flags: SOSFlag[];
  latitude: number;
  longitude: number;
  locationLabel: string;
  description?: string | undefined;
  /** Missing-person reports from Family: which member the report is about (never sent to helpers). */
  subjectMemberId?: string | undefined;
}

/** Natural-disaster situations first; the flow for each type lives in sos-flows.ts. */
export const EMERGENCY_TYPES: { key: EmergencyType; label: L; icon: LucideIcon }[] = [
  { key: "EARTHQUAKE", label: { en: "EARTHQUAKE", hi: "भूकंप" }, icon: Activity },
  { key: "FLOOD", label: { en: "FLOOD", hi: "बाढ़" }, icon: Droplets },
  { key: "CYCLONE", label: { en: "CYCLONE / STORM", hi: "चक्रवात / तूफ़ान" }, icon: Tornado },
  { key: "LANDSLIDE", label: { en: "LANDSLIDE", hi: "भूस्खलन" }, icon: Mountain },
  { key: "FIRE", label: { en: "FIRE", hi: "आग" }, icon: Flame },
  { key: "TRAPPED", label: { en: "TRAPPED", hi: "फँसे हुए" }, icon: Boxes },
  { key: "MEDICAL", label: { en: "MEDICAL", hi: "चिकित्सा" }, icon: HeartPulse },
  { key: "INJURY", label: { en: "INJURY", hi: "चोट" }, icon: Bandage },
  { key: "MISSING_PERSON", label: { en: "MISSING PERSON", hi: "लापता व्यक्ति" }, icon: UserSearch },
  { key: "OTHER", label: { en: "OTHER", hi: "अन्य" }, icon: HelpCircle },
];

export const SOS_FLAGS: { key: SOSFlag; label: L; icon: LucideIcon }[] = [
  {
    key: "MEDICAL_HELP",
    label: { en: "MEDICAL HELP NEEDED", hi: "चिकित्सा सहायता चाहिए" },
    icon: Stethoscope,
  },
  { key: "CANNOT_MOVE", label: { en: "CANNOT MOVE", hi: "हिल नहीं सकते" }, icon: PersonStanding },
  { key: "CHILD", label: { en: "CHILD PRESENT", hi: "बच्चा साथ है" }, icon: Baby },
  {
    key: "ELDERLY",
    label: { en: "ELDERLY PERSON PRESENT", hi: "बुज़ुर्ग साथ हैं" },
    icon: HeartPulse,
  },
  {
    key: "ACCESSIBILITY",
    label: { en: "ACCESSIBILITY ASSISTANCE", hi: "सुगमता सहायता" },
    icon: Accessibility,
  },
  { key: "TRAPPED", label: { en: "TRAPPED", hi: "फँसे हुए" }, icon: Boxes },
  { key: "PREGNANT", label: { en: "PREGNANT PERSON", hi: "गर्भवती महिला" }, icon: HeartPulse },
  {
    key: "MOBILITY_LIMITATION",
    label: { en: "MOBILITY LIMITATION", hi: "चलने-फिरने में कठिनाई" },
    icon: PersonStanding,
  },
  {
    key: "MEDICAL_DEPENDENCY",
    label: { en: "MEDICAL DEPENDENCY", hi: "दवा/चिकित्सा पर निर्भर" },
    icon: Pill,
  },
];

export const FALLBACK_LOCATION = {
  latitude: 10.1076,
  longitude: 76.3516,
  label: "Aluva Demo Location",
} as const;

export const SOS_STORAGE_KEY = "resq_sos_packets";

const URGENT_LABEL: L = { en: "URGENT — SOS NOW", hi: "अत्यावश्यक — SOS अभी" };
const TYPE_SET = new Set<string>([...EMERGENCY_TYPES.map((t) => t.key), "URGENT_UNSPECIFIED"]);
/** Last location Sahara captured on this device (used so SOS NOW never waits for GPS). */
export const LAST_LOCATION_KEY = "resq_last_location";

export interface CachedLocation {
  latitude: number;
  longitude: number;
  at: number;
}

export function readCachedLocation(): CachedLocation | null {
  try {
    const raw = localStorage.getItem(LAST_LOCATION_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<CachedLocation>;
    return typeof v.latitude === "number" &&
      typeof v.longitude === "number" &&
      typeof v.at === "number"
      ? (v as CachedLocation)
      : null;
  } catch {
    return null;
  }
}

export function writeCachedLocation(latitude: number, longitude: number) {
  try {
    localStorage.setItem(
      LAST_LOCATION_KEY,
      JSON.stringify({ latitude, longitude, at: Date.now() }),
    );
  } catch {
    /* ignore */
  }
}
const FLAG_SET = new Set<string>(SOS_FLAGS.map((f) => f.key));
const STATUS_SET = new Set<string>(["QUEUED_OFFLINE", "SYNCING", "DELIVERED_DEMO"]);

export function typeLabel(type: EmergencyType, lang: Lang = "en"): string {
  if (type === "URGENT_UNSPECIFIED") return URGENT_LABEL[lang];
  const l = EMERGENCY_TYPES.find((t) => t.key === type)?.label;
  return l ? l[lang] : type;
}

export function flagLabel(flag: SOSFlag, lang: Lang = "en"): string {
  const l = SOS_FLAGS.find((f) => f.key === flag)?.label;
  return l ? l[lang] : flag;
}

export function isPending(p: SOSPacket): boolean {
  return p.deliveryStatus !== "DELIVERED_DEMO";
}

/** True when the latest report suggests the user needs accessibility support. */
export function needsAccessibility(p: SOSPacket | null): boolean {
  if (!p) return false;
  return p.flags.some(
    (f) => f === "ACCESSIBILITY" || f === "MOBILITY_LIMITATION" || f === "CANNOT_MOVE",
  );
}

/** True when the latest report suggests the user needs medical support. */
export function needsMedical(p: SOSPacket | null): boolean {
  if (!p) return false;
  return (
    p.type === "MEDICAL" ||
    p.type === "INJURY" ||
    p.flags.some((f) => f === "MEDICAL_HELP" || f === "MEDICAL_DEPENDENCY")
  );
}

export function generateSosId(existing: string[]): string {
  const taken = new Set(existing);
  for (let i = 0; i < 20; i++) {
    const seed = (Date.now() + Math.floor(Math.random() * 100_000)) % 9000;
    const id = `SAHARA-SOS-${String(1000 + seed).padStart(4, "0")}`;
    if (!taken.has(id)) return id;
  }
  return `SAHARA-SOS-${Date.now().toString().slice(-4)}`;
}

/** Safely parse the stored packet list; malformed data yields an empty array. */
export function parsePackets(raw: string | null): SOSPacket[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter(isPacket).map(normalizePacket);
  } catch {
    return [];
  }
}

function normalizePacket(p: SOSPacket): SOSPacket {
  // Unknown flags from future builds are dropped rather than rejecting the whole packet.
  const flags = p.flags.filter((f) => FLAG_SET.has(f));
  const responses =
    p.responses && typeof p.responses === "object"
      ? Object.fromEntries(Object.entries(p.responses).filter(([, v]) => typeof v === "string"))
      : undefined;
  const peopleRange = PEOPLE_RANGES.some((option) => option.value === p.peopleRange)
    ? p.peopleRange
    : undefined;
  return {
    ...p,
    flags,
    responses,
    peopleRange,
    subType: typeof p.subType === "string" ? p.subType : undefined,
  };
}

function isPacket(v: unknown): v is SOSPacket {
  if (!v || typeof v !== "object") return false;
  const p = v as Partial<Record<keyof SOSPacket, unknown>>;
  return (
    typeof p.id === "string" &&
    typeof p.type === "string" &&
    TYPE_SET.has(p.type) &&
    typeof p.peopleCount === "number" &&
    Array.isArray(p.flags) &&
    p.flags.every((f) => typeof f === "string") &&
    typeof p.latitude === "number" &&
    typeof p.longitude === "number" &&
    typeof p.locationLabel === "string" &&
    typeof p.createdAt === "string" &&
    typeof p.deliveryStatus === "string" &&
    STATUS_SET.has(p.deliveryStatus)
  );
}

export function formatCoord(n: number): string {
  return n.toFixed(4);
}
