import { Link } from "@tanstack/react-router";
import {
  Home,
  Users,
  Building2,
  Compass,
  MoreHorizontal,
  Wifi,
  WifiOff,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useLang, type TKey } from "@/lib/i18n";
import { useResq } from "@/lib/resq-store";
import { speechService } from "@/lib/speech-service";
import { BrandLogo } from "./BrandLogo";
import { DemoPanel } from "./DemoPanel";
import { DisasterAlert } from "./DisasterAlert";
import { LanguageSetup } from "./LanguageSetup";
import { SyncNotice } from "./SyncNotice";

const NAV: { to: "/" | "/family" | "/shelters" | "/guide" | "/more"; label: TKey; icon: LucideIcon }[] = [
  { to: "/", label: "home", icon: Home },
  { to: "/family", label: "family", icon: Users },
  { to: "/shelters", label: "shelters", icon: Building2 },
  { to: "/guide", label: "guide", icon: Compass },
  { to: "/more", label: "more", icon: MoreHorizontal },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { networkStatus } = useResq();
  const { t, needsSetup } = useLang();
  const [demoOpen, setDemoOpen] = useState(false);
  const online = networkStatus === "ONLINE";

  // Voices load asynchronously; start listening as early as possible so Hindi audio is ready when needed.
  useEffect(() => speechService.init(), []);

  // First launch only: choose a language before entering Citizen Home.
  if (needsSetup) return <LanguageSetup />;

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-30 border-b bg-card shadow-card">
        <div className="mx-auto flex w-full max-w-md items-center justify-between gap-3 px-4 py-2.5">
          <Link to="/" aria-label={t("home")} className="flex min-w-0 items-center rounded-lg focus-visible:outline-ring">
            <BrandLogo size="header" tone="dark" />
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <p
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${
                online ? "border-safe-border bg-safe-soft text-safe" : "border-warning-border bg-warning-soft text-warning-foreground"
              }`}
              role="status"
              aria-live="polite"
            >
              {online ? <Wifi className="h-3.5 w-3.5" aria-hidden /> : <WifiOff className="h-3.5 w-3.5" aria-hidden />}
              <span className="max-w-[9rem] truncate">{online ? t("connectedShort") : t("offlineResilienceShort")}</span>
            </p>
            <button
              type="button"
              onClick={() => setDemoOpen(true)}
              aria-label="Open demo controls"
              className="tap-target grid place-items-center rounded-lg border border-input text-muted-foreground hover:bg-muted"
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      </header>

      <SyncNotice />
      <main className="mx-auto w-full max-w-md flex-1 px-4 pb-28 pt-4">{children}</main>

      <nav
        aria-label="Main navigation"
        className="fixed inset-x-0 bottom-0 z-30 border-t bg-card shadow-nav safe-bottom"
      >
        <ul className="mx-auto grid w-full max-w-md grid-cols-5">
          {NAV.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <Link
                to={to}
                aria-label={t(label)}
                className="flex min-h-16 flex-col items-center justify-center gap-1 text-muted-foreground"
                activeProps={{ className: "text-primary", "aria-current": "page" }}
                activeOptions={{ exact: to === "/" }}
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={`grid h-8 w-12 place-items-center rounded-full ${isActive ? "bg-navy-soft" : ""}`}
                    >
                      <Icon className="h-6 w-6" strokeWidth={isActive ? 2.5 : 2} aria-hidden />
                    </span>
                    <span className="text-[11px] font-bold tracking-wide">{t(label)}</span>
                  </>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <DemoPanel open={demoOpen} onClose={() => setDemoOpen(false)} />
      <DisasterAlert />
    </div>
  );
}
