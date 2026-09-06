import { Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Radio, Users, WifiOff } from "lucide-react";
import {
  ASSISTANCE_META,
  REQUEST_TYPE_KEY,
  communitySignal,
  formatDistance,
  type CommunityRequest,
} from "@/lib/community";
import { useLang } from "@/lib/i18n";
import { useResq } from "@/lib/resq-store";
import { peopleRangeLabel } from "@/lib/sos";

/**
 * Requester view: what Sahara is doing with this device's own nearby-assistance request.
 * Offline = stored only (never claims anyone received it). Online = signal active (prototype backend).
 */
export function CommunitySignalCard({
  request,
  compact,
}: {
  request: CommunityRequest;
  compact?: boolean;
}) {
  const { t } = useLang();
  const { helperResponses, communityReports } = useResq();
  const sig = communitySignal(request, helperResponses, communityReports, Date.now());
  const stored = sig.state === "STORED";
  const closed = sig.state === "RESOLVED";

  return (
    <section
      aria-labelledby={`csig-${request.id}`}
      data-testid="community-signal"
      data-state={sig.state}
      className={`resq-card p-4 ${stored ? "border-warning-border" : closed ? "" : "border-info-border"}`}
    >
      <h2 id={`csig-${request.id}`} className="section-label flex items-center gap-2">
        <Users className="h-4 w-4" aria-hidden />
        {compact ? t("nearbyCommunitySupport") : t("communitySupportStatus")}
      </h2>
      <p className="mt-2 flex items-center gap-2 text-base font-bold">
        {stored ? (
          <WifiOff className="h-5 w-5 shrink-0 text-warning-foreground" aria-hidden />
        ) : closed ? (
          <CheckCircle2 className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
        ) : (
          <Radio className="h-5 w-5 shrink-0 text-info" aria-hidden />
        )}
        {stored ? t("signalStored") : closed ? t("signalResolved") : t("signalActive")}
      </p>
      {stored ? (
        <div className="mt-1 text-sm text-muted-foreground">
          <p>{t("signalStoredNote1")}</p>
          <p>{t("signalStoredNote2")}</p>
        </div>
      ) : (
        !closed && <p className="mt-1 text-sm text-muted-foreground">{t("signalActiveNote")}</p>
      )}
      {!closed && (
        <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Stat label={t("searchRadius")} value={formatDistance(sig.radiusM)} />
          <Stat
            label={t("eligibleNearbyUsers")}
            value={stored ? "—" : String(sig.eligibleNearby)}
          />
          <Stat label={t("communityResponses")} value={stored ? "—" : String(sig.responses)} />
        </dl>
      )}
      {!closed && sig.reportsReceived > 0 && (
        <p className="mt-2 text-sm">
          <span className="text-muted-foreground">{t("informationReceived")}: </span>
          <span className="font-bold">
            {sig.reportsReceived} {t("reportsCount")}
          </span>
        </p>
      )}
      <p className="mt-3 text-xs font-semibold text-muted-foreground">{t("professionalPrimary")}</p>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted px-2 py-2">
      <dt className="text-[11px] font-semibold leading-tight text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-lg font-extrabold tabular-nums leading-none">{value}</dd>
    </div>
  );
}

/** Helper view (eligible safe users only): a nearby request card with VIEW REQUEST / NOT AVAILABLE. */
export function NearbyRequestCard({
  request,
  onDecline,
}: {
  request: CommunityRequest & { distanceM: number };
  onDecline: () => void;
}) {
  const { t } = useLang();
  const first = request.allowedAssistanceTypes[0];
  const urgent = request.requestType === "URGENT_UNKNOWN";
  return (
    <section
      aria-labelledby={`nearby-${request.id}`}
      data-testid="community-alert-card"
      className={`resq-card p-4 ${urgent ? "border-emergency-border" : "border-warning-border"}`}
    >
      <h2
        id={`nearby-${request.id}`}
        className={`section-label flex items-center gap-2 ${urgent ? "text-emergency" : "text-warning-foreground"}`}
      >
        <AlertTriangle className="h-4 w-4" aria-hidden />
        {t("assistanceNeededNearby")}
      </h2>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">{t("approx")}</dt>
        <dd className="font-extrabold">
          {formatDistance(request.distanceM)} {t("approxAway")}
        </dd>
        <dt className="text-muted-foreground">{t("situation")}</dt>
        <dd className="font-bold">{t(REQUEST_TYPE_KEY[request.requestType])}</dd>
        <dt className="text-muted-foreground">{t("people")}</dt>
        <dd className="font-bold">{peopleRangeLabel(request.peopleRange, request.peopleCount)}</dd>
        {first && (
          <>
            <dt className="text-muted-foreground">{t("possibleAssistance")}</dt>
            <dd className="font-bold">{t(ASSISTANCE_META[first].key)}</dd>
          </>
        )}
        <dt className="text-muted-foreground">{t("professionalRescue")}</dt>
        <dd className="font-bold">{t("rescuePending")}</dd>
      </dl>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={onDecline} className="btn btn-secondary text-sm">
          {t("notAvailableBtn")}
        </button>
        <Link to="/community" search={{ id: request.id }} className="btn btn-primary text-sm">
          {t("viewRequest")}
        </Link>
      </div>
    </section>
  );
}
