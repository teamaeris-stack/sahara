import { Link } from "@tanstack/react-router";
import { ArrowRight, Clock, MapPin, User, WifiOff } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { FAMILY_MEMBERS, SELF_ID, deriveMember, findPlace, minutesAgo, type MemberView } from "@/lib/family";
import { useNow, useResq } from "@/lib/resq-store";
import { PrototypeFooter } from "./DeliveryBadge";
import { FamilyStatusBadge, sourceKey } from "./FamilyBits";
import { FamilyRescue } from './FamilyRescue';

export function FamilyScreen() {
  return <FamilyRescue />;
}

export function LegacyFamilyScreen() {
  const { t, tx } = useLang();
  const { statusEvents, peerEvents, networkStatus, hydrated, userStatus } = useResq();
  const now = useNow(15_000);
  const online = networkStatus === "ONLINE";

  const self = deriveMember(SELF_ID, statusEvents, peerEvents, now, { initialPending: userStatus === "UNKNOWN" });
  const members = FAMILY_MEMBERS.map((m) => ({ m, v: deriveMember(m.id, statusEvents, peerEvents, now) }));

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">{t("familySafety")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("familySub")}</p>
        {!online && (
          <div role="status" className="mt-2 rounded-xl border border-warning-border bg-warning-soft px-3 py-2 text-sm">
            <p className="flex items-center gap-2 font-extrabold tracking-wide">
              <WifiOff className="h-5 w-5 shrink-0 text-warning-foreground" aria-hidden />
              {t("offlineFamilyMode")}
            </p>
            <p className="mt-1 text-muted-foreground">{t("offlineFamilySub")}</p>
          </div>
        )}
      </header>

      {/* This device */}
      <section className="resq-card border-primary/40 p-4" aria-labelledby="fam-you">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
              <User className="h-6 w-6" aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 id="fam-you" className="text-lg font-extrabold leading-tight">
                {t("youWord")}
              </h2>
              <p className="text-xs text-muted-foreground">{t("thisDevice")}</p>
            </div>
          </div>
          {hydrated && <FamilyStatusBadge status={self.display} />}
        </div>
        {hydrated && (
          <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <Cell label={t("lastConfirmedSafe")} value={agoText(self.lastSafeAt, now, t)} />
            <Cell label={t("lastUpdate")} value={agoText(self.latestAt, now, t)} />
          </dl>
        )}
      </section>

      <ul className="flex flex-col gap-3" aria-label={t("familySafety")}>
        {members.map(({ m, v }) => (
          <li key={m.id}>
            <MemberCard name={tx(m.name)} relation={tx(m.relation)} id={m.id} view={v} now={now} />
          </li>
        ))}
      </ul>

      <p className="rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
        <span className="font-extrabold">{t("notLiveTracking")}</span> {t("movementEstimated")}
      </p>
      <PrototypeFooter />
    </div>
  );
}

function MemberCard({ name, relation, id, view, now }: { name: string; relation: string; id: string; view: MemberView; now: number }) {
  const { t, tx } = useLang();
  const place = findPlace(view.lastPlaceId ?? undefined);
  return (
    <article className={`resq-card p-4 ${view.display === "NEEDS_HELP" ? "border-emergency-border" : view.stale ? "border-warning-border" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-extrabold leading-tight">{name}</h2>
          <p className="text-xs font-bold text-muted-foreground">{relation}</p>
        </div>
        <FamilyStatusBadge status={view.display} />
      </div>
      <dl className="mt-3 flex flex-col gap-1.5 text-sm">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <dt className="text-muted-foreground">{t("lastUpdate")}:</dt>
          <dd className="font-bold">{agoText(view.latestAt, now, t)}</dd>
        </div>
        <div className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <dt className="text-muted-foreground">{t("lastKnownLocation")}:</dt>
          <dd className="min-w-0 font-bold">{place ? tx(place.name) : "—"}</dd>
        </div>
        <p className="text-xs text-muted-foreground">
          {t("source")}: {t(sourceKey(view.source))}
        </p>
      </dl>
      <Link
        to="/family/$id"
        params={{ id }}
        className="tap-target mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-base font-extrabold tracking-wide text-primary-foreground hover:bg-primary/90"
      >
        {t("viewDetails")}
        <ArrowRight className="h-5 w-5" aria-hidden />
      </Link>
    </article>
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

export function agoText(ts: number | null, now: number, t: (k: "minAgo" | "noSafetyUpdate") => string): string {
  const m = minutesAgo(ts, now);
  return m === null ? t("noSafetyUpdate") : `${m} ${t("minAgo")}`;
}
