import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Info,
  ShieldCheck,
  Siren,
  Square,
  Volume2,
  WifiOff,
} from "lucide-react";
import { useEffect, useState } from "react";
import { GUIDES, LAST_GUIDE_KEY, LOW_PROMINENCE_GUIDES, findGuide, type EmergencyGuide, type GuidanceStep } from "@/lib/guides";
import { useLang } from "@/lib/i18n";
import { useResq } from "@/lib/resq-store";
import { useSpeech } from "@/hooks/use-speech";
import { PrototypeFooter } from "./DeliveryBadge";

export function GuideScreen() {
  const { networkStatus } = useResq();
  const { t, tx } = useLang();
  const online = networkStatus === "ONLINE";
  const [guideId, setGuideId] = useState<string | null>(null);
  const [lastId, setLastId] = useState<string | null>(null);

  useEffect(() => {
    try {
      setLastId(localStorage.getItem(LAST_GUIDE_KEY));
    } catch {
      /* ignore */
    }
  }, []);

  const openGuide = (id: string) => {
    setGuideId(id);
    setLastId(id);
    try {
      localStorage.setItem(LAST_GUIDE_KEY, id);
    } catch {
      /* ignore */
    }
  };

  const guide = findGuide(guideId);
  const parent = guide ? GUIDES.find((g) => g.subGuides?.some((s) => s.id === guide.id)) ?? null : null;

  return (
    <div className="flex flex-col gap-4">
      <header className="resq-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-navy px-3 py-1 text-xs font-extrabold tracking-widest text-navy-foreground">
            <ShieldCheck className="h-4 w-4" aria-hidden />
            {t("offline100")}
          </span>
          {!online && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-warning px-3 py-1 text-xs font-extrabold tracking-widest text-warning-foreground">
              <WifiOff className="h-4 w-4" aria-hidden />
              {t("zeroSignal")}
            </span>
          )}
        </div>
        <h1 className={`mt-3 font-extrabold leading-tight tracking-tight ${guide ? "text-base" : "text-2xl"}`}>
          {t("guideTitle")}
        </h1>
        {!guide && <p className="mt-1 text-sm text-muted-foreground">{t("guideSub")}</p>}
        {!online && !guide && (
          <p className="mt-3 flex items-center gap-2 rounded-lg border border-warning-border bg-warning-soft px-3 py-2 text-sm font-bold">
            <WifiOff className="h-4 w-4 shrink-0 text-warning-foreground" aria-hidden />
            {t("offlineGuideActive")}
          </p>
        )}
      </header>

      {!guide && <CategoryGrid guides={GUIDES} lastId={lastId} onPick={openGuide} heading={t("whatHappening")} />}

      {guide && guide.subGuides && (
        <>
          <button
            type="button"
            onClick={() => setGuideId(null)}
            className="tap-target flex w-fit items-center gap-2 rounded-lg px-2 text-sm font-extrabold tracking-wide text-primary hover:bg-muted"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
            {t("backToGuide")}
          </button>
          {guide.note && (
            <p className="flex items-start gap-2 rounded-xl border border-warning-border bg-warning-soft p-3 text-sm font-semibold">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-warning-foreground" aria-hidden />
              {tx(guide.note)}
            </p>
          )}
          <CategoryGrid guides={guide.subGuides} lastId={null} onPick={openGuide} heading={`${tx(guide.title)} — ${t("whatKindHelp")}`} />
        </>
      )}

      {guide && !guide.subGuides && (
        <StepPlayer
          key={guide.id}
          guide={guide}
          note={parent?.note ? tx(parent.note) : undefined}
          onExit={() => setGuideId(parent ? parent.id : null)}
          exitLabel={parent ? `${t("backTo")} ${tx(parent.title)}` : t("returnToGuide")}
        />
      )}

      <PrototypeFooter />
    </div>
  );
}

