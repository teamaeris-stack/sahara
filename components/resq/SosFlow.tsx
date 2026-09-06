import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  Clock,
  Hash,
  Loader2,
  MapPin,
  Siren,
  WifiOff,
  ShieldAlert,
  MapPinned,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLang } from "@/lib/i18n";
import { formatTime, useResq } from "@/lib/resq-store";
import {
  EMERGENCY_TYPES,
  FALLBACK_LOCATION,
  writeCachedLocation,
  SOS_FLAGS,
  flagLabel,
  formatCoord,
  PEOPLE_RANGES,
  peopleRangeLabel,
  typeLabel,
  type EmergencyType,
  type PeopleRange,
  type SOSFlag,
  type SOSPacket,
  type SOSResponses,
} from "@/lib/sos";
import {
  FLOWS,
  answerLabel,
  asksPeople,
  questionLabel,
  visibleQuestions,
  type FlowQuestion,
} from "@/lib/sos-flows";
import { DeliveryBadge, PrototypeFooter } from "./DeliveryBadge";
import { InfoRow } from "./HomeScreen";

type Stage =
  | { kind: "type" }
  | { kind: "question"; q: FlowQuestion }
  | { kind: "people" }
  | { kind: "location" };
type GeoState =
  | { kind: "locating" }
  | { kind: "captured"; latitude: number; longitude: number }
  | { kind: "fallback" };

/** Optional prefill (e.g. REPORT MISSING from Family reuses this flow instead of a second form). */
export interface SosPrefill {
  type?: EmergencyType | undefined;
  responses?: SOSResponses | undefined;
  subjectMemberId?: string | undefined;
}

