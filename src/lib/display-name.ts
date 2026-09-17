/**
 * Never render a raw email address in the UI.
 * Returns a safe display name: trimmed name, or the local part of an email,
 * or the given fallback when nothing usable exists.
 */
export function safeName(raw?: string | null, fallback = "Warrior"): string {
  const value = (raw ?? "").trim();
  if (!value) return fallback;
  const local = value.includes("@") ? value.split("@")[0].trim() : value;
  return local || fallback;
}