function CategoryGrid({
  guides,
  lastId,
  onPick,
  heading,
}: {
  guides: EmergencyGuide[];
  lastId: string | null;
  onPick: (id: string) => void;
  heading: string;
}) {
  const { t, tx } = useLang();
  return (
    <section aria-labelledby="guide-what">
      <h2 id="guide-what" className="text-lg font-extrabold tracking-wide">
        {heading}
      </h2>
      {/* Equal-height 2-column grid: fixed icon box, clamped text, identical padding — long labels wrap inside the same height. */}
      <ul className="mt-3 grid grid-cols-2 gap-3">
        {guides.map((g) => {
          const Icon = g.icon;
          const last = lastId === g.id;
          const quiet = LOW_PROMINENCE_GUIDES.has(g.id);
          return (
            <li key={g.id} className="h-full">
              <button
                type="button"
                onClick={() => onPick(g.id)}
                className={`resq-card tap-target flex h-full min-h-40 w-full flex-col items-center justify-start gap-2 px-3 py-4 text-center hover:bg-muted ${last ? "border-primary" : ""} ${quiet ? "bg-muted/60" : ""}`}
              >
                <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${quiet ? "bg-muted text-muted-foreground" : "bg-navy-soft text-primary"}`}>
                  <Icon className="h-7 w-7" aria-hidden strokeWidth={2.25} />
                </span>
                <span className="line-clamp-2 flex min-h-10 items-center text-sm font-extrabold leading-tight tracking-wide">{tx(g.title)}</span>
                <span className="line-clamp-2 text-xs leading-snug text-muted-foreground">{last ? t("lastViewed") : tx(g.description)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function StepPlayer({
  guide,
  note,
  onExit,
  exitLabel,
}: {
  guide: EmergencyGuide;
  note?: string | undefined;
  onExit: () => void;
  exitLabel: string;
}) {
  const { t, tx, lang } = useLang();
  const [index, setIndex] = useState(0);
  const { supported, speaking, speak, stop, voiceMissing } = useSpeech(lang);
  const { setUserStatus } = useResq();
  const navigate = useNavigate();
  const total = guide.steps.length;
  const done = index >= total;
  const step: GuidanceStep | undefined = guide.steps[index];
  const [safeMarked, setSafeMarked] = useState(false);

  // Stop audio whenever the step changes.
  useEffect(() => {
    stop();
    try {
      window.scrollTo({ top: 0 });
    } catch {
      /* ignore */
    }
  }, [index, stop]);

  const StepIcon = step?.icon;

  return (
    <section aria-live="polite" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => (index === 0 ? onExit() : setIndex((i) => i - 1))}
          className="tap-target flex items-center gap-2 rounded-lg px-2 text-sm font-extrabold tracking-wide text-primary hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
          {t("back")}
        </button>
        <p className="text-sm font-extrabold tracking-widest text-muted-foreground">
          {done ? t("complete") : `${t("step")} ${index + 1} ${t("of")} ${total}`}
        </p>
      </div>

      <div className="flex gap-1.5" aria-hidden>
        {guide.steps.map((s, i) => (
          <span key={s.title.en} className={`h-1.5 flex-1 rounded-full ${i < index || done ? "bg-primary" : i === index ? "bg-primary/60" : "bg-muted"}`} />
        ))}
      </div>

      <p className="text-xs font-extrabold tracking-widest text-muted-foreground">{tx(guide.title)}</p>

      {note && (
        <p className="flex items-start gap-2 rounded-xl border border-warning-border bg-warning-soft p-3 text-sm font-semibold">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-warning-foreground" aria-hidden />
          {note}
        </p>
      )}

      {!done && step && StepIcon ? (
        <article className="resq-card flex flex-col items-center gap-4 p-6 text-center">
          <span className="text-5xl font-black leading-none text-primary" aria-hidden>
            {index + 1}
          </span>
          <span className="grid h-24 w-24 place-items-center rounded-full bg-navy-soft text-primary">
            <StepIcon className="h-12 w-12" strokeWidth={2.25} aria-hidden />
          </span>
          <h2 className="text-2xl font-extrabold leading-tight tracking-wide">{tx(step.title)}</h2>
          <p className="text-base text-muted-foreground">{tx(step.description)}</p>

          {step.action === "SEND_SOS" && (
            <button
              type="button"
              onClick={() => navigate({ to: "/help" })}
              className="tap-target flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl bg-emergency px-5 text-xl font-extrabold tracking-wide text-emergency-foreground shadow-action hover:bg-emergency/90"
            >
              <Siren className="h-8 w-8" aria-hidden />
              {t("sendSos")}
            </button>
          )}
          {step.action === "IM_SAFE" && (
            <button
              type="button"
              disabled={safeMarked}
              onClick={() => {
                setUserStatus("SAFE");
                setSafeMarked(true);
              }}
              className="tap-target flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl bg-safe px-5 text-xl font-extrabold tracking-wide text-safe-foreground shadow-action hover:bg-safe/90 disabled:opacity-90"
            >
              <CheckCircle2 className="h-8 w-8" aria-hidden />
              {safeMarked ? t("markedSafe") : t("imSafe")}
            </button>
          )}
          {step.action === "FIND_SHELTER" && (
            <Link
              to="/shelters"
              className="tap-target flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl bg-primary px-5 text-xl font-extrabold tracking-wide text-primary-foreground shadow-action hover:bg-primary/90"
            >
              <Building2 className="h-8 w-8" aria-hidden />
              {t("findSafeZone")}
            </Link>
          )}

          {supported && (
            <>
              <button
                type="button"
                onClick={() => (speaking ? stop() : speak(`${tx(step.title)}. ${tx(step.description)}`, step.audioSrc?.[lang]))}
                aria-label={speaking ? t("stopAudio") : t("listen")}
                aria-pressed={speaking}
                className="tap-target flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border-2 border-input bg-card text-base font-extrabold tracking-wide hover:bg-muted"
              >
                {speaking ? <Square className="h-5 w-5" aria-hidden /> : <Volume2 className="h-6 w-6" aria-hidden />}
                {speaking ? t("stopAudio") : t("listen")}
              </button>
              {lang === "hi" && voiceMissing && (
                <p className="text-sm text-muted-foreground" lang="hi">
                  {t("hindiVoiceMissing")}
                </p>
              )}
            </>
          )}
        </article>
      ) : (
        <article className="resq-card flex flex-col items-center gap-4 border-safe-border bg-safe-soft p-6 text-center">
          <CheckCircle2 className="h-16 w-16 text-safe" aria-hidden />
          <h2 className="text-2xl font-extrabold tracking-wide">{t("guidanceComplete")}</h2>
          <p className="text-base text-muted-foreground">{t("guidanceCompleteSub")}</p>
        </article>
      )}

      {!done ? (
        <button
          type="button"
          onClick={() => setIndex((i) => i + 1)}
          className="tap-target flex min-h-16 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-xl font-extrabold tracking-wide text-primary-foreground shadow-action hover:bg-primary/90"
        >
          {index === total - 1 ? t("finish") : t("nextStep")}
          <ArrowRight className="h-6 w-6" aria-hidden />
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={onExit}
            className="tap-target flex min-h-16 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-xl font-extrabold tracking-wide text-primary-foreground shadow-action hover:bg-primary/90"
          >
            {exitLabel}
          </button>
          <Link
            to="/"
            className="tap-target flex w-full items-center justify-center rounded-xl border-2 border-input bg-card px-4 text-base font-extrabold tracking-wide hover:bg-muted"
          >
            {t("backToHome")}
          </Link>
        </>
      )}
    </section>
  );
}
