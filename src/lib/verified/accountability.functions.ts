import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type InviteResult = { ok: true; code: string } | { ok: false; message: string };
export type AcceptResult = { ok: true } | { ok: false; message: string };

async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function known(msg: string | undefined, fallback: string) {
  const m = msg ?? "";
  for (const k of ["You already have a partner", "Invite limit reached for today", "Please wait an hour before a new invite", "Invite invalid or expired"]) {
    if (m.includes(k)) return k;
  }
  return fallback;
}

/** Token is generated server-side; only its SHA-256 hash is stored. Never logged. */
export const createInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<InviteResult> => {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    const code = Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
    const hash = await sha256Hex(code);
    const { error } = await (context.supabase.rpc as any)("create_accountability_invite", { _token_hash: hash });
    if (error) return { ok: false, message: known(error.message, "Could not create invite") };
    return { ok: true, code };
  });

export const acceptInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string }) => {
    const code = typeof input?.code === "string" ? input.code.trim().toUpperCase().replace(/[^0-9A-F]/g, "") : "";
    return { code: code.slice(0, 64) };
  })
  .handler(async ({ data, context }): Promise<AcceptResult> => {
    if (data.code.length !== 32) return { ok: false, message: "Invite invalid or expired" };
    const hash = await sha256Hex(data.code);
    const { error } = await (context.supabase.rpc as any)("accept_accountability_invite", { _token_hash: hash });
    if (error) return { ok: false, message: known(error.message, "Invite invalid or expired") };
    return { ok: true };
  });
