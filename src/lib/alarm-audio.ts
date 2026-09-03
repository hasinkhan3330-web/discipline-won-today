/**
 * Alarm playback with Web Audio amplification.
 * Routes the <audio> element through a GainNode so playback can exceed
 * the normal 100% ceiling (up to 200%). Loops persistently until stopped.
 */

let ctx: AudioContext | null = null;
let el: HTMLAudioElement | null = null;
let gain: GainNode | null = null;
let src: MediaElementAudioSourceNode | null = null;
let watchdog: number | null = null;

const BOOST = 2.0; // 200%

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  if (!AC) return null;
  if (!ctx || ctx.state === "closed") ctx = new AC();
  return ctx;
}

/** Start (or restart) the looping alarm at boosted volume. */
export function startAlarm(url: string, boost = BOOST) {
  stopAlarm();
  if (typeof window === "undefined") return;
  try {
    const a = new Audio(url);
    a.loop = true;
    a.preload = "auto";
    a.crossOrigin = "anonymous";
    a.volume = 1;
    el = a;

    const c = getCtx();
    if (c) {
      try {
        if (c.state === "suspended") c.resume().catch(() => {});
        src = c.createMediaElementSource(a);
        gain = c.createGain();
        gain.gain.value = boost;
        src.connect(gain).connect(c.destination);
      } catch {
        // fall back to plain element playback
        gain = null;
        src = null;
      }
    }

    a.play().catch(() => {});

    // keep it ringing: restart if the browser pauses or the track ends
    a.addEventListener("ended", () => { try { a.currentTime = 0; a.play().catch(() => {}); } catch { /* ignore */ } });
    watchdog = window.setInterval(() => {
      if (!el) return;
      if (el.paused) { el.play().catch(() => {}); }
      if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
    }, 1000);
  } catch {
    /* ignore */
  }
}

/** Stop the alarm and release the audio graph. */
export function stopAlarm() {
  if (watchdog !== null) { clearInterval(watchdog); watchdog = null; }
  try { el?.pause(); } catch { /* ignore */ }
  try { src?.disconnect(); } catch { /* ignore */ }
  try { gain?.disconnect(); } catch { /* ignore */ }
  el = null; src = null; gain = null;
}

/** True while any alarm/preview is currently playing. */
export function isAlarmPlaying() {
  return !!el && !el.paused;
}

/**
 * Ringtone preview: plays the FULL track and keeps looping until stopped.
 * Never truncates after a couple of seconds.
 */
export function previewTone(url: string) {
  startAlarm(url, 1.6);
}
