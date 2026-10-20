# 4AM wake alarm — verification and limits

## Result
The existing Wake Protocol saves per-user settings, uses stored IANA timezone and UTC occurrences, and opens a server-checked math/science solve gate. Overnight Mode primes audio, requests Screen Wake Lock, loops the chosen sound with a 20-second ramp and synthesized fallback, and supports vibration where available. Persisted ringing resumes after reopening. Test alarms award nothing.

**This is not a completed closed-app alarm service.** Push subscription and a private queue/processor exist, but delivery is deliberately inactive. No new callback has been published and no per-minute HTTP schedule was armed. The approved plan forbids pointing a production job at an unpublished callback. Separately approved publication and private-secret scheduler setup are required before closed-app backup can be enabled.

## Reused systems
- Settings: existing `alarms`; completion: existing `alarm_sessions`, `task_completions`.
- Coins: existing `axen_award_completion_coins`, `coin_transactions`, profile balance and scoped daily unique ledger key. Wake-only source added, not a second coin system.
- XP: existing `wake_slot_reward`, `score_events`, once-per-user/local-day key.
- Science: existing `quiz_questions`, private `wake_only` rows with source/category metadata. Existing public quiz subject stays `science`.
- Existing Wake Protocol sections, eight requested ringtone assets, CoinBadge, auth boundary and navigation framework.

## Changed files
- Wake UI wiring: `src/components/WakeProtocol.tsx`, `src/routes/_authenticated/dashboard.tsx`.
- New wake-only UI: `src/components/wake/{AlarmScreen,WakeReadiness,WakeObserver}.tsx`, `alarm.module.css`, `src/routes/_authenticated/alarm.tsx`.
- Wake-only logic: `src/lib/{wake.functions,wake-rules,wake-types,web-alarm-scheduler,wake-push.server,wake-origin.server}.ts`; private `wake-science-bank.server.json`.
- Push callback: `src/routes/api/public/wake/process.ts`; `public/wake-service-worker.js`, `public/wake-manifest.webmanifest`.
- Root mounts the wake reopen observer and install manifest; removed inherited stale social-image metadata. No global CSS/theme/shared controls changed.
- Tests: `tests/wake-{rules,server,science,science-server,load}.test.ts`; `AGENTS.md`, `roadmap.md`, this report.
- Migrations 0019–0025: private occurrences/history/subscriptions/outbox/log; verified rewards/queues; legacy completion denial and wake-field guards; reopen/XP/uniqueness; due/save snapshot protection; science category; timezone retry protection. Generated database types refreshed automatically.
- Dependencies for edge-compatible Web Push encryption and P-256 key derivation: `@block65/webcrypto-web-push`, `@noble/curves`; existing installed `postgres` used only for isolated tests.

## Actual test output
1. `bun test tests/wake-rules.test.ts tests/wake-science.test.ts tests/coin-badge.test.tsx tests/display-name.test.ts tests/milestone-seals.test.ts`: **59 pass, 0 fail, 2,616 expectations**.
2. `WAKE_TEST_DATABASE_URL=<disposable-local-db> bun test tests/wake-server.test.ts`: **9 pass, 0 fail, 27 expectations**. Includes private-table/legacy denial, question privacy, wrong answers, cross-account rejection, eight concurrent solves paying exactly 10 once, balance=ledger, exactly one XP row, solved reload and reward-free tests.
3. `WAKE_TEST_DATABASE_URL=<disposable-local-db> bun test tests/wake-science-server.test.ts`: **4 pass, 0 fail, 415 expectations**. All 400 questions issued with no repetition before exhaustion, cycle increment, wrong reset, two consecutive correct answers, zero test coins/streak, SQL DST gap/fold/local-day conversion, private helper denial.
4. Signed-in browser using a temporary account: save → 10-second test → wrong numeric answer → reload while ringing → correct server-checked solve → “AWAKE CONFIRMED / Test complete. No coins, XP or streak changes.” **PASS**, zero page errors. Screenshots checked at 360/390/430px with no document overflow. Temporary account and alarm-related rows removed; backend occurrence count returned to zero.
5. Latest observed preview build: **build OK** (2026-10-20 08:03:55 UTC). No manual production build or typecheck was run.

## Science content provenance
400 unique, source-backed items across chemistry (80), biology (80), physics (80), earth (80), astronomy (80). Sources: IUPAC periodic table, NCBI standard genetic code, NHGRI base pairing, OpenStax physics formulas, USGS Mohs scale, NASA planet order/size. Each row has an authoritative reference, four distinct options, one answer index and explanatory source. Tests check codon coverage and selected known codons, unique questions/options, category coverage and comparison extrema.

This is a source-backed, programmatically checked bank; **independent question-by-question human scientific review is UNVERIFIED**, not claimed. Many questions are formula/comparison variations rather than 400 different scientific topics. Answer keys are never returned before submission.

