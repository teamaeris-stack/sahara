import { AlertTriangle, CheckCircle2, Clock, XCircle, type LucideIcon } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { CONFIDENCE_KEY, FACILITY_META, STATUS_KEY, confidenceFor, type Facility, type ShelterStatus } from "@/lib/shelters";

const STATUS_STYLE: Record<ShelterStatus, { icon: LucideIcon; cls: string }> = {
  AVAILABLE: { icon: CheckCircle2, cls: "border-safe-border bg-safe-soft text-safe" },
  LIMITED: { icon: AlertTriangle, cls: "border-warning-border bg-warning-soft text-warning-foreground" },
  FULL: { icon: XCircle, cls: "border-emergency-border bg-emergency-soft text-emergency" },
};

/** Icon + text + colour — never colour alone. */
export function StatusBadge({ status, large }: { status: ShelterStatus; large?: boolean }) {
  const { t } = useLang();
  const { icon: Icon, cls } = STATUS_STYLE[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-extrabold tracking-wide ${cls} ${large ? "px-4 py-2 text-lg" : "px-2.5 py-1 text-xs"}`}>
      <Icon className={large ? "h-6 w-6" : "h-4 w-4"} strokeWidth={2.5} aria-hidden />
      {t(STATUS_KEY[status])}
    </span>
  );
}

export function Freshness({ minutes, showWarning }: { minutes: number; showWarning?: boolean }) {
  const { t } = useLang();
  const conf = confidenceFor(minutes);
  const confCls = conf === "HIGH" ? "text-safe" : conf === "MEDIUM" ? "text-warning-foreground" : "text-emergency";
  return (
    <div className="text-xs text-muted-foreground">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" aria-hidden />
          {t("lastVerified")}: <span className="font-bold text-foreground">{minutes} {t("minAgo")}</span>
        </span>
        <span>
          {t("confidence")}: <span className={`font-extrabold ${confCls}`}>{t(CONFIDENCE_KEY[conf])}</span>
        </span>
      </p>
      {showWarning && conf !== "HIGH" && <p className="mt-0.5 font-semibold text-warning-foreground">{t("availabilityChanged")}</p>}
    </div>
  );
}

export function FacilityChips({ facilities, size = "sm" }: { facilities: Facility[]; size?: "sm" | "md" }) {
  const { t } = useLang();
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label={t("facilities")}>
      {facilities.map((f) => {
        const { icon: Icon, key } = FACILITY_META[f];
        return (
          <li
            key={f}
            className={`inline-flex items-center gap-1 rounded-full bg-muted font-bold text-foreground ${size === "md" ? "px-3 py-1.5 text-sm" : "px-2 py-0.5 text-[11px]"}`}
          >
            <Icon className={size === "md" ? "h-4 w-4 text-primary" : "h-3 w-3 text-primary"} aria-hidden />
            {t(key)}
          </li>
        );
      })}
    </ul>
  );
}
