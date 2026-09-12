/** PCM helpers for the Gemini Live API (16 kHz in, 24 kHz out). */

export function floatToPcm16Base64(input: Float32Array): string {
  const buf = new ArrayBuffer(input.length * 2);
  const view = new DataView(buf);
  for (let i = 0; i < input.length; i++) {
    const sample = input[i] ?? 0;
    const s = Math.max(-1, Math.min(1, sample));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  const bytes = new Uint8Array(buf);
  let bin = "";
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CH));
  }
  return btoa(bin);
}

export function base64ToFloat32(b64: string): Float32Array {
  const bin = atob(b64);
  const len = bin.length >> 1;
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const lo = bin.charCodeAt(i * 2);
    const hi = bin.charCodeAt(i * 2 + 1);
    let v = (hi << 8) | lo;
    if (v >= 0x8000) v -= 0x10000;
    out[i] = v / 0x8000;
  }
  return out;
}

/**
 * Gapless 24 kHz PCM playback.
 *
 * Every incoming chunk is scheduled on an absolute timeline (`nextStart`) on a
 * single AudioContext, so consecutive chunks butt up sample-exactly instead of
 * waiting for an `onended` callback (which always leaves an audible gap and
 * caused the "voice breaks 20 times in 5 seconds" stutter).
 */
export class PcmPlayer {
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private sources = new Set<AudioBufferSourceNode>();
  private nextStart = 0;
  /** Jitter buffer: keep a small lead so network hiccups never underrun. */
  private readonly lead = 0.18;

  constructor(private rate = 24000) {}

  private ensure(): AudioContext {
    if (!this.ctx || this.ctx.state === "closed") {
      const AudioContextClass =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioContextClass();
      this.gain = this.ctx.createGain();
      this.gain.connect(this.ctx.destination);
      this.nextStart = 0;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  /** True while scheduled audio is still ahead of the playback clock. */
  get isPlaying(): boolean {
    return !!this.ctx && this.nextStart > this.ctx.currentTime + 0.02;
  }

  push(samples: Float32Array) {
    if (!samples.length) return;
    const ctx = this.ensure();
    const gain = this.gain;
    if (!gain) return;

    const buffer = ctx.createBuffer(1, samples.length, this.rate);
    buffer.getChannelData(0).set(samples);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(gain);

    const now = ctx.currentTime;
    // Restart the timeline if we fell behind (silence gap), else continue exactly.
    if (this.nextStart < now + 0.01) this.nextStart = now + this.lead;
    src.start(this.nextStart);
    this.nextStart += buffer.duration;

    this.sources.add(src);
    src.onended = () => {
      this.sources.delete(src);
    };
  }

  /** Drop everything scheduled (used on interruption / stop). */
  clear() {
    for (const src of this.sources) {
      try {
        src.onended = null;
        src.stop();
        src.disconnect();
      } catch {
        /* already stopped */
      }
    }
    this.sources.clear();
    this.nextStart = this.ctx ? this.ctx.currentTime : 0;
  }

  async close() {
    this.clear();
    try {
      this.gain?.disconnect();
      await this.ctx?.close();
    } catch {
      /* ignore */
    }
    this.gain = null;
    this.ctx = null;
  }
}
