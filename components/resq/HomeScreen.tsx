import { Link, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  CheckCircle2,
  Siren,
  MessageSquareDashed,
  Wifi,
  WifiOff,
  Clock,
  HardDrive,
  Timer,
  HelpCircle,
  Building2,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { SELF_HELPER_ID, helperEligibility, isRequestActive, nearbyRequests } from "@/lib/community";
import { useLang } from "@/lib/i18n";
import { formatCountdown, formatTime, useNow, useResq, type UserStatus } from "@/lib/resq-store";
import { typeLabel } from "@/lib/sos";
import { subTypeLabel } from "@/lib/sos-flows";
import { Sheet, SheetButton } from "./Sheet";
import { DeliveryBadge } from "./DeliveryBadge";
import { CommunitySignalCard, NearbyRequestCard } from "./CommunityBits";
import { RelayPanel } from "./RelayPanel";

type Panel = "none" | "safe" | "choose";

export function HomeScreen() {
  const {
    networkStatus,
    userStatus,
    statusUpdatedAt,
    setUserStatus,
    hydrated,
    latestPacket,
    initialCheckinDeadline,
    nextSafetyCheckAt,
    recheckDue,
    createDirectSos,
    lastSafetyCheckAt,
    packets,
    communityRequests,
    helperResponses,
    respondToRequest,
  } = useResq();
  const { t, lang } = useLang();
  const [panel, setPanel] = useState<Panel>("none");
  const navigate = useNavigate();
  const online = networkStatus === "ONLINE";
  const close = () => setPanel("none");

  const markSafe = () => {
    setUserStatus("SAFE");
    setPanel("safe");
  };
  // I NEED HELP is first a SAFETY STATUS: family learns immediately, then the user chooses how to continue.
  const needHelp = () => {
    close();
    setUserStatus("NEEDS_HELP");
    navigate({ to: "/help" });
  };
  const sosNow = () => {
    close();
    const p = createDirectSos();
    navigate({ to: "/sos-now", search: { id: p.id } });
  };

  // Two options only (I'M SAFE / I NEED HELP) for the initial check-in, after a missed check-in, and when a recheck is due.
  const initialPending = !hydrated || userStatus === "UNKNOWN";
  const showPrimary = initialPending || userStatus === "NO_RESPONSE" || recheckDue;
  const sub = latestPacket ? subTypeLabel(latestPacket.type, latestPacket.subType, lang) : null;

  // Community alert card: only for users who are safely eligible to share information.
  const eligibility = hydrated ? helperEligibility({ userStatus, lastSafetyCheckAt, recheckDue, packets, now: Date.now() }) : null;
  const nearby = eligibility?.eligible ? nearbyRequests(communityRequests, helperResponses, Date.now()) : [];
  const nearest = nearby[0] ?? null;
  // Requester view: this device's own active nearby-assistance request (created by I NEED HELP / SOS).
  const ownRequest = hydrated ? communityRequests.filter((r) => r.requesterId === SELF_HELPER_ID && isRequestActive(r, Date.now())).sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null : null;

  return (
    <div className="flex flex-col gap-4">
      <RelayPanel />
      {/* Disaster mode banner */}
      <section
        role="alert"
        className="flex items-center gap-3 rounded-xl border border-emergency-border bg-emergency px-4 py-3 text-emergency-foreground shadow-card"
      >
        <AlertTriangle className="h-7 w-7 shrink-0" aria-hidden />
        <div>
          <p className="text-lg font-extrabold leading-tight tracking-wide">{t("disasterModeActive")}</p>
          <p className="text-sm opacity-90">{t("disasterModeSub")}</p>
        </div>
      </section>

      {/* Network state */}
      <section
        aria-live="polite"
        className={`resq-card p-4 ${online ? "border-safe-border bg-safe-soft" : "border-warning-border bg-warning-soft"}`}
      >
        <div className="flex items-center gap-3">
          <span
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${online ? "bg-safe text-safe-foreground" : "bg-warning text-warning-foreground"}`}
          >
            {online ? <Wifi className="h-6 w-6" aria-hidden /> : <WifiOff className="h-6 w-6" aria-hidden />}
          </span>
          <div className="min-w-0">
            <p className="text-base font-extrabold tracking-wide">{online ? t("connected") : t("offlineResilience")}</p>
            {online ? (
              <p className="text-sm text-muted-foreground">{t("connectedSub")}</p>
            ) : (
              <p className="text-xl font-bold leading-tight">{t("resqStillWorking")}</p>
            )}
          </div>
        </div>
        {!online && <p className="mt-3 text-sm text-muted-foreground">{t("offlineSub")}</p>}
      </section>

      {/* Check-in prompt: initial 90 s countdown, or the 10-minute recheck */}
      {hydrated && initialPending && initialCheckinDeadline && <CheckinCountdown deadline={initialCheckinDeadline} />}
      {hydrated && recheckDue && (
        <section role="alert" className="rounded-xl border-2 border-warning-border bg-warning-soft px-4 py-3">
          <p className="flex items-center gap-2 text-lg font-extrabold tracking-wide">
            <HelpCircle className="h-6 w-6 shrink-0 text-warning-foreground" aria-hidden />
            {t("stillSafe")}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{t("stillSafeSub")}</p>
        </section>
      )}

      {/* Primary actions */}
      {showPrimary && (
        <section aria-label="Emergency actions" className="flex flex-col gap-3">
          <ActionButton icon={CheckCircle2} label={t("imSafe")} tone="safe" onClick={markSafe} />
          <ActionButton icon={Siren} label={t("iNeedHelp")} tone="emergency" onClick={needHelp} />
        </section>
      )}

      {/* Permanent one-tap SOS — visually distinct from I NEED HELP */}
      <button
        type="button"
        onClick={sosNow}
        data-testid="sos-now"
        aria-label={`${t("sosNow")} — ${t("sosNowSub")}`}
        className="btn btn-lg min-h-20 w-full justify-start gap-4 border-2 border-emergency bg-card px-5 text-emergency shadow-action hover:bg-emergency-soft"
      >
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-emergency text-sm font-black tracking-wider text-emergency-foreground" aria-hidden>
          SOS
        </span>
        <span className="min-w-0 text-left">
          <span className="block text-2xl font-black tracking-wide">{t("sosNow")}</span>
          <span className="block text-sm font-semibold text-muted-foreground">{t("sosNowSub")}</span>
        </span>
      </button>

      {/* Requester: status of this device's nearby-assistance request */}
      {ownRequest && <CommunitySignalCard request={ownRequest} compact />}

      {/* Helper: shown only when this user is safely eligible and a nearby request exists */}
      {nearest && <NearbyRequestCard request={nearest} onDecline={() => respondToRequest(nearest.id, "DECLINED")} />}

      {/* Persistent status card */}
      {hydrated && userStatus !== "UNKNOWN" && (
        <section aria-labelledby="your-status" className="resq-card p-4">
          <h2 id="your-status" className="section-label">
            {t("yourStatus")}
          </h2>
          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <StatusIcon status={userStatus} />
              <div className="min-w-0">
                <p className="text-2xl font-extrabold leading-none">{statusLabel(userStatus, t)}</p>
                <p className="mt-1 whitespace-nowrap text-sm text-muted-foreground">
                  {t("updated")}: {formatTime(statusUpdatedAt)}
                </p>
              </div>
            </div>
            {!showPrimary && (
              <button
                type="button"
                onClick={() => setPanel("choose")}
                className="btn btn-secondary shrink-0 px-3 text-xs"
              >
                {t("updateStatus")}
              </button>
            )}
          </div>
          {userStatus === "NO_RESPONSE" && (
            <>
              <p className="mt-2 text-base font-bold">{t("noSafetyUpdate")}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t("noResponseNote")}</p>
            </>
          )}
          {(userStatus === "SAFE" || userStatus === "AT_SHELTER") && nextSafetyCheckAt && !recheckDue && <RecheckCountdown at={nextSafetyCheckAt} />}
          {recheckDue && <p className="mt-2 text-sm font-bold text-warning-foreground">{t("recheckOverdueNote")}</p>}
        </section>
      )}

      {/* Active emergency card */}
      {hydrated && latestPacket && (
        <section aria-labelledby="active-sos" className="resq-card border-emergency-border p-4">
          <h2 id="active-sos" className="section-label text-emergency">
            {t("activeEmergency")}
          </h2>
          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Siren className="h-9 w-9 shrink-0 text-emergency" aria-hidden />
              <div className="min-w-0">
                <p className="truncate text-xl font-extrabold leading-none">{typeLabel(latestPacket.type, lang)}</p>
                <p className="mt-1 truncate text-xs font-bold text-muted-foreground">
                  {sub ? `${sub} · ` : ""}
                  {latestPacket.id}
                </p>
              </div>
            </div>
            <Link
              to="/sos-status"
              search={{ id: latestPacket.id }}
              className="btn btn-secondary shrink-0 px-3 text-xs"
            >
              {t("viewStatus")}
            </Link>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-emergency px-2 py-0.5 text-[11px] font-extrabold tracking-wide text-emergency-foreground">
              {t("p0Critical")}
            </span>
            <DeliveryBadge status={latestPacket.deliveryStatus} />
          </div>
        </section>
      )}

      {/* Offline readiness — informational only */}
      <section aria-labelledby="readiness" className="resq-card p-4">
        <h2 id="readiness" className="section-label">
          {t("offlineReadiness")}
        </h2>
        <p className="mt-2 flex items-center gap-2 text-base font-extrabold tracking-wide">
          {online ? (
            <>
              <CheckCircle2 className="h-5 w-5 shrink-0 text-safe" aria-hidden />
              {t("readinessReady")}
            </>
          ) : (
            <>
              <WifiOff className="h-5 w-5 shrink-0 text-warning-foreground" aria-hidden />
              {t("readinessOffline")}
            </>
          )}
        </p>
        <dl className="mt-3 divide-y text-sm">
          <ReadinessRow label={t("rEmergencyStatus")} value={t("ready")} />
          <ReadinessRow label={t("rSosStorage")} value={t("ready")} />
          <ReadinessRow label={t("rGuidance")} value={t("ready")} />
          <ReadinessRow label={t("rShelters")} value={t("ready")} />
          <ReadinessRow label={t("rRoutes")} value={t("ready")} />
        </dl>
        {!online && <p className="mt-3 text-sm text-muted-foreground">{t("offlineSub")}</p>}
      </section>

      {/* I'M SAFE confirmation */}
      <Sheet open={panel === "safe"} onOpenChange={(o) => !o && close()} title={t("markedSafeTitle")}>
        <div className="rounded-xl border border-safe-border bg-safe-soft p-4">
          <InfoRow icon={CheckCircle2} label={t("status")} value={t("safe")} />
          <InfoRow icon={Clock} label={t("lastUpdated")} value={formatTime(statusUpdatedAt)} />
          <InfoRow icon={HardDrive} label={t("storage")} value={t("savedOnDevice")} />
        </div>
        {!online && <p className="mt-3 text-sm text-muted-foreground">{t("safeOfflineNote")}</p>}
        <div className="mt-5">
          <SheetButton variant="safe" onClick={close} autoFocus>
            {t("done")}
          </SheetButton>
        </div>
      </Sheet>

      {/* Update status chooser */}
      <Sheet open={panel === "choose"} onOpenChange={(o) => !o && close()} title={t("updateStatus")} description={t("chooseStatus")}>
        <div className="flex flex-col gap-3">
          {userStatus !== "SAFE" && <ActionButton icon={CheckCircle2} label={t("imSafe")} tone="safe" onClick={markSafe} compact />}
          <ActionButton icon={Siren} label={t("iNeedHelp")} tone="emergency" onClick={needHelp} compact />
          <SheetButton variant="outline" onClick={close}>
            {t("cancel")}
          </SheetButton>
        </div>
      </Sheet>
    </div>
  );
}

function CheckinCountdown({ deadline }: { deadline: number }) {
  const { t } = useLang();
  const now = useNow();
  return (
    <section role="timer" aria-live="polite" className="rounded-xl border-2 border-emergency-border bg-emergency-soft px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-base font-extrabold tracking-wide">
            <Timer className="h-5 w-5 shrink-0 text-emergency" aria-hidden />
            {t("checkinRequired")}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">{t("checkinSub")}</p>
        </div>
        <p className="shrink-0 text-4xl font-black tabular-nums leading-none text-emergency" data-testid="checkin-countdown">
          {formatCountdown(deadline - now)}
        </p>
      </div>
    </section>
  );
}

function RecheckCountdown({ at }: { at: number }) {
  const { t } = useLang();
  const now = useNow();
  return (
    <p className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-muted px-3 py-2" role="timer" aria-live="off">
      <span className="flex items-center gap-2 text-xs font-extrabold tracking-widest text-muted-foreground">
        <Timer className="h-4 w-4" aria-hidden />
        {t("nextSafetyCheck")}
      </span>
      <span className="text-lg font-extrabold tabular-nums" data-testid="recheck-countdown">
        {formatCountdown(at - now)}
      </span>
    </p>
  );
}

function StatusIcon({ status }: { status: UserStatus }) {
  switch (status) {
    case "SAFE":
      return <CheckCircle2 className="h-9 w-9 shrink-0 text-safe" aria-hidden />;
    case "AT_SHELTER":
      return <Building2 className="h-9 w-9 shrink-0 text-safe" aria-hidden />;
    case "NEEDS_HELP":
      return <Siren className="h-9 w-9 shrink-0 text-emergency" aria-hidden />;
    case "NO_RESPONSE":
      return <Clock className="h-9 w-9 shrink-0 text-muted-foreground" aria-hidden />;
    default:
      return <MessageSquareDashed className="h-9 w-9 shrink-0 text-warning-foreground" aria-hidden />;
  }
}

export function statusLabel(status: UserStatus, t: (k: Parameters<ReturnType<typeof useLang>["t"]>[0]) => string): string {
  switch (status) {
    case "SAFE":
      return t("safe");
    case "AT_SHELTER":
      return t("atShelter");
    case "NEEDS_HELP":
      return t("needsHelp");
    case "NO_RESPONSE":
      return t("noResponseYet");
    case "CANNOT_RESPOND":
      return t("cantRespond");
    default:
      return t("unknown");
  }
}

function ReadinessRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="flex items-center gap-1.5 font-bold">
        <CheckCircle2 className="h-4 w-4 text-safe" aria-hidden />
        {value}
      </dd>
    </div>
  );
}

export function ActionButton({
  icon: Icon,
  label,
  tone,
  onClick,
  compact,
}: {
  icon: LucideIcon;
  label: string;
  tone: "safe" | "emergency" | "warning";
  onClick: () => void;
  compact?: boolean;
}) {
  const tones = { safe: "btn-safe", emergency: "btn-danger", warning: "btn-warning" }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`btn btn-lg w-full justify-start gap-4 px-5 shadow-action ${compact ? "min-h-16" : "min-h-22"} ${tones}`}
    >
      <Icon className={compact ? "h-8 w-8 shrink-0" : "h-11 w-11 shrink-0"} strokeWidth={2.25} aria-hidden />
      <span className={`font-extrabold tracking-wide ${compact ? "text-xl" : "text-2xl"}`}>{label}</span>
    </button>
  );
}

export function InfoRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <Icon className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="w-28 shrink-0 text-sm text-muted-foreground">{label}:</span>
      <span className="text-base font-bold">{value}</span>
    </div>
  );
}
