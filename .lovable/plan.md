# Accountability behind the existing Pro gate (screens + server)

## What I checked
- Rank, Zen and Coach screens use `ProtectedFeatureGate`. It reads the server verdict `get_entitlement().premium_access`, which is true during the 3-day trial or with active Pro.
- Accountability opens only from You → Accountability. The invite page `/join/$code` calls `acceptInvite` → `accept_accountability_invite`.
- Accountability uses 18 server functions (listed below). None is called by another database function.
- It also reads and writes 11 Accountability-only tables directly from the phone. Check-in is a direct write to `acct_checkins`.
- Pacts (`save_pact`, `cancel_pact`, `set_pact_pause`), `daily_contracts`, `proof_submissions` and `profiles` are shared with the Contract card. They stay unlocked so Contract keeps working for everyone.

## 1. Screen lock (unchanged from before)
- `ProfileTab.tsx`: wrap `AccountabilitySection` in `ProtectedFeatureGate` and add an optional `onUpgrade` prop. "Continue basic" goes back to the You menu.
- `dashboard.tsx`: pass `onUpgrade={() => setShowPaywall(true)}` to open the existing ₹99 paywall.
- `join.$code.tsx`: for signed-in users, wrap the page in `EntitlementProvider` and `ProtectedFeatureGate`. Without access, the same lock replaces the Join button and its upgrade goes to `/pro`. Signed-out visitors see the page exactly as today.

## 2. Server lock (one migration, same verdict, no new timer)
Every check uses `(SELECT premium_access FROM public.get_entitlement())`. That is the exact verdict the app already shows.

**Functions.** Add one guard line at the top of each, and keep the rest of the body byte-for-byte:
`create_accountability_invite`, `accept_accountability_invite`, `acct_revoke_my_invites`, `get_my_accountability`, `get_trust_summary`, `get_partner_reviews`, `partner_proof_action`, `send_nudge`, `send_accountability_nudge`, `get_nudge_suggestions`, `acct_send_cheer`, `acct_garden_score`, `acct_pair_streak`, `acct_partner_checkin_status`, `acct_partner_garden_stage`, `acct_weekly_report`, `get_partner_today`, `get_partner_contract_summary`.
- The plpgsql functions raise "AXEN Pro required" (permission denied).
- The 4 SQL functions return no rows without access. They keep the same language, signature and grants.

**Tables.** Add one new restrictive Pro policy per table for signed-in users, covering reads and writes. Existing policies stay untouched:
`acct_checkins`, `acct_settings`, `acct_milestones_seen`, `accountability_invites`, `accountability_connections`, `accountability_events`, `acct_cheers`, `partner_events`, `partner_messages`, `pact_nudges`, `trust_events`.
- Server-side triggers and cron run with owner rights and are not affected.

No table, column, grant, timer, reward or other feature changes.

## Effects to know
- A user without trial or Pro gets no partner data, check-in, nudges, cheers or invites. Their incoming nudge pop-ups also stop.
- Their Contract card still works, but its small partner line disappears, because that line reads `get_my_accountability`.
- A Pro user's partner who has expired can't respond, but the Pro user's own access is unaffected.

## Verification
- Read the live function definitions and policies back from the database.
- Add a small test checking every listed function and table carries the Pro guard. Run the existing tests and report PASS/FAIL/SKIPPED.
- Typecheck and build log. Signed-out `/join/x` still shows sign-in.
- Not testable live: locked and unlocked behaviour with a real expired account and a real trial or Pro account, because test accounts are not allowed. This will be reported as NOT TESTED.
