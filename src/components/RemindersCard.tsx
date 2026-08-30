import { useCallback, useEffect, useRef, useState } from "react";
import { AX, cardStyle, titleStyle } from "@/tabs/styles";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { haptic } from "@/lib/haptics";
import { Bell, BellOff } from "lucide-react";

export type ReminderTask = { uuid: string; name: string; done: boolean };
type Row = { task_id: string; remind_at: string; enabled: boolean; timezone: string };

const tz = () => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; }
};

/** Per-habit reminder times. Persisted server-side, scheduled locally while the app is open. */
export function RemindersCard({ tasks }: { tasks: ReminderTask[] }) {
  const CARD = cardStyle();
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [loaded, setLoaded] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const timers = useRef<number[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setPermission("Notification" in window ? Notification.permission : "unsupported");
  }, []);

  const load = useCallback(async () => {
    const { data } = await supabase.from("habit_reminders").select("task_id, remind_at, enabled, timezone");
    const map: Record<string, Row> = {};
    (data || []).forEach((r: any) => { map[r.task_id] = r as Row; });
    setRows(map);
    setLoaded(true);
  }, []);

  useEffect(() => { load(); }, [load]);

  // schedule local notifications for today's remaining reminders
  useEffect(() => {
    timers.current.forEach(t => window.clearTimeout(t));
    timers.current = [];
    if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") return;

    tasks.forEach(t => {
      const r = rows[t.uuid];
      if (!r?.enabled || t.done) return;
      const [h, m] = r.remind_at.split(":").map(Number);
      const when = new Date();
      when.setHours(h || 0, m || 0, 0, 0);
      const delay = when.getTime() - Date.now();
      if (delay <= 0 || delay > 12 * 3600_000) return;
      const id = window.setTimeout(() => {
        try { new Notification("AXEN", { body: `${t.name} — still open today.` }); } catch { /* ignore */ }
      }, delay);
      timers.current.push(id);
    });

    return () => { timers.current.forEach(t => window.clearTimeout(t)); timers.current = []; };
  }, [rows, tasks, permission]);

  const askPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    try {
      const p = await Notification.requestPermission();
      setPermission(p);
      if (p !== "granted") toast.message("Notifications are blocked", { description: "Reminders stay saved and show inside the app." });
    } catch { /* ignore */ }
  };

  const save = async (taskId: string, patch: Partial<Row>) => {
    const current = rows[taskId] ?? { task_id: taskId, remind_at: "07:00", enabled: false, timezone: tz() };
    const next = { ...current, ...patch, timezone: tz() };
    setRows(p => ({ ...p, [taskId]: next }));
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id;
    if (!uid) return;
    const { error } = await supabase
      .from("habit_reminders")
      .upsert({ user_id: uid, task_id: taskId, remind_at: next.remind_at, enabled: next.enabled, timezone: next.timezone },
        { onConflict: "user_id,task_id" });
    if (error) {
      toast.error("Could not save that reminder", { description: error.message });
      setRows(p => ({ ...p, [taskId]: current }));
      return;
    }
    if (patch.enabled) {
      haptic("tap");
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") askPermission();
    }
  };

  return (
    <div style={CARD}>
      <div style={titleStyle}>
        <Bell size={16} strokeWidth={1.8} color={AX.accent} />
        Reminders
      </div>

      {!loaded && <div style={{ fontSize: 13, color: AX.muted }}>Loading reminders…</div>}

      {loaded && tasks.length === 0 && (
        <div style={{ fontSize: 13, color: AX.muted }}>Your habits load first — reminders appear here right after.</div>
      )}

      {loaded && tasks.map(t => {
        const r = rows[t.uuid];
        const on = !!r?.enabled;
        return (
          <div key={t.uuid} style={{
            display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
            background: "#181820", border: `1px solid ${AX.border}`, borderRadius: 14, marginBottom: 8,
          }}>
            <div style={{ flex: 1, minWidth: 0, fontSize: 14, color: on ? AX.text : AX.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {t.name}
            </div>
            <input
              type="time"
              value={(r?.remind_at ?? "07:00").slice(0, 5)}
              onChange={e => save(t.uuid, { remind_at: e.target.value })}
              aria-label={`Reminder time for ${t.name}`}
              style={{
                minHeight: 40, padding: "6px 8px", borderRadius: 10, background: "#14141C",
                border: `1px solid ${AX.border}`, color: AX.text, fontFamily: AX.font, fontSize: 13,
              }}
            />
            <button
              onClick={() => save(t.uuid, { enabled: !on })}
              aria-label={on ? `Turn off reminder for ${t.name}` : `Turn on reminder for ${t.name}`}
              style={{
                width: 44, height: 44, borderRadius: 12, cursor: "pointer", flexShrink: 0,
                background: "transparent", border: `1px solid ${on ? AX.accent : AX.border}`,
                color: on ? AX.accent : AX.muted, display: "flex", alignItems: "center", justifyContent: "center",
                transition: "border-color .15s ease, color .15s ease",
              }}
            >
              {on ? <Bell size={17} strokeWidth={1.9} /> : <BellOff size={17} strokeWidth={1.8} />}
            </button>
          </div>
        );
      })}

      {loaded && permission === "denied" && (
        <div style={{ fontSize: 12, color: AX.muted, marginTop: 6, lineHeight: 1.5 }}>
          Notifications are blocked in your browser settings. Times are still saved and used by the alarm screen.
        </div>
      )}
      {loaded && permission === "default" && tasks.length > 0 && (
        <button onClick={askPermission} style={{
          width: "100%", minHeight: 44, marginTop: 6, borderRadius: 12, cursor: "pointer",
          background: "transparent", border: `1px solid ${AX.border}`, color: AX.text,
          fontFamily: AX.font, fontSize: 13, fontWeight: 600,
        }}>
          Allow notifications
        </button>
      )}
    </div>
  );
}
