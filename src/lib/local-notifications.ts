export type LocalReminder = {
  id: number;
  title: string;
  body: string;
  at: Date;
};

export function stableNotificationId(value: string, offset = 5000) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  return offset + Math.abs(hash % 100000);
}

export function nextReminderAt(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const at = new Date();
  at.setHours(hours || 0, minutes || 0, 0, 0);
  if (at.getTime() <= Date.now()) at.setDate(at.getDate() + 1);
  return at;
}

export async function cancelLocalReminder(id: number) {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable("LocalNotifications")) return;
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    await LocalNotifications.cancel({ notifications: [{ id }] });
  } catch { /* best effort */ }
}

export async function scheduleLocalReminder(reminder: LocalReminder) {
  if (typeof window === "undefined") return "unsupported" as const;
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("LocalNotifications")) {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      const permission = await LocalNotifications.requestPermissions();
      if (permission.display !== "granted") return "denied" as const;
      await LocalNotifications.cancel({ notifications: [{ id: reminder.id }] });
      await LocalNotifications.schedule({ notifications: [{
        id: reminder.id,
        title: reminder.title,
        body: reminder.body,
        schedule: { at: reminder.at, allowWhileIdle: true },
      }] });
      return "scheduled" as const;
    }
  } catch { /* continue with browser fallback */ }

  if (!("Notification" in window)) return "unsupported" as const;
  const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
  return permission === "granted" ? "browser" as const : "denied" as const;
}