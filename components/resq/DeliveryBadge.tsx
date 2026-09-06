import { CheckCircle2, Clock, Loader2 } from "lucide-react";
import { useLang, type Lang } from "@/lib/i18n";
import type { SOSDeliveryStatus } from "@/lib/sos";

export function deliveryLabel(status: SOSDeliveryStatus, lang: Lang = "en"): string {
  const en = {
    QUEUED_OFFLINE: "WAITING FOR DELIVERY",
    SYNCING: "SYNCING…",
    DELIVERED_DEMO: "DELIVERED — PROTOTYPE",
  };
  const hi = {
    QUEUED_OFFLINE: "डिलीवरी की प्रतीक्षा",
    SYNCING: "सिंक हो रहा है…",
    DELIVERED_DEMO: "डिलीवर — प्रोटोटाइप",
  };
  return (lang === "hi" ? hi : en)[status];
}

export function DeliveryBadge({ status, large }: { status: SOSDeliveryStatus; large?: boolean }) {
  const { lang } = useLang();
  const styles = {
    QUEUED_OFFLINE: "border-warning-border bg-warning-soft text-warning-foreground",
    SYNCING: "border-input bg-navy-soft text-primary",
    DELIVERED_DEMO: "border-safe-border bg-safe-soft text-safe",
  }[status];
  const Icon = status === "QUEUED_OFFLINE" ? Clock : status === "SYNCING" ? Loader2 : CheckCircle2;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-extrabold tracking-wide ${styles} ${
        large ? "px-3 py-1.5 text-sm" : "px-2 py-0.5 text-[11px]"
      }`}
    >
      <Icon className={`${large ? "h-4 w-4" : "h-3 w-3"} ${status === "SYNCING" ? "animate-spin" : ""}`} aria-hidden />
      {deliveryLabel(status, lang)}
    </span>
  );
}

export function PrototypeFooter() {
  const { t } = useLang();
  return <p className="pt-2 text-center text-xs text-muted-foreground">{t("prototypeFooter")}</p>;
}