## Failed and UNVERIFIED checks
- **100,000/min load acceptance: UNVERIFIED.** Initial run failed because fixture users were missing. Corrected setup exceeded the 600-second limit before fixture transaction completed; it was cancelled. No due-batch times, delivery throughput or zero-duplicate scale result was produced. No load traffic was sent to real push providers. The bounded query/lease design is not evidence of target throughput.
- **Actual push encryption/provider acceptance, 404/410/backoff E2E and scheduled callback: UNVERIFIED.** Six concurrent outbound calls per invocation; processing presently limited to one 500-event sweep and six push jobs per request. This alone does not meet 100,000 deliveries/minute.
- **Physical iOS/Android**, closed-app notification display, wake-lock, muted/locked phone sound, vibration and real ringtone audibility: UNVERIFIED.
- Real clock changes, multi-tab race, offline retry, hardware Back, independent daily-midnight reward rollover and all timing-boundary database cases: not fully exercised. Unit boundary tests do not replace these.
- Only the math alarm flow was exercised end-to-end in the browser; science was checked against the isolated database.
- The requested “exact backup warning” was not supplied literally. Current wording: “Browser alarms can't be guaranteed on every phone. Keep a backup alarm until your test works.”

## Security and honesty
Authenticated server functions validate the bearer through existing middleware and reject cross-site wake origins. Private occurrence/history/outbox tables use RLS with no authenticated read policy; private functions cannot be executed by authenticated users. Older manual/selfie completion calls fail closed, and generic alarm completion rejects Wake Protocol. Server time controls scheduling, eligibility and daily awards; no client answer or reward verdict is trusted. Settings cannot cancel a due/ringing event, and timezone changes cannot alter a ringing snapshot.

Browsers cannot prevent closure, power-off, OS mute, permission rejection or notification suppression. Push cannot force open a page or guarantee looping audio. iOS push needs an installed Home Screen app on iOS 16.4+. Keep an independent phone alarm. Minute checks would run 1,440 times/day and may increase Cloud costs once activated.

No publication, deployment, native packaging, auth changes, unrelated screen redesign or unrelated reward changes were performed. The feature remains **partially delivered**, with closed-app activation, independent science review and throughput/device acceptance outstanding.
## Answer-key privacy (2026-10-20)
- `tests/wake-answer-privacy.test.ts` (disposable DB, functions md5-identical to live): 7 pass, 0 fail, 176 expectations.
- Question fields sent to the browser: `id, version, text, options, type, correct_in_row` (options null for math; question null unless ringing).
- Explanation is returned only in the reply to a correct submission, for the question just answered. Wrong answers return `explanation: null`.
- Client bundle scan: 445 files, 0/400 bank questions, 0/400 explanations, 0 private column names.
- Live browser capture (temporary account, deleted): 647 responses, 0 with private field names, 0 pre-solve with hash/explanation.
- UNVERIFIED: physical devices; push payloads in a real delivery (push inactive).

## Privacy hardening follow-up (2026-10-20)
1. **Table rights revoked.** Migration `0026_wake_revoke_private_table_grants` removes all anon/authenticated rights on `alarm_events`, `wake_question_history`, `quiz_questions` (live ACL now: postgres, service_role, sandbox_exec only). RLS stays on as layer 2. Test: direct reads by both roles fail with 42501; a rolled-back temporary grant still sees 0 rows.
2. **Push payload.** Body is built by `wakePushMessage()` from an explicit allowlist: `eventId, round, url` only — no question fields at all, no answer/index/hash/explanation; notification text is fixed. Extra fields on a job row cannot be forwarded (`tests/wake-push-payload.test.ts`). Real provider delivery remains UNVERIFIED (push inactive).
3. **On-device caching.** None exists: no question pre-fetch, no Cache Storage, no IndexedDB, and the worker has no fetch handler. Live capture snapshots (scheduled/ringing/solved) held only the sign-in session and router scroll key — no question text, answer, hash or explanation.
4. **Offline answers.** Queued in memory on the alarm screen (never stored on the device), answer buttons locked, notice shown, retried on reconnect and at 2/4/8/16/30s. Only a server-confirmed solve stops the alarm; server rejections are shown, not retried (`tests/wake-offline-queue.test.ts`). Live: server unchanged while offline; delivered exactly once after reconnect.
5. **Live science capture** (`WAKE_LIVE_CAPTURE=1`, driver `tests/wake-live-capture.py`, preview app on the live backend, throwaway account deleted): 637 responses, 0 private field names, 6 science questions with exactly the allowlisted keys and 4 options, hashes in 0 responses, explanations in 0 pre-answer responses, wrong-answer explanation never sent. Full file: 14 pass, 0 fail, 362 expectations.
- UNVERIFIED: capture against the published domain (wake feature not published yet), physical phones.
