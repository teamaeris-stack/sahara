import { Link } from "@tanstack/react-router";
import {
  Accessibility,
  ArrowRight,
  CheckCircle2,
  Footprints,
  Navigation,
  Plus,
  Route,
  SearchCheck,
  Star,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLang } from "@/lib/i18n";
import { useResq } from "@/lib/resq-store";
import { needsAccessibility, needsMedical } from "@/lib/sos";
import {
  SHELTER_REFRESH_MS,
  SHELTER_TYPE_KEY,
  hasMedical,
  isAccessible,
  liveShelters,
  rankShelters,
  walkMinutes,
  type RankedShelter,
} from "@/lib/shelters";
import { PrototypeFooter } from "./DeliveryBadge";
import { OfflineMap, nearestAvailableByRoad, useOfflineNavigation } from "./OfflineMap";
import { FacilityChips, Freshness, StatusBadge } from "./ShelterBits";

/** Badges are decided automatically by the ranking — no filters for a stressed user. */
export type Badge = "RECOMMENDED" | "MOST_ACCESSIBLE" | "MEDICAL_SUPPORT" | "HARD_TO_REACH";

export function badgesFor(row: RankedShelter, ranked: RankedShelter[]): Badge[] {
  const out: Badge[] = [];
  const top = ranked[0];
  if (!row.reachable) out.push("HARD_TO_REACH");
  if (top && row.shelter.id === top.shelter.id && row.reachable && row.shelter.status !== "FULL")
    out.push("RECOMMENDED");
  const bestAccessible = ranked.find(
    (r) => r.reachable && r.shelter.status !== "FULL" && isAccessible(r.shelter),
  );
  if (bestAccessible && bestAccessible.shelter.id === row.shelter.id) out.push("MOST_ACCESSIBLE");
  if (
    row.shelter.type === "MEDICAL_SAFE_POINT" ||
    row.shelter.facilities.includes("MEDICAL_SUPPORT")
  )
    out.push("MEDICAL_SUPPORT");
  return out;
}

