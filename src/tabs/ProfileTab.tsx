import { useState } from "react";
import { AX, cardStyle, titleStyle, buttonStyle } from "./styles";
import { ManageSubscriptionCard } from "@/components/ManageSubscriptionCard";
import { SubscriptionTimeline } from "@/components/SubscriptionTimeline";
import { ReferralCard } from "@/components/ReferralCard";
import { Camera, LogOut, AlarmClock, Check } from "lucide-react";

const VICTORIES = [
  { d: 1,   label: "Day 1 · The first step",  line: "The first step is the heaviest. Most surrender here — you did not." },
  { d: 7,   label: "Day 7 · Iron week",       line: "One full week. Most quit before this line. You crossed it quietly." },
  { d: 21,  label: "Day 21 · Neural forge",   line: "Twenty-one days. Your brain has begun rewiring." },
  { d: 60,  label: "Day 60 · Steel spine",    line: "Sixty days of work with yourself — and you kept showing up." },
  { d: 90,  label: "Day 90 · Identity shift", line: "Ninety days. You are no longer trying to change; you have changed." },
  { d: 180, label: "Day 180 · Unbreakable",   line: "Half a year. Weakness no longer decides your mornings." },
  { d: 365, label: "Day 365 · Legend",        line: "One year. You did not build a habit — you became someone else." },
];

const WAKE_TIERS = [
  { time: "4 AM", pts: 21, tag: "Elite" },
  { time: "5 AM", pts: 17, tag: "Strong" },
  { time: "6 AM", pts: 9,  tag: "Solid" },
  { time: "7 AM", pts: 5,  tag: "Base" },
];

function Segmented({ active, onChange, tabs }: { active: string; onChange: (id: string) => void; tabs: { id: string; label: string }[] }) {
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
      {tabs.map(t => {
        const on = active === t.id;
        return (
          <button key={t.id} onClick={() => onChange(t.id)} style={{
            flex: 1, padding: "10px 8px", borderRadius: 12, cursor: "pointer",
            background: on ? AX.accent : "#181820",
            border: `1px solid ${on ? AX.accent : AX.border}`,
            color: on ? "#FFFFFF" : AX.muted,
            fontFamily: AX.font, fontSize: 13, fontWeight: 600,
          }}>{t.label}</button>
        );
      })}
    </div>
  );
}

export function ProfileTab({
  coins, streak,
  myName, myAvatar, uploading,
  openCropper, fallbackAvatar,
  todayDone = 0, todayTotal = 0,
  onSignOut,
  referredBy = null,
  onCoins,
}: {
  coins: number; streak: number;
  myName: string; myAvatar: string; uploading: boolean;
  openCropper: (f: File) => void;
  fallbackAvatar: (n: string) => string;
  todayDone?: number; todayTotal?: number;
  onSignOut?: () => void;
  referredBy?: string | null;
  onCoins?: (coins: number) => void;
}) {
  const CARD = cardStyle();
  const [tab, setTab] = useState("profile");
  const dayPct = todayTotal ? Math.round((todayDone / todayTotal) * 100) : 0;

  return (
    <>
      <div style={{ ...CARD, display: "flex", alignItems: "center", gap: 16 }}>
        <img
          src={myAvatar || fallbackAvatar(myName)}
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = fallbackAvatar(myName); }}
          alt={myName}
          style={{ width: 60, height: 60, borderRadius: "50%", objectFit: "cover", border: `1px solid ${AX.border}`, flexShrink: 0 }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: AX.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{myName}</div>
          <div style={{ fontSize: 13, color: AX.muted, marginTop: 2 }}>{coins} coins · {streak} day streak</div>
          <label style={{
            display: "inline-flex", alignItems: "center", gap: 8, marginTop: 10,
            padding: "9px 14px", borderRadius: 12, cursor: uploading ? "wait" : "pointer",
            background: "#181820", border: `1px solid ${AX.border}`, color: AX.text,
            fontSize: 13, fontWeight: 500, opacity: uploading ? 0.6 : 1,
          }}>
            <Camera size={15} strokeWidth={1.8} />
            {uploading ? "Uploading…" : "Change photo"}
            <input type="file" accept="image/*" disabled={uploading} style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) openCropper(f); e.currentTarget.value = ""; }} />
          </label>
        </div>
      </div>

      <Segmented active={tab} onChange={setTab} tabs={[
        { id: "profile", label: "Today" },
        { id: "wake", label: "Wake" },
        { id: "account", label: "Account" },
      ]} />

      {tab === "profile" && (
        <>
          <div style={CARD}>
            <div style={titleStyle}>Today</div>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ fontSize: 30, fontWeight: 600, color: dayPct >= 100 ? AX.success : AX.text }}>{dayPct}%</div>
              <div style={{ flex: 1 }}>
                <div style={{ height: 6, background: "#1D1D28", borderRadius: 6, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${dayPct}%`, background: dayPct >= 100 ? AX.success : AX.accent, transition: "width .4s ease" }} />
                </div>
                <div style={{ fontSize: 12, color: AX.muted, marginTop: 8 }}>{todayDone} of {todayTotal} habits complete</div>
              </div>
            </div>
          </div>

          <div style={CARD}>
            <div style={titleStyle}>Victories</div>
            {VICTORIES.map(v => {
              const done = streak >= v.d;
              return (
                <div key={v.d} style={{
                  display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 14px",
                  background: "#181820", border: `1px solid ${done ? AX.success : AX.border}`,
                  borderRadius: 14, marginBottom: 10,
                }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: 8, flexShrink: 0, marginTop: 2,
                    background: done ? AX.success : "transparent",
                    border: `1px solid ${done ? AX.success : AX.border}`,
                    display: "flex", alignItems: "center", justifyContent: "center", color: "#0A0A0F",
                  }}>{done && <Check size={14} strokeWidth={3} />}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: done ? AX.text : AX.muted }}>{v.label}</div>
                    <div style={{ fontSize: 12, color: AX.muted, marginTop: 3, lineHeight: 1.5 }}>{v.line}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {tab === "wake" && (
        <div style={CARD}>
          <div style={titleStyle}>Wake protocol</div>
          <div style={{ fontSize: 13, color: AX.muted, marginBottom: 14, lineHeight: 1.5 }}>
            Tap the wake habit on Home to start the protocol. Earlier rises earn more coins.
          </div>
          {WAKE_TIERS.map(w => (
            <div key={w.time} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
              background: "#181820", border: `1px solid ${AX.border}`, borderRadius: 14, marginBottom: 10,
            }}>
              <AlarmClock size={18} strokeWidth={1.8} color={AX.accent} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 500, color: AX.text }}>{w.time}</div>
                <div style={{ fontSize: 12, color: AX.muted, marginTop: 2 }}>{w.tag}</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: AX.accent }}>+{w.pts}</div>
            </div>
          ))}
        </div>
      )}

      {tab === "account" && (
        <>
          <ReferralCard referredBy={referredBy ?? null} onCoins={onCoins} />
          <ManageSubscriptionCard />
          <SubscriptionTimeline />
          {onSignOut && (
            <div style={CARD}>
              <button onClick={onSignOut} style={{ ...buttonStyle("ghost"), width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <LogOut size={16} strokeWidth={1.8} /> Sign out
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}
