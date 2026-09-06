import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, Clock, Hash, Loader2, MapPin, ShieldAlert, WifiOff } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { formatTime, useResq } from "@/lib/resq-store";
import { SELF_HELPER_ID, isRequestActive } from "@/lib/community";
import { CommunitySignalCard } from "./CommunityBits";
import { DeliveryBadge } from "./DeliveryBadge";
import { InfoRow } from "./HomeScreen";

/** Feedback after SOS NOW. Never claims real emergency services were reached. */
export function DirectSosSaved({ id }: { id?: string | undefined }) {
  const { t } = useLang();
  const { packets, latestPacket, hydrated, communityRequests } = useResq();
  const packet = (id ? packets.find((p) => p.id === id) : undefined) ?? latestPacket;

  if (!hydrated) return null;
  if (!packet) {
    return (
      <section className="resq-card flex flex-col items-center gap-4 px-6 py-10 text-center">
        <p className="text-lg font-extrabold">{t("noNearbyRequests")}</p>
        <Link to="/" className="btn btn-primary btn-lg w-full">
          {t("returnHome")}
        </Link>
      </section>
    );
  }

  const delivered = packet.deliveryStatus === "DELIVERED_DEMO";
  const syncing = packet.deliveryStatus === "SYNCING";
  const offline = packet.deliveryStatus === "QUEUED_OFFLINE";
  const ownRequest = communityRequests.filter((r) => r.requesterId === SELF_HELPER_ID && isRequestActive(r, Date.now())).sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null;

  return (
    <div className="flex flex-col gap-4" role="status" aria-live="polite" data-testid="direct-sos-saved">
      <section className={`resq-card p-5 text-center ${delivered ? "border-safe-border bg-safe-soft" : "border-emergency-border bg-emergency-soft"}`}>
        <span className={`mx-auto grid h-20 w-20 place-items-center rounded-full ${delivered ? "bg-safe text-safe-foreground" : "bg-emergency text-emergency-foreground"}`}>
          {syncing ? <Loader2 className="h-10 w-10 animate-spin" aria-hidden /> : delivered ? <Check className="h-10 w-10" strokeWidth={3} aria-hidden /> : <span className="text-lg font-black tracking-wider">SOS</span>}
        </span>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight">{t("sosNowSaved")}</h1>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <span className="rounded-full bg-emergency px-3 py-1 text-xs font-extrabold tracking-widest text-emergency-foreground">{t("p0Critical")}</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-navy px-3 py-1 text-xs font-extrabold tracking-widest text-navy-foreground">
            <MapPin className="h-3.5 w-3.5" aria-hidden />
            {t("locationAttachedShort")}
          </span>
          {offline && (
            <span className="inline-flex items-center gap-1 rounded-full bg-warning px-3 py-1 text-xs font-extrabold tracking-widest text-warning-foreground">
              <WifiOff className="h-3.5 w-3.5" aria-hidden />
              {t("storedOffline")}
            </span>
          )}
        </div>
        <p className="mt-3 text-base font-bold">{offline ? t("sosRemainsSaved") : syncing ? t("sosNowSyncing") : t("sosNowSentDemo")}</p>
      </section>

      <section className="resq-card p-4">
        <InfoRow icon={Hash} label={t("emergencyId")} value={packet.id} />
        <InfoRow icon={ShieldAlert} label={t("priority")} value={t("p0Critical")} />
        <InfoRow icon={MapPin} label={t("location")} value={packet.locationLabel} />
        <InfoRow icon={Clock} label={t("time")} value={formatTime(packet.createdAt)} />
        <div className="mt-2 flex items-center gap-3 border-t pt-3">
          <span className="text-sm text-muted-foreground">{t("delivery")}:</span>
          <DeliveryBadge status={packet.deliveryStatus} large />
        </div>
      </section>

      {ownRequest ? <CommunitySignalCard request={ownRequest} compact /> : <p className="text-sm text-muted-foreground">{t("communityAlertNote")}</p>}
      <p className="text-sm text-muted-foreground">{t("addDetailsLater")}</p>

      <div className="flex flex-col gap-2">
        <Link
          to="/sos-status"
          search={{ id: packet.id }}
          className="btn btn-primary btn-lg w-full"
        >
          {t("viewDeliveryStatus")}
          <ArrowRight className="h-5 w-5" aria-hidden />
        </Link>
        <Link to="/" className="btn btn-secondary btn-lg w-full">
          {t("returnHome")}
        </Link>
      </div>
    </div>
  );
}