export function SheltersScreen() {
  const { networkStatus, hazards, latestPacket, hydrated, shelterCache, refreshShelters } =
    useResq();
  const { t, tx } = useLang();
  const online = networkStatus === "ONLINE";
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const navigation = useOfflineNavigation(selectedId);

  const needs = {
    accessible: hydrated && needsAccessibility(latestPacket),
    medical: hydrated && needsMedical(latestPacket),
  };

  // Local data renders immediately; while online, status refreshes on a gentle interval.
  useEffect(() => {
    if (!online) return;
    const id = setInterval(refreshShelters, SHELTER_REFRESH_MS);
    return () => clearInterval(id);
  }, [online, refreshShelters]);

  const ranked = useMemo(
    () => rankShelters(liveShelters(shelterCache), hazards, needs),
    [shelterCache, hazards, needs.accessible, needs.medical],
  );
  const nearest = useMemo(
    () => nearestAvailableByRoad(navigation.map, navigation.location, liveShelters(shelterCache)),
    [navigation.map, navigation.location, shelterCache],
  );
  const top =
    ranked[0] && ranked[0].reachable && ranked[0].shelter.status !== "FULL" ? ranked[0] : null;
  const selected = ranked.find((r) => r.shelter.id === selectedId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">{t("safePlacesNear")}</h1>
        {online ? (
          <p className="mt-2 flex items-center gap-2 rounded-xl border border-safe-border bg-safe-soft px-3 py-2 text-sm">
            <Wifi className="h-5 w-5 shrink-0 text-safe" aria-hidden />
            <span>
              <span className="font-extrabold tracking-wide">{t("connected")}</span>
              <span className="block text-muted-foreground">{t("refreshedJustNow")}</span>
            </span>
          </p>
        ) : (
          <div
            role="status"
            className="mt-2 rounded-xl border border-warning-border bg-warning-soft px-3 py-2 text-sm"
          >
            <p className="flex items-center gap-2 font-extrabold tracking-wide">
              <WifiOff className="h-5 w-5 shrink-0 text-warning-foreground" aria-hidden />
              {t("offlineShelterMode")}
            </p>
            <p className="mt-1 text-muted-foreground">{t("offlineShelterSub1")}</p>
            <p className="text-muted-foreground">{t("offlineShelterSub2")}</p>
          </div>
        )}
      </header>

      {/* Recommended safe place */}
      {top && (
        <section
          aria-labelledby="rec-h"
          className="rounded-2xl border-2 border-primary bg-navy-soft p-4 shadow-card"
        >
          <h2
            id="rec-h"
            className="flex items-center gap-2 text-xs font-extrabold tracking-widest text-primary"
          >
            <Star className="h-4 w-4" aria-hidden />
            {t("recommendedSafePlace")}
          </h2>
          <p className="mt-1 text-xl font-extrabold leading-tight">{tx(top.shelter.name)}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <StatusBadge status={top.shelter.status} />
            <span className="font-bold">
              {top.result.route?.distanceKm ?? top.shelter.distanceKm} km
            </span>
            <span className="inline-flex items-center gap-1 font-bold">
              <Footprints className="h-4 w-4" aria-hidden />
              {top.result.minutes} {t("minWalk")}
            </span>
            {top.result.rerouted && (
              <span className="inline-flex items-center gap-1 rounded-full bg-warning px-2 py-0.5 text-[11px] font-extrabold text-warning-foreground">
                <Route className="h-3 w-3" aria-hidden />
                {t("routeB")}
              </span>
            )}
          </div>
          <BadgeRow badges={badgesFor(top, ranked).filter((b) => b !== "RECOMMENDED")} />
          <Link
            to="/shelter/$id"
            params={{ id: top.shelter.id }}
            className="tap-target mt-3 flex min-h-16 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-lg font-extrabold tracking-wide text-primary-foreground shadow-action hover:bg-primary/90"
          >
            {t("view")}
            <ArrowRight className="h-5 w-5" aria-hidden />
          </Link>
        </section>
      )}

      {/* Map */}
      <section className="resq-card p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-extrabold tracking-widest text-muted-foreground">
            OPENSTREETMAP · ALUVA
          </p>
          <button
            type="button"
            disabled={!nearest}
            onClick={() => nearest && setSelectedId(nearest.shelter.id)}
            className="tap-target inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-extrabold text-primary-foreground disabled:opacity-50"
          >
            <SearchCheck className="h-4 w-4" aria-hidden />
            {tx({ en: "FIND NEAREST", hi: "निकटतम खोजें" })}
          </button>
        </div>
        <OfflineMap
          navigation={navigation}
          selectedId={selectedId}
          onSelect={setSelectedId}
          compact
        />
        {selected ? (
          <div className="mt-3 rounded-xl border bg-muted p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold">{tx(selected.shelter.name)}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <StatusBadge status={selected.shelter.status} />
                  {navigation.route && (
                    <span className="font-bold">
                      {navigation.route.distanceKm} km · {navigation.route.walkingMinutes} min walk
                    </span>
                  )}
                </div>
              </div>
              <Link
                to="/shelter/$id"
                params={{ id: selected.shelter.id }}
                className="tap-target flex shrink-0 items-center gap-1 rounded-lg bg-primary px-3 text-xs font-extrabold tracking-wide text-primary-foreground hover:bg-primary/90"
              >
                {t("view")}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
            {navigation.route && selected.shelter.status !== "FULL" && (
              <Link
                to="/safe-route/$id"
                params={{ id: selected.shelter.id }}
                className="tap-target mt-3 flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-safe px-4 text-base font-extrabold text-safe-foreground"
              >
                <Navigation className="h-5 w-5" aria-hidden />
                {tx({ en: "GUIDE ME", hi: "मार्ग दिखाएँ" })}
              </Link>
            )}
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">{t("tapMarker")}</p>
        )}
      </section>

      {/* All shelters — status visible at a glance */}
      <p className="text-xs font-bold text-muted-foreground">{t("autoSorted")}</p>
      <ul className="flex flex-col gap-3">
        {ranked.map((r) => (
          <li key={r.shelter.id}>
            <ShelterCard
              row={r}
              badges={badgesFor(r, ranked)}
              selected={selectedId === r.shelter.id}
              onSelect={() => setSelectedId(r.shelter.id)}
            />
          </li>
        ))}
      </ul>

      <PrototypeFooter />
    </div>
  );
}

