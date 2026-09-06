import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle, BellOff, CheckCircle2, Siren, Volume2, VolumeX, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLang } from "@/lib/i18n";
import { formatCountdown, useNow, useResq } from "@/lib/resq-store";
import { isAlertAcked, markAlertAcked, siren, stopVibration, vibrateAlert, type SirenState } from "@/lib/siren";

/**
 * Full-screen natural-disaster alert shown once per NEW disaster event while the initial
 * check-in is unanswered. Siren (Web Audio) + vibration + visual. Acknowledgement is persisted
 * per event id, so a refresh never replays an acknowledged alert.
 */
export function DisasterAlert() {
  const { hydrated, userStatus, disasterEventId, initialCheckinDeadline, setUserStatus } = useResq();
  const { t } = useLang();
  const navigate = useNavigate();
  const [acked, setAcked] = useState<boolean | null>(null);
  const [sirenState, setSirenState] = useState<SirenState>(siren.state);
  const startedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (!disasterEventId) return;
    setAcked(isAlertAcked(disasterEventId));
  }, [disasterEventId]);

  useEffect(() => siren.subscribe(setSirenState), []);

  const show = hydrated && !!disasterEventId && userStatus === "UNKNOWN" && acked === false;

  // Start alert channels exactly once per event; stop everything when the alert closes.
  useEffect(() => {
    if (!show || !disasterEventId) return;
    if (startedForRef.current !== disasterEventId) {
      startedForRef.current = disasterEventId;
      vibrateAlert();
      void siren.start({ repeat: true });
    }
    return () => {
      siren.stop();
      stopVibration();
    };
  }, [show, disasterEventId]);

  // Any status change (including the automatic NO RESPONSE) acknowledges the alert.
  useEffect(() => {
    if (hydrated && disasterEventId && userStatus !== "UNKNOWN" && acked === false) {
      markAlertAcked(disasterEventId);
      setAcked(true);
    }
  }, [hydrated, disasterEventId, userStatus, acked]);

  if (!show) return null;

  const ack = () => {
    if (disasterEventId) markAlertAcked(disasterEventId);
    setAcked(true);
    siren.stop();
    stopVibration();
  };
  const safe = () => {
    setUserStatus("SAFE");
    ack();
  };
  const help = () => {
    setUserStatus("NEEDS_HELP");
    ack();
    navigate({ to: "/help" });
  };
  const hear = () => void siren.start({ repeat: true });

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="da-title"
      data-testid="disaster-alert"
      className="fixed inset-0 z-[60] flex flex-col bg-emergency text-emergency-foreground"
      onClick={sirenState === "blocked" ? hear : undefined}
    >
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-8 pt-6">
        <div className="flex items-start justify-between gap-3">
          <p className="flex items-center gap-2 text-xs font-extrabold tracking-widest opacity-90">
            <Siren className="h-4 w-4" aria-hidden />
            SAHARA
          </p>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              ack();
            }}
            aria-label={t("dismissAlert")}
            className="tap-target grid place-items-center rounded-lg border border-emergency-foreground/40 px-2 text-xs font-extrabold hover:bg-emergency-foreground/10"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <AlertTriangle className="h-20 w-20 animate-pulse" strokeWidth={2.25} aria-hidden />
          <h1 id="da-title" className="text-3xl font-black leading-tight tracking-tight">
            {t("disasterAlertTitle")}
          </h1>
          <p className="text-lg font-bold opacity-95">{t("safetyCheckRequired")}</p>
          {initialCheckinDeadline && <Countdown deadline={initialCheckinDeadline} />}

          {sirenState === "blocked" && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                hear();
              }}
              className="tap-target flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl border-2 border-emergency-foreground bg-emergency-foreground/10 px-5 text-lg font-extrabold tracking-wide hover:bg-emergency-foreground/20"
            >
              <Volume2 className="h-7 w-7" aria-hidden />
              {t("tapToHear")}
            </button>
          )}
          <p role="status" className="flex items-center gap-2 text-sm font-bold opacity-90" data-testid="siren-state">
            {sirenState === "playing" && (
              <>
                <Volume2 className="h-4 w-4" aria-hidden />
                {t("sirenPlaying")}
              </>
            )}
            {sirenState === "blocked" && (
              <>
                <VolumeX className="h-4 w-4" aria-hidden />
                {t("sirenBlocked")}
              </>
            )}
            {sirenState === "unsupported" && (
              <>
                <BellOff className="h-4 w-4" aria-hidden />
                {t("sirenUnsupported")}
              </>
            )}
          </p>
        </div>

        <div className="flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={safe}
            className="tap-target flex min-h-22 w-full items-center gap-4 rounded-2xl bg-safe px-5 text-safe-foreground shadow-action hover:bg-safe/90"
          >
            <CheckCircle2 className="h-11 w-11 shrink-0" strokeWidth={2.25} aria-hidden />
            <span className="text-2xl font-extrabold tracking-wide">{t("imSafe")}</span>
          </button>
          <button
            type="button"
            onClick={help}
            className="tap-target flex min-h-22 w-full items-center gap-4 rounded-2xl border-2 border-emergency-foreground bg-emergency-foreground px-5 text-emergency shadow-action hover:opacity-90"
          >
            <Siren className="h-11 w-11 shrink-0" strokeWidth={2.25} aria-hidden />
            <span className="text-2xl font-extrabold tracking-wide">{t("iNeedHelp")}</span>
          </button>
          {sirenState === "playing" && (
            <button
              type="button"
              onClick={() => siren.stop()}
              className="tap-target flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border border-emergency-foreground/50 text-base font-extrabold tracking-wide hover:bg-emergency-foreground/10"
            >
              <VolumeX className="h-5 w-5" aria-hidden />
              {t("stopSiren")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Countdown({ deadline }: { deadline: number }) {
  const now = useNow();
  return (
    <p className="text-6xl font-black tabular-nums leading-none" role="timer" data-testid="alert-countdown">
      {formatCountdown(deadline - now)}
    </p>
  );
}
