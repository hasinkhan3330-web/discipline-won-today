import { cancelLocalReminder, scheduleLocalReminder, stableNotificationId } from "@/lib/local-notifications";
import type { ContractRow } from "@/lib/verified/contracts";

/**
 * Contract reminders. Reuses the existing @capacitor/local-notifications wrapper.
 * IDs are deterministic (derived from contract_id), so re-scheduling never duplicates.
 * Times come from the stored `scheduled_at` UTC instant — DST-safe in any timezone.
 */

const PREP_KEY = (id: string) => `contract:${id}:prep`;
const START_KEY = (id: string) => `contract:${id}:start`;
export const CONTRACT_ACTION_TYPE = "AXEN_CONTRACT";

export function contractNotificationIds(contractId: string) {
  return [stableNotificationId(PREP_KEY(contractId)), stableNotificationId(START_KEY(contractId))];
}

export async function cancelContractReminders(contractId: string) {
  for (const id of contractNotificationIds(contractId)) await cancelLocalReminder(id);
}

/** Register READY / RESCHEDULE / RESCUE VERSION actions. Native Android only; no-op elsewhere. */
async function ensureContractActions() {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable("LocalNotifications")) return;
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    await LocalNotifications.registerActionTypes({
      types: [{
        id: CONTRACT_ACTION_TYPE,
        actions: [
          { id: "ready", title: "READY" },
          { id: "reschedule", title: "RESCHEDULE" },
          { id: "rescue", title: "RESCUE VERSION" },
        ],
      }],
    });
  } catch { /* actions are optional */ }
}

export type ContractReminderResult = "scheduled" | "denied" | "unsupported" | "browser" | "none" | "past";

/**
 * Schedules prep + start reminders for a scheduled contract. Cancels old IDs first.
 * reminder_pref: "none" → nothing, "standard" → 5 min before, "early" → 15 min before.
 * Permission is requested by the OS here (after the contract is confirmed), never at app launch.
 */
export async function scheduleContractReminders(c: ContractRow): Promise<ContractReminderResult> {
  await cancelContractReminders(c.id);
  if (c.reminder_pref === "none") return "none";

  const startAt = new Date(c.scheduled_at);
  if (Number.isNaN(startAt.getTime())) return "past";
  const leadMin = c.reminder_pref === "early" ? 15 : 5;
  const prepAt = new Date(startAt.getTime() - leadMin * 60_000);

  let result: ContractReminderResult = "past";
  const put = async (id: number, body: string, at: Date, withActions: boolean) => {
    if (at.getTime() <= Date.now()) return;
    const r = await scheduleLocalReminder({
      id, title: "AXEN Contract", body, at,
      actionsId: withActions ? CONTRACT_ACTION_TYPE : undefined,
      extra: { contractId: c.id },
    });
    // keep the worst outcome so the caller can show a fallback note
    if (r === "denied" || result === "past") result = r;
    else if (r === "unsupported") result = "unsupported";
    else if (r === "browser" && result !== "browser") result = "browser";
    else if (r === "scheduled" && result === "past") result = "scheduled";
  };

  await ensureContractActions();
  await put(contractNotificationIds(c.id)[0], `Prep: “${c.title}” starts in ${leadMin} minutes.`, prepAt, false);
  await put(contractNotificationIds(c.id)[1], `Start now: “${c.title}”.`, startAt, true);
  return result;
}

/** Listen for notification taps/action buttons. Returns an unsubscribe fn. Native only. */
export async function listenContractActions(onOpen: (contractId: string | null, actionId: string | null) => void) {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable("LocalNotifications")) return () => {};
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    const handle = await LocalNotifications.addListener("localNotificationActionPerformed", (event) => {
      const contractId = (event.notification.extra as any)?.contractId ?? null;
      onOpen(typeof contractId === "string" ? contractId : null, event.actionId ?? null);
    });
    return () => { void handle.remove(); };
  } catch { return () => {}; }
}
