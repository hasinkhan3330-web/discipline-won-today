# Accountability rebuild — audit (no code yet)

Scope: only You → Accountability, its sheets, notifications and backend. Home, Rank, Zen, Stats, Coach, Contract, 4AM, Rank list, subscription banner and bottom nav stay untouched.

## Conflicts to decide first
1. **Light theme default** — you earlier chose dark navy/blue for Accountability. New spec says Light by default. Both token sets would live only inside the Accountability screen (no global theme change).
2. **Coin stake rules** — the stake setup already in the database is mutual 10–500 coins between two partners. The new spec is solo 0/10/25/50, +10% bonus on time, burn on miss, 24h lock on lowering. That needs one new rule set; the old mutual one would stay unused.
3. **Phase 2 server logic was never run** (pact advance, reviews, co-focus, sweep). Tier 1 needs a rewritten version of it, shown to you as exact SQL before running.

## Design
- Exists: Accountability screen (one 442-line file), navy theme, app font, icon set, rings in other tabs.
- Missing: two scoped token sets, week strip, ring, tree (5 stages), pill/card/list kit, skeleton/empty/error/denied states.
- Touch: new Accountability-only components + one scoped style file. Risk: low, nothing shared is edited.

## Tier 1
| # | Exists | Missing | Risk |
|---|---|---|---|
| 1 No-partner paths | Invites (hashed, expiring, single-use, rate-limited), revoke, block/remove | 48h expiry, share/deep link, Match me queue (under-18 off via existing minor flag), Solo pact, Report | Changing invite expiry affects pending invites only |
| 2 Roles | Connection + share toggles | Reviewer/Supporter per connection, per-pact visibility | Low (new columns, default Reviewer) |
| 3 Pact creator | Contract sheet on Home, done criteria/fallback/deadline fields | 3-step creator inside Accountability, schedule, pause/reschedule/end | Must reuse contract data so Home card keeps working |
| 4 Coin stake | Coin ledger, once-per-pact key | New stake rules (see conflict 2), no-negative guard | Medium: coin logic; tested for once-only |
| 5 Week strip | Contract day history | Strip component | Low |
| 6 Proof & review | Proof submissions, partner review action, private storage | Clarification/more-evidence actions, 12h auto-confirm, withdraw, AI "Looks complete/Unsure" hint, auto-proof from Zen/sessions | Medium: review path shared with Trust |
| 7 Work Together | Co-focus table (empty), existing focus sessions | 25/50/75 timer, goals, end check-in, schedule, star, punctuality into Trust 30% | Low |
| 8 Losing focus | Free-text + mic composer | Panic action, 3/day limit, 5-min sprint | Low |
| 9 Pair streak/rest | Personal streak + milestones | Pair streak, 3/7/14/30 celebration, 2 rest days/month for 20 coins | Must not touch personal streak/seals |
| 10 Recovery | 15-min Comeback, 5–10 min restart (planned) | Reduce, Reschedule, Pause, "Recovered" label | Comeback rewards preserved unchanged |
| 11 Daily check-in | Check-in nudge | 4-question check-in + cheers | Low |

## Presence
- Exists: realtime is enabled; no presence or last-seen today.
- Plan: private presence table (last seen, in-session flag, show-status setting default ON, appear-offline). Heartbeat every 45s only while app visible; read only via a server function that returns status to accepted partners (and squad members later). Online = within 2 min, In a session, Last seen X ago, Offline after 24h, "Status hidden" when off. No notifications, no pressure copy.
- Tests: expiry after missed heartbeats, hidden respected, non-partner refused.

## Files / tables
- Files: Accountability section + new components under the same folder, NudgeListener (panic/check-in text only), one test file per rule.
- Tables: reuse connections, invites, contracts, proof, recovery, events, ledger, Phase 1 tables; add only presence, match queue, pair-streak/rest days, role/visibility columns.

## Order
Show SQL → you approve → apply → build Design + Tier 1 + Presence → tests → screenshots. Tier 2/3 only after Tier 1 is confirmed.
