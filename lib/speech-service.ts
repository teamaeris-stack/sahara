import type { Lang } from "./i18n";

/**
 * Reusable speech service (app-wide singleton).
 * Level 1: bundled local clip (if the file exists) · Level 2: speechSynthesis with a language-matched voice.
 * Exactly one source plays at a time. Hindi never falls back to an English voice.
 */

const LANG_TAG: Record<Lang, string> = { en: "en-IN", hi: "hi-IN" };

function norm(tag: string): string {
  return (tag || "").replace("_", "-").toLowerCase();
}

/**
 * Hindi  → exact hi-IN → lang starting "hi-"/"hi" → name containing "Hindi".
 * English → exact en-IN → lang starting "en".
 */
export function pickVoice(voices: SpeechSynthesisVoice[], lang: Lang): SpeechSynthesisVoice | null {
  if (lang === "hi") {
    return (
      voices.find((v) => norm(v.lang) === "hi-in") ??
      voices.find((v) => norm(v.lang).startsWith("hi-") || norm(v.lang) === "hi") ??
      voices.find((v) => /hindi/i.test(v.name)) ??
      null
    );
  }
  return voices.find((v) => norm(v.lang) === "en-in") ?? voices.find((v) => norm(v.lang).startsWith("en")) ?? null;
}

type Listener = () => void;

class SpeechService {
  voices: SpeechSynthesisVoice[] = [];
  speaking = false;
  private initialised = false;
  private listeners = new Set<Listener>();
  private utter: SpeechSynthesisUtterance | null = null;
  private clip: HTMLAudioElement | null = null;

  get supported(): boolean {
    return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
  }

  /** Call once on app start: loads voices now and again on `voiceschanged` (voices load late on many devices). */
  init() {
    if (this.initialised || !this.supported) return;
    this.initialised = true;
    const load = () => {
      try {
        const list = window.speechSynthesis.getVoices();
        if (list.length || !this.voices.length) {
          this.voices = list;
          this.emit();
        }
      } catch {
        /* ignore */
      }
    };
    load();
    [250, 1000, 3000, 6000].forEach((ms) => setTimeout(load, ms));
    try {
      window.speechSynthesis.addEventListener("voiceschanged", load);
    } catch {
      /* ignore */
    }
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit() {
    this.listeners.forEach((l) => l());
  }

  private setSpeaking(v: boolean) {
    if (this.speaking !== v) {
      this.speaking = v;
      this.emit();
    }
  }

  voiceFor(lang: Lang): SpeechSynthesisVoice | null {
    return pickVoice(this.voices, lang);
  }

  /** True when voices have loaded and none can speak the language (Hindi only matters in practice). */
  voiceMissing(lang: Lang): boolean {
    return lang === "hi" && this.voices.length > 0 && !this.voiceFor("hi");
  }

  stop() {
    try {
      if (this.clip) {
        this.clip.pause();
        this.clip.src = "";
        this.clip = null;
      }
    } catch {
      /* ignore */
    }
    try {
      if (this.supported) window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
    this.utter = null;
    this.setSpeaking(false);
  }

  /**
   * Plays a bundled clip when it exists, otherwise speaks the text.
   * Resolves with the source actually used ("clip" | "tts" | "none").
   */
  play(text: string, lang: Lang, clipSrc?: string): Promise<"clip" | "tts" | "none"> {
    this.stop();
    if (!clipSrc || typeof Audio === "undefined") return Promise.resolve(this.speak(text, lang) ? "tts" : "none");
    return new Promise((resolve) => {
      let settled = false;
      const audio = new Audio(clipSrc);
      audio.preload = "auto";
      this.clip = audio;
      this.setSpeaking(true);
      const fallback = () => {
        if (settled) return;
        settled = true;
        if (this.clip === audio) this.clip = null;
        resolve(this.speak(text, lang) ? "tts" : "none");
      };
      audio.onerror = fallback;
      audio.onended = () => {
        if (this.clip === audio) {
          this.clip = null;
          this.setSpeaking(false);
        }
      };
      audio.oncanplay = () => {
        if (settled) return;
        settled = true;
        resolve("clip");
      };
      audio.play().catch(fallback);
    });
  }

  /** Speaks with the language-matched voice. Returns false when nothing could be spoken. */
  speak(text: string, lang: Lang): boolean {
    if (!this.supported) {
      this.setSpeaking(false);
      return false;
    }
    try {
      window.speechSynthesis.cancel();
      if (!this.voices.length) this.voices = window.speechSynthesis.getVoices();
      const voice = this.voiceFor(lang);
      if (lang === "hi" && !voice && this.voices.length > 0) {
        // No Hindi voice on this device: do not read Hindi with an English voice.
        this.setSpeaking(false);
        return false;
      }
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.95;
      u.lang = LANG_TAG[lang];
      if (voice) u.voice = voice;
      u.onend = () => {
        if (this.utter === u) this.setSpeaking(false);
      };
      u.onerror = () => {
        if (this.utter === u) this.setSpeaking(false);
      };
      this.utter = u;
      this.setSpeaking(true);
      window.speechSynthesis.speak(u);
      return true;
    } catch {
      this.setSpeaking(false);
      return false;
    }
  }
}

export const speechService = new SpeechService();

/** Resolves true when a bundled clip is reachable (used by the demo voice diagnostic only). */
export async function clipAvailable(src: string): Promise<boolean> {
  try {
    const res = await fetch(src, { method: "HEAD" });
    const type = res.headers.get("content-type") ?? "";
    return res.ok && /audio|octet-stream/i.test(type);
  } catch {
    return false;
  }
}
