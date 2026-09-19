import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, Pencil, Plus, Search, Trash2, X } from "lucide-react";

export type GoalHabit = { id: string; name: string; icon: string; pts: number; frequency: string };

export function GoalHabitPicker({
  userId, open, picked, onClose, onPickedChange, onHabitsChanged,
}: {
  userId: string | null;
  open: boolean;
  picked: string[];
  onClose: () => void;
  onPickedChange: (ids: string[]) => void;
  onHabitsChanged?: () => void;
}) {
  const [pool, setPool] = useState<GoalHabit[]>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftPts, setDraftPts] = useState(10);
  const [draftFreq, setDraftFreq] = useState("daily");
  const [creating, setCreating] = useState(false);

  const load = async () => {
    const { data, error } = await supabase
      .from("tasks").select("id,name,icon,pts,frequency")
      .eq("is_active", true).order("sort_order");
    if (error) return void toast.error("Could not load your habits", { description: error.message });
    setPool((data ?? []) as GoalHabit[]);
  };
  useEffect(() => { if (open) { void load(); setQuery(""); setEditing(null); setCreating(false); } }, [open]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pool.filter(h => !q || h.name.toLowerCase().includes(q));
  }, [pool, query]);

  if (!open || typeof document === "undefined") return null;

  const toggle = (id: string) => {
    onPickedChange(picked.includes(id) ? picked.filter(x => x !== id) : [...picked, id]);
  };

  const startEdit = (habit: GoalHabit) => {
    setCreating(false); setEditing(habit.id);
    setDraftName(habit.name); setDraftPts(habit.pts); setDraftFreq(habit.frequency || "daily");
  };
  const startCreate = () => {
    setEditing(null); setCreating(true);
    setDraftName(query.trim()); setDraftPts(10); setDraftFreq("daily");
  };

  const saveDraft = async () => {
    const name = draftName.trim();
    if (!userId || !name || busy) return;
    setBusy(true);
    if (creating) {
      const { data, error } = await supabase.from("tasks").insert({
        user_id: userId, name, icon: "◎", pts: draftPts, frequency: draftFreq,
        sort_order: pool.length + 1,
      }).select("id,name,icon,pts,frequency").single();
      setBusy(false);
      if (error) return void toast.error("Could not create that habit", { description: error.message });
      setPool(list => [...list, data as GoalHabit]);
      onPickedChange([...picked, (data as GoalHabit).id]);
      setCreating(false); setQuery("");
      onHabitsChanged?.();
      return;
    }
    if (!editing) { setBusy(false); return; }
    const { error } = await supabase.from("tasks")
      .update({ name, pts: draftPts, frequency: draftFreq }).eq("id", editing);
    setBusy(false);
    if (error) return void toast.error("Could not update that habit", { description: error.message });
    setPool(list => list.map(h => h.id === editing ? { ...h, name, pts: draftPts, frequency: draftFreq } : h));
    setEditing(null);
    onHabitsChanged?.();
  };

  return createPortal(
    <div className="axh-scrim" role="dialog" aria-modal="true" aria-label="Choose linked habits" onClick={onClose}>
      <section className="axh-sheet gh-sheet" onClick={event => event.stopPropagation()}>
        <header className="gh-head">
          <strong>Your habits</strong>
          <button type="button" className="gh-close" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </header>
        <p className="gh-note">Pick, rename or create the habits that drive this goal. Only what you select is linked.</p>

        <label className="gh-search">
          <Search size={15} />
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search your habits" />
        </label>

        <div className="gh-list">
          {matches.map(habit => (
            <div key={habit.id} className={`gh-row ${picked.includes(habit.id) ? "is-on" : ""}`}>
              {editing === habit.id ? (
                <div className="gh-edit">
                  <input value={draftName} maxLength={80} onChange={event => setDraftName(event.target.value)} placeholder="Habit name" />
                  <div className="gh-edit-grid">
                    <select value={draftFreq} onChange={event => setDraftFreq(event.target.value)}>
                      <option value="daily">Daily</option>
                      <option value="weekdays">Weekdays</option>
                      <option value="weekends">Weekends</option>
                      <option value="weekly">Weekly</option>
                    </select>
                    <input type="number" min={1} max={50} value={draftPts}
                      onChange={event => setDraftPts(Math.max(1, Math.min(50, Number(event.target.value) || 1)))} />
                  </div>
                  <div className="gh-edit-actions">
                    <button type="button" onClick={() => setEditing(null)}>Cancel</button>
                    <button type="button" className="is-primary" disabled={busy || !draftName.trim()} onClick={saveDraft}>{busy ? "Saving…" : "Save"}</button>
                  </div>
                </div>
              ) : (
                <>
                  <button type="button" className="gh-pick" onClick={() => toggle(habit.id)}>
                    <i>{picked.includes(habit.id) ? <Check size={13} /> : null}</i>
                    <span>{habit.name}</span>
                    <b>+{habit.pts}</b>
                  </button>
                  <button type="button" className="gh-mini" onClick={() => startEdit(habit)} aria-label={`Edit ${habit.name}`}><Pencil size={13} /></button>
                  {picked.includes(habit.id) && (
                    <button type="button" className="gh-mini" onClick={() => toggle(habit.id)} aria-label={`Remove ${habit.name} from this goal`}><Trash2 size={13} /></button>
                  )}
                </>
              )}
            </div>
          ))}
          {!matches.length && <span className="gh-empty">No habit matches that name yet.</span>}
        </div>

        {creating ? (
          <div className="gh-row gh-row--new">
            <div className="gh-edit">
              <input value={draftName} maxLength={80} onChange={event => setDraftName(event.target.value)} placeholder="New habit name" />
              <div className="gh-edit-grid">
                <select value={draftFreq} onChange={event => setDraftFreq(event.target.value)}>
                  <option value="daily">Daily</option>
                  <option value="weekdays">Weekdays</option>
                  <option value="weekends">Weekends</option>
                  <option value="weekly">Weekly</option>
                </select>
                <input type="number" min={1} max={50} value={draftPts}
                  onChange={event => setDraftPts(Math.max(1, Math.min(50, Number(event.target.value) || 1)))} />
              </div>
              <div className="gh-edit-actions">
                <button type="button" onClick={() => setCreating(false)}>Cancel</button>
                <button type="button" className="is-primary" disabled={busy || !draftName.trim()} onClick={saveDraft}>{busy ? "Saving…" : "Create habit"}</button>
              </div>
            </div>
          </div>
        ) : (
          <button type="button" className="gh-new" onClick={startCreate}><Plus size={15} /> Create my own habit</button>
        )}

        <button type="button" className="you-save-button" onClick={onClose}>Done</button>
      </section>
    </div>,
    document.body,
  );
}
