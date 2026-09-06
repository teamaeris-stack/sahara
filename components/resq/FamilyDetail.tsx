import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Clock, Compass, MapPin, MessageCircleQuestion, Search, Users } from "lucide-react";
import { useState } from "react";
import { useLang } from "@/lib/i18n";
import { deriveMember, findMember, findPlace, headingValue, lastSeenBucket, minutesAgo, type EvidencePoint } from "@/lib/family";
import { useNow, useResq } from "@/lib/resq-store";
import { PrototypeFooter } from "./DeliveryBadge";
import { FamilyStatusBadge, sourceKey } from "./FamilyBits";
import { agoText } from "./FamilyScreen";
import { LocalMap, type MapEvidence } from "./LocalMap";
import { FamilyRescue } from './FamilyRescue';

export function FamilyDetail({ id }: { id: string }) {
  return <FamilyRescue id={id} />;
}

export function LegacyFamilyDetail({ id }: { id: string }) {
  const { t, tx, lang } = useLang();
  const { statusEvents, peerEvents, hazards, networkStatus, requestCheckin, checkinRequests } = useResq();
  const now = useNow(15_000);
  const navigate = useNavigate();
  const member = findMember(id);
  const [requested, setRequested] = useState(false);

  if (!member) {
    return (
      <section className="resq-card flex flex-col items-center gap-4 px-6 py-10 text-center">
        <p className="text-lg font-extrabold">{t("memberNotFound")}</p>
        <Link to="/family" className="tap-target flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-4 text-base font-extrabold tracking-wide text-primary-foreground">
          <ArrowLeft className="h-5 w-5" aria-hidden />
          {t("backToFamily")}
        </Link>
      </section>
    );
  }

  const view = deriveMember(member.id, statusEvents, peerEvents, now);
  const lastPlace = findPlace(view.lastPlaceId ?? undefined);
  const name = tx(member.name);
  const lastRequest = checkinRequests.filter((r) => r.memberId === member.id).sort((a, b) => b.requestedAt - a.requestedAt)[0] ?? null;

  const evidence: MapEvidence[] = view.trail
    .map((p, i): MapEvidence | null => {
      const place = findPlace(p.placeId);
      if (!place) return null;
      const latest = i === view.trail.length - 1;
      return { id: `${p.kind}-${p.at}`, pos: place.pos, kind: p.kind, label: latest ? name : "", latest };
    })
    .filter((e): e is MapEvidence => e !== null);
  const trail = evidence.map((e) => e.pos);

  const reportMissing = () => {
    const min = minutesAgo(view.latestAt, now);
    navigate({
      to: "/sos",
      search: {
        subject: member.id,
        type: "MISSING_PERSON",
        prefill: {
          subType: member.personType,
          lastSeen: lastSeenBucket(min),
          lastKnownLocation: lastPlace ? lastPlace.name.en : "",
          lastDirection: headingValue(view.heading),
          identifyingDetails: `${member.name.en} (${member.relation.en})`,
        },
      },
    });
  };

  const onRequest = () => {
    requestCheckin(member.id);
    setRequested(true);
  };

  const headingKey = view.heading === "N" ? "headingN" : view.heading === "S" ? "headingS" : view.heading === "E" ? "headingE" : view.heading === "W" ? "headingW" : null;

  return (
    <div className="flex flex-col gap-4">
      <Link to="/family" className="tap-target flex w-fit items-center gap-2 rounded-lg px-2 text-sm font-extrabold tracking-wide text-primary hover:bg-muted">
        <ArrowLeft className="h-5 w-5" aria-hidden />
        {t("backToFamily")}
      </Link>

      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight">{name}</h1>
          <p className="text-sm font-bold text-muted-foreground">{tx(member.relation)}</p>
        </div>
        <FamilyStatusBadge status={view.display} large />
      </header>

      {/* Last-seen intelligence */}
      <section className="resq-card p-4" aria-labelledby="lsi">
        <h2 id="lsi" className="text-xs font-extrabold tracking-widest text-muted-foreground">
          {t("lastSeenIntel")}
        </h2>
        <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
          <Cell label={t("lastConfirmedSafe")} value={agoText(view.lastSafeAt, now, t)} />
          <Cell label={t("lastUpdate")} value={agoText(view.latestAt, now, t)} />
        </dl>
        <div className="mt-3 flex items-start gap-2 text-sm">
          <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
          <div>
            <p className="text-xs font-extrabold tracking-widest text-muted-foreground">{t("lastKnownLocation")}</p>
            <p className="text-base font-extrabold">{lastPlace ? tx(lastPlace.name) : t("currentLocationUnknown")}</p>
            <p className="text-xs text-muted-foreground">
              {t("source")}: {t(sourceKey(view.source))} · {t("freshness")}: {agoText(view.latestAt, now, t)}
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
          <Compass className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
          <div>
            <p className="text-xs font-extrabold tracking-widest text-muted-foreground">{t("possibleMovement")}</p>
            <p className="font-bold">{headingKey ? t(headingKey) : t("currentLocationUnknown")}</p>
            <p className="text-xs text-muted-foreground">{t("movementEstimated")}</p>
          </div>
        </div>
        <p className="mt-2 text-xs font-extrabold text-warning-foreground">{t("notLiveTracking")}</p>
      </section>

      {/* Map */}
      <section className="resq-card p-3">
        <p className="mb-2 text-xs font-extrabold tracking-widest text-muted-foreground">{t("familyMap")}</p>
        <LocalMap hazards={hazards} evidence={evidence} trail={trail} compact />
      </section>

      {/* Evidence timeline */}
      <section className="resq-card p-4">
        <h2 className="text-xs font-extrabold tracking-widest text-muted-foreground">{t("latestEvidence")}</h2>
        {view.trail.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{t("noSafetyUpdate")}</p>
        ) : (
          <ol className="mt-2 flex flex-col gap-2">
            {[...view.trail].reverse().map((p) => (
              <TimelineRow key={`${p.kind}-${p.at}`} p={p} now={now} />
            ))}
          </ol>
        )}
      </section>

      {/* Actions */}
      <section className="flex flex-col gap-3" aria-label={t("familySafety")}>
        <button
          type="button"
          onClick={onRequest}
          className="tap-target flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-4 text-base font-extrabold tracking-wide text-primary-foreground hover:bg-primary/90"
        >
          <MessageCircleQuestion className="h-6 w-6" aria-hidden />
          {t("requestCheckin")}
        </button>
        {(requested || lastRequest) && (
          <p role="status" className="rounded-xl border border-safe-border bg-safe-soft px-3 py-2 text-sm">
            {networkStatus === "ONLINE" && lastRequest?.sync === "SYNCED_DEMO" ? t("requestSyncedDemo") : t("requestStored")}
          </p>
        )}
        <button
          type="button"
          onClick={reportMissing}
          className="tap-target flex w-full items-center justify-center gap-2 rounded-xl border-2 border-emergency bg-emergency-soft px-4 py-4 text-base font-extrabold tracking-wide text-emergency hover:bg-emergency/10"
        >
          <Search className="h-6 w-6" aria-hidden />
          {t("reportMissing")}
        </button>
        <p className="text-center text-xs text-muted-foreground">
          <Users className="mr-1 inline h-3.5 w-3.5" aria-hidden />
          {lang === "hi" ? "लापता रिपोर्ट मौजूदा SOS प्रवाह में जानकारी पहले से भर देती है।" : "Report Missing opens the existing SOS flow with this person's details pre-filled."}
        </p>
      </section>
      <PrototypeFooter />
    </div>
  );
}

function TimelineRow({ p, now }: { p: EvidencePoint; now: number }) {
  const { t, tx } = useLang();
  const place = findPlace(p.placeId);
  const m = minutesAgo(p.at, now) ?? 0;
  return (
    <li className="flex items-center gap-3 rounded-lg bg-muted px-3 py-2 text-sm">
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${p.kind === "PEER" ? "border-2 border-primary bg-card text-primary" : "bg-primary text-primary-foreground"}`}>
        {p.kind === "PEER" ? <Users className="h-4 w-4" aria-hidden /> : <Clock className="h-4 w-4" aria-hidden />}
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-extrabold tracking-widest text-muted-foreground">{p.kind === "PEER" ? t("peerEncounter") : t("directCheckin")}</span>
        <span className="block font-bold">{place ? tx(place.name) : "—"}</span>
        <span className="block text-xs text-muted-foreground">
          {m} {t("minAgo")}
        </span>
      </span>
    </li>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted p-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-sm font-extrabold">{value}</dd>
    </div>
  );
}
