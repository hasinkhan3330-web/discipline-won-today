// Share card images drawn on the device. Only real numbers passed in; never proof or pact titles.
export type CardFormat = "story" | "square";
export type CardData = { kind: "weekly" | "streak"; headline: string; stats: { label: string; value: string }[]; partnerFirst: string | null };

export async function drawShareCard(d: CardData, format: CardFormat): Promise<Blob> {
  const W = 1080, H = format === "story" ? 1920 : 1080;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d"); if (!g) throw new Error("canvas");
  const bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, "#0b1020"); bg.addColorStop(1, "#151a33");
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.fillStyle = "rgba(255,255,255,0.05)";
  for (let y = 30; y < H; y += 44) for (let x = 30; x < W; x += 44) { g.beginPath(); g.arc(x, y, 2, 0, Math.PI * 2); g.fill(); }
  const glow = g.createRadialGradient(W / 2, H * 0.42, 40, W / 2, H * 0.42, 520); glow.addColorStop(0, "rgba(198,255,61,0.22)"); glow.addColorStop(1, "rgba(198,255,61,0)");
  g.fillStyle = glow; g.fillRect(0, 0, W, H);
  const font = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
  g.textAlign = "center"; g.fillStyle = "#c6ff3d"; g.font = `800 64px ${font}`;
  g.fillText("AXEN", W / 2, format === "story" ? 220 : 130);
  g.fillStyle = "rgba(255,255,255,0.65)"; g.font = `600 30px ${font}`;
  g.fillText(d.kind === "weekly" ? "WEEKLY RECAP" : "STREAK MILESTONE", W / 2, format === "story" ? 280 : 185);
  const mid = format === "story" ? 700 : 400;
  g.fillStyle = "#ffffff"; g.font = `800 ${format === "story" ? 120 : 100}px ${font}`;
  g.fillText(d.headline, W / 2, mid);
  if (d.partnerFirst) { g.fillStyle = "#b9a4ff"; g.font = `600 40px ${font}`; g.fillText(`with ${d.partnerFirst}`, W / 2, mid + 80); }
  const top = mid + (format === "story" ? 220 : 150), rowH = format === "story" ? 150 : 110;
  d.stats.slice(0, format === "story" ? 4 : 3).forEach((s, i) => {
    const y = top + i * rowH;
    g.fillStyle = "rgba(255,255,255,0.07)"; roundRect(g, 140, y - 70, W - 280, rowH - 24, 28); g.fill();
    g.textAlign = "left"; g.fillStyle = "rgba(255,255,255,0.75)"; g.font = `500 38px ${font}`; g.fillText(s.label, 190, y);
    g.textAlign = "right"; g.fillStyle = "#c6ff3d"; g.font = `800 48px ${font}`; g.fillText(s.value, W - 190, y);
  });
  g.textAlign = "center"; g.fillStyle = "rgba(255,255,255,0.8)"; g.font = `600 36px ${font}`;
  g.fillText("axonhabit.app", W / 2, H - (format === "story" ? 140 : 70));
  return await new Promise<Blob>((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error("blob"))), "image/png"));
}
function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
export function canShareFile(blob: Blob, name: string): boolean {
  try { const nav = navigator as any; return !!nav.share && !!nav.canShare?.({ files: [new File([blob], name, { type: blob.type })] }); } catch { return false; }
}
export async function shareFile(blob: Blob, name: string): Promise<void> {
  const file = new File([blob], name, { type: blob.type });
  try { await (navigator as any).share({ files: [file], title: "AXEN" }); } catch { /* cancelled */ }
}
export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob); const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
export const deviceGet = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
export const deviceSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage off */ } };
