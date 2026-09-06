import { useNavigate } from "@tanstack/react-router";
import { Wifi, WifiOff, Trash2, Radar, MapPin, Volume2, Users } from "lucide-react";
import { useState } from "react";
import { useSpeech } from "@/hooks/use-speech";
import { PEER_DEMO_PLACES, findPlace } from "@/lib/family";
import { useFamilySync } from "@/lib/family-sync";
import { FamilyMembersEditor } from "./FamilyMembersEditor";
import { clipAvailable } from "@/lib/speech-service";
import { useLang } from "@/lib/i18n";
import { useResq } from "@/lib/resq-store";
import { Sheet, SheetButton } from "./Sheet";
import { SyncNotice } from "./SyncNotice";

export function DemoPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const {
    networkStatus,
    setNetworkStatus,
    resetDemoData,
    pendingCount,
    addPeerEncounter,
    setSafetyCheckAge,
  } = useResq();
  const { t, tx, lang } = useLang();
  const speech = useSpeech("hi");
  const [clipOk, setClipOk] = useState<boolean | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [peerMember, setPeerMember] = useState("dad");
  const [peerPlace, setPeerPlace] = useState<string>(PEER_DEMO_PLACES[0]);
  const [peerAdded, setPeerAdded] = useState(false);
  const navigate = useNavigate();
  const family = useFamilySync();
  const selectedPeer = family.members.find((m) => m.id === peerMember) || family.members[0];

  const handleClose = (next: boolean) => {
    if (!next) {
      setConfirming(false);
      setPeerAdded(false);
      onClose();
    }
  };

  const confirmReset = () => {
    resetDemoData();
    setConfirming(false);
    onClose();
    navigate({ to: "/" });
  };

  const addPeer = () => {
    if (!selectedPeer) return;
    addPeerEncounter(selectedPeer.id, peerPlace);
    setPeerAdded(true);
    setTimeout(() => setPeerAdded(false), 4000);
  };

  const checkClip = () => {
    setClipOk(null);
    void clipAvailable("/audio/hi/earthquake-1.mp3").then(setClipOk);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={handleClose}
      title="Family & demo settings"
      description="Manage people or open a test control below."
    >
      <details open className="rounded-xl border p-3">
        <summary className="cursor-pointer font-bold">Family members</summary>
        <div className="mt-3">
          <FamilyMembersEditor />
        </div>
      </details>
      <details className="mt-3 rounded-xl border p-3">
        <summary className="cursor-pointer font-bold">Test connection</summary>
        <div className="mt-3">
          <section aria-labelledby="net-sim">
            <h3
              id="net-sim"
              className="text-xs font-extrabold tracking-widest text-muted-foreground"
            >
              NETWORK SIMULATION
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Sahara changes mode automatically with the device connection. Use these buttons only
              to simulate a state until the connection changes or the app is refreshed.
            </p>
            <div
              role="radiogroup"
              aria-label="Network simulation"
              className="mt-2 grid grid-cols-2 gap-1 rounded-xl bg-muted p-1"
            >
              {(["ONLINE", "OFFLINE"] as const).map((opt) => {
                const active = networkStatus === opt;
                const Icon = opt === "ONLINE" ? Wifi : WifiOff;
                return (
                  <button
                    key={opt}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setNetworkStatus(opt)}
                    className={`tap-target flex items-center justify-center gap-2 rounded-lg py-3 text-base font-extrabold tracking-wide ${
                      active
                        ? opt === "ONLINE"
                          ? "bg-safe text-safe-foreground shadow-card"
                          : "bg-warning text-warning-foreground shadow-card"
                        : "text-muted-foreground hover:bg-card"
                    }`}
                  >
                    <Icon className="h-5 w-5" aria-hidden />
                    {opt}
                  </button>
                );
              })}
            </div>
            {pendingCount > 0 && (
              <p className="mt-2 text-sm text-muted-foreground">
                {pendingCount} emergency packet{pendingCount === 1 ? "" : "s"} waiting in the
                offline queue.
              </p>
            )}
            <SyncNotice inline />
          </section>
        </div>
      </details>

      {/* Peer witness simulation — the only Family demo control. Road hazards are reported from the route screen. */}
      <details className="mt-3 rounded-xl border p-3">
        <summary className="cursor-pointer font-bold">Simulate a peer encounter</summary>
        <section className="mt-3" aria-labelledby="peer-sim">
          <h3
            id="peer-sim"
            className="flex items-center gap-2 text-xs font-extrabold tracking-widest text-muted-foreground"
          >
            <Radar className="h-4 w-4" aria-hidden />
            {t("simulatePeer")}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">{t("peerSimNote")}</p>
          <p className="mt-3 text-xs font-extrabold tracking-widest text-muted-foreground">
            {t("peerMember")}
          </p>
          <div
            role="radiogroup"
            aria-label={t("peerMember")}
            className="mt-1 grid grid-cols-2 gap-1 rounded-xl bg-muted p-1"
          >
            {family.members.map((m) => {
              const active = selectedPeer?.id === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setPeerMember(m.id)}
                  className={`tap-target rounded-lg py-2 text-sm font-extrabold ${active ? "bg-primary text-primary-foreground shadow-card" : "text-muted-foreground hover:bg-card"}`}
                >
                  {m.name}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs font-extrabold tracking-widest text-muted-foreground">
            {t("peerLocation")}
          </p>
          <div
            role="radiogroup"
            aria-label={t("peerLocation")}
            className="mt-1 grid grid-cols-1 gap-1"
          >
            {PEER_DEMO_PLACES.map((pid) => {
              const p = findPlace(pid)!;
              const active = peerPlace === pid;
              return (
                <button
                  key={pid}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setPeerPlace(pid)}
                  className={`tap-target flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-left text-sm font-bold ${active ? "border-primary bg-navy-soft text-primary" : "border-input bg-card hover:bg-muted"}`}
                >
                  <MapPin className="h-4 w-4 shrink-0" aria-hidden />
                  {tx(p.name)}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={addPeer}
            className="tap-target mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-base font-extrabold tracking-wide text-primary-foreground hover:bg-primary/90"
          >
            <Radar className="h-5 w-5" aria-hidden />
            {t("addEncounter")} · {selectedPeer?.name || "Select a member"}
          </button>
          {peerAdded && (
            <p
              role="status"
              className="mt-2 rounded-lg border border-safe-border bg-safe-soft px-3 py-2 text-sm font-bold"
            >
              {t("peerAdded")}
            </p>
          )}
        </section>
      </details>

      {/* Voice diagnostics */}
      <details className="mt-3 rounded-xl border p-3">
        <summary className="cursor-pointer font-bold">Voice & language test</summary>
        <section className="mt-3" aria-labelledby="voice-h" data-testid="voice-status">
          <h3
            id="voice-h"
            className="flex items-center gap-2 text-xs font-extrabold tracking-widest text-muted-foreground"
          >
            <Volume2 className="h-4 w-4" aria-hidden />
            {t("voiceStatus")}
          </h3>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-muted-foreground">{t("selectedLanguage")}</dt>
            <dd className="font-bold">{lang === "hi" ? t("hindi") : t("english")}</dd>
            <dt className="text-muted-foreground">{t("speechSynthesis")}</dt>
            <dd className="font-bold">{speech.supported ? t("supported") : t("unsupported")}</dd>
            <dt className="text-muted-foreground">{t("hindiVoice")}</dt>
            <dd className="font-bold" data-testid="hindi-voice">
              {speech.voices.length === 0
                ? t("checking")
                : speech.voice
                  ? `${speech.voice.name} (${speech.voice.lang})`
                  : t("notAvailable")}
            </dd>
            <dt className="text-muted-foreground">{t("localHindiClip")}</dt>
            <dd className="font-bold">
              {clipOk === null ? (
                <button type="button" onClick={checkClip} className="underline">
                  {t("checking")}
                </button>
              ) : clipOk ? (
                t("available")
              ) : (
                t("notAvailable")
              )}
            </dd>
          </dl>
          <button
            type="button"
            onClick={() => speech.speak(t("hindiTestSentence"))}
            disabled={!speech.supported}
            className="tap-target mt-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-primary bg-card px-4 py-3 text-base font-extrabold tracking-wide text-primary hover:bg-navy-soft disabled:opacity-50"
          >
            <Volume2 className="h-5 w-5" aria-hidden />
            {t("testHindiVoice")}
          </button>
          {speech.voiceMissing && (
            <p className="mt-2 text-xs font-bold text-warning-foreground">
              {t("hindiVoiceMissing")}
            </p>
          )}
        </section>
      </details>

      {/* Safety-check age (testing helper eligibility) */}
      <details className="mt-3 rounded-xl border p-3">
        <summary className="cursor-pointer font-bold">Safety timer test</summary>
        <section className="mt-3" aria-labelledby="safety-age-h">
          <h3
            id="safety-age-h"
            className="flex items-center gap-2 text-xs font-extrabold tracking-widest text-muted-foreground"
          >
            <Users className="h-4 w-4" aria-hidden />
            {t("safetyCheckAge")}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">{t("safetyCheckAgeNote")}</p>
          <div className="mt-2 grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
            <button
              type="button"
              onClick={() => setSafetyCheckAge(2)}
              data-testid="safety-age-2"
              className="tap-target rounded-lg bg-safe py-2 text-sm font-extrabold text-safe-foreground"
            >
              {t("twoMin")}
            </button>
            <button
              type="button"
              onClick={() => setSafetyCheckAge(12)}
              data-testid="safety-age-12"
              className="tap-target rounded-lg bg-warning py-2 text-sm font-extrabold text-warning-foreground"
            >
              {t("twelveMin")}
            </button>
          </div>
        </section>
      </details>

      <details className="mt-3 rounded-xl border p-3">
        <summary className="cursor-pointer font-bold">Reset demo data</summary>
        <section className="mt-3" aria-labelledby="reset-h">
          <h3 id="reset-h" className="text-xs font-extrabold tracking-widest text-muted-foreground">
            LOCAL DATA
          </h3>
          {confirming ? (
            <div className="mt-2 rounded-xl border border-emergency-border bg-emergency-soft p-4">
              <p className="text-base font-bold">Clear all Sahara demo data on this device?</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Network returns to ONLINE, your status returns to UNKNOWN, timers restart, and SOS
                packets, route reports and family events are removed. Your language is kept.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <SheetButton variant="outline" onClick={() => setConfirming(false)}>
                  CANCEL
                </SheetButton>
                <button
                  type="button"
                  onClick={confirmReset}
                  className="tap-target w-full rounded-xl bg-emergency px-4 py-4 text-base font-extrabold tracking-wide text-emergency-foreground hover:bg-emergency/90"
                >
                  YES, RESET
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="tap-target mt-2 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-emergency-border bg-card px-4 py-4 text-base font-extrabold tracking-wide text-emergency hover:bg-emergency-soft"
            >
              <Trash2 className="h-5 w-5" aria-hidden />
              RESET LOCAL DEMO DATA
            </button>
          )}
        </section>
      </details>
    </Sheet>
  );
}
