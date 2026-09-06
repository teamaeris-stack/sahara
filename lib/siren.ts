/**
 * Local emergency siren — generated with the Web Audio API, no network and no audio files.
 * A two-tone alternating pattern (~8 s) that may repeat only while the alert is unacknowledged.
 */

export type SirenState = "idle" | "playing" | "blocked" | "unsupported";

type AudioCtor = typeof AudioContext;

function getCtor(): AudioCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

export const SIREN_BURST_MS = 8000;
const MAX_TOTAL_MS = 60_000; // hard stop: never sirens indefinitely

class Siren {
  private ctx: AudioContext | null = null;
  private osc: OscillatorNode | null = null;
  private gain: GainNode | null = null;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private startedAt = 0;
  private listeners = new Set<(s: SirenState) => void>();
  state: SirenState = "idle";

  subscribe(fn: (s: SirenState) => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private set(s: SirenState) {
    this.state = s;
    this.listeners.forEach((l) => l(s));
  }

  get supported() {
    return getCtor() !== null;
  }

  /**
   * Attempts to start. Resolves to "playing" when the context is running,
   * "blocked" when the browser suspended it (autoplay policy), "unsupported" otherwise.
   */
  async start(opts: { repeat?: boolean } = {}): Promise<SirenState> {
    const Ctor = getCtor();
    if (!Ctor) {
      this.set("unsupported");
      return "unsupported";
    }
    try {
      if (!this.ctx) this.ctx = new Ctor();
      if (this.ctx.state !== "running") {
        try {
          await this.ctx.resume();
        } catch {
          /* fallthrough */
        }
      }
      if (this.ctx.state !== "running") {
        this.set("blocked");
        return "blocked";
      }
      this.stopNodes();
      this.startedAt = this.startedAt || Date.now();
      this.playBurst(this.ctx, opts.repeat === true);
      this.set("playing");
      return "playing";
    } catch {
      this.set("unsupported");
      return "unsupported";
    }
  }

  private playBurst(ctx: AudioContext, repeat: boolean) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    gain.gain.value = 0.0001;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const t0 = ctx.currentTime;
    // Alternating two-tone: 0.4 s at 880 Hz, 0.4 s at 660 Hz, for the burst length.
    const seg = 0.4;
    const segments = Math.floor(SIREN_BURST_MS / 1000 / seg);
    for (let i = 0; i < segments; i++) {
      osc.frequency.setValueAtTime(i % 2 === 0 ? 880 : 660, t0 + i * seg);
    }
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.25, t0 + 0.05);
    gain.gain.setValueAtTime(0.25, t0 + segments * seg - 0.1);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + segments * seg);
    osc.start(t0);
    osc.stop(t0 + segments * seg + 0.05);
    this.osc = osc;
    this.gain = gain;
    const burstMs = segments * seg * 1000;
    this.timers.push(
      setTimeout(() => {
        if (this.state !== "playing") return;
        const elapsed = Date.now() - this.startedAt;
        if (repeat && elapsed + burstMs + 1500 < MAX_TOTAL_MS) {
          // Short pause, then repeat while still unacknowledged.
          this.timers.push(setTimeout(() => this.state === "playing" && this.ctx && this.playBurst(this.ctx, true), 1500));
        } else {
          this.stop();
        }
      }, burstMs + 100),
    );
  }

  private stopNodes() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
    try {
      this.osc?.stop();
      this.osc?.disconnect();
      this.gain?.disconnect();
    } catch {
      /* ignore */
    }
    this.osc = null;
    this.gain = null;
  }

  stop() {
    this.stopNodes();
    this.startedAt = 0;
    if (this.state === "playing" || this.state === "blocked") this.set("idle");
  }
}

export const siren = new Siren();

/** Short emergency vibration pattern; silently does nothing when unsupported. */
export function vibrateAlert() {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate([500, 250, 500, 250, 800]);
  } catch {
    /* ignore */
  }
}

export function stopVibration() {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(0);
  } catch {
    /* ignore */
  }
}

export const alertAckKey = (eventId: string) => `sahara_disaster_alert_ack_${eventId}`;

export function isAlertAcked(eventId: string): boolean {
  try {
    return localStorage.getItem(alertAckKey(eventId)) === "1";
  } catch {
    return false;
  }
}

export function markAlertAcked(eventId: string) {
  try {
    localStorage.setItem(alertAckKey(eventId), "1");
  } catch {
    /* ignore */
  }
}

/** Removes every persisted acknowledgement (used by demo reset so a new event alerts again). */
export function clearAlertAcks() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("sahara_disaster_alert_ack_")) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}
