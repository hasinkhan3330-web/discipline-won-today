import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type EventRow = {
  id: string;
  event_type: string;
  status: string | null;
  amount: number | null;
  currency: string | null;
  created_at: string;
};

const G = "#00d4ff";
const R = "#ff4d4d";
const Y = "#ffb84d";

const META: Record<string, { label: string; color: string; icon: string }> = {
  "subscription.authenticated": { label: "MANDATE APPROVED",       color: G, icon: "◉" },
  "subscription.activated":     { label: "SUBSCRIPTION ACTIVE",    color: G, icon: "◉" },
  "subscription.charged":       { label: "PAYMENT SUCCEEDED",      color: G, icon: "✓" },
  "subscription.updated":       { label: "SUBSCRIPTION UPDATED",   color: G, icon: "⟳" },
  "subscription.pending":       { label: "PAYMENT RETRYING",       color: Y, icon: "⚠" },
  "subscription.halted":        { label: "PAYMENT FAILED",         color: R, icon: "⚠" },
  "subscription.cancelled":     { label: "SUBSCRIPTION CANCELED",  color: Y, icon: "◌" },
  "subscription.paused":        { label: "SUBSCRIPTION PAUSED",    color: Y, icon: "❙❙" },
  "subscription.resumed":       { label: "SUBSCRIPTION RESUMED",   color: G, icon: "▶" },
  "subscription.completed":     { label: "SUBSCRIPTION COMPLETED", color: Y, icon: "◍" },
  "payment.failed":             { label: "PAYMENT FAILED",         color: R, icon: "⚠" },
};

function fmt(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function money(amount: number | null, currency: string | null) {
  if (amount == null) return null;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "INR" }).format(amount);
  } catch {
    return `${amount} ${currency ?? ""}`.trim();
  }
}

export function SubscriptionTimeline() {
  const [rows, setRows] = useState<EventRow[] | null>(null);
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("payment_events")
        .select("id, event_type, status, amount, currency, created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(10);
      if (!cancelled) setRows((data as EventRow[]) ?? []);
    };
    load();
    const ch = supabase
      .channel(`pay_evt_${uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "payment_events", filter: `user_id=eq.${uid}` }, () => load())
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [uid]);

  if (!uid) return null;

  return (
    <div style={{
      marginTop: 14, padding: 16, background: "rgba(10,10,25,0.7)",
      border: `1px solid ${G}33`, borderLeft: `3px solid ${G}`, borderRadius: 4,
    }}>
      <div style={{ fontSize: 10, color: G, letterSpacing: 3, marginBottom: 12, fontFamily: "monospace" }}>◈ ACTIVITY TIMELINE</div>

      {rows === null ? (
        <div style={{ fontSize: 10, color: "#888", fontFamily: "monospace", letterSpacing: 1.5 }}>◌ LOADING…</div>
      ) : rows.length === 0 ? (
        <div style={{ fontSize: 10, color: "#888", fontFamily: "monospace", letterSpacing: 1.5, lineHeight: 1.6 }}>
          No billing activity yet. Events appear here after checkout, renewals, plan changes, and cancellations.
        </div>
      ) : (
        <div style={{ position: "relative", paddingLeft: 18 }}>
          <div style={{ position: "absolute", left: 5, top: 4, bottom: 4, width: 1, background: `${G}22` }} />
          {rows.map((r) => {
            const m = META[r.event_type] ?? { label: r.event_type.toUpperCase(), color: "#888", icon: "•" };
            const amt = money(r.amount, r.currency);
            return (
              <div key={r.id} style={{ position: "relative", paddingBottom: 14 }}>
                <div style={{
                  position: "absolute", left: -18, top: 2, width: 11, height: 11, borderRadius: "50%",
                  background: "#0a0a19", border: `2px solid ${m.color}`, boxShadow: `0 0 8px ${m.color}66`,
                }} />
                <div style={{ fontSize: 10, color: m.color, letterSpacing: 2, fontFamily: "monospace", fontWeight: 900 }}>
                  {m.icon} {m.label}
                </div>
                <div style={{ marginTop: 3, fontSize: 9, color: "#aaa", letterSpacing: 1, fontFamily: "monospace" }}>
                  {fmt(r.created_at)}
                  {r.status ? ` · ${r.status.toUpperCase()}` : ""}
                  {amt ? ` · ${amt}` : ""}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
