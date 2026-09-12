/** PCM helpers for the Gemini Live API (16 kHz in, 24 kHz out). */

export function floatToPcm16Base64(input: Float32Array): string {
  const buf = new ArrayBuffer(input.length * 2);
  const view = new DataView(buf);
  for (let i = 0; i < input.length; i++) {
    let s = Math.max(-1, Math.min(1, input[i]!));
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

/** Sequentially schedules 24 kHz PCM chunks so playback stays gapless. */
export class PcmPlayer {
  private ctx: AudioContext | null = null;
  private next = 0;
  private sources = new Set<AudioBufferSourceNode>();

  constructor(private rate = 24000) {}

  private ensure(): AudioContext {
    if (!this.ctx || this.ctx.state === "closed") {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AC();
      this.next = 0;
    }
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  push(samples: Float32Array) {
    if (!samples.length) return;
    const ctx = this.ensure();
    const buffer = ctx.createBuffer(1, samples.length, this.rate);
    buffer.getChannelData(0).set(samples);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    const start = Math.max(ctx.currentTime + 0.05, this.next);
    src.start(start);
    this.next = start + buffer.duration;
    this.sources.add(src);
    src.onended = () => this.sources.delete(src);
  }

  /** Drop everything queued (used when the model is interrupted). */
  clear() {
    for (const s of this.sources) { try { s.stop(); } catch { /* ignore */ } }
    this.sources.clear();
    this.next = 0;
  }

  async close() {
    this.clear();
    try { await this.ctx?.close(); } catch { /* ignore */ }
    this.ctx = null;
  }
}
