import { useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { haptic } from "@/lib/haptics";

export const NUDGE_SEEN_KEY = "axen:nudge-seen-at";
export const NUDGE_EVENT = "axen:nudge-received";

/** Listens for accountability alerts sent to me and shows an in-app banner. Read-only. */
export function NudgeListener({ userId }: { userId: string | null }) {
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`nudges_${userId}_${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes" as never,
        { event: "INSERT", schema: "public", table: "accountability_events", filter: `recipient_id=eq.${userId}` },
        (payload: { new?: { kind?: string; message?: string | null } }) => {
          const row = payload.new;
          if (!row || !["nudge", "emergency", "checkin", "review_confirmed", "review_asked", "review_disputed", "review_resubmitted", "review_resolved"].includes(row.kind ?? "")) return;
          const message = row.message ?? "Your partner sent an update";
          toast(row.kind === "nudge" ? `Your partner sent: ${message}` : message, { duration: 6000 });
          haptic("success");
          window.dispatchEvent(new Event(NUDGE_EVENT));
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [userId]);
  return null;
}
