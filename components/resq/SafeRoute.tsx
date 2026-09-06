import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowDown, ArrowLeft, CheckCircle2, Footprints, MapPin, Navigation, TriangleAlert, WifiOff } from "lucide-react";
import { useMemo, useState } from "react";
import { useLang } from "@/lib/i18n";
import { useResq } from "@/lib/resq-store";
import { needsAccessibility, needsMedical } from "@/lib/sos";
import { HAZARD_META, REPORTABLE_HAZARDS, computeRoute, liveShelters, rerouteTarget, type HazardKind, type RoadKey } from "@/lib/shelters";
import { PrototypeFooter } from "./DeliveryBadge";
import { LocalMap } from "./LocalMap";
import { RerouteCard } from "./RerouteCard";
import { Freshness, StatusBadge } from "./ShelterBits";
import { Sheet, SheetButton } from "./Sheet";

export function SafeRoute({ id }: { id: string }) {
  const { t, tx } = useLang();
  const { hazards, networkStatus, shelterCache, latestPacket, reportHazard, markArrivedAtShelter, userStatus, statusEvents } = useResq();
  const live = useMemo(() => liveShelters(shelterCache), [shelterCache]);
  const shelter = live.find((s) => s.id === id) ?? null;
  const [reportOpen, setReportOpen] = useState(false);
  const [kind, setKind] = useState<HazardKind | null>(null);
  const [reported, setReported] = useState<{ kind: HazardKind; road: RoadKey } | null>(null);

  if (!shelter) {
    return (
      <section className="resq-card flex flex-col items-center gap-4 px-6 py-10 text-center">
        <p className="text-lg font-extrabold">{t("shelterNotFound")}</p>
        <Link to="/shelters" className="tap-target flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-4 text-base font-extrabold tracking-wide text-primary-foreground">
          <ArrowLeft className="h-5 w-5" aria-hidden />
          {t("backToShelters")}
        </Link>
      </section>
    );
  }

  const { route, rerouted, minutes, blockedBy } = computeRoute(shelter, hazards);
  const needs = { accessible: needsAccessibility(latestPacket), medical: needsMedical(latestPacket) };
  const alt = !route ? rerouteTarget(live, hazards, needs, shelter.id) : null;
  const routeHazards = hazards.filter((h) => h.reported || (h.roadKey && route?.roads.includes(h.roadKey)));
  const lastEvent = statusEvents[statusEvents.length - 1];
  const arrivedHere = userStatus === "AT_SHELTER" && lastEvent?.status === "AT_SHELTER" && lastEvent.placeId === shelter.id;
  // Roads the traveller could report on: the active route's roads (or Route A's when unreachable).
  const roads = (route ?? shelter.routeA).roads;

  const submit = (road: RoadKey) => {
    if (!kind) return;
    reportHazard(kind, road);
    setReported({ kind, road });
    setKind(null);
    setReportOpen(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <Link to="/shelter/$id" params={{ id: shelter.id }} className="tap-target flex w-fit items-center gap-2 rounded-lg px-2 text-sm font-extrabold tracking-wide text-primary hover:bg-muted">
        <ArrowLeft className="h-5 w-5" aria-hidden />
        {t("back")}
      </Link>

      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">{t("offlineSafeRoute")}</h1>
        <p className="mt-1 inline-flex items-center gap-2 rounded-full bg-navy px-3 py-1 text-xs font-extrabold tracking-widest text-navy-foreground">
          {networkStatus === "OFFLINE" && <WifiOff className="h-4 w-4" aria-hidden />}
          {t("cachedRoute")}
          {route ? ` · ${route.id === "A" ? t("routeA") : t("routeB")}` : ""}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{t("cachedRouteSub")}</p>
      </header>

      {/* Destination + route status */}
      <section className="resq-card p-4">
        <p className="text-xs font-extrabold tracking-widest text-muted-foreground">{t("destination")}</p>
        <p className="text-lg font-extrabold leading-tight">{tx(shelter.name)}</p>
        {route && (
          <p className="mt-1 text-sm font-bold text-muted-foreground">
            {route.distanceKm} km · {minutes} min
          </p>
        )}
        <div className="mt-3 border-t pt-3">
          <p className="text-xs font-extrabold tracking-widest text-muted-foreground">{t("routeStatus")}</p>
          {route && !rerouted ? (
            <p className="mt-1 flex items-center gap-2 text-base font-extrabold text-safe">
              <CheckCircle2 className="h-6 w-6" aria-hidden />
              {t("passable")}
            </p>
          ) : (
            <div className="mt-1">
              <p className="flex items-center gap-2 text-base font-extrabold text-warning-foreground">
                <AlertTriangle className="h-6 w-6" aria-hidden />
                {t("routeImpacted")}
              </p>
              {blockedBy && (
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {t(HAZARD_META[blockedBy.kind].key)} {t("reportedOn")} {blockedBy.roadKey ? t(blockedBy.roadKey) : "—"}.
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      {rerouted && route && (
        <div role="status" className="rounded-xl border border-warning-border bg-warning-soft p-3">
          <p className="flex items-center gap-2 text-base font-extrabold tracking-wide">
            <AlertTriangle className="h-6 w-6 shrink-0 text-warning-foreground" aria-hidden />
            {t("routeUpdated")}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("unsafeRoadAvoided")} {t("routeB")} · {route.distanceKm} km · {minutes} min
          </p>
        </div>
      )}

      {reported && (
        <div role="status" className="rounded-xl border border-safe-border bg-safe-soft p-3 text-sm">
          <p className="font-extrabold">{t("problemSaved")}</p>
          <p className="text-muted-foreground">
            {t(HAZARD_META[reported.kind].key)} · {t(reported.road)} — {networkStatus === "ONLINE" ? t("problemSynced") : t("problemQueued")}
          </p>
        </div>
      )}

      <section className="resq-card p-3">
        <LocalMap selectedId={shelter.id} hazards={hazards} route={route} />
      </section>

      {!route && <RerouteCard original={shelter} blockedBy={blockedBy} target={alt} />}

      {route && (
        <>
          <section className="resq-card p-4">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                <Navigation className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="text-xs font-extrabold tracking-widest text-muted-foreground">{t("you")}</p>
                <p className="text-base font-extrabold">{t("currentLocation")}</p>
              </div>
            </div>
            <ol className="ml-4 mt-2 border-l-2 border-dashed border-primary/40 pl-7">
              {route.via.map((w) => (
                <li key={w} className="relative py-1.5 text-sm font-bold">
                  <ArrowDown className="absolute -left-[2.1rem] top-1.5 h-4 w-4 text-primary" aria-hidden />
                  {t(w)}
                </li>
              ))}
            </ol>
            <div className="mt-2 flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-safe text-safe-foreground">
                <MapPin className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-extrabold tracking-widest text-muted-foreground">{t("destination")}</p>
                <p className="text-base font-extrabold">{tx(shelter.name)}</p>
              </div>
            </div>
          </section>

          <section className="resq-card p-4">
            <dl className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-xl bg-muted p-3">
                <dt className="text-xs text-muted-foreground">{t("distance")}</dt>
                <dd className="text-2xl font-extrabold tabular-nums">{route.distanceKm} km</dd>
              </div>
              <div className="rounded-xl bg-muted p-3">
                <dt className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                  <Footprints className="h-3.5 w-3.5" aria-hidden />
                  {t("walkTime")}
                </dt>
                <dd className="text-2xl font-extrabold tabular-nums">
                  {minutes} <span className="text-sm">min</span>
                </dd>
              </div>
            </dl>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
              <span className="text-sm text-muted-foreground">{t("destinationStatus")}</span>
              <StatusBadge status={shelter.status} />
            </div>
            <div className="mt-2">
              <Freshness minutes={shelter.verifiedMin} showWarning />
            </div>
          </section>

          <button
            type="button"
            disabled={arrivedHere}
            onClick={() => markArrivedAtShelter(shelter.id)}
            className="tap-target flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl bg-safe px-5 text-xl font-extrabold tracking-wide text-safe-foreground shadow-action hover:bg-safe/90 disabled:opacity-80"
          >
            <CheckCircle2 className="h-7 w-7" aria-hidden />
            {arrivedHere ? t("arrivedSaved") : t("markArrivedSafe")}
          </button>
        </>
      )}

      {/* Hazards on / near this route */}
      {routeHazards.length > 0 && (
        <section className="resq-card p-4">
          <h2 className="text-xs font-extrabold tracking-widest text-muted-foreground">{t("hazards")}</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {routeHazards.map((h) => {
              const { icon: Icon, key } = HAZARD_META[h.kind];
              return (
                <li key={h.id} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-bold ${h.reported ? "border border-warning-border bg-warning-soft" : "bg-muted"}`}>
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-warning text-warning-foreground">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span>
                    {t(key)}
                    {h.roadKey && <span className="block text-xs font-semibold text-muted-foreground">{t(h.roadKey)} · {t("roadBlocked")}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <button
        type="button"
        onClick={() => setReportOpen(true)}
        className="tap-target flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl border-2 border-warning-border bg-warning-soft px-5 text-lg font-extrabold tracking-wide text-warning-foreground hover:bg-warning/30"
      >
        <TriangleAlert className="h-7 w-7" aria-hidden />
        {t("reportRouteProblem")}
      </button>

      <Link to="/shelters" className="tap-target flex w-full items-center justify-center gap-2 rounded-xl border-2 border-input bg-card px-4 py-4 text-base font-extrabold tracking-wide hover:bg-muted">
        {t("backToShelters")}
      </Link>
      <PrototypeFooter />

      <Sheet
        open={reportOpen}
        onOpenChange={(o) => {
          if (!o) {
            setReportOpen(false);
            setKind(null);
          }
        }}
        title={t("reportRouteProblem")}
        description={kind ? t("whichRoad") : t("whatProblem")}
      >
        {!kind ? (
          <ul className="grid grid-cols-2 gap-2">
            {REPORTABLE_HAZARDS.map((k) => {
              const { icon: Icon, key } = HAZARD_META[k];
              return (
                <li key={k}>
                  <button
                    type="button"
                    onClick={() => setKind(k)}
                    className="resq-card tap-target flex min-h-24 w-full flex-col items-center justify-center gap-2 p-3 text-center hover:bg-muted"
                  >
                    <Icon className="h-9 w-9 text-warning-foreground" strokeWidth={2.25} aria-hidden />
                    <span className="text-sm font-extrabold tracking-wide">{t(key)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-bold">{t(HAZARD_META[kind].key)}</p>
            {roads.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => submit(r)}
                className="tap-target flex min-h-14 w-full items-center gap-3 rounded-xl border-2 border-input bg-card px-4 text-left text-base font-extrabold hover:bg-muted"
              >
                <MapPin className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                {t(r)}
              </button>
            ))}
            <SheetButton variant="outline" onClick={() => setKind(null)}>
              {t("back")}
            </SheetButton>
          </div>
        )}
      </Sheet>
    </div>
  );
}
