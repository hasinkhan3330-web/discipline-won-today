import { toast } from "sonner";

type SaveResult = { success?: boolean; saved_count?: number; error?: string } | null | undefined;

// One toast per real save result (text or voice); realtime echoes within 5s are skipped.
let lastShownAt = 0;
export function showPlanSaveToast(result: SaveResult, openPlan: () => void) {
  if (!result) return;
  if (result.success) {
    lastShownAt = Date.now();
    toast.success(`Plan saved ✅ (${result.saved_count ?? 0} tasks)`, { action: { label: "View", onClick: openPlan } });
  } else {
    toast.error(`Plan not saved: ${result.error ?? "something went wrong"}`);
  }
}
export function planToastRecentlyShown(ms = 5000) {
  return Date.now() - lastShownAt < ms;
}
