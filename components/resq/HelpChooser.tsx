import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ClipboardList, Siren } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { useResq } from "@/lib/resq-store";

/** YOU NEED HELP — two separate emergency paths. Status NEEDS_HELP was already recorded before arriving here. */
export function HelpChooser() {
  const { t } = useLang();
  const { createDirectSos } = useResq();
  const navigate = useNavigate();

  const sosNow = () => {
    const p = createDirectSos();
    navigate({ to: "/sos-now", search: { id: p.id } });
  };

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => navigate({ to: "/" })}
        className="tap-target flex w-fit items-center gap-2 rounded-lg px-2 text-sm font-extrabold tracking-wide text-primary hover:bg-muted"
      >
        <ArrowLeft className="h-5 w-5" aria-hidden />
        {t("back")}
      </button>
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight">{t("youNeedHelp")}</h1>
        <p className="mt-1 text-base text-muted-foreground">{t("chooseHowContinue")}</p>
        <p className="mt-2 rounded-lg border border-emergency-border bg-emergency-soft px-3 py-2 text-sm font-bold">{t("helpStatusRecorded")}</p>
      </header>

      <button
        type="button"
        onClick={sosNow}
        data-testid="sos-now"
        className="tap-target flex min-h-28 w-full items-center gap-4 rounded-2xl border-4 border-emergency bg-emergency px-5 text-emergency-foreground shadow-action ring-4 ring-emergency/25 hover:bg-emergency/90"
      >
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-emergency-foreground/15 text-base font-black tracking-wider" aria-hidden>
          SOS
        </span>
        <span className="text-left">
          <span className="block text-2xl font-black tracking-wide">{t("sosNow")}</span>
          <span className="block text-sm font-bold opacity-90">{t("sosNowSub")}</span>
        </span>
      </button>

      <button
        type="button"
        onClick={() => navigate({ to: "/sos" })}
        data-testid="describe-emergency"
        className="tap-target flex min-h-24 w-full items-center gap-4 rounded-2xl border-2 border-primary bg-card px-5 text-primary shadow-card hover:bg-navy-soft"
      >
        <ClipboardList className="h-10 w-10 shrink-0" strokeWidth={2.25} aria-hidden />
        <span className="text-left">
          <span className="block text-xl font-extrabold tracking-wide">{t("describeEmergency")}</span>
          <span className="block text-sm font-semibold text-muted-foreground">{t("describeEmergencySub")}</span>
        </span>
      </button>

      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <Siren className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        {t("prototypeFooter")}
      </p>
    </div>
  );
}
