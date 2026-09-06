import { ShieldCheck } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { BrandLogo } from "./BrandLogo";

/** First-time setup: choose a language once. Not authentication — just a stored preference. */
export function LanguageSetup() {
  const { setLang } = useLang();
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-navy px-6 py-10 text-navy-foreground">
      <div className="flex w-full max-w-md flex-col items-center text-center">
        <div className="grid w-full place-items-center rounded-2xl bg-card px-6 py-6 shadow-action">
          <BrandLogo size="hero" tone="dark" />
        </div>
        <p className="mt-6 text-base font-semibold text-navy-foreground/85">People. Families. Safer Together.</p>
        <p className="mt-1 text-base font-semibold text-navy-foreground/85" lang="hi">
          लोग। परिवार। साथ में सुरक्षित।
        </p>

        <h1 className="mt-10 text-xs font-extrabold tracking-widest text-navy-foreground/80">
          CHOOSE YOUR LANGUAGE · <span lang="hi">अपनी भाषा चुनें</span>
        </h1>

        <div className="mt-4 flex w-full flex-col gap-3">
          <button
            type="button"
            onClick={() => setLang("en")}
            lang="en"
            className="btn btn-lg min-h-20 w-full flex-col gap-1 bg-card text-foreground shadow-action hover:bg-muted"
          >
            <span className="section-label">English</span>
            <span className="text-2xl font-extrabold">Continue in English</span>
          </button>
          <button
            type="button"
            onClick={() => setLang("hi")}
            lang="hi"
            className="btn btn-lg min-h-20 w-full flex-col gap-1 bg-card text-foreground shadow-action hover:bg-muted"
          >
            <span className="section-label">हिन्दी</span>
            <span className="text-2xl font-extrabold">हिन्दी में जारी रखें</span>
          </button>
        </div>

        <p className="mt-8 flex items-center gap-2 text-xs text-navy-foreground/70">
          <ShieldCheck className="h-4 w-4" aria-hidden />
          Saved on this device · You can change it later in MORE.
        </p>
      </div>
    </main>
  );
}
