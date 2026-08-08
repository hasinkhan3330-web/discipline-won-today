import { useState, type ReactNode } from "react";

/** Compact collapsible section with neon header. */
export function Accordion({ G, title, defaultOpen = false, children }: {
  G: string; title: ReactNode; defaultOpen?: boolean; children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{
      background: "rgba(10,10,25,0.55)", backdropFilter: "blur(12px)",
      border: `1px solid ${G}33`, borderLeft: `2px solid ${G}`,
      marginBottom: 8, borderRadius: 2, overflow: "hidden",
      boxShadow: `0 4px 18px rgba(0,0,0,0.4), inset 0 1px 0 ${G}22`,
    }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 8, padding: "11px 12px", background: "none", border: "none", cursor: "pointer",
        color: "#e8e8e8", fontFamily: "monospace", fontSize: 11, fontWeight: 700, letterSpacing: 2.5,
      }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, textAlign: "left" }}>
          <span style={{ color: G }}>▸</span>{title}
        </span>
        <span style={{ color: G, fontSize: 11, flexShrink: 0 }}>{open ? "▾" : "▸"}</span>
      </button>
      {open && <div style={{ padding: "0 12px 12px" }}>{children}</div>}
    </div>
  );
}

/** Sleek neon sub-tab switcher. */
export function SubTabs({ G, tabs, active, onChange }: {
  G: string; tabs: { id: string; label: string }[]; active: string; onChange: (id: string) => void;
}) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: `repeat(${tabs.length},1fr)`, gap: 4,
      marginBottom: 10, padding: 3, borderRadius: 3,
      background: "rgba(5,5,14,0.7)", border: `1px solid ${G}22`,
    }}>
      {tabs.map(t => {
        const on = t.id === active;
        return (
          <button key={t.id} onClick={() => onChange(t.id)} style={{
            padding: "8px 4px", cursor: "pointer", borderRadius: 2,
            fontFamily: "monospace", fontSize: 9, fontWeight: 900, letterSpacing: 1.6,
            color: on ? "#03030a" : "#8a8a9a",
            background: on ? `linear-gradient(135deg, ${G}, ${G}bb)` : "transparent",
            border: `1px solid ${on ? G : "transparent"}`,
            boxShadow: on ? `0 0 14px ${G}66` : "none",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>{t.label}</button>
        );
      })}
    </div>
  );
}

/** Horizontal snap-scroll rail for widget cards. */
export function Rail({ children, gap = 8 }: { children: ReactNode; gap?: number }) {
  return (
    <div style={{
      display: "flex", gap, overflowX: "auto", scrollSnapType: "x mandatory",
      paddingBottom: 4, WebkitOverflowScrolling: "touch", scrollbarWidth: "none",
    }}>{children}</div>
  );
}
