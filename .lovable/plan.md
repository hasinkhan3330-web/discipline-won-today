# Fixed 10-minute comeback + full state walkthrough

Everything else stays exactly as built: visuals, states, security, no money stakes.

## Step 0 - Backup / checkpoint
- The current version is saved in project history, so it can be restored with one click.
- Before any change, I save a copy of the current comeback rule (the full server definition of the recovery function) and the Accountability screen file into a private backup note. If anything breaks, they can be put back exactly.
- Confirmed in chat before moving on.

## Step 1 - Comeback locked to 10 minutes
- The server's recovery rule changes from "20% of the pact, at least 5 minutes" to a flat 10 minutes (600 seconds). The old formula is removed completely.
- Nothing else in that rule changes: one comeback per missed pact, same day only, ownership checks, and the 8 XP + 2 coins reward.
- The comeback text on the Recovery row shows "10 minutes" instead of a calculated number. No styling change.
- Test: a 45-minute and a 240-minute missed pact both create a 10-minute comeback. A second comeback attempt is still refused.

## Step 2 - Full walkthrough with real screenshots
- Create two temporary test accounts (owner + partner), connect them as partners, and give the owner one test pact.
- Walk through each state in the real app and take a screenshot of each at phone size:
  1. Before session (Start proof session)
  2. Session live (ring running)
  3. Proof required (Submit proof)
  4. Partner review (partner's Review proof screen)
  5. Verified (Partner confirmed)
  6. Recovered (a second test pact marked missed, then a 10-minute comeback finished, shown as "Recovered")
- To reach "missed" and to finish the session without waiting the full time, test pacts use short lengths; no rules are bypassed in the app.
- Then delete everything created for the test: both accounts, their pacts, sessions, proofs, partner link, invites, events, and any test coins/XP rows. A final check confirms zero leftover rows.
- Screenshots are shown in chat.

## Not changed
Any other logic, tables, security rules, rewards, styling, Home, Rank, Deep Focus, Zen.

## Technical details
- One migration: `CREATE OR REPLACE FUNCTION public.start_recovery` with the same signature, grants and pinned search_path; only the duration line becomes `600`. Original definition captured via `pg_get_functiondef` first.
- UI: replace the computed minutes in the Recovery row of `AccountabilitySection.tsx` with the constant 10.
- Test data created and removed with the data tools only; deletion scoped strictly to the two test user ids.
