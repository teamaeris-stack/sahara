import { useCallback, useEffect, useState } from "react";
import type { Lang } from "@/lib/i18n";
import { speechService } from "@/lib/speech-service";

export { pickVoice } from "@/lib/speech-service";

/**
 * React binding for the shared speech service. Never throws when unsupported.
 * `speak(text, clipSrc?)` plays a bundled clip first (if it exists) and falls back to
 * speech synthesis with a language-matched voice; repeated taps cancel the previous source.
 */
export function useSpeech(lang: Lang) {
  const [, force] = useState(0);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    speechService.init();
    setSupported(speechService.supported);
    const unsub = speechService.subscribe(() => force((n) => n + 1));
    return () => {
      unsub();
      speechService.stop();
    };
  }, []);

  const stop = useCallback(() => speechService.stop(), []);
  const speak = useCallback((text: string, clipSrc?: string) => void speechService.play(text, lang, clipSrc), [lang]);

  return {
    supported,
    speaking: speechService.speaking,
    speak,
    stop,
    voice: speechService.voiceFor(lang),
    voiceMissing: speechService.voiceMissing(lang),
    voices: speechService.voices,
  };
}
