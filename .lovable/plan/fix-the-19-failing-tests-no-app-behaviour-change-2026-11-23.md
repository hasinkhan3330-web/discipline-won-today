# Fix the 19 failing tests (no app behaviour change)

## What I found
Before today's changes I ran the suite on a clean copy of the code (commit fe43ad5): **all 19 of these tests already failed there.** One of them, the Accountability live test, now fails for a new reason (see group C).

**A. Simple/Dark theme (4 tests): outdated expectations.**
`tests/simple-theme.test.ts` still expects Simple as the default. You later chose Dark as the default for new visitors, and the app does that (`normalizeTheme` returns "dark").

**B. Zen/Contract coin tests (13 tests + 1 cleanup): need test-only server helpers that don't exist.**
`tests/coin-rewards-server.test.ts` calls `axen_coin_test_fixture`, `axen_coin_edge_fixture` and `axen_coin_test_cleanup`, which are not in the database. One more test (reward config) fails only because the server also returns `wake_limit: 1`, which the test doesn't expect.

**C. Two more live tests:**
- `accountability-rebuild`: before today it already failed. Now it gets "AXEN Pro required", because its fresh account has no trial.
- `coach-security`: hits the 5-task Home limit you asked for.

**Critical issue:** groups B and C (6 test files) create real accounts in your **live** database whenever the suite runs. That breaks your no-test-accounts rule. My runs today left **75 `coin-test-…@example.com` accounts**. There are also 3 older `acct-test-…` accounts from 18 Nov.

## Changes (test files only)
1. `tests/simple-theme.test.ts`: expect "dark" in the 4 default cases. This matches the current app.
2. Every test file that creates accounts (`coin-rewards-server`, `accountability-rebuild`, `coach-security`, `coach-profile-context`, `coach-voice-tools` live parts, `wake-missions-server`): run only when an explicit isolated-database variable is set, the same pattern the wake tests already use. They will never touch the live database again.
3. `coin-rewards-server` reward-config test: compare only the keys the app defines (`toMatchObject`). It no longer fails on the extra `wake_limit`.

Result: 4 theme tests PASS. The live-database tests show as SKIPPED, not PASS. They can only truly pass on a separate test database with the test helpers, and I won't add test-only functions to your live database.

No app code, database or behaviour changes.

## Needs your separate approval (not part of this plan)
- Deleting the 78 test accounts (75 from today, 3 from 18 Nov) and their profiles. I'll list them for your per-row approval before touching anything.

## Verification
- Run the unit tests (live ones skipped) and report PASS/FAIL/SKIPPED.
- Confirm no new `*-test-*@example.com` accounts appear afterwards.
