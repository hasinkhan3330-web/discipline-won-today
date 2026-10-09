/**
 * Never render a raw email address in the UI.
 * Email addresses are rejected entirely, never shortened to their local part.
 */
export function safeName(raw?: string | null, fallback = "Axen Member"): string {
  const value = (raw ?? "").trim();
  return value && !value.includes("@") ? value : fallback;
}

/** Public identities never fall back to username or auth metadata. */
export function publicDisplayName(displayName: string | null | undefined, userId: string): string {
  return safeName(displayName, `Axen Member ${userId.slice(-4)}`);
}
