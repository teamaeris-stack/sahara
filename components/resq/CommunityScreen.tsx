import { Link, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronRight,
  Clock,
  MapPin,
  Megaphone,
  RefreshCw,
  ShieldCheck,
  Users,
  WifiOff,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  ASSISTANCE_META,
  COMMUNITY_REFRESH_MS,
  REPORT_META,
  REPORT_OPTIONS,
  REQUEST_TYPE_KEY,
  ROAD_KEYS,
  SELF_HELPER_ID,
  acceptedIds,
  activeReports,
  formatDistance,
  helperEligibility,
  isRequestActive,
  nearbyRequests,
  type AssistanceType,
  type CommunityRequest,
  type Eligibility,
  type ReportType,
} from "@/lib/community";
import { useLang, type TKey } from "@/lib/i18n";
import { useNow, useResq } from "@/lib/resq-store";
import { SHELTERS, type RoadKey } from "@/lib/shelters";
import { peopleRangeLabel } from "@/lib/sos";
import { CommunitySignalCard } from "./CommunityBits";
import { Sheet, SheetButton } from "./Sheet";

const ROAD_KEY_T: Record<RoadKey, TKey> = {
  mainRoad: "mainRoad",
  schoolRoad: "schoolRoad",
  templeRoad: "templeRoad",
  northStreet: "northStreet",
  eastStreet: "eastStreet",
  stationRoad: "stationRoad",
};

const INELIGIBLE_KEY: Record<NonNullable<Eligibility["reason"]>, TKey> = {
  NEEDS_HELP: "notEligibleNeedsHelp",
  STALE: "notEligibleStale",
  RECHECK_OVERDUE: "notEligibleOverdue",
  UNKNOWN: "notEligibleUnknown",
  ACTIVE_SOS: "notEligibleSos",
};

function minsAgo(ts: number, now: number): number {
  return Math.max(0, Math.round((now - ts) / 60_000));
}

