import { useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { haptic } from "@/lib/haptics";

export const NUDGE_SEEN_KEY = "axen:nudge-seen-at";
export const NUDGE_EVENT = "axen:nudge-received";

/** Listens for nudges sent to me and shows an in-app banner. Read-only. */
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
          if (!row || row.kind !== "nudge") return;
          toast(`Your partner sent: ${row.message ?? "a nudge"}`, { duration: 6000 });
          haptic("success");
          window.dispatchEvent(new Event(NUDGE_EVENT));
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [userId]);
  return null;
}
