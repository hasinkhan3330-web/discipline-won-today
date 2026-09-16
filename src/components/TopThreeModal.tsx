import { useCallback, useEffect, useState } from "react";
import { AX } from "@/tabs/styles";
import { toast } from "sonner";
import { haptic } from "@/lib/haptics";
import { supabase } from "@/integrations/supabase/client";
import { Target, X, Check, Loader2 } from "lucide-react";

type Slot = 1 | 2 | 3;
type Row = { slot: Slot; title: string; done: boolean };

const REWARD: Record<Slot, number> = { 1: 7, 2: 7, 3: 6 };
const todayKey = () => new Date(new Date().getTime() - new Date().getTimezoneOffset() * 0).toISOString().slice(0, 10);

const btn = (primary?: boolean): React.CSSProperties => ({
  minHeight: 46, padding: "0 16px", borderRadius: 12, cursor: "pointer",
  fontFamily: AX.font, fontSize: 14, fontWeight: 600,
  background: primary ? AX.accent : "transparent",
  border: `1px solid ${primary ? AX.accent : AX.border}`,
  color: primary ? "#FFFFFF" : AX.text,
  display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%",
});

/**
 * Tomorrow's three most important tasks, planned before sleeping.
 * Each row pays its coins exactly once per day, credited by the server.
 */
export function TopThreeModal({ onClose, onCoins, onAllDone }: {
  onClose: () => void;
  onCoins: (coins: number) => void;
  onAllDone?: () => void;
}) {
  const day = todayKey();
  const [rows, setRows] = useState<Row[]>([
    { slot: 1, title: "", done: false },
    { slot: 2, title: "", done: false },
    { slot: 3, title: "", done: false },
  ]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busySlot, setBusySlot] = useState<Slot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setError("Please sign in again."); setLoading(false); return; }
    const { data, error: e } = await supabase
      .from("daily_top_tasks")
      .select("slot, title, done")
      .eq("user_id", u.user.id)
      .eq("day", day)
      .order("slot");
    if (e) setError(e.message);
    else if (data?.length) {
      setRows([1, 2, 3].map(s => {
        const r = data.find(d => Number(d.slot) === s);
        return { slot: s as Slot, title: r?.title ?? "", done: !!r?.done };
      }));
    }
    setLoading(false);
  }, [day]);

  useEffect(() => { void load(); }, [load]);

  const savePlan = async () => {
    const filled = rows.filter(r => r.title.trim());
    if (filled.length < 3) { toast.error("Write all three tasks first"); return; }
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setSaving(false); return; }
    const { error: e } = await supabase.from("daily_top_tasks").upsert(
      rows.map(r => ({ user_id: u.user!.id, day, slot: r.slot, title: r.title.trim().slice(0, 120) })),
      { onConflict: "user_id,day,slot", ignoreDuplicates: false },
    );
    setSaving(false);
    if (e) { toast.error("Could not save your tasks", { description: e.message }); return; }
    haptic("success");
    toast.success("Top 3 Missions saved");
    void load();
  };

  const markDone = async (slot: Slot) => {
    setBusySlot(slot);
    const { data, error: e } = await (supabase as any).rpc("complete_top_task", { _slot: slot });
    setBusySlot(null);
    if (e) { toast.error("Could not log that task", { description: e.message }); return; }
    const row = Array.isArray(data) ? data[0] : data;
    setRows(p => p.map(r => (r.slot === slot ? { ...r, done: true } : r)));
    if (row?.coins != null) onCoins(Number(row.coins));
    if (Number(row?.awarded ?? 0) > 0) {
      haptic("success");
      toast.success(`+${row.awarded} coins`, { description: `Mission ${slot} complete.` });
    }
    if (row?.all_done) onAllDone?.();
  };

  const planned = rows.every(r => r.title.trim());

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(5,5,9,0.82)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, overflowY: "auto" }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 420, background: AX.surface, border: `1px solid ${AX.border}`, borderRadius: 16, padding: 18, fontFamily: AX.font }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <Target size={18} strokeWidth={1.8} color={AX.accent} />
          <div style={{ flex: 1, fontSize: 16, fontWeight: 600, color: AX.text }}>Top 3 Missions</div>
          <button onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", color: AX.muted, cursor: "pointer", padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ fontSize: 13, color: AX.muted, lineHeight: 1.5, marginBottom: 14 }}>
          Write the three most important tasks you must finish before sleeping. 7 + 7 + 6 = 20 coins. They reset automatically tomorrow.
        </div>

        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 90, color: AX.muted, fontSize: 13 }}>
            <Loader2 size={16} className="ax-spin" />Loading today’s plan…
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {rows.map(r => (
              <div key={r.slot} style={{
                background: "#181820", border: `1px solid ${r.done ? AX.success : AX.border}`,
                borderRadius: 12, padding: 12, display: "grid", gap: 8,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: AX.muted }}>
                  <span style={{ color: AX.text, fontWeight: 600 }}>Mission {r.slot}</span>
                  <span>+{REWARD[r.slot]} coins</span>
                </div>
                <input
                  value={r.title}
                  disabled={r.done}
                  placeholder={`Task ${r.slot}`}
                  maxLength={120}
                  onChange={e => setRows(p => p.map(x => (x.slot === r.slot ? { ...x, title: e.target.value } : x)))}
                  style={{
                    minHeight: 44, borderRadius: 10, padding: "0 12px",
                    background: "#11111A", border: `1px solid ${AX.border}`, color: AX.text,
                    fontFamily: AX.font, fontSize: 14, width: "100%",
                  }}
                />
                {r.done ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, color: AX.success, fontSize: 13, fontWeight: 600 }}>
                    <Check size={16} />Completed · +{REWARD[r.slot]} coins
                  </div>
                ) : (
                  <button
                    onClick={() => void markDone(r.slot)}
                    disabled={!planned || busySlot === r.slot}
                    style={{ ...btn(), opacity: planned ? 1 : 0.5, minHeight: 44 }}
                  >
                    {busySlot === r.slot ? <Loader2 size={16} className="ax-spin" /> : <Check size={16} />}
                    Mark done
                  </button>
                )}
              </div>
            ))}

            <button onClick={() => void savePlan()} disabled={saving} style={btn(true)}>
              {saving ? <Loader2 size={16} className="ax-spin" /> : <Target size={16} />}
              {planned ? "Save changes" : "Save my 3 missions"}
            </button>
          </div>
        )}

        {error && <div style={{ marginTop: 12, fontSize: 12, color: AX.danger, lineHeight: 1.5 }}>{error}</div>}
      </div>
    </div>
  );
}
