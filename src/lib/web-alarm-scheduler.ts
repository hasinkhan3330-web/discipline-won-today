import type { AlarmState } from "./wake-types";

export interface AlarmScheduler {
  synchronize(state: AlarmState): void;
  now(): number;
  startOvernight(): Promise<{ wakeLock: boolean; audio: boolean }>;
  ring(url: string): Promise<void>;
  stopVerified(): void;
}
class WebAlarmScheduler implements AlarmScheduler {
  private server = 0;
  private tick = 0;
  private audio: AudioContext | null = null;
  private media: HTMLAudioElement | null = null;
  private gain: GainNode | null = null;
  private lock: WakeLockSentinel | null = null;
  private pattern: number | null = null;
  private ringing = false;
  private overnight = false;
  synchronize(state: AlarmState) { this.server = Date.parse(state.server_now); this.tick = performance.now(); }
  now() { return this.server ? this.server + performance.now() - this.tick : Date.now(); }
  async startOvernight() {
    this.overnight = true;
    if (!this.audio || this.audio.state === "closed") this.audio = new AudioContext();
    await this.audio.resume();
    const oscillator = this.audio.createOscillator();
    const silent = this.audio.createGain(); silent.gain.value = 0;
    oscillator.connect(silent).connect(this.audio.destination); oscillator.start(); oscillator.stop(this.audio.currentTime + .03);
    try { this.lock = await navigator.wakeLock?.request("screen") ?? null; } catch { this.lock = null; }
    document.addEventListener("visibilitychange", this.restoreLock);
    return { wakeLock: this.lock !== null, audio: this.audio.state === "running" };
  }
  private restoreLock = async () => {
    if (this.overnight && document.visibilityState === "visible") {
      try { this.lock = await navigator.wakeLock?.request("screen") ?? null; } catch { this.lock = null; }
    }
  };
  get ready() { return this.overnight && this.audio?.state === "running"; }
  get lockActive() { return !!this.lock && !this.lock.released; }
  async ring(url: string) {
    if (this.ringing) return;
    this.ringing = true;
    if (!this.audio || this.audio.state === "closed") this.audio = new AudioContext();
    try { await this.audio.resume(); } catch { /* readiness exposes blocked audio */ }
    this.gain = this.audio.createGain();
    this.gain.gain.setValueAtTime(.08, this.audio.currentTime);
    this.gain.gain.linearRampToValueAtTime(1, this.audio.currentTime + 20);
    this.gain.connect(this.audio.destination);
    this.media = new Audio(url); this.media.loop = true; this.media.volume = 1; this.media.crossOrigin = "anonymous";
    let fallback = false;
    const useFallback = () => { fallback = true; this.beep(); };
    this.media.addEventListener("error", useFallback, { once: true });
    try { this.audio.createMediaElementSource(this.media).connect(this.gain); await this.media.play(); } catch { useFallback(); }
    this.pattern = window.setInterval(() => {
      navigator.vibrate?.([300, 150, 300, 150, 600]);
      if (this.audio?.state === "suspended") void this.audio.resume().catch(() => {});
      if (fallback) this.beep();
      else if (this.media?.paused) void this.media.play().catch(useFallback);
    }, 1800);
  }
  private beep() {
    const c = this.audio, g = this.gain;
    if (!c || !g) return;
    for (let i = 0; i < 3; i++) {
      const o = c.createOscillator(); o.type = "square"; o.frequency.value = i % 2 ? 880 : 660;
      o.connect(g); o.start(c.currentTime + i * .35); o.stop(c.currentTime + i * .35 + .25);
    }
  }
  stopVerified() {
    this.ringing = false;
    if (this.pattern !== null) window.clearInterval(this.pattern);
    this.pattern = null; this.media?.pause(); this.media = null;
    this.gain?.disconnect(); this.gain = null;
    navigator.vibrate?.(0);
  }
  async leaveOvernight() {
    if (this.ringing) return;
    this.overnight = false; await this.lock?.release(); this.lock = null;
    document.removeEventListener("visibilitychange", this.restoreLock);
  }
}
export const webAlarmScheduler = new WebAlarmScheduler();