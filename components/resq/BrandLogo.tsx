import { useEffect, useRef, useState } from "react";

/** Public asset: the full Sahara lockup — emblem with the "Sahara" wordmark and tagline. */
export const LOGO_SRC = "/sahara-logo.png";

type Size = "header" | "hero" | "inline";

const SIZES: Record<Size, { img: string; text: string }> = {
  header: { img: "h-11 max-w-[160px]", text: "text-xl" },
  hero: { img: "h-24 max-w-[280px] sm:h-28", text: "text-5xl" },
  inline: { img: "h-14 max-w-[180px]", text: "text-2xl" },
};

/**
 * Sahara brand lockup. Uses the provided bilingual logo image (never stretched; object-fit: contain)
 * and falls back to accessible "Sahara" text if the asset is missing. Accessible name is always "Sahara".
 */
export function BrandLogo({ size = "header", tone = "light", className = "" }: { size?: Size; tone?: "light" | "dark"; className?: string }) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  const s = SIZES[size];
  // The error event can fire before hydration attaches onError; re-check once mounted.
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, []);
  if (failed) {
    return (
      <span className={`inline-flex items-center gap-2 ${className}`} aria-label="Sahara" role="img">
        <span
          className={`grid shrink-0 place-items-center rounded-lg font-black ${size === "hero" ? "h-16 w-16 text-3xl" : "h-9 w-9 text-lg"} ${
            tone === "light" ? "bg-navy-foreground/15 text-navy-foreground" : "bg-navy text-navy-foreground"
          }`}
          aria-hidden
        >
          S
        </span>
        <span className={`font-extrabold tracking-tight ${s.text} ${tone === "light" ? "text-navy-foreground" : "text-foreground"}`}>Sahara</span>
      </span>
    );
  }
  return (
    <img
      ref={ref}
      src={LOGO_SRC}
      alt="Sahara"
      width={size === "hero" ? 280 : 140}
      height={size === "hero" ? 112 : 36}
      decoding="async"
      loading="eager"
      onError={() => setFailed(true)}
      className={`${s.img} w-auto object-contain object-left ${className}`}
    />
  );
}
