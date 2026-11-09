/** "DD Mon YYYY", e.g. 09 Aug 2027. */
export function formatPillDate(iso: string): string {
  const d = new Date(iso);
  const m = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()];
  return `${String(d.getDate()).padStart(2, "0")} ${m} ${d.getFullYear()}`;
}
export function pillText(row: { status?: string | null; current_period_end?: string | null } | null, now = new Date()): string {
  if (!row?.current_period_end) return "Free";
  const end = new Date(row.current_period_end);
  const active = end > now && row.status !== "expired" && row.status !== "halted";
  return `${active ? "Active" : "Expired"} · ${formatPillDate(row.current_period_end)}`;
}