export function SosFlow({ prefill }: { prefill?: SosPrefill } = {}) {
  const { networkStatus, createSos, packets } = useResq();
  const { t, tx, lang } = useLang();
  const online = networkStatus === "ONLINE";
  const navigate = useNavigate();

  const [pos, setPos] = useState(prefill?.type ? 1 : 0);
  const [type, setType] = useState<EmergencyType | null>(prefill?.type ?? null);
  const [responses, setResponses] = useState<SOSResponses>(prefill?.responses ?? {});
  const [peopleRange, setPeopleRange] = useState<PeopleRange>("1-5");
  const [flags, setFlags] = useState<SOSFlag[]>([]);
  const [details, setDetails] = useState("");
  const [geo, setGeo] = useState<GeoState>({ kind: "locating" });
  const [sending, setSending] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  const created: SOSPacket | null = createdId
    ? (packets.find((p) => p.id === createdId) ?? null)
    : null;
  const flow = type ? FLOWS[type] : null;

  // The stage list is derived from the chosen emergency and the answers so far.
  const stages = useMemo<Stage[]>(() => {
    const list: Stage[] = [{ kind: "type" }];
    if (!flow) return list;
    for (const q of visibleQuestions(flow, responses)) list.push({ kind: "question", q });
    if (asksPeople(flow, responses)) list.push({ kind: "people" });
    list.push({ kind: "location" });
    return list;
  }, [flow, responses]);

  const safePos = Math.min(pos, stages.length - 1);
  const stage = stages[safePos]!;
  const isLocation = stage.kind === "location";

  useEffect(() => {
    topRef.current?.scrollIntoView({ block: "start" });
  }, [safePos, createdId]);

  // Geolocation is attempted once, on entering the location step; failure never blocks the SOS.
  useEffect(() => {
    if (!isLocation || geo.kind !== "locating") return;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeo({ kind: "fallback" });
      return;
    }
    let done = false;
    const finish = (next: GeoState) => {
      if (!done) {
        done = true;
        setGeo(next);
      }
    };
    const timer = setTimeout(() => finish({ kind: "fallback" }), 8000);
    try {
      navigator.geolocation.getCurrentPosition(
        (p) => {
          clearTimeout(timer);
          writeCachedLocation(p.coords.latitude, p.coords.longitude);
          finish({ kind: "captured", latitude: p.coords.latitude, longitude: p.coords.longitude });
        },
        () => {
          clearTimeout(timer);
          finish({ kind: "fallback" });
        },
        { timeout: 7000, maximumAge: 60_000 },
      );
    } catch {
      clearTimeout(timer);
      finish({ kind: "fallback" });
    }
    return () => clearTimeout(timer);
  }, [isLocation, geo.kind]);

  const next = () => setPos((p) => Math.min(p + 1, stages.length - 1));
  const back = () => setPos((p) => Math.max(0, p - 1));

  const pickType = (tp: EmergencyType) => {
    if (tp !== type) {
      setResponses({});
      setFlags([]);
      setPeopleRange("1-5");
    }
    setType(tp);
    setPos(1);
  };

  const answer = (q: FlowQuestion, value: string) => {
    setResponses((r) => ({ ...r, [q.id]: value }));
    if (q.kind === "single") setPos((p) => p + 1);
  };

  const toggleFlag = (f: SOSFlag) =>
    setFlags((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));

  const location =
    geo.kind === "captured"
      ? { latitude: geo.latitude, longitude: geo.longitude, label: t("currentLocation") }
      : {
          latitude: FALLBACK_LOCATION.latitude,
          longitude: FALLBACK_LOCATION.longitude,
          label: FALLBACK_LOCATION.label,
        };

  const send = () => {
    if (sending || !type || !flow) return;
    setSending(true);
    // Keep only answers to questions that are still visible for the final answer set.
    const visibleIds = new Set(visibleQuestions(flow, responses).map((q) => q.id));
    const cleaned: SOSResponses = {};
    for (const [k, v] of Object.entries(responses))
      if (visibleIds.has(k) && v.trim()) cleaned[k] = v.trim();
    const { subType, ...rest } = cleaned;
    const description = [rest["shortDescription"], details.trim()].filter(Boolean).join(" — ");
    try {
      const packet = createSos({
        type,
        subType,
        responses: rest,
        peopleCount: asksPeople(flow, responses)
          ? (PEOPLE_RANGES.find((option) => option.value === peopleRange)?.minimum ?? 1)
          : 1,
        peopleRange: asksPeople(flow, responses) ? peopleRange : undefined,
        flags,
        latitude: location.latitude,
        longitude: location.longitude,
        locationLabel: location.label,
        description: description || undefined,
        subjectMemberId: prefill?.subjectMemberId,
      });
      setCreatedId(packet.id);
    } finally {
      setTimeout(() => setSending(false), 1500);
    }
  };

  if (created) {
    return <SosSaved packet={created} onHome={() => navigate({ to: "/" })} />;
  }

  const total = stages.length;
  const summaryAnswers = flow
    ? visibleQuestions(flow, responses)
        .filter((q) => q.id !== "subType" && responses[q.id])
        .map(
          (q) =>
            `${questionLabel(flow.type, q.id, lang)}: ${answerLabel(flow.type, q.id, responses[q.id]!, lang)}`,
        )
    : [];

  return (
    <div ref={topRef} className="flex scroll-mt-20 flex-col gap-4">
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight">{t("sosTitle")}</h1>
        <p className="mt-1 text-base text-muted-foreground">{t("sosSubtitle")}</p>
      </header>

      {!online && (
        <div
          role="status"
          className="flex items-center gap-3 rounded-xl border border-warning-border bg-warning-soft px-4 py-3"
        >
          <WifiOff className="h-6 w-6 shrink-0 text-warning-foreground" aria-hidden />
          <div>
            <p className="text-sm font-extrabold tracking-wide">{t("offline")}</p>
            <p className="text-sm text-muted-foreground">{t("sosOfflineNote")}</p>
          </div>
        </div>
      )}

      {/* Progress */}
      <div aria-label="Progress" className="flex items-center gap-3">
        <div className="flex flex-1 gap-1" aria-hidden>
          {stages.map((s, i) => (
            <span
              key={s.kind === "question" ? s.q.id : s.kind}
              className={`h-1.5 flex-1 rounded-full ${i < safePos ? "bg-safe" : i === safePos ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>
        <p className="shrink-0 text-xs font-extrabold tracking-widest text-muted-foreground">
          {t("step")} {safePos + 1} {t("of")} {total}
        </p>
      </div>
      {type && (
        <p className="text-xs font-extrabold tracking-widest text-emergency">
          {typeLabel(type, lang)}
          {responses["subType"] && type
            ? ` · ${answerLabel(type, "subType", responses["subType"], lang)}`
            : ""}
        </p>
      )}

      {stage.kind === "type" && (
        <section aria-labelledby="q-type" className="flex flex-col gap-3">
          <h2 id="q-type" className="text-xl font-extrabold tracking-wide">
            {t("whatHappening")}
          </h2>
          <div role="radiogroup" aria-labelledby="q-type" className="grid grid-cols-2 gap-3">
            {EMERGENCY_TYPES.map(({ key, label, icon: Icon }) => {
              const selected = type === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => pickType(key)}
                  className={`tap-target flex min-h-28 flex-col items-center justify-center gap-2 rounded-2xl border-2 p-4 text-center shadow-card ${
                    selected
                      ? "border-emergency bg-emergency-soft text-emergency"
                      : "border-border bg-card text-foreground hover:bg-muted"
                  }`}
                >
                  <Icon className="h-10 w-10" strokeWidth={2.25} aria-hidden />
                  <span className="text-sm font-extrabold tracking-wide">{tx(label)}</span>
                </button>
              );
            })}
          </div>
          <NavRow
            back={
              <Link
                to="/"
                className="tap-target flex items-center justify-center gap-2 rounded-xl border-2 border-input bg-card px-4 py-4 text-base font-extrabold tracking-wide hover:bg-muted"
              >
                <ArrowLeft className="h-5 w-5" aria-hidden />
                {t("home")}
              </Link>
            }
            next={
              <NextButton disabled={!type} onClick={next}>
                {t("next")}
              </NextButton>
            }
          />
        </section>
      )}

      {stage.kind === "question" && stage.q.kind === "single" && (
        <section aria-labelledby={`q-${stage.q.id}`} className="flex flex-col gap-3">
          <h2 id={`q-${stage.q.id}`} className="text-xl font-extrabold tracking-wide">
            {tx(stage.q.prompt)}
          </h2>
          <div
            role="radiogroup"
            aria-labelledby={`q-${stage.q.id}`}
            className="grid grid-cols-1 gap-3"
          >
            {stage.q.options?.map((o) => {
              const selected = responses[stage.q.id] === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => answer(stage.q, o.value)}
                  className={`tap-target flex min-h-16 items-center justify-between gap-3 rounded-2xl border-2 px-5 text-left shadow-card ${
                    selected
                      ? "border-primary bg-navy-soft text-primary"
                      : "border-border bg-card hover:bg-muted"
                  }`}
                >
                  <span className="text-lg font-extrabold tracking-wide">{tx(o.label)}</span>
                  {selected ? (
                    <Check className="h-6 w-6 shrink-0" strokeWidth={3} aria-hidden />
                  ) : (
                    <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                  )}
                </button>
              );
            })}
          </div>
          <NavRow back={<BackButton onClick={back} label={t("back")} />} />
        </section>
      )}

      {stage.kind === "question" && stage.q.kind === "text" && (
        <section className="flex flex-col gap-3">
          <div className="resq-card p-4">
            <label htmlFor={`q-${stage.q.id}`} className="text-xl font-extrabold tracking-wide">
              {tx(stage.q.prompt)}{" "}
              <span className="text-sm font-semibold text-muted-foreground">{t("optional")}</span>
            </label>
            <input
              id={`q-${stage.q.id}`}
              value={responses[stage.q.id] ?? ""}
              maxLength={stage.q.maxLength ?? 120}
              onChange={(e) => answer(stage.q, e.target.value)}
              placeholder={stage.q.placeholder ? tx(stage.q.placeholder) : ""}
              className="mt-3 w-full rounded-xl border-2 border-input bg-card px-4 py-4 text-lg outline-none focus-visible:border-ring"
            />
            <p className="mt-1 text-right text-xs tabular-nums text-muted-foreground">
              {(responses[stage.q.id] ?? "").length}/{stage.q.maxLength ?? 120}
            </p>
          </div>
          <NavRow
            back={<BackButton onClick={back} label={t("back")} />}
            next={
              <NextButton onClick={next}>
                {responses[stage.q.id]?.trim() ? t("next") : t("skip")}
              </NextButton>
            }
          />
        </section>
      )}

      {stage.kind === "people" && flow && (
        <section className="flex flex-col gap-4">
          <div className="resq-card p-4">
            <h2 id="q-people" className="text-xl font-extrabold tracking-wide">
              {flow.peoplePrompt ? tx(flow.peoplePrompt) : t("howManyPeople")}
            </h2>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">
              {t("selectPeopleRange")}
            </p>
            <div
              className="mt-4 grid grid-cols-2 gap-3"
              role="radiogroup"
              aria-labelledby="q-people"
            >
              {PEOPLE_RANGES.map((option) => {
                const selected = peopleRange === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setPeopleRange(option.value)}
                    className={`tap-target relative min-h-24 rounded-2xl border-2 px-4 py-3 text-center shadow-card ${
                      selected
                        ? "border-primary bg-navy-soft text-primary"
                        : "border-border bg-card hover:bg-muted"
                    }`}
                  >
                    <span className="block text-3xl font-extrabold tabular-nums">
                      {option.label}
                    </span>
                    <span className="mt-1 block text-xs font-extrabold uppercase tracking-widest">
                      {t("people")}
                    </span>
                    {selected && (
                      <Check
                        className="absolute right-2 top-2 h-5 w-5"
                        strokeWidth={3}
                        aria-hidden
                      />
                    )}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{t("peopleRangeHint")}</p>
          </div>

          {flow.flags.length > 0 && (
            <div>
              <h2 id="q-flags" className="text-base font-extrabold tracking-wide">
                {t("anythingElse")}{" "}
                <span className="font-semibold text-muted-foreground">{t("optional")}</span>
              </h2>
              <div role="group" aria-labelledby="q-flags" className="mt-2 grid grid-cols-2 gap-3">
                {SOS_FLAGS.filter((f) => flow.flags.includes(f.key)).map(
                  ({ key, label, icon: Icon }) => {
                    const on = flags.includes(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleFlag(key)}
                        className={`tap-target flex min-h-20 items-center gap-3 rounded-2xl border-2 p-3 text-left shadow-card ${
                          on
                            ? "border-primary bg-navy-soft text-primary"
                            : "border-border bg-card hover:bg-muted"
                        }`}
                      >
                        <span
                          className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${on ? "bg-primary text-primary-foreground" : "bg-muted text-primary"}`}
                        >
                          {on ? (
                            <Check className="h-5 w-5" strokeWidth={3} aria-hidden />
                          ) : (
                            <Icon className="h-5 w-5" aria-hidden />
                          )}
                        </span>
                        <span className="text-xs font-extrabold leading-tight tracking-wide">
                          {tx(label)}
                        </span>
                      </button>
                    );
                  },
                )}
              </div>
            </div>
          )}

          <NavRow
            back={<BackButton onClick={back} label={t("back")} />}
            next={<NextButton onClick={next}>{t("next")}</NextButton>}
          />
        </section>
      )}

      {stage.kind === "location" && flow && (
        <section className="flex flex-col gap-4">
          <div
            className={`resq-card p-4 ${
              geo.kind === "captured"
                ? "border-safe-border bg-safe-soft"
                : geo.kind === "fallback"
                  ? "border-warning-border bg-warning-soft"
                  : ""
            }`}
            aria-live="polite"
          >
            <h2 className="text-xl font-extrabold tracking-wide">{t("yourLocation")}</h2>
            <div className="mt-3 flex items-start gap-3">
              {geo.kind === "locating" ? (
                <Loader2 className="h-8 w-8 shrink-0 animate-spin text-primary" aria-hidden />
              ) : (
                <MapPinned
                  className={`h-8 w-8 shrink-0 ${geo.kind === "captured" ? "text-safe" : "text-warning-foreground"}`}
                  aria-hidden
                />
              )}
              <div className="min-w-0">
                {geo.kind === "locating" && (
                  <p className="text-lg font-extrabold">{t("findingLocation")}</p>
                )}
                {geo.kind === "captured" && (
                  <p className="text-lg font-extrabold">{t("locationCaptured")}</p>
                )}
                {geo.kind === "fallback" && (
                  <>
                    <p className="text-lg font-extrabold">{FALLBACK_LOCATION.label}</p>
                    <p className="text-xs font-extrabold tracking-widest text-warning-foreground">
                      {t("demoLocation")}
                    </p>
                  </>
                )}
                {geo.kind !== "locating" && (
                  <p className="mt-1 text-sm tabular-nums text-muted-foreground">
                    {t("latitude")} {formatCoord(location.latitude)} · {t("longitude")}{" "}
                    {formatCoord(location.longitude)}
                  </p>
                )}
              </div>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{t("locationAttached")}</p>
          </div>

          {!flow.questions.some((q) => q.id === "shortDescription") && (
            <div className="resq-card p-4">
              <label htmlFor="details" className="text-base font-extrabold tracking-wide">
                {t("addDetails")}{" "}
                <span className="font-semibold text-muted-foreground">{t("optional")}</span>
              </label>
              <textarea
                id="details"
                value={details}
                maxLength={160}
                rows={2}
                onChange={(e) => setDetails(e.target.value)}
                placeholder={t("detailsPlaceholder")}
                className="mt-2 w-full resize-none rounded-xl border-2 border-input bg-card px-4 py-3 text-base outline-none focus-visible:border-ring"
              />
              <p className="mt-1 text-right text-xs tabular-nums text-muted-foreground">
                {details.length}/160
              </p>
            </div>
          )}

          <div className="resq-card p-4">
            <h2 className="text-xs font-extrabold tracking-widest text-muted-foreground">
              {t("summary")}
            </h2>
            <dl className="mt-2 grid grid-cols-[6.5rem_1fr] gap-y-2 text-base">
              <dt className="text-muted-foreground">{t("emergency")}:</dt>
              <dd className="font-extrabold">
                {type ? typeLabel(type, lang) : "—"}
                {responses["subType"] && type
                  ? ` — ${answerLabel(type, "subType", responses["subType"], lang)}`
                  : ""}
              </dd>
              <dt className="text-muted-foreground">{t("people")}:</dt>
              <dd className="font-extrabold">
                {asksPeople(flow, responses) ? peopleRangeLabel(peopleRange, 1) : 1}
              </dd>
              <dt className="text-muted-foreground">{t("location")}:</dt>
              <dd className="font-extrabold">
                {geo.kind === "locating" ? t("finding") : location.label}
              </dd>
              {summaryAnswers.length > 0 && (
                <>
                  <dt className="text-muted-foreground">{t("answers")}:</dt>
                  <dd className="text-sm font-bold">
                    {summaryAnswers.map((a) => (
                      <span key={a} className="block">
                        {a}
                      </span>
                    ))}
                  </dd>
                </>
              )}
              {flow.flags.length > 0 && (
                <>
                  <dt className="text-muted-foreground">{t("flags")}:</dt>
                  <dd className="font-bold">
                    {flags.length ? flags.map((f) => flagLabel(f, lang)).join(", ") : t("none")}
                  </dd>
                </>
              )}
            </dl>
          </div>

          <div className="sticky bottom-24 z-20">
            <button
              type="button"
              onClick={send}
              disabled={sending}
              className="tap-target flex min-h-20 w-full items-center justify-center gap-3 rounded-2xl bg-emergency px-5 text-2xl font-extrabold tracking-wide text-emergency-foreground shadow-action hover:bg-emergency/90 active:bg-emergency/80 disabled:opacity-70"
            >
              {sending ? (
                <Loader2 className="h-9 w-9 animate-spin" aria-hidden />
              ) : (
                <Siren className="h-9 w-9" strokeWidth={2.25} aria-hidden />
              )}
              {sending ? t("saving") : t("sendSos")}
            </button>
          </div>
          {geo.kind === "locating" && (
            <p className="text-center text-xs text-muted-foreground">{t("sendNowNote")}</p>
          )}

          <NavRow back={<BackButton onClick={back} label={t("back")} />} />
          <PrototypeFooter />
        </section>
      )}
    </div>
  );
}

