import { Link } from "@tanstack/react-router";
import { Accessibility, ArrowLeft, ArrowRight, CheckCircle2, Footprints, Navigation, SearchCheck, Stethoscope } from "lucide-react";
import { AlertTriangle } from "lucide-react";
import { useMemo } from "react";
import { REPORT_META, latestShelterObservation } from "@/lib/community";
import { useLang } from "@/lib/i18n";
import { useResq } from "@/lib/resq-store";
import { needsAccessibility, needsMedical } from "@/lib/sos";
import { SHELTER_TYPE_KEY, STATUS_KEY, computeRoute, hasMedical, isAccessible, liveShelters, rankShelters, rerouteTarget, walkMinutes } from "@/lib/shelters";
import { PrototypeFooter } from "./DeliveryBadge";
import { OfflineMap, useOfflineNavigation } from "./OfflineMap";
import { RerouteCard } from "./RerouteCard";
import { FacilityChips, Freshness, StatusBadge } from "./ShelterBits";
import { BadgeRow, badgesFor } from "./SheltersScreen";

export function ShelterDetail({ id }: { id: string }) {
  const { t, tx } = useLang();
  const { hazards, latestPacket, networkStatus, shelterCache, userStatus, statusUpdatedAt, markArrivedAtShelter, statusEvents, communityReports } = useResq();
  const live = useMemo(() => liveShelters(shelterCache), [shelterCache]);
  const shelter = live.find((s) => s.id === id) ?? null;
  const offlineNavigation = useOfflineNavigation(shelter?.status === "FULL" ? null : id);
  const needs = { accessible: needsAccessibility(latestPacket), medical: needsMedical(latestPacket) };
  const ranked = useMemo(() => rankShelters(live, hazards, needs), [live, hazards, needs.accessible, needs.medical]);

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

  const full = shelter.status === "FULL";
  const result = computeRoute(shelter, hazards);
  const alt = full || !result.route ? rerouteTarget(live, hazards, needs, shelter.id) : null;
  const row = ranked.find((r) => r.shelter.id === shelter.id)!;
  const lastEvent = statusEvents[statusEvents.length - 1];
  // Community observation never overwrites the verified update; a disagreement is shown as such.
  const observation = latestShelterObservation(communityReports, shelter.id, Date.now());
  const observed = observation ? REPORT_META[observation.reportType].shelterStatus : undefined;
  const conflict = !!observation && !!observed && observed !== shelter.status;
  const obsMin = observation ? Math.max(0, Math.round((Date.now() - observation.createdAt) / 60_000)) : 0;
  const arrivedHere = userStatus === "AT_SHELTER" && lastEvent?.status === "AT_SHELTER" && lastEvent.placeId === shelter.id;

  return (
    <div className="flex flex-col gap-4">
      <Link to="/shelters" className="tap-target flex w-fit items-center gap-2 rounded-lg px-2 text-sm font-extrabold tracking-wide text-primary hover:bg-muted">
        <ArrowLeft className="h-5 w-5" aria-hidden />
        {t("backToShelters")}
      </Link>

      <header className="resq-card p-4">
        <p className="text-[11px] font-extrabold tracking-widest text-muted-foreground">{t(SHELTER_TYPE_KEY[shelter.type])}</p>
        <h1 className="text-2xl font-extrabold leading-tight tracking-tight">{tx(shelter.name)}</h1>
        <div className="mt-3">
          <StatusBadge status={shelter.status} large />
        </div>
        <BadgeRow badges={badgesFor(row, ranked)} />
        <div className="mt-3">
          <Freshness minutes={shelter.verifiedMin} showWarning />
        </div>
        {networkStatus === "OFFLINE" && <p className="mt-2 text-xs font-bold text-warning-foreground">{t("offlineShelterSub1")}</p>}
        {observation && (
          <div className={`mt-3 rounded-xl border p-3 text-sm ${conflict ? "border-warning-border bg-warning-soft" : "border-input bg-muted"}`} data-testid="shelter-observation">
            {conflict && (
              <p className="flex items-center gap-2 text-xs font-extrabold tracking-widest text-warning-foreground">
                <AlertTriangle className="h-4 w-4" aria-hidden />
                {t("conflictingInfo")}
              </p>
            )}
            <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
              <dt className="text-muted-foreground">{t("verifiedSource")}</dt>
              <dd className="font-bold">
                {t(STATUS_KEY[shelter.status])} · {shelter.verifiedMin} {t("minAgo")}
              </dd>
              <dt className="text-muted-foreground">{t("communitySource")}</dt>
              <dd className="font-bold">
                {t(REPORT_META[observation.reportType].key)} · {obsMin} {t("minAgo")}
              </dd>
            </dl>
            {conflict && <p className="mt-1 text-xs text-muted-foreground">{t("conflictNote")}</p>}
          </div>
        )}
      </header>

      {(needs.medical && hasMedical(shelter)) || (needs.accessible && isAccessible(shelter)) ? (
        <div className="flex flex-col gap-2">
          {needs.medical && hasMedical(shelter) && (
            <p className="flex items-center gap-2 rounded-xl border border-primary bg-navy-soft px-3 py-2 text-sm font-bold text-primary">
              <Stethoscope className="h-5 w-5 shrink-0" aria-hidden />
              {t("medicalSupportAvailable")}
            </p>
          )}
          {needs.accessible && isAccessible(shelter) && (
            <p className="flex items-center gap-2 rounded-xl border border-primary bg-navy-soft px-3 py-2 text-sm font-bold text-primary">
              <Accessibility className="h-5 w-5 shrink-0" aria-hidden />
              {t("accessibleRecommended")}
            </p>
          )}
        </div>
      ) : null}

      <section className="resq-card p-4">
        <dl className="grid grid-cols-2 gap-3 text-center">
          <div className="rounded-xl bg-muted p-3">
            <dt className="text-xs text-muted-foreground">{t("distance")}</dt>
            <dd className="text-2xl font-extrabold tabular-nums">{offlineNavigation.route?.distanceKm ?? result.route?.distanceKm ?? shelter.distanceKm} km</dd>
          </div>
          <div className="rounded-xl bg-muted p-3">
            <dt className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
              <Footprints className="h-3.5 w-3.5" aria-hidden />
              {t("walkTime")}
            </dt>
            <dd className="text-2xl font-extrabold tabular-nums">
              {offlineNavigation.route?.walkingMinutes ?? (result.route ? result.minutes : walkMinutes(shelter.distanceKm))} <span className="text-sm">min</span>
            </dd>
          </div>
          <div className="rounded-xl bg-muted p-3">
            <dt className="text-xs text-muted-foreground">{t("capacity")}</dt>
            <dd className="text-2xl font-extrabold tabular-nums">{shelter.capacity ?? t("unknown")}</dd>
          </div>
          <div className="rounded-xl bg-muted p-3">
            <dt className="text-xs text-muted-foreground">{t("spacesRemaining")}</dt>
            <dd className={`text-2xl font-extrabold tabular-nums ${full ? "text-emergency" : ""}`}>{shelter.availableSpaces ?? "—"}</dd>
          </div>
        </dl>
      </section>

      <section className="resq-card p-4">
        <h2 className="text-xs font-extrabold tracking-widest text-muted-foreground">{t("facilities")}</h2>
        <div className="mt-2">
          <FacilityChips facilities={shelter.facilities} size="md" />
        </div>
        <h2 className="mt-4 text-xs font-extrabold tracking-widest text-muted-foreground">{t("accessibility")}</h2>
        <p className="mt-1 flex items-center gap-2 text-sm font-bold">
          <Accessibility className={`h-5 w-5 ${isAccessible(shelter) ? "text-safe" : "text-muted-foreground"}`} aria-hidden />
          {isAccessible(shelter) ? t("wheelchairYes") : t("wheelchairNo")}
        </p>
      </section>

      <section className="resq-card p-3">
        <OfflineMap navigation={offlineNavigation} selectedId={shelter.id} compact />
      </section>

      {full ? (
        <section className="rounded-2xl border border-emergency-border bg-emergency-soft p-4">
          <p className="text-base font-bold">{t("shelterFullNote")}</p>
          {alt && (
            <div className="mt-3 rounded-xl border bg-card p-3">
              <p className="text-[11px] font-extrabold tracking-widest text-primary">{t("recommended")}</p>
              <p className="text-base font-extrabold">{tx(alt.shelter.name)}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                <StatusBadge status={alt.shelter.status} />
                <span className="font-bold">{alt.result.route?.distanceKm} km</span>
              </div>
              <Link
                to="/shelter/$id"
                params={{ id: alt.shelter.id }}
                className="tap-target mt-3 flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl bg-primary px-5 text-lg font-extrabold tracking-wide text-primary-foreground shadow-action hover:bg-primary/90"
              >
                <SearchCheck className="h-6 w-6" aria-hidden />
                {t("findNextAvailable")}
                <ArrowRight className="h-5 w-5" aria-hidden />
              </Link>
            </div>
          )}
        </section>
      ) : !result.route ? (
        <RerouteCard original={shelter} blockedBy={result.blockedBy} target={alt} />
      ) : (
        <>
          <Link
            to="/safe-route/$id"
            params={{ id: shelter.id }}
            className="tap-target flex min-h-20 w-full items-center justify-center gap-3 rounded-2xl bg-safe px-5 text-2xl font-extrabold tracking-wide text-safe-foreground shadow-action hover:bg-safe/90"
          >
            <Navigation className="h-8 w-8" aria-hidden />
            {t("takeMeThere")}
          </Link>
          <button
            type="button"
            disabled={arrivedHere}
            onClick={() => markArrivedAtShelter(shelter.id)}
            className="tap-target flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border-2 border-safe-border bg-card px-4 text-base font-extrabold tracking-wide text-safe hover:bg-safe-soft disabled:opacity-80"
          >
            <CheckCircle2 className="h-5 w-5" aria-hidden />
            {arrivedHere ? `${t("arrivedSaved")} · ${new Date(statusUpdatedAt ?? Date.now()).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : t("markArrivedSafe")}
          </button>
        </>
      )}

      <PrototypeFooter />
    </div>
  );
}
