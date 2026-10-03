# AXEN Accountability Redesign (warm navy, partner review)

The warm navy override is the only visual direction used. HUD, mono, bracket, terminal, cyan/violet and dot-grid instructions are ignored. Only the Accountability screen changes. Home, Rank, Deep Focus core, Zen, rewards, navigation and theme everywhere else stay as they are.

## 1. Money-stake audit
- The active screen (Profile → Accountability) has no ₹500 text, no money penalties and no payments.
- The only stake wording is in the unused legacy `AccountabilityPanel.tsx`: "Coins at stake" and "coins on the line… your partner sees it". It is not shown anywhere in the app. The plan deletes the file.
- The `accountability_pacts.stake_coins` column stays in place (no destructive change). It gets marked DEPRECATED and nothing reads it.
- The ₹99 / ₹499 references are AXEN Pro subscription prices. They stay.

## 2. Reuse map (no duplicate tables)
| Concept | Existing structure reused | Addition |
|---|---|---|
| Pact | `daily_contracts` (today's contract) | none |
| Partner | `accountability_connections` + invites | none |
| Proof session | `contract_sessions` + `start_contract_session` / `end_contract_session` (server time, one live session) | add `client_request_id` unique column so the same request can't start two sessions |
| Proof | `proof_submissions` (timer / note / photo checked then discarded) | add nullable columns `reviewer_id`, `reviewed_at`, `review_status` (pending / confirmed / asked / cannot_verify), `asked_once` |
| Partner review | none yet | one new RPC `review_partner_proof` |
| Recovery | `start_recovery` + `recovery_events` (one per contract, same day) | none |
| Audit / trust events | `contract_events`, `accountability_events` | new event kinds: review, ask, dispute, resolve, correction |
| Trust | none yet | new read-only RPC `get_trust_summary`, calculated from the events above |
| Points | `award_contract` (idempotent, never negative) | not changed |
| Notifications | `NudgeListener` realtime on `accountability_events` | add review / ask / dispute messages |

## 3. State machine
```text
BEFORE_SESSION --tap--> STARTING --server ok--> SESSION_LIVE
SESSION_LIVE --end--> ENDING --server ok--> PROOF_REQUIRED
PROOF_REQUIRED --submit--> PARTNER_REVIEW (labelled "Evidence submitted")
PARTNER_REVIEW --partner verifies--> VERIFIED ("Partner confirmed")
PARTNER_REVIEW --partner asks once--> PROOF_REQUIRED (one more try, then review again)
PARTNER_REVIEW --partner can't verify--> DISPUTED --resolve--> SELF-REPORTED or resubmit
missed window --server says recovery is available--> RECOVERY_AVAILABLE --> RECOVERED (never shown as perfect)
No partner: proof ends as SELF-REPORTED
```
The screen state comes from server rows only (contract status + session + proof review_status). Nothing on the device decides the state.

## 4. Screen (warm navy)
- Background #0A0E1A, one accent #4F7CFF, cards with 20–24px corners, one soft radial glow behind the pact card, and glow on the main button only. Fonts: Space Grotesk for headings and numbers, Manrope for everything else. All labels in sentence case.
- Header: "Accountability", status ("Pact active" / "No active pact"), "With {partner}", and a ⋯ menu holding mute, remove, block & report, and sharing.
- Today's pact card: title · duration, scheduled time, partner, short success rule.
- One main button per state: "Start proof session" → "Starting…" → "End session" (with a live circular ring) → "Saving…" → "Submit proof" → "Review proof" (partner side) / "Waiting for review".
- Three chips: "Streak 4/7" or "Streak building", "1 pending review", "Trust 96" or "Building trust".
- Three tap-to-open rows: Check-ins (existing nudges, check-in, emergency nudge, our contract), Proof history (labels + reviewer and time), Recovery ("Missed the window? Make a comeback." → "Start comeback").
- Accessibility: touch targets of at least 48px, every status shown as text (never color alone), focus rings, and no ring glow or animation when the phone's reduced-motion setting is on.

## 5. Trust
- Calculated on the server from the last 60 days: partner-confirmed proofs, on-time submissions, disputes, recoveries and abandoned sessions. Old events stop counting, so nobody is punished forever.
- With fewer than 5 reviewed sessions the screen shows "Building trust · 3 verified · 1 recovery · 0 disputes" instead of a number.
- With enough history it shows a number, plus a "Why?" sheet that explains it in plain words. Each user only sees their own breakdown.

## 6. Security
- `review_partner_proof(proof_id, action, note)` checks four things: the caller is the active, unblocked partner of the proof's owner; the caller is not the owner; the proof is pending; and the 'ask' action has not been used yet. It writes the reviewer and server time, logs an audit event, and adds the trust event once (unique key).
- Users can't write the review columns directly. A guard trigger rejects that unless it comes from the server function, and existing RLS still makes proof rows owner-only.
- Partners get a minimal review view through a secure function (title, proof type, note text, duration, submitted time). They never get raw rows, photos, or private notes.
- Session times always come from the server, never the device. Sending the same start request twice returns the existing session.
- Realtime keeps using `accountability_events` with RLS where actor or recipient = the signed-in user, so unrelated users receive nothing.

## 7. Tests (two throwaway accounts plus a third, deleted afterwards)
1. Each user sees only their own pacts.
2. The partner sees only the assigned review.
3. The third account is denied everything.
4. The owner cannot review their own proof.
5. A direct update to "confirmed" is rejected.
6. Forged old or future times are ignored or rejected.
7. Duplicate start / submit / review requests resolve once.
8. A removed partner loses access.
9. A blocked partner can't review future proofs.
10. Realtime events don't reach the third account.
11. "Ask once" can't be used twice.
12. A recovery shows as "Recovered", never "Partner confirmed".
13. Trust stays hidden below the history threshold.
14. Points stay unchanged by any review.

UI checks: browser screenshots of before session, session live, proof required and partner review at 360px; double-tap and slow-network checks; reduced-motion check.

## 8. Decisions made
- **Recovery length:** the existing server rule is 20% of the pact length (minimum 5 minutes). The comeback copy will say "a short comeback" and show the real minutes. Switching to a fixed 10 minutes would change the approved Phase 6 rule, so it only happens if you approve it separately.
- **Review and points:** a partner review does not change coins or XP. Rewards stay exactly as they are today.

## Technical details
- Files changed: `src/components/verified/AccountabilitySection.tsx` (rebuilt around the states), new `src/components/verified/accountability/*` (PactCard, ProofRing, ReviewSheet, TrustWhy), `NudgeListener.tsx` (new event messages), scoped styles in `src/styles.css` under an `.acct-` prefix, and a Manrope + Space Grotesk font link if not already loaded. Delete `AccountabilityPanel.tsx`.
- One additive migration: new columns on proof_submissions and contract_sessions, the review RPC, the trust RPC, the partner review view RPC, the guard trigger, and the stake_coins deprecation comment. Grants go to authenticated users only, with search_path pinned. Nothing is dropped.
- No production publish. There is one shared backend, so test accounts are created and removed. No real user data is touched.
- The final report will list changed files, the migration, RLS/guards, test results, limitations (no physical-device test, photo proofs are not stored so partners review text/timer only) and the screenshots.
