import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Footprints,
  MapPin,
  Navigation,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLang } from "@/lib/i18n";
import { useResq } from "@/lib/resq-store";
import type { OfflineRouteSegment } from "@/lib/offline-routing";
import {
  HAZARD_META,
  REPORTABLE_HAZARDS,
  liveShelters,
  type HazardKind,
} from "@/lib/shelters";
import { OfflineMap, useOfflineNavigation } from "./OfflineMap";
import { Freshness, StatusBadge } from "./ShelterBits";
import { Sheet } from "./Sheet";

export function OfflineSafeRoute({ id }: { id: string }) {
  const { t, tx } = useLang();
  const {
    hazards,
    shelterCache,
    markArrivedAtShelter,
    reportOsmHazard,
    userStatus,
    statusEvents,
  } = useResq();
  const shelters = useMemo(() => liveShelters(shelterCache), [shelterCache]);
  const shelter = shelters.find((item) => item.id === id) ?? null;
  const blockedWayIds = useMemo(
    () =>
      hazards
        .filter((hazard) => hazard.reported && hazard.osmWayId)
        .map((hazard) => hazard.osmWayId!),
    [hazards],
  );
  const routingHazards = useMemo(
    () => hazards.filter((hazard) => hazard.reported && hazard.osmWayId),
    [hazards],
  );
  const navigation = useOfflineNavigation(id, routingHazards);
  const [reportOpen, setReportOpen] = useState(false);
  const [pendingKind, setPendingKind] = useState<HazardKind | null>(null);
  const unmatchedBlockedRoad = hazards.some(
    (hazard) =>
      hazard.reported &&
      !hazard.osmWayId &&
      ["ROAD_BLOCKED", "FLOODING", "BRIDGE_INACCESSIBLE", "DEBRIS"].includes(hazard.kind),
  );
  const lastEvent = statusEvents[statusEvents.length - 1];
  const arrived = userStatus === "AT_SHELTER" && lastEvent?.placeId === id;

  useEffect(() => {
    if (!pendingKind) return;
    requestAnimationFrame(() =>
      document
        .querySelector('[data-testid="offline-map"]')
        ?.scrollIntoView({ behavior: "smooth", block: "center" }),
    );
  }, [pendingKind]);

  const reportRouteSegment = (
    segment: OfflineRouteSegment,
    point: { lat: number; lng: number },
  ) => {
    if (!pendingKind) return;
    reportOsmHazard(
      pendingKind,
      segment.wayId,
      point,
      segment.name,
      segment.coordinates,
    );
    setPendingKind(null);
  };

  if (!shelter) {
    return (
      <section className="resq-card p-6 text-center">
        <p className="font-extrabold">{t("shelterNotFound")}</p>
        <Link to="/shelters" className="mt-4 inline-flex text-primary">
          {t("backToShelters")}
        </Link>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Link
        to="/shelter/$id"
        params={{ id }}
        className="tap-target flex w-fit items-center gap-2 rounded-lg px-2 text-sm font-extrabold text-primary"
      >
        <ArrowLeft className="h-5 w-5" aria-hidden /> {t("back")}
      </Link>

      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">{t("offlineSafeRoute")}</h1>
        <p className="mt-1 inline-flex rounded-full bg-navy px-3 py-1 text-xs font-extrabold tracking-widest text-navy-foreground">
          OFFLINE MAP · LOCAL A* ROUTING
        </p>
      </header>

      <section className="resq-card p-4">
        <p className="text-xs font-extrabold tracking-widest text-muted-foreground">
          {t("destination")}
        </p>
        <p className="text-lg font-extrabold">{tx(shelter.name)}</p>
        <div className="mt-2">
          <StatusBadge status={shelter.status} />
        </div>
      </section>

      {unmatchedBlockedRoad && (
        <div role="alert" className="rounded-xl border-2 border-warning-border bg-warning-soft p-4">
          <p className="flex items-center gap-2 font-extrabold text-warning-foreground">
            <AlertTriangle className="h-6 w-6" aria-hidden />
            ROAD BLOCKED — ALTERNATE ROUTE REQUIRED
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            The saved demo road report cannot be matched safely to an OSM way, so Sahara does not
            claim that this route avoids it.
          </p>
        </div>
      )}

      {pendingKind && (
        <div role="status" className="rounded-xl border-2 border-warning-border bg-warning-soft p-4">
          <p className="font-extrabold text-warning-foreground">
            TAP THE EXACT AFFECTED ROUTE SEGMENT
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Not reported yet. Tap an orange road to confirm its closure. The selected OSM road
            will turn red and routing will exclude it. Other unaffected parts may stay the same.
          </p>
          <button
            type="button"
            className="mt-3 rounded-lg border bg-card px-3 py-2 text-sm font-bold"
            onClick={() => setPendingKind(null)}
          >
            {t("cancel")}
          </button>
          <details className="mt-3">
            <summary className="cursor-pointer font-bold">Or select the affected road from this route</summary>
            <div className="mt-2 flex max-h-48 flex-col gap-2 overflow-y-auto">
              {navigation.route?.segments.map((segment,index)=><button key={`${segment.wayId}-${index}`} type="button" className="rounded-lg border bg-card p-3 text-left text-sm font-bold" onClick={()=>reportRouteSegment(segment,segment.coordinates[Math.floor(segment.coordinates.length/2)]!)}>Block {segment.name || `OSM road ${segment.wayId}`} · {Math.round(segment.metres)} m</button>)}
            </div>
          </details>
        </div>
      )}

      <section className="resq-card p-3">
        <OfflineMap
          navigation={navigation}
          selectedId={id}
          hazards={hazards}
          routePickMode={pendingKind !== null}
          onRouteSegmentPick={reportRouteSegment}
        />
      </section>

      {blockedWayIds.length > 0 && navigation.route && (
        <div role="status" className="rounded-xl border-2 border-safe-border bg-safe-soft p-4">
          <p className="font-extrabold text-safe">ROUTE RECALCULATED · HAZARD AVOIDED</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Blocked: {routingHazards.map((hazard) => hazard.osmWayName ?? `OSM road ${hazard.osmWayId}`).join(", ")}. Routing excludes these OSM roads. A route avoiding reported closures is not a guarantee of safety.
          </p>
        </div>
      )}

      {navigation.loading && (
        <p className="resq-card p-4 text-sm font-bold">Building the local walking route…</p>
      )}
      {!navigation.loading && !navigation.error && !navigation.route && (
        <p className="rounded-xl border border-warning-border bg-warning-soft p-4 font-bold">
          {blockedWayIds.length
            ? "ROAD BLOCKED — ALTERNATE ROUTE REQUIRED. No connected alternate route was found in the packaged OSM graph."
            : "No connected walking route was found in the packaged OSM road graph."}
        </p>
      )}

      {navigation.route && (
        <>
          <section className="resq-card p-4">
            <p className="flex items-center gap-2 font-extrabold text-safe">
              <CheckCircle2 className="h-6 w-6" aria-hidden />
              LOCAL OSM ROUTE READY
            </p>
            <p className="mt-2 flex items-center gap-2 text-sm font-bold">
              <Navigation className="h-5 w-5 text-primary" aria-hidden />
              Follow the blue walking route to the selected shelter.
            </p>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-center">
              <div className="rounded-xl bg-muted p-3">
                <dt className="text-xs text-muted-foreground">{t("distance")}</dt>
                <dd className="text-2xl font-extrabold">{navigation.route.distanceKm} km</dd>
              </div>
              <div className="rounded-xl bg-muted p-3">
                <dt className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                  <Footprints className="h-4 w-4" aria-hidden />
                  {t("walkTime")}
                </dt>
                <dd className="text-2xl font-extrabold">
                  {navigation.route.walkingMinutes} <span className="text-sm">min</span>
                </dd>
              </div>
            </dl>
            <div className="mt-3 border-t pt-3">
              <Freshness minutes={shelter.verifiedMin} showWarning />
            </div>
          </section>
          <button
            type="button"
            disabled={arrived}
            onClick={() => markArrivedAtShelter(id)}
            className="tap-target flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl bg-safe px-5 text-xl font-extrabold text-safe-foreground disabled:opacity-70"
          >
            <MapPin className="h-7 w-7" aria-hidden />
            {arrived ? t("arrivedSaved") : t("markArrivedSafe")}
          </button>
          <button
            type="button"
            onClick={() => setReportOpen(true)}
            className="tap-target flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl border-2 border-warning-border bg-warning-soft px-5 text-lg font-extrabold text-warning-foreground"
          >
            <AlertTriangle className="h-7 w-7" aria-hidden />
            REPORT HAZARD ON THIS ROUTE
          </button>
        </>
      )}

      <Link
        to="/shelters"
        className="tap-target flex w-full items-center justify-center rounded-xl border-2 border-input bg-card px-4 py-4 font-extrabold"
      >
        {t("backToShelters")}
      </Link>

      <Sheet
        open={reportOpen}
        onOpenChange={setReportOpen}
        title="Report route hazard"
        description="Choose the problem at your current route segment. Sahara will block that OSM road and calculate again."
      >
        <ul className="grid grid-cols-2 gap-2">
          {REPORTABLE_HAZARDS.map((kind) => {
            const { icon: Icon, key } = HAZARD_META[kind];
            return (
              <li key={kind}>
                <button
                  type="button"
                  onClick={() => {
                    setPendingKind(kind);
                    setReportOpen(false);
                  }}
                  className="resq-card tap-target flex min-h-24 w-full flex-col items-center justify-center gap-2 p-3 text-center hover:bg-muted"
                >
                  <Icon className="h-8 w-8 text-warning-foreground" aria-hidden />
                  <span className="text-sm font-extrabold">{t(key)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </Sheet>
    </div>
  );
}
