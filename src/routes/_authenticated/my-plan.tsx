import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { addDays } from "@/lib/plan-tasks";
import { planToastRecentlyShown } from "@/lib/plan-toast";
import s from "@/components/plan/my-plan.module.css";

export const Route = createFileRoute("/_authenticated/my-plan")({
  head: () => ({ meta: [
    { title: "My Plan — AXEN" },
    { name: "description", content: "Your coach-built plan for today and the next 7 days." },
    { property: "og:title", content: "My Plan — AXEN" },
    { property: "og:description", content: "Your coach-built plan for today and the next 7 days." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: MyPlanPage,
});

type Row = { id: string; task_date: string; day_number: number | null; title: string; description: string | null; duration_minutes: number | null; completed: boolean; plan_title: string | null };

function localToday() {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
function dayLabel(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

function MyPlanPage() {
  const [tab, setTab] = useState<"today" | "week">("today");
  const qc = useQueryClient();
  const today = useMemo(localToday, []);
  const end = addDays(today, 7);
  const key = ["plan_tasks", today];
  const q = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase.from("plan_tasks").select("id,task_date,day_number,title,description,duration_minutes,completed,plan_title").gte("task_date", today).lte("task_date", end).order("task_date").order("created_at");
      if (error) throw new Error(error.message);
      return (data ?? []) as Row[];
    },
  });

  useEffect(() => {
    const ch = supabase.channel(`plan-tasks-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "plan_tasks" }, (p) => {
        void qc.invalidateQueries({ queryKey: ["plan_tasks"] });
        if (p.eventType === "INSERT" && !planToastRecentlyShown(8000)) { /* saved from another device/session */ }
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [qc]);

  const toggle = async (row: Row) => {
    qc.setQueryData<Row[]>(key, (rows) => rows?.map((r) => (r.id === row.id ? { ...r, completed: !r.completed } : r)));
    const { error } = await supabase.from("plan_tasks").update({ completed: !row.completed }).eq("id", row.id);
    if (error) { toast.error("Couldn't update the task"); }
    void qc.invalidateQueries({ queryKey: ["plan_tasks"] });
  };

  const rows = q.data ?? [];
  const todayRows = rows.filter((r) => r.task_date === today);
  const days = Array.from(new Set(rows.map((r) => r.task_date)));

  return (
    <main className={s.page}>
      <div className={s.head}>
        <Link to="/dashboard" className={s.back} aria-label="Back"><ArrowLeft size={20} /></Link>
        <h1 className={s.title}>My Plan</h1>
      </div>
      <div className={s.tabs} role="tablist">
        <button role="tab" aria-selected={tab === "today"} className={`${s.tab} ${tab === "today" ? s.tabOn : ""}`} onClick={() => setTab("today")}>Today</button>
        <button role="tab" aria-selected={tab === "week"} className={`${s.tab} ${tab === "week" ? s.tabOn : ""}`} onClick={() => setTab("week")}>7 Days</button>
      </div>
      {q.isLoading ? (<><div className={s.skel} /><div className={s.skel} /></>)
        : q.isError ? (
          <div className={`${s.card} ${s.empty}`}><p className={s.error}>Couldn't load your plan.</p><button className={s.retry} onClick={() => q.refetch()}>Try again</button></div>
        ) : (tab === "today" ? todayRows.length === 0 : rows.length === 0) ? (
          <div className={`${s.card} ${s.empty}`}>No plan yet – talk to your coach</div>
        ) : tab === "today" ? (
          <section className={s.card}>
            <div className={s.micro}>{todayRows[0]?.plan_title ?? "Today"} · {dayLabel(today)}</div>
            {todayRows.map((r) => <TaskRow key={r.id} row={r} onToggle={toggle} />)}
          </section>
        ) : days.map((d) => {
          const list = rows.filter((r) => r.task_date === d);
          const done = list.filter((r) => r.completed).length;
          return (
            <section key={d} className={s.card}>
              <div className={s.dayHead}><span className={s.dayTitle}>{d === today ? "Today" : dayLabel(d)}</span><span className={s.micro}>{done}/{list.length} done</span></div>
              <div className={s.bar}><i style={{ width: `${list.length ? (done / list.length) * 100 : 0}%` }} /></div>
              {list.map((r) => <TaskRow key={r.id} row={r} onToggle={toggle} />)}
            </section>
          );
        })}
    </main>
  );
}

function TaskRow({ row, onToggle }: { row: Row; onToggle: (r: Row) => void }) {
  return (
    <label className={s.row}>
      <input type="checkbox" className={s.check} checked={row.completed} onChange={() => onToggle(row)} />
      <div>
        <div className={`${s.taskTitle} ${row.completed ? s.done : ""}`}>{row.title}</div>
        {row.description && <div className={s.desc}>{row.description}</div>}
      </div>
      {row.duration_minutes ? <span className={s.mins}>{row.duration_minutes} min</span> : null}
    </label>
  );
}
