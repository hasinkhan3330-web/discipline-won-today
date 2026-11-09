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

import { History, Receipt } from "lucide-react";
import s from "@/components/account/account.module.css";

// Tone names map to dot classes: checkout/renewal = lime, plan change = violet, cancellation = gold.
const G = "lime";
const V = "violet";
const R = "red";
const Y = "gold";

const META: Record<string, { label: string; color: string; icon: string }> = {
  "subscription.authenticated": { label: "MANDATE APPROVED",       color: G, icon: "◉" },
  "subscription.activated":     { label: "SUBSCRIPTION ACTIVE",    color: G, icon: "◉" },
  "subscription.charged":       { label: "PAYMENT SUCCEEDED",      color: G, icon: "✓" },
  "subscription.updated":       { label: "SUBSCRIPTION UPDATED",   color: V, icon: "⟳" },
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
    <section className={s.card}>
      <div className={s.cardHead}>
        <span className={s.well}><History size={18} strokeWidth={1.8} /></span>
        <h2 className={s.cardTitle}>Activity timeline</h2>
      </div>

      {rows === null ? (
        <div aria-label="Loading…"><div className={s.skeleton} style={{ width: "70%" }} /><div className={s.skeleton} style={{ width: "45%" }} /></div>
      ) : rows.length === 0 ? (
        <div className={s.empty}>
          <span className={`${s.well} ${s.wellSlate}`}><Receipt size={18} strokeWidth={1.5} /></span>
          <p className={s.body}>No billing activity yet. Events appear here after checkout, renewals, plan changes, and cancellations.</p>
        </div>
      ) : (
        <ul className={s.timeline}>
          {rows.map((r) => {
            const m = META[r.event_type] ?? { label: r.event_type.toUpperCase(), color: "slate", icon: "•" };
            const amt = money(r.amount, r.currency);
            return (
              <li key={r.id} className={s.event}>
                <span className={`${s.dot} ${s[`dot-${m.color}`]}`} aria-hidden />
                <p className={s.eventTitle}>{m.icon} {m.label}</p>
                <p className={s.eventMeta}>
                  {fmt(r.created_at)}
                  {r.status ? ` · ${r.status.toUpperCase()}` : ""}
                  {amt ? ` · ${amt}` : ""}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
