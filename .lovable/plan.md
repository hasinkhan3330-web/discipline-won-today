# AXEN milestone seals: metallic visuals and automatic coin unlocks

## Scope and confirmed findings
Change only the seals on the five Streak Milestones circles. Preserve circle layout, labels, surrounding Stats content, every other screen, badges beside names, and coin-based Rank verification badges.

`StatsTab.tsx` currently uses best-streak days to show these badges through the shared `StreakBadge`. Your clarification replaces eligibility for milestone-circle seals only with coin thresholds. Day numbers remain milestone labels, not awarded streak days.

The existing `claim_streak_milestones` checks real consecutive history and awards coin bonuses. Leave it unchanged: coin-based seal unlocking must not call it or award any coins/XP. `unlock_rewards` already provides unique user/key records and owner-only reads, but owner INSERT/UPDATE policies need a narrow guard for new server-only seal records.

The live aggregate query currently shows 13 profiles below 350 and none above. Backfill will use actual balances at implementation time, without changing any user data or balances.

## Automatic unlock rules
| Profile coins reached | Milestone circle | Metallic seal |
|---|---|---|
| 350 | 7 days | Dark Bronze |
| 1,050 | 21 days | Dark Silver |
| 5,000 | 100 days | Dark Gold |
| 14,500 | 290 days | Dark Amethyst |
| 18,250 | 365 days | Dark Diamond |

- Below 350: no seal, regardless of streak. Coins alone qualify these seals.
- Higher balances unlock all qualifying lower seals too.
- Automatically record unlocks on the server when coins reach thresholds; no claim button or manual grant.
- Backfill existing qualifying accounts once, idempotently, before enabling the display.
- Earned seals remain earned if the balance later decreases. Existing streak rewards and Rank badge logic remain untouched.
- Read confirmed unlocks on app open and after coin updates, so eligible users see seals immediately without claiming.

## Exact milestone-only SVG styling
Create a dedicated inline SVG seal; leave `StreakBadge.tsx` and `RankCoinBadge.tsx` unchanged. Use the screenshot as reference only, not as an image asset.

- Scalloped seal body with diagonal top-left → bottom-right gradient: highlight 0%, tier 40%, deep shadow 72%, tier 100%.
- Rim: 1.4px gradient stroke, light rim → deep shadow.
- Gloss: duplicate seal path, white gradient at 60% opacity in the top-left, zero at the midpoint.
- Inner rings: r=16.5 black 35%, r=15.5 white 35%.
- Filled check: white → #E6DBC0 gradient, soft black 55% shadow with dy 0.8 and blur 0.5.
- Outer glow: drop-shadow(0 0 4px tierGlow).
- Keep the seal touching the circle’s top-right edge and preserve accessible labels without resizing the circle layout.

| Tier | Highlight | Tier | Deep shadow | Rim light | Glow |
|---|---|---|---|---|---|
| Bronze | #E8AC74 | #8C5A2B | #3E200C | #F0B98A | rgba(205,127,50,.55) |
| Silver | #E2E7EF | #7B8491 | #30353F | #EEF1F6 | rgba(190,200,215,.5) |
| Gold | #FBE08A | #A87C00 | #4A3500 | #FFE9A0 | rgba(245,197,24,.55) |
| Amethyst | #C4AEFF | #6A3FD0 | #25106A | #D6C6FF | rgba(140,100,255,.6) |
| Diamond | #A8F3FA | #11808F | #032E36 | #C9FAFF | rgba(60,196,212,.7) |

Diamond is teal, not blue: dashed outer halo, exactly two sparkles, and strongest glow pulsing slowly over 2.4 seconds from 3px to 10px.

On unlock, play one white diagonal-band shine sweep for 0.8 seconds. Track presentation separately from entitlement so rerenders, tab switching, and reloads do not replay it. Disable sweep and pulse under prefers-reduced-motion.

## Technical implementation
- Reuse `unlock_rewards` with isolated `milestone_seal_*` keys, never `streak_*`; no new tables or changes to reward ledgers.
- Add a server-only reconciliation helper and profile coin-change trigger, plus authenticated own-seal read/presentation operations. Pin safe search paths, derive identity from auth, and use the existing unique constraint for concurrency/idempotency.
- Add a narrowly scoped validation trigger blocking client insertion, mutation, deletion, or key-renaming into/out of seal records. Preserve unrelated unlock policies and guards.
- Apply function/trigger/grant changes through a migration only after approval. Run the data-only backfill separately through the database data tool.
- Add `src/components/MilestoneSeal.tsx` and a small milestone-only constants/data helper; do not change shared milestone tones used by other screens.
- Update only seal eligibility/rendering in `src/tabs/StatsTab.tsx`; add scoped semantic color/glow tokens and seal styles in `src/styles.css`.
- Minimal wiring in `src/routes/_authenticated/dashboard.tsx` to read/refresh server seals and pass them to Stats, without changing other screen rendering.
- Add focused tests and update `AGENTS.md` and `roadmap.md` during implementation.

## Tests and acceptance
- Concrete boundary tests: 349/350, 1,049/1,050, 4,999/5,000, 14,499/14,500, 18,249/18,250.
- Low streak + qualifying coins unlocks; high streak + fewer than 350 coins does not.
- Multi-tier unlock, backfill repeated twice, concurrent requests, reopening, and balance decrease preserve correct permanent records.
- Client forgery/other-user access denied; seal operations change zero coins, XP, streak days, or economy ledger rows.
- Signed-in real-app threshold crossing, followed by reading the seal back in Stats; delete only temporary test data.
- Screenshots at 360, 390, and 430px: all five seals, top-right circle contact, unchanged spacing, no clipping or overlap, unique SVG IDs, one-time sweep, diamond pulse, reduced motion.
- Run new and relevant existing tests; inspect preview compilation and browser errors. Report every changed file and any limitations.

No publication, deployment, redesign, or unrelated changes.
