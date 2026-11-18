import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, PartyPopper, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import s from "./acct.module.css";

type Row = { id: string; from_user: string; to_user: string; kind: "nudge" | "cheer" | "emergency"; text: string; created_at: string; seen_at: string | null };

function ago(iso: string) {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

/** Unread received nudges/cheers for the active partnership (RLS hides ended partnerships). */
export async function loadUnreadPartnerEvents(): Promise<number> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return 0;
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { count, error } = await supabase.from("partner_events").select("id", { count: "exact", head: true })
    .eq("to_user", u.user.id).is("seen_at", null).gte("created_at", since);
  return error ? 0 : count ?? 0;
}

export function PartnerHistory({ partnerName }: { partnerName: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [err, setErr] = useState(false);
  const load = useCallback(async () => {
    setErr(false); setRows(null);
    const { data: u } = await supabase.auth.getUser();
    const me = u.user?.id ?? null; setUid(me);
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const { data, error } = await supabase.from("partner_events").select("id,from_user,to_user,kind,text,created_at,seen_at")
      .gte("created_at", since).order("created_at", { ascending: false }).limit(100);
    if (error) { setErr(true); return; }
    const list = (data ?? []) as Row[];
    setRows(list);
    const unseen = list.filter(r => r.to_user === me && !r.seen_at).map(r => r.id);
    if (me && unseen.length) {
      const { error: e2 } = await supabase.from("partner_events").update({ seen_at: new Date().toISOString() }).in("id", unseen);
      if (e2) console.warn("[partner_events] mark seen failed", e2.message);
      else window.dispatchEvent(new Event("axen:partner-events-seen"));
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  return (
    <div className={s.item} data-testid="partner-recent">
      <span className={s.label}>Recent</span>
      {err ? <div className={s.histErr} role="alert"><span>Couldn't load recent nudges.</span><button className={s.seg} onClick={() => void load()}>Try again</button></div>
        : rows == null ? <><div className={`${s.skel} ${s.histSkel}`} /><div className={`${s.skel} ${s.histSkel}`} /></>
        : rows.length === 0 ? <div className={s.muted} style={{ padding: "8px 0" }}>Abhi tak koi nudge ya cheer nahi</div>
        : <ul className={s.histList}>{rows.map(r => {
            const mine = r.from_user === uid;
            const unread = !mine && !r.seen_at;
            const Icon = r.kind === "emergency" ? AlertTriangle : r.kind === "cheer" ? PartyPopper : Zap;
            return <li key={r.id} className={`${s.histRow} ${r.kind === "emergency" ? s.histEmerg : ""}`}>
              <span className={`${s.histIcon} ${r.kind === "cheer" ? s.histCheer : ""}`}><Icon size={15} /></span>
              <span className={s.histBody}><span className={s.histText}>{r.text}</span>
                <span className={s.histMeta}>{mine ? `You → ${partnerName}` : `${partnerName} → You`} · {ago(r.created_at)}</span></span>
              {unread && <span className={s.histDot} aria-label="Unread" />}
            </li>;
          })}</ul>}
    </div>
  );
}
