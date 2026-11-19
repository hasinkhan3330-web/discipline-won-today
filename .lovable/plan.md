# Phase 2 (Option A: coin amounts unchanged)

## Answers (LIVE evidence)
- **Direct proof insert:** a signed-in user CANNOT set status or verification fields. `guard_proof_submission` (BEFORE INSERT) forces `status='submitted'`, clears confidence/reason/verifier/verified_at/retry_count and checks that the session belongs to the same user and pact. Later updates by users are refused ("proof status is server-only"). So there is no priority fix.
- **(a) Coins today:** a normal pact pays 10 coins once per day (`axen_completion_reward_config` contract=10, contract_limit=1) plus 20 XP. A recovered pact pays `LEAST(2, axen_daily_coin_room)` coins plus 8 XP.
- **(b) Without partner review:** yes. `award_contract` pays when the pact is `verified`, a proof has `status='verified'` (set by the automatic verifier via `verify_contract_proof`: photo detector, timer recall or Zen session) and a session is `completed`. Partner review is not required.
- **(c) 50/day room:** no. Normal pact coins carry `reward_source='contract'`, which `axen_daily_coin_room` excludes, and they are capped at 1 per day. Recovered pacts use the room for at most 2 coins.
- `acct_is_party` and `acct_connection_active_for`: anon EXECUTE = false.

## Build in this run
1. **Check-in guard:** a trigger `BEFORE INSERT OR UPDATE OF day ON acct_checkins` refuses a `day` outside `acct_user_today(user_id) ± 1`. Garden formula untouched.
2. **`save_pact(_id uuid, _payload jsonb)`:** SECURITY DEFINER, `search_path=public`, EXECUTE for authenticated only (revoked from PUBLIC/anon). Whitelist = exactly the columns `toPayload()` in `ContractCard.tsx` sends today (read from code before writing), plus `status` limited to `draft|scheduled` as today. Unknown keys → error. Owner = `auth.uid()`. Edit locks the row `FOR UPDATE` and requires ownership. The existing triggers still run.
3. **`set_pact_pause(_id, _paused boolean)` and reschedule:** only if the Recovery view writes `daily_contracts` directly today; same rules, writes only `paused_at` / the schedule columns used today.
4. **Proof insert:** no new RPC needed, because the guard already enforces everything; the server function stays as it is.
5. **Switch frontend calls:** `ContractCard.tsx` insert/update, plus the Recovery view pause/resume/reschedule if direct. Screens unchanged. Browser check with writes intercepted.
6. **No revoke this run.** The report includes the revoke SQL (for later), its rollback SQL and the list of switched calls.

## Evidence then STOP
Function definitions and ACLs, trigger definition, `pg_policies` of `acct_checkins` and `daily_contracts`; report max 8 lines.