function SosSaved({ packet, onHome }: { packet: SOSPacket; onHome: () => void }) {
  const { t } = useLang();
  const delivered = packet.deliveryStatus === "DELIVERED_DEMO";
  const syncing = packet.deliveryStatus === "SYNCING";
  const suggestShelter = FLOWS[packet.type].suggestShelter;
  return (
    <div className="flex flex-col gap-4" role="status" aria-live="polite">
      <section
        className={`resq-card p-5 text-center ${delivered ? "border-safe-border bg-safe-soft" : "border-warning-border bg-warning-soft"}`}
      >
        <span
          className={`mx-auto grid h-20 w-20 place-items-center rounded-full ${delivered ? "bg-safe text-safe-foreground" : "bg-emergency text-emergency-foreground"}`}
        >
          {syncing ? (
            <Loader2 className="h-10 w-10 animate-spin" aria-hidden />
          ) : delivered ? (
            <Check className="h-10 w-10" strokeWidth={3} aria-hidden />
          ) : (
            <Siren className="h-10 w-10" aria-hidden />
          )}
        </span>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight">
          {delivered ? t("sosRecorded") : syncing ? t("sosSavedPlain") : t("sosSaved")}
        </h1>
        <p className="mt-2 text-base font-bold">
          {delivered ? t("connectedModeMsg") : syncing ? t("syncingPacket") : t("noNetworkNeeded")}
        </p>
      </section>

      <section className="resq-card p-4">
        <InfoRow icon={Hash} label={t("emergencyId")} value={packet.id} />
        <InfoRow icon={ShieldAlert} label={t("priority")} value={t("p0Critical")} />
        <InfoRow icon={MapPin} label={t("location")} value={t("saved")} />
        <InfoRow icon={Clock} label={t("time")} value={formatTime(packet.createdAt)} />
        <div className="mt-2 flex items-center gap-3 border-t pt-3">
          <span className="text-sm text-muted-foreground">{t("delivery")}:</span>
          <DeliveryBadge status={packet.deliveryStatus} large />
        </div>
      </section>

      {!delivered && (
        <section className="rounded-xl border border-warning-border bg-warning-soft p-4">
          <p className="text-base font-bold">{t("storedSafely")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("keepQueued")}</p>
        </section>
      )}

      <div className="flex flex-col gap-2">
        {suggestShelter && (
          <Link
            to="/shelters"
            className="tap-target flex w-full items-center justify-center gap-2 rounded-xl border-2 border-primary bg-navy-soft px-4 py-4 text-base font-extrabold tracking-wide text-primary hover:bg-navy-soft/70"
          >
            <Building2 className="h-5 w-5" aria-hidden />
            {t("findSafePlace")}
          </Link>
        )}
        <Link
          to="/sos-status"
          search={{ id: packet.id }}
          className="tap-target flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-4 text-base font-extrabold tracking-wide text-primary-foreground hover:bg-primary/90"
        >
          {t("viewDeliveryStatus")}
          <ArrowRight className="h-5 w-5" aria-hidden />
        </Link>
        <button
          type="button"
          onClick={onHome}
          className="tap-target w-full rounded-xl border-2 border-input bg-card px-4 py-4 text-base font-extrabold tracking-wide hover:bg-muted"
        >
          {t("returnHome")}
        </button>
      </div>
      <PrototypeFooter />
    </div>
  );
}

function NavRow({ back, next }: { back: React.ReactNode; next?: React.ReactNode }) {
  return (
    <div className={`grid gap-3 ${next ? "grid-cols-2" : "grid-cols-1"}`}>
      {back}
      {next}
    </div>
  );
}

function BackButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tap-target flex items-center justify-center gap-2 rounded-xl border-2 border-input bg-card px-4 py-4 text-base font-extrabold tracking-wide hover:bg-muted"
    >
      <ArrowLeft className="h-5 w-5" aria-hidden />
      {label}
    </button>
  );
}

function NextButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="tap-target flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-4 text-base font-extrabold tracking-wide text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
    >
      {children}
      <ArrowRight className="h-5 w-5" aria-hidden />
    </button>
  );
}
