import { Link } from "@tanstack/react-router";
import { Users, Info, SlidersHorizontal, ChevronRight, Languages, Check } from "lucide-react";
import { useState } from "react";
import { useLang, type Lang } from "@/lib/i18n";
import { BrandLogo } from "./BrandLogo";
import { DemoPanel } from "./DemoPanel";
import { PrototypeFooter } from "./DeliveryBadge";

export function MoreScreen() {
  const { t, lang, setLang } = useLang();
  const [demoOpen, setDemoOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  const choose = (l: Lang) => {
    setLang(l); // Preference only — emergency data is untouched.
    setLangOpen(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-extrabold tracking-tight">{t("more")}</h1>

      <div className="resq-card flex items-center gap-4 p-4">
        <BrandLogo size="inline" tone="dark" />
        <p className="ml-auto text-right text-xs font-semibold text-muted-foreground">{t("brandTagline")}</p>
      </div>

      <ul className="flex flex-col gap-3">
        <li>
          <button
            type="button"
            onClick={() => setLangOpen((o) => !o)}
            aria-expanded={langOpen}
            className="resq-card tap-target flex w-full items-center gap-4 p-4 text-left hover:bg-muted"
          >
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-navy-soft text-primary">
              <Languages className="h-6 w-6" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-extrabold tracking-wide">{t("language")}</span>
              <span className="block text-sm text-muted-foreground">{lang === "hi" ? t("hindi") : t("english")}</span>
            </span>
            <ChevronRight className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${langOpen ? "rotate-90" : ""}`} aria-hidden />
          </button>
          {langOpen && (
            <div role="radiogroup" aria-label={t("languageLabel")} className="mt-2 grid grid-cols-2 gap-2">
              {(["en", "hi"] as const).map((l) => {
                const active = lang === l;
                return (
                  <button
                    key={l}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    lang={l}
                    onClick={() => choose(l)}
                    className={`tap-target flex min-h-16 items-center justify-center gap-2 rounded-xl border-2 px-4 text-lg font-extrabold ${
                      active ? "border-primary bg-navy-soft text-primary" : "border-input bg-card hover:bg-muted"
                    }`}
                  >
                    {active && <Check className="h-5 w-5" strokeWidth={3} aria-hidden />}
                    {l === "en" ? "English" : "हिन्दी"}
                  </button>
                );
              })}
            </div>
          )}
        </li>
        <li>
          <button
            type="button"
            onClick={() => setDemoOpen(true)}
            className="resq-card tap-target flex w-full items-center gap-4 p-4 text-left hover:bg-muted"
          >
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-navy-soft text-primary">
              <SlidersHorizontal className="h-6 w-6" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-extrabold tracking-wide">{t("demoControls")}</span>
              <span className="block text-sm text-muted-foreground">{t("demoControlsSub")}</span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
          </button>
        </li>
        <li>
          <Link to="/community" className="resq-card tap-target flex w-full items-center gap-4 p-4 text-left hover:bg-muted" data-testid="more-community">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-navy-soft text-primary">
              <Users className="h-6 w-6" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-extrabold tracking-wide">{t("communitySupport")}</span>
              <span className="block text-sm text-muted-foreground">{t("communitySub")}</span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        </li>
        <li>
          <button
            type="button"
            onClick={() => setAboutOpen((o) => !o)}
            aria-expanded={aboutOpen}
            className="resq-card tap-target flex w-full items-center gap-4 p-4 text-left hover:bg-muted"
          >
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-navy-soft text-primary">
              <Info className="h-6 w-6" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-extrabold tracking-wide">{t("aboutResq")}</span>
              <span className="block text-sm text-muted-foreground">{t("tagline")}</span>
            </span>
            <ChevronRight className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${aboutOpen ? "rotate-90" : ""}`} aria-hidden />
          </button>
          {aboutOpen && (
            <div className="mt-2 rounded-xl border bg-muted p-4 text-sm text-muted-foreground">
              <div className="mb-3 grid place-items-center rounded-lg bg-card p-3">
                <BrandLogo size="hero" tone="dark" />
              </div>
              <p className="text-base font-bold text-foreground">When networks fail, Sahara stays with you.</p>
              <p className="mt-2">
                Sahara is an offline-first citizen emergency app. Your status, SOS requests, safety guidance and cached safe
                places are stored on this device and delivered when a path becomes available.
              </p>
              <p className="mt-2">{t("brandTagline")}</p>
            </div>
          )}
        </li>
      </ul>

      <PrototypeFooter />
      <DemoPanel open={demoOpen} onClose={() => setDemoOpen(false)} />
    </div>
  );
}