export function BadgeRow({ badges }: { badges: Badge[] }) {
  const { t } = useLang();
  if (badges.length === 0) return null;
  const meta: Record<Badge, { label: string; cls: string; icon: typeof Star }> = {
    RECOMMENDED: {
      label: t("recommended"),
      cls: "bg-primary text-primary-foreground",
      icon: CheckCircle2,
    },
    MOST_ACCESSIBLE: {
      label: t("mostAccessible"),
      cls: "bg-safe-soft text-safe border border-safe-border",
      icon: Accessibility,
    },
    MEDICAL_SUPPORT: {
      label: t("medicalSupportBadge"),
      cls: "bg-emergency-soft text-emergency border border-emergency-border",
      icon: Plus,
    },
    HARD_TO_REACH: {
      label: t("hardToReach"),
      cls: "bg-warning-soft text-warning-foreground border border-warning-border",
      icon: Route,
    },
  };
  return (
    <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Recommendations">
      {badges.map((b) => {
        const { label, cls, icon: Icon } = meta[b];
        return (
          <li
            key={b}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold tracking-wide ${cls}`}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
            {label}
          </li>
        );
      })}
    </ul>
  );
}

function ShelterCard({
  row,
  badges,
  selected,
  onSelect,
}: {
  row: RankedShelter;
  badges: Badge[];
  selected: boolean;
  onSelect: () => void;
}) {
  const { t, tx } = useLang();
  const s = row.shelter;
  const rec = badges.includes("RECOMMENDED");
  return (
    <article
      onClick={onSelect}
      className={`resq-card p-4 ${selected ? "border-primary ring-2 ring-primary/30" : rec ? "border-primary/60" : ""} ${s.status === "FULL" ? "opacity-90" : ""}`}
      aria-current={selected ? "true" : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold tracking-widest text-muted-foreground">
            {t(SHELTER_TYPE_KEY[s.type])}
          </p>
          <h2 className="text-base font-extrabold leading-tight">{tx(s.name)}</h2>
        </div>
        <StatusBadge status={s.status} />
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-lg bg-muted p-2">
          <dt className="text-muted-foreground">{t("spaces")}</dt>
          <dd
            className={`text-base font-extrabold tabular-nums ${s.status === "FULL" ? "text-emergency" : ""}`}
          >
            {s.availableSpaces === null ? "—" : s.availableSpaces}
          </dd>
        </div>
        <div className="rounded-lg bg-muted p-2">
          <dt className="text-muted-foreground">{t("distance")}</dt>
          <dd className="text-base font-extrabold tabular-nums">
            {row.result.route?.distanceKm ?? s.distanceKm} km
          </dd>
        </div>
        <div className="rounded-lg bg-muted p-2">
          <dt className="flex items-center justify-center gap-1 text-muted-foreground">
            <Footprints className="h-3 w-3" aria-hidden />
            {t("minWalk")}
          </dt>
          <dd className="text-base font-extrabold tabular-nums">
            {row.reachable ? row.result.minutes : walkMinutes(s.distanceKm)}
          </dd>
        </div>
      </dl>

      <div className="mt-3">
        <FacilityChips facilities={s.facilities} />
      </div>
      <BadgeRow badges={badges} />
      {!badges.includes("MOST_ACCESSIBLE") && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-bold">
          <Accessibility
            className={`h-4 w-4 ${isAccessible(s) ? "text-safe" : "text-muted-foreground"}`}
            aria-hidden
          />
          {isAccessible(s) ? t("wheelchairYes") : t("wheelchairNo")}
        </p>
      )}
      {hasMedical(s) && !badges.includes("MEDICAL_SUPPORT") && null}
      <div className="mt-2">
        <Freshness minutes={s.verifiedMin} showWarning />
      </div>

      <Link
        to="/shelter/$id"
        params={{ id: s.id }}
        onClick={(e) => e.stopPropagation()}
        className={`tap-target mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-4 text-base font-extrabold tracking-wide ${
          rec
            ? "bg-primary text-primary-foreground hover:bg-primary/90"
            : "border-2 border-input bg-card hover:bg-muted"
        }`}
      >
        {t("view")}
        <ArrowRight className="h-5 w-5" aria-hidden />
      </Link>
    </article>
  );
}
