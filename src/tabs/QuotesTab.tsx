import { dayCombo, rot } from "@/constants/legends";

export function QuotesTab({ G }: { G: string }) {
  const now = new Date();
  const dayIdx = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000);
  const today = dayCombo(dayIdx);
  const todayI = rot(dayIdx, 999);
  const dateLabel = now.toLocaleDateString(undefined, { weekday: "long", day: "2-digit", month: "short", year: "numeric" }).toUpperCase();
  const countdown = () => {
    const t = new Date(); t.setHours(24, 0, 0, 0);
    const ms = t.getTime() - Date.now();
    const h = Math.floor(ms / 3600000); const m = Math.floor((ms % 3600000) / 60000);
    return `${String(h).padStart(2,"0")}H ${String(m).padStart(2,"0")}M`;
  };
  const upcoming = Array.from({ length: 30 }, (_, k) => ({ ...dayCombo(dayIdx + k + 1), _k: k }));
  const fallback = (name: string) => `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0a0a19&color=00ff88&size=400&bold=true&font-size=0.42`;

  return (
    <>
      <div style={{ marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 9, letterSpacing: 2, color: G }}>
        <span>◉ TODAY · {dateLabel}</span>
        <span style={{ color: "#888" }}>NEXT DROP IN {countdown()}</span>
      </div>
      <div style={{
        position: "relative", marginBottom: 18, borderRadius: 2, overflow: "hidden",
        border: `1px solid ${G}`, borderLeft: `4px solid ${G}`,
        boxShadow: `0 0 40px ${G}55, 0 8px 30px rgba(0,0,0,0.7)`,
        background: "rgba(10,10,25,0.7)", backdropFilter: "blur(10px)",
      }}>
        <div style={{ position: "relative", height: 460, overflow: "hidden", background: "#05050a" }}>
          <img src={today.img} alt={today.p} style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "center top", filter: "contrast(1.08) saturate(1.15)" }} onError={(e) => { const el = e.currentTarget as HTMLImageElement; if (!el.dataset.fb) { el.dataset.fb = "1"; el.style.objectFit = "cover"; el.src = fallback(today.p); } }} />
          <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, transparent 55%, rgba(10,10,25,0.97) 100%)`, pointerEvents: "none" }} />
          <div style={{ position: "absolute", top: 10, left: 10, fontSize: 9, color: "#000", letterSpacing: 2, padding: "5px 10px", background: G, fontWeight: 800 }}>◉ LEGEND OF THE DAY</div>
          <div style={{ position: "absolute", top: 10, right: 10, fontSize: 9, color: G, letterSpacing: 2, padding: "5px 10px", background: "rgba(0,0,0,0.7)", border: `1px solid ${G}66` }}>#{String(todayI + 1).padStart(3, "0")}</div>
          <div style={{ position: "absolute", bottom: 12, left: 14, fontSize: 18, fontWeight: 900, color: "#fff", letterSpacing: 3, textShadow: `0 0 14px ${G}` }}>{today.p}</div>
        </div>
        <div style={{ padding: 18, fontSize: 15, color: "#f0f0f0", lineHeight: 1.7, fontStyle: "italic", borderTop: `1px solid ${G}44` }}>
          <span style={{ color: G, fontSize: 26, marginRight: 4 }}>"</span>
          {today.q}
          <span style={{ color: G, fontSize: 26, marginLeft: 4 }}>"</span>
        </div>
      </div>

      <div style={{ fontSize: 10, letterSpacing: 3, color: "#888", marginBottom: 12, fontWeight: 600 }}>▸ ALL LEGENDS · ONE PER DAY</div>
      {upcoming.map((q, k) => (
        <div key={k} style={{
          position: "relative", marginBottom: 18, borderRadius: 2, overflow: "hidden",
          border: `1px solid ${G}66`, borderLeft: `4px solid ${G}`,
          boxShadow: `0 0 25px ${G}33, 0 6px 20px rgba(0,0,0,0.6)`,
          background: "rgba(10,10,25,0.7)", backdropFilter: "blur(10px)",
        }}>
          <div style={{ position: "relative", height: 420, overflow: "hidden", background: "#05050a" }}>
            <img src={q.img} alt={q.p} style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "center top", filter: "contrast(1.08) saturate(1.15)" }} onError={(e) => { const el = e.currentTarget as HTMLImageElement; if (!el.dataset.fb) { el.dataset.fb = "1"; el.style.objectFit = "cover"; el.src = fallback(q.p); } }} />
            <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, transparent 55%, rgba(10,10,25,0.97) 100%)`, pointerEvents: "none" }} />
            <div style={{ position: "absolute", top: 10, left: 10, fontSize: 9, color: G, letterSpacing: 2, padding: "5px 10px", background: "rgba(0,0,0,0.75)", border: `1px solid ${G}66`, fontWeight: 800 }}>DAY +{k + 1}</div>
            <div style={{ position: "absolute", top: 10, right: 10, fontSize: 9, color: G, letterSpacing: 2, padding: "5px 10px", background: "rgba(0,0,0,0.7)", border: `1px solid ${G}66` }}>+{k + 1}D</div>
            <div style={{ position: "absolute", bottom: 12, left: 14, fontSize: 17, fontWeight: 900, color: "#fff", letterSpacing: 3, textShadow: `0 0 14px ${G}` }}>{q.p}</div>
          </div>
          <div style={{ padding: 16, fontSize: 14, color: "#f0f0f0", lineHeight: 1.7, fontStyle: "italic", borderTop: `1px solid ${G}44` }}>
            <span style={{ color: G, fontSize: 24, marginRight: 4 }}>"</span>
            {q.q}
            <span style={{ color: G, fontSize: 24, marginLeft: 4 }}>"</span>
          </div>
        </div>
      ))}
    </>
  );
}