/** MORE → COMMUNITY SUPPORT. Nearby assistance (eligible users only), my assistance, local disaster updates. */
export function CommunityScreen({ openId }: { openId?: string | undefined }) {
  const { t, tx } = useLang();
  const {
    hydrated,
    userStatus,
    lastSafetyCheckAt,
    recheckDue,
    packets,
    communityRequests,
    helperResponses,
    communityReports,
    refreshCommunity,
    resolveRequest,
    setUserStatus,
    networkStatus,
  } = useResq();
  const now = useNow();
  const [openReq, setOpenReq] = useState<string | null>(openId ?? null);
  const [reportOpen, setReportOpen] = useState(false);

  // Local-first expiry + queue flush. Timestamp-driven, so we pause while hidden and catch up on return.
  useEffect(() => {
    refreshCommunity();
    let id: ReturnType<typeof setInterval> | null = setInterval(
      refreshCommunity,
      COMMUNITY_REFRESH_MS,
    );
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        if (id) clearInterval(id);
        id = null;
      } else if (!id) {
        refreshCommunity();
        id = setInterval(refreshCommunity, COMMUNITY_REFRESH_MS);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      if (id) clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refreshCommunity]);

  const eligibility = useMemo(
    () => helperEligibility({ userStatus, lastSafetyCheckAt, recheckDue, packets, now }),
    [userStatus, lastSafetyCheckAt, recheckDue, packets, now],
  );
  const nearby = useMemo(
    () => nearbyRequests(communityRequests, helperResponses, now),
    [communityRequests, helperResponses, now],
  );
  const mine = useMemo(
    () =>
      communityRequests
        .filter((r) => r.requesterId === SELF_HELPER_ID)
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [communityRequests],
  );
  const accepted = acceptedIds(helperResponses);
  const helping = useMemo(
    () => communityRequests.filter((r) => accepted.has(r.id) && isRequestActive(r, now)),
    [communityRequests, accepted, now],
  );
  const updates = useMemo(
    () => activeReports(communityReports, now).slice(0, 12),
    [communityReports, now],
  );
  const selected = openReq ? (communityRequests.find((r) => r.id === openReq) ?? null) : null;
  const canReconfirm =
    eligibility.reason === "STALE" ||
    eligibility.reason === "RECHECK_OVERDUE" ||
    eligibility.reason === "UNKNOWN";

  if (!hydrated) return null;

  return (
    <div className="flex flex-col gap-5">
      <Link
        to="/more"
        className="tap-target flex w-fit items-center gap-2 rounded-lg px-2 text-sm font-extrabold tracking-wide text-primary hover:bg-muted"
      >
        <ArrowLeft className="h-5 w-5" aria-hidden />
        {t("more")}
      </Link>
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
          <Users className="h-7 w-7 text-primary" aria-hidden />
          {t("communitySupport")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("communityIntro")}</p>
      </header>

      {networkStatus === "OFFLINE" && (
        <p
          className="flex items-center gap-2 rounded-xl border border-warning-border bg-warning-soft p-3 text-sm font-bold"
          role="status"
        >
          <WifiOff className="h-5 w-5 shrink-0 text-warning-foreground" aria-hidden />
          <span>
            {t("offlineResilienceMode")} ·{" "}
            <span className="font-semibold text-muted-foreground">{t("waitingDeliveryPath")}</span>
          </span>
        </p>
      )}

      {/* Requester view: this device's own requests */}
      {mine
        .filter((r) => isRequestActive(r, now))
        .map((r) => (
          <div key={r.id} className="flex flex-col gap-2">
            <CommunitySignalCard request={r} />
            {r.requestType !== "URGENT_UNKNOWN" && (
              <button
                type="button"
                onClick={() => resolveRequest(r.id)}
                className="btn btn-secondary w-full text-sm"
              >
                {t("markResolved")}
              </button>
            )}
          </div>
        ))}

      {/* Helper safety status */}
      <section
        className={`rounded-xl border p-3 text-sm ${eligibility.eligible ? "border-safe-border bg-safe-soft" : "border-warning-border bg-warning-soft"}`}
        data-testid="eligibility"
      >
        {eligibility.eligible ? (
          <p className="flex items-center gap-2 font-bold">
            <ShieldCheck className="h-5 w-5 shrink-0 text-safe" aria-hidden />
            {t("safetyCheckCurrent")}
            {eligibility.safeAgeMin !== null && (
              <span className="font-semibold text-muted-foreground">
                · {eligibility.safeAgeMin} {t("minAgo")}
              </span>
            )}
          </p>
        ) : (
          <>
            <p className="flex items-center gap-2 font-extrabold">
              <AlertTriangle className="h-5 w-5 shrink-0 text-warning-foreground" aria-hidden />
              {helping.length > 0 ? t("safetyNoLongerCurrent") : t("safetyCheckRequired")}
            </p>
            <p className="mt-1 text-muted-foreground">
              {eligibility.reason
                ? t(INELIGIBLE_KEY[eligibility.reason])
                : t("safetyCheckRequiredNote")}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {canReconfirm ? (
                <button
                  type="button"
                  onClick={() => setUserStatus("SAFE")}
                  className="btn btn-safe"
                  data-testid="community-im-safe"
                >
                  <Check className="h-5 w-5" strokeWidth={3} aria-hidden />
                  {t("imSafe")}
                </button>
              ) : (
                <Link to="/" className="btn btn-primary">
                  {t("goToHome")}
                </Link>
              )}
              <Link to="/more" className="btn btn-secondary">
                {t("cancel")}
              </Link>
            </div>
          </>
        )}
      </section>

      {/* NEARBY ASSISTANCE */}
      <section aria-labelledby="nearby-h">
        <div className="flex items-center justify-between">
          <h2 id="nearby-h" className="section-label">
            {t("nearbyAssistance")}
          </h2>
          <button
            type="button"
            onClick={refreshCommunity}
            aria-label={t("updated")}
            className="tap-target grid place-items-center rounded-lg px-2 text-muted-foreground hover:bg-muted"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
          </button>
        </div>
        {!eligibility.eligible ? (
          <p className="mt-2 rounded-xl border bg-muted p-4 text-sm text-muted-foreground">
            {t("safetyCheckRequiredNote")}
          </p>
        ) : nearby.length === 0 ? (
          <div className="mt-2 rounded-xl border bg-muted p-4 text-sm">
            <p className="font-extrabold">{t("noActiveRequestsNearby")}</p>
            <p className="mt-1 text-muted-foreground">{t("noActiveRequestsNote")}</p>
          </div>
        ) : (
          <ul className="mt-2 flex flex-col gap-2" data-testid="nearby-list">
            {nearby.map((r) => {
              const urgent = r.requestType === "URGENT_UNKNOWN";
              const first = r.allowedAssistanceTypes[0];
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setOpenReq(r.id)}
                    className={`resq-card tap-target flex w-full items-center gap-3 p-4 text-left hover:bg-muted ${urgent ? "border-emergency-border" : ""}`}
                  >
                    <span
                      className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${urgent ? "bg-emergency text-emergency-foreground" : "bg-navy-soft text-primary"}`}
                    >
                      {urgent ? (
                        <AlertTriangle className="h-6 w-6" aria-hidden />
                      ) : (
                        <Megaphone className="h-6 w-6" aria-hidden />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="section-label block">
                        {urgent ? t("potentialEmergencyNearby") : t("assistanceNeededNearby")}
                      </span>
                      <span className="block text-base font-extrabold">
                        {t(REQUEST_TYPE_KEY[r.requestType])}
                      </span>
                      <span className="block text-sm text-muted-foreground">
                        {formatDistance(r.distanceM)} {t("approxAway")} ·{" "}
                        {peopleRangeLabel(r.peopleRange, r.peopleCount)}{" "}
                        {r.peopleRange || r.peopleCount !== 1 ? t("peopleLower") : t("person")} ·{" "}
                        {minsAgo(r.updatedAt, now)} {t("minAgo")}
                      </span>
                      {first && (
                        <span className="block text-xs font-semibold text-muted-foreground">
                          {t("possibleAssistance")}: {t(ASSISTANCE_META[first].key)}
                        </span>
                      )}
                      {accepted.has(r.id) && (
                        <span className="mt-1 inline-block rounded-full bg-safe px-2 py-0.5 text-xs font-extrabold text-safe-foreground">
                          {t("assistanceAccepted")}
                        </span>
                      )}
                    </span>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* MY ASSISTANCE */}
      {(helping.length > 0 || mine.some((r) => !isRequestActive(r, now))) && (
        <section aria-labelledby="mine-h">
          <h2 id="mine-h" className="section-label">
            {t("myAssistance")}
          </h2>
          <ul className="mt-2 flex flex-col gap-2" data-testid="my-requests">
            {helping.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setOpenReq(r.id)}
                  className="resq-card tap-target flex w-full items-center gap-3 p-4 text-left hover:bg-muted"
                >
                  <Check className="h-6 w-6 shrink-0 text-safe" strokeWidth={3} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-extrabold">
                      {t(REQUEST_TYPE_KEY[r.requestType])}
                    </span>
                    <span className="block text-sm text-muted-foreground">
                      {tx(r.approxLocationLabel)} · {t("assistanceAccepted")}
                    </span>
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                </button>
              </li>
            ))}
            {mine
              .filter((r) => !isRequestActive(r, now))
              .slice(0, 3)
              .map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-2 rounded-xl border bg-muted px-4 py-3"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-extrabold">
                      {t(REQUEST_TYPE_KEY[r.requestType])}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {tx(r.approxLocationLabel)} · {minsAgo(r.createdAt, now)} {t("minAgo")}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-card px-2 py-0.5 text-xs font-extrabold text-muted-foreground">
                    {r.status === "RESOLVED" ? t("resolved") : t("expired")}
                  </span>
                </li>
              ))}
          </ul>
        </section>
      )}

      {/* Report local condition */}
      <button
        type="button"
        onClick={() => setReportOpen(true)}
        disabled={!eligibility.eligible}
        className="btn btn-primary btn-lg w-full"
        data-testid="report-condition"
      >
        <Megaphone className="h-5 w-5" aria-hidden />
        {t("reportLocalCondition")}
      </button>

      {/* LOCAL DISASTER UPDATES */}
      <section aria-labelledby="updates-h">
        <h2 id="updates-h" className="section-label">
          {t("localDisasterUpdates")}
        </h2>
        {updates.length === 0 ? (
          <div className="mt-2 rounded-xl border bg-muted p-4 text-sm">
            <p className="font-extrabold">{t("noEmergencyReports")}</p>
            <p className="mt-1 text-muted-foreground">{t("noCommunityUpdates")}</p>
          </div>
        ) : (
          <ul className="mt-2 flex flex-col gap-2" data-testid="updates-list">
            {updates.map((u) => {
              const meta = REPORT_META[u.reportType];
              const Icon = meta.icon;
              const hazard = !!meta.hazard;
              return (
                <li
                  key={u.id}
                  className={`flex items-center gap-3 rounded-xl border p-3 ${hazard ? "border-warning-border bg-warning-soft" : "bg-card"}`}
                >
                  <Icon
                    className={`h-6 w-6 shrink-0 ${hazard ? "text-warning-foreground" : "text-primary"}`}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-extrabold">{t(meta.key)}</span>
                    <span className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" aria-hidden />
                      {tx(u.locationLabel)} · {t("sourceLabel")}:{" "}
                      {u.reporterId === SELF_HELPER_ID ? t("you") : t("communityReport")} ·{" "}
                      {minsAgo(u.createdAt, now)} {t("minAgo")}
                    </span>
                  </span>
                  {u.sync === "QUEUED" && (
                    <WifiOff
                      className="h-4 w-4 shrink-0 text-warning-foreground"
                      aria-label={t("waitingPathNote")}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <RequestSheet request={selected} eligibility={eligibility} onClose={() => setOpenReq(null)} />
      <ReportSheet open={reportOpen} onClose={() => setReportOpen(false)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Request detail + safety-gated assistance
// ---------------------------------------------------------------------------

function RequestSheet({
  request,
  eligibility,
  onClose,
}: {
  request: CommunityRequest | null;
  eligibility: Eligibility;
  onClose: () => void;
}) {
  const { t, tx } = useLang();
  const {
    respondToRequest,
    submitCommunityReport,
    reportLastSeen,
    helperResponses,
    networkStatus,
  } = useResq();
  const navigate = useNavigate();
  const [stage, setStage] = useState<"detail" | "gate" | "actions" | "road" | "shelter" | "done">(
    "detail",
  );
  const [action, setAction] = useState<AssistanceType | null>(null);
  const [doneKey, setDoneKey] = useState<TKey>("reportSent");

  useEffect(() => {
    setStage("detail");
    setAction(null);
  }, [request?.id]);

  if (!request) return null;
  const alreadyAccepted = acceptedIds(helperResponses).has(request.id);
  const riskKey: TKey =
    request.riskLevel === "HIGH"
      ? "riskHigh"
      : request.riskLevel === "MODERATE"
        ? "riskModerate"
        : "riskLow";

  const finish = (key: TKey) => {
    setDoneKey(key);
    setStage("done");
  };

  const chooseAction = (a: AssistanceType) => {
    setAction(a);
    respondToRequest(request.id, "CAN_ASSIST", a);
    const meta = ASSISTANCE_META[a];
    if (a === "SAW_PERSON" || a === "REPORT_LAST_SEEN") return setStage("road");
    if (a === "CONTACT_RESPONDER") return finish("contactResponderNote");
    if (a === "REPORT_OBSERVATION" || a === "GUIDE_FROM_SAFE_AREA") return finish("responseStored");
    if (meta.reportType === "SHELTER_OPEN") return setStage("shelter");
    if (meta.reportType) return setStage("road");
    finish("responseStored");
  };

  const pickRoad = (road: RoadKey) => {
    if (!action) return;
    if (action === "SAW_PERSON" || action === "REPORT_LAST_SEEN") {
      reportLastSeen(request.id, road);
      return finish("lastSeenRecorded");
    }
    const rt = ASSISTANCE_META[action].reportType ?? "ROAD_PASSABLE";
    submitCommunityReport({ reportType: rt, roadKey: road, requestId: request.id });
    finish("reportSent");
  };

  const pickShelter = (shelterId: string, rt: ReportType) => {
    submitCommunityReport({ reportType: rt, shelterId, requestId: request.id });
    finish("reportSent");
  };

  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={t(REQUEST_TYPE_KEY[request.requestType])}
      description={`${tx(request.approxLocationLabel)} · ${peopleRangeLabel(request.peopleRange, request.peopleCount)} ${request.peopleRange || request.peopleCount !== 1 ? t("peopleLower") : t("person")}`}
    >
      {stage === "detail" && (
        <div className="flex flex-col gap-3">
          <p
            className={`rounded-xl border p-3 text-sm font-bold ${request.riskLevel === "HIGH" ? "border-emergency-border bg-emergency-soft" : "border-warning-border bg-warning-soft"}`}
          >
            {t(riskKey)}
          </p>
          {request.subjectMemberId && (
            <Link
              to="/family/$id"
              params={{ id: request.subjectMemberId }}
              className="text-sm font-extrabold text-primary underline"
            >
              {t("lastSeenIntel")}
            </Link>
          )}
          {alreadyAccepted && (
            <p className="text-sm font-bold text-safe">{t("assistanceRecorded")}</p>
          )}
          {alreadyAccepted && !eligibility.eligible && (
            <p
              className="rounded-xl border border-warning-border bg-warning-soft p-3 text-sm font-bold"
              role="alert"
            >
              {t("safetyNoLongerCurrent")} — {t("safetyNoLongerCurrentNote")}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <SheetButton
              variant="outline"
              onClick={() => {
                respondToRequest(request.id, "DECLINED");
                onClose();
              }}
            >
              {t("notAvailableBtn")}
            </SheetButton>
            <SheetButton
              onClick={() => (eligibility.eligible ? setStage("gate") : navigate({ to: "/" }))}
              data-testid="i-can-assist"
            >
              {eligibility.eligible ? t("iCanAssist") : t("goToHome")}
            </SheetButton>
          </div>
        </div>
      )}

      {stage === "gate" && (
        <div className="flex flex-col gap-3" data-testid="safety-gate">
          <h3 className="section-label">{t("beforeYouHelp")}</h3>
          <ul className="flex flex-col gap-2 text-sm font-bold">
            <li className="flex items-center gap-2">
              <Check className="h-5 w-5 text-safe" aria-hidden />
              {t("statusIsSafe")}
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-5 w-5 text-safe" aria-hidden />
              {t("safetyCheckCurrent")}
            </li>
            <li className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning-foreground" aria-hidden />
              {t("onlyHelpSafe")}
            </li>
          </ul>
          <SheetButton onClick={() => setStage("actions")}>{t("continueSafely")}</SheetButton>
        </div>
      )}

      {stage === "actions" && (
        <div className="flex flex-col gap-2" data-testid="assist-actions">
          <h3 className="section-label">{t("howCanYouHelp")}</h3>
          <p className="text-xs text-muted-foreground">{t("safeOnlyNote")}</p>
          {request.allowedAssistanceTypes.map((a) => {
            const meta = ASSISTANCE_META[a];
            const Icon = meta.icon;
            return (
              <button
                key={a}
                type="button"
                onClick={() => chooseAction(a)}
                className="tap-target flex w-full items-center gap-3 rounded-xl border-2 border-input bg-card px-4 py-3 text-left text-sm font-extrabold hover:bg-muted"
              >
                <Icon className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                {t(meta.key)}
              </button>
            );
          })}
        </div>
      )}

      {stage === "road" && (
        <div className="flex flex-col gap-2">
          <h3 className="section-label">{t("whichRoad")}</h3>
          {ROAD_KEYS.map((rk) => (
            <button
              key={rk}
              type="button"
              onClick={() => pickRoad(rk)}
              className="tap-target flex w-full items-center gap-2 rounded-xl border-2 border-input bg-card px-4 py-3 text-left text-sm font-bold hover:bg-muted"
            >
              <MapPin className="h-4 w-4 shrink-0" aria-hidden />
              {t(ROAD_KEY_T[rk])}
            </button>
          ))}
        </div>
      )}

      {stage === "shelter" && (
        <div className="flex flex-col gap-3">
          <h3 className="section-label">{t("whichShelter")}</h3>
          {SHELTERS.map((s) => (
            <div key={s.id} className="rounded-xl border-2 border-input bg-card p-3">
              <p className="text-sm font-extrabold">{tx(s.name)}</p>
              <p className="text-xs text-muted-foreground">{t("shelterOpenQ")}</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => pickShelter(s.id, "SHELTER_OPEN")}
                  className="tap-target rounded-lg bg-safe py-2 text-xs font-extrabold text-safe-foreground"
                >
                  {t("rpShelterOpen")}
                </button>
                <button
                  type="button"
                  onClick={() => pickShelter(s.id, "SHELTER_FULL")}
                  className="tap-target rounded-lg bg-warning py-2 text-xs font-extrabold text-warning-foreground"
                >
                  {t("rpShelterFull")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {stage === "done" && (
        <div className="flex flex-col gap-3" role="status" data-testid="assist-done">
          <p className="flex items-center gap-2 text-base font-extrabold">
            <Check className="h-6 w-6 text-safe" strokeWidth={3} aria-hidden />
            {t(doneKey)}
          </p>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            {networkStatus === "ONLINE" ? (
              <Check className="h-4 w-4" aria-hidden />
            ) : (
              <Clock className="h-4 w-4" aria-hidden />
            )}
            {networkStatus === "ONLINE" ? t("requestShared") : t("reportPendingDelivery")}
          </p>
          <SheetButton onClick={onClose}>{t("done")}</SheetButton>
        </div>
      )}
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// REPORT LOCAL CONDITION
// ---------------------------------------------------------------------------

function ReportSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, tx } = useLang();
  const { submitCommunityReport, networkStatus } = useResq();
  const [type, setType] = useState<ReportType | null>(null);
  const [done, setDone] = useState(false);

  const close = () => {
    setType(null);
    setDone(false);
    onClose();
  };
  const opt = REPORT_OPTIONS.find((o) => o.type === type);

  const submit = (input: { roadKey?: RoadKey; shelterId?: string; reportType?: ReportType }) => {
    if (!type) return;
    submitCommunityReport({
      reportType: input.reportType ?? type,
      roadKey: input.roadKey,
      shelterId: input.shelterId,
    });
    setDone(true);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && close()}
      title={t("reportLocalCondition")}
      description={t("reportOnlySafe")}
    >
      {done ? (
        <div className="flex flex-col gap-3" role="status" data-testid="report-done">
          <p className="flex items-center gap-2 text-base font-extrabold">
            <Check className="h-6 w-6 text-safe" strokeWidth={3} aria-hidden />
            {t("reportSent")}
          </p>
          <p className="text-sm text-muted-foreground">
            {networkStatus === "ONLINE" ? t("requestShared") : t("reportPendingDelivery")}
          </p>
          <SheetButton onClick={close}>{t("done")}</SheetButton>
        </div>
      ) : !type ? (
        <div className="grid grid-cols-2 gap-2" data-testid="report-options">
          <p className="section-label col-span-2">{t("whatDoYouSee")}</p>
          {REPORT_OPTIONS.map((o) => {
            const Icon = o.icon;
            return (
              <button
                key={o.type}
                type="button"
                onClick={() => setType(o.type)}
                className="tap-target flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl border-2 border-input bg-card p-2 text-center text-xs font-extrabold hover:bg-muted"
              >
                <Icon className="h-6 w-6 text-primary" aria-hidden />
                {t(o.key)}
              </button>
            );
          })}
        </div>
      ) : opt?.target === "road" ? (
        <div className="flex flex-col gap-2">
          <h3 className="section-label">{t("whichRoad")}</h3>
          {ROAD_KEYS.map((rk) => (
            <button
              key={rk}
              type="button"
              onClick={() => submit({ roadKey: rk })}
              className="tap-target flex w-full items-center gap-2 rounded-xl border-2 border-input bg-card px-4 py-3 text-left text-sm font-bold hover:bg-muted"
            >
              <MapPin className="h-4 w-4 shrink-0" aria-hidden />
              {t(ROAD_KEY_T[rk])}
            </button>
          ))}
          <SheetButton variant="outline" onClick={() => setType(null)}>
            {t("back")}
          </SheetButton>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <h3 className="section-label">{t("whichShelter")}</h3>
          {SHELTERS.map((s) => (
            <div key={s.id} className="rounded-xl border-2 border-input bg-card p-3">
              <p className="text-sm font-extrabold">{tx(s.name)}</p>
              {type === "SHELTER_OPEN" ? (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => submit({ shelterId: s.id, reportType: "SHELTER_OPEN" })}
                    className="tap-target rounded-lg bg-safe py-2 text-xs font-extrabold text-safe-foreground"
                  >
                    {t("rpShelterOpen")}
                  </button>
                  <button
                    type="button"
                    onClick={() => submit({ shelterId: s.id, reportType: "SHELTER_FULL" })}
                    className="tap-target rounded-lg bg-warning py-2 text-xs font-extrabold text-warning-foreground"
                  >
                    {t("rpShelterFull")}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => submit({ shelterId: s.id })}
                  className="tap-target mt-2 w-full rounded-lg bg-primary py-2 text-xs font-extrabold text-primary-foreground"
                >
                  {t("submitReport")}
                </button>
              )}
            </div>
          ))}
          <SheetButton variant="outline" onClick={() => setType(null)}>
            {t("back")}
          </SheetButton>
        </div>
      )}
    </Sheet>
  );
}
