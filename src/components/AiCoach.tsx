import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { askCoach, type CoachMessage } from "@/utils/coach.functions";
import { AX, cardStyle, titleStyle } from "@/tabs/styles";
import { haptic } from "@/lib/haptics";
import { Bot, Send, Sparkles } from "lucide-react";
import { VoiceCoach } from "@/components/VoiceCoach";

const STARTERS = [
  "Why do I keep breaking my streak?",
  "Plan my next 7 days.",
  "Which habit should I fix first?",
  "I feel like quitting today.",
];

/**
 * AI Assistant (PRO) — a coach that reads the user's real AXEN data
 * server-side (streak, coins, per-habit 30-day history) and answers with
 * concrete, personal instructions. No data leaves the server unprompted.
 */
export function AiCoach() {
  const ask = useServerFn(askCoach);
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    haptic("tap");
    setError(null);
    setInput("");
    const next: CoachMessage[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setBusy(true);
    try {
      const res = await ask({ data: { messages: next } });
      setMessages([...next, { role: "assistant", content: res.reply }]);
      haptic("success");
    } catch (e: any) {
      setError(e?.message || "The coach could not answer right now.");
    } finally {
      setBusy(false);
    }
  };

  const CARD = cardStyle();

  return (
    <>
      <div style={CARD}>
        <div style={titleStyle}>
          <Bot size={16} strokeWidth={1.8} color={AX.accent} />
          AI Assistant
        </div>
        <div style={{ fontSize: 13, color: AX.muted, lineHeight: 1.6 }}>
          Your coach can see your streak, coins and every habit's 30-day record.
          Ask anything about your discipline — the answers are about your data, not generic advice.
        </div>
      </div>

      <VoiceCoach />

      <div style={{ ...CARD, padding: 14 }}>
        {messages.length === 0 && (
          <div style={{ display: "grid", gap: 8, marginBottom: 4 }}>
            {STARTERS.map(s => (
              <button key={s} onClick={() => send(s)} disabled={busy} style={{
                display: "flex", alignItems: "center", gap: 10, textAlign: "left",
                minHeight: 46, padding: "10px 13px", borderRadius: 12,
                cursor: busy ? "not-allowed" : "pointer",
                background: "#181820", border: `1px solid ${AX.border}`, color: AX.text,
                fontFamily: AX.font, fontSize: 13,
              }}>
                <Sparkles size={14} strokeWidth={1.8} color={AX.cyan} />
                <span style={{ flex: 1, minWidth: 0 }}>{s}</span>
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} style={{
            display: "flex",
            justifyContent: m.role === "user" ? "flex-end" : "flex-start",
            marginBottom: 10,
          }}>
            <div style={{
              maxWidth: "86%", padding: "11px 13px", borderRadius: 14,
              background: m.role === "user" ? AX.accent : "#181820",
              border: `1px solid ${m.role === "user" ? AX.accent : AX.border}`,
              color: m.role === "user" ? "#FFFFFF" : AX.text,
              fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word",
            }}>{m.content}</div>
          </div>
        ))}

        {busy && (
          <div style={{ fontSize: 13, color: AX.muted, padding: "4px 2px" }}>Coach is thinking…</div>
        )}
        {error && (
          <div style={{ fontSize: 13, color: AX.danger, padding: "4px 2px" }}>{error}</div>
        )}
        <div ref={endRef} />

        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") send(input); }}
            placeholder="Ask your coach…"
            style={{
              flex: 1, minHeight: 46, padding: "10px 14px", borderRadius: 12,
              background: "#181820", border: `1px solid ${AX.border}`, color: AX.text,
              fontFamily: AX.font, fontSize: 14, outline: "none",
            }}
          />
          <button
            onClick={() => send(input)}
            disabled={busy || !input.trim()}
            aria-label="Send"
            style={{
              width: 46, minHeight: 46, borderRadius: 12,
              cursor: busy || !input.trim() ? "not-allowed" : "pointer",
              background: busy || !input.trim() ? "#181820" : AX.accent,
              border: `1px solid ${busy || !input.trim() ? AX.border : AX.accent}`,
              color: busy || !input.trim() ? AX.muted : "#FFFFFF",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          ><Send size={17} strokeWidth={2} /></button>
        </div>
      </div>
    </>
  );
}
