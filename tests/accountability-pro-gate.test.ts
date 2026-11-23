import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const sql = readFileSync("drizzle/migrations/0055_accountability_pro_gate.sql", "utf8");
const G = "coalesce((SELECT ge.premium_access FROM public.get_entitlement() ge),false)";
const fns = ["create_accountability_invite","accept_accountability_invite","acct_revoke_my_invites","get_trust_summary","partner_proof_action","send_nudge","send_accountability_nudge","get_nudge_suggestions","acct_send_cheer","acct_garden_score","acct_pair_streak","acct_partner_checkin_status","acct_partner_garden_stage","acct_weekly_report","get_my_accountability","get_partner_reviews","get_partner_today","get_partner_contract_summary"];
const tables = ["acct_checkins","acct_settings","acct_milestones_seen","accountability_invites","accountability_connections","accountability_events","acct_cheers","partner_events","partner_messages","pact_nudges","trust_events"];

test("every Accountability function is guarded by the existing trial/Pro verdict (missing = deny)", () => {
  for (const f of fns) expect(sql).toContain(`'${f}'`);
  expect(sql).toContain(G);
});

test("every Accountability table gets a restrictive read+write Pro policy", () => {
  for (const t of tables) expect(sql).toContain(`ON public.${t} AS RESTRICTIVE FOR ALL TO authenticated USING (${G}) WITH CHECK (${G})`);
});

test("shared Contract pact functions stay unlocked", () => {
  for (const f of ["save_pact", "cancel_pact", "set_pact_pause"]) expect(sql).not.toContain(f);
});
