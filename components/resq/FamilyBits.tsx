import { AlertTriangle, Building2, CheckCircle2, Clock, HelpCircle, MessageSquareDashed, Siren, type LucideIcon } from "lucide-react";
import { useLang, type TKey } from "@/lib/i18n";
import type { DisplayStatus, EventSource } from "@/lib/family";

const STYLE: Record<DisplayStatus, { icon: LucideIcon; key: TKey; cls: string }> = {
  SAFE_RECENT: { icon: CheckCircle2, key: "safeRecent", cls: "border-safe-border bg-safe-soft text-safe" },
  AT_SHELTER: { icon: Building2, key: "atShelter", cls: "border-safe-border bg-safe-soft text-safe" },
  NEEDS_HELP: { icon: Siren, key: "needsHelp", cls: "border-emergency-border bg-emergency-soft text-emergency" },
  CANNOT_RESPOND: { icon: MessageSquareDashed, key: "cantRespond", cls: "border-warning-border bg-warning-soft text-warning-foreground" },
  RECHECK_OVERDUE: { icon: AlertTriangle, key: "recheckOverdue", cls: "border-warning-border bg-warning-soft text-warning-foreground" },
  NO_RESPONSE_YET: { icon: Clock, key: "noResponseShort", cls: "border-input bg-muted text-foreground" },
  NO_RECENT_CONTACT: { icon: HelpCircle, key: "noRecentContact", cls: "border-input bg-muted text-muted-foreground" },
  UNKNOWN: { icon: HelpCircle, key: "unknown", cls: "border-input bg-muted text-muted-foreground" },
};

/** Icon + text + colour — never colour alone. */
export function FamilyStatusBadge({ status, large }: { status: DisplayStatus; large?: boolean }) {
  const { t } = useLang();
  const { icon: Icon, key, cls } = STYLE[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-extrabold tracking-wide ${cls} ${large ? "px-4 py-2 text-base" : "px-2.5 py-1 text-xs"}`}>
      <Icon className={large ? "h-5 w-5" : "h-4 w-4"} strokeWidth={2.5} aria-hidden />
      {t(key)}
    </span>
  );
}

export function sourceKey(src: EventSource | null): TKey {
  switch (src) {
    case "SELF_CHECKIN":
      return "srcSelf";
    case "SELF_SOS":
      return "srcSos";
    case "AUTO_TIMER":
      return "srcTimer";
    case "SHELTER_ARRIVAL":
      return "srcShelter";
    case "SIMULATED_PEER":
      return "srcPeer";
    case "COMMUNITY_WITNESS":
      return "srcCommunity";
    default:
      return "srcSeed";
  }
}
