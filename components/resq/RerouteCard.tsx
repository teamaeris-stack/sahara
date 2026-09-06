import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowRight, Footprints, Navigation, XCircle } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { HAZARD_META, type Hazard, type LiveShelter, type RankedShelter } from "@/lib/shelters";
import { FacilityChips, StatusBadge } from "./ShelterBits";

/**
 * Shown when no cached route to the original shelter avoids the reported hazards.
 * Original destination is crossed out; the next suitable reachable shelter is offered.
 */
export function RerouteCard({ original, blockedBy, target }: { original: LiveShelter; blockedBy: Hazard | null; target: RankedShelter | null }) {
  const { t, tx } = useLang();
  const reason = blockedBy
    ? `${t(HAZARD_META[blockedBy.kind].key)}${blockedBy.roadKey ? ` · ${t(blockedBy.roadKey)}` : ""}`
    : t("noSafeRouteNote");
  return (
    <section className="rounded-2xl border-2 border-warning-border bg-warning-soft p-4" aria-live="polite">
      <p className="text-base font-extrabold tracking-wide">{t("difficultToReach")}</p>
      <p className="mt-1 text-sm text-muted-foreground">{t("noSafeRouteNote")}</p>

      <div className="mt-3 rounded-xl border bg-card p-3">
        <p className="text-[11px] font-extrabold tracking-widest text-muted-foreground">{t("originalDestination")}</p>
        <p className="flex items-center gap-2 text-base font-extrabold text-muted-foreground line-through decoration-2">
          <XCircle className="h-5 w-5 shrink-0 text-emergency" aria-hidden />
          {tx(original.name)}
        </p>
        <p className="mt-1 text-xs font-bold text-warning-foreground">
          {t("reason")}: {reason}
        </p>
      </div>

      <div className="my-2 grid place-items-center">
        <ArrowDown className="h-6 w-6 text-primary" aria-hidden />
      </div>

      {target ? (
        <div className="rounded-xl border-2 border-primary bg-navy-soft p-3">
          <p className="text-[11px] font-extrabold tracking-widest text-primary">{t("newSafeDestination")}</p>
          <p className="text-lg font-extrabold leading-tight">{tx(target.shelter.name)}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <StatusBadge status={target.shelter.status} />
            <span className="font-bold">{target.result.route?.distanceKm} km</span>
            <span className="inline-flex items-center gap-1 font-bold">
              <Footprints className="h-4 w-4" aria-hidden />
              {t("eta")} {target.result.minutes} min
            </span>
            {target.shelter.availableSpaces !== null && (
              <span className="text-muted-foreground">
                {target.shelter.availableSpaces} {t("spaces").toLowerCase()}
              </span>
            )}
          </div>
          <div className="mt-2">
            <FacilityChips facilities={target.shelter.facilities} />
          </div>
          <Link
            to="/safe-route/$id"
            params={{ id: target.shelter.id }}
            className="tap-target mt-3 flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl bg-primary px-5 text-lg font-extrabold tracking-wide text-primary-foreground shadow-action hover:bg-primary/90"
          >
            <Navigation className="h-6 w-6" aria-hidden />
            {t("rerouteToAnother")}
            <ArrowRight className="h-5 w-5" aria-hidden />
          </Link>
        </div>
      ) : (
        <p className="rounded-xl border bg-card p-3 text-sm font-bold">{t("noAlternative")}</p>
      )}
    </section>
  );
}
