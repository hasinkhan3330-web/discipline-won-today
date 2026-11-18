# Accountability: styling-only check of all 8 screens

Screens 6–8 (Focus garden, Proof history, Recovery) are already built. This plan covers only the remaining check.

## Scope
Check all 8 Accountability screens in Dark and Simple at 360, 390 and 414px:
1. Home  2. Options menu  3. Daily check-in  4. New pact  5. Check-ins  6. Focus garden  7. Proof history  8. Recovery

Fix only:
- Contrast: text and icons readable against their background (WCAG AA)
- Focus: visible focus ring on every button, chip, switch and link
- Labels: icon-only buttons get an accessible name
- Spacing: no clipping, overlap or sideways scrolling

## Rules
- Styling and labels only. No behavior or logic changes, especially on screens 3–5.
- Changes stay in the Accountability files and their own style module. No global styles, tokens or other tabs.
- No database changes, no dependencies, no test that creates accounts.
- While checking, every save, send and submit is blocked. Nothing is written to the real account.
- The 3 test accounts stay untouched.

## Technical details
- Files: `src/components/verified/acct/acct.module.css`, plus `aria-label` additions in `AcctUI.tsx`, `AcctScreens.tsx`, `PartnerHistory.tsx` and `AccountabilitySection.tsx` where needed.
- Check by script with the write requests blocked, then run the existing tests (vitest acct-datetime plus the bun theme tests; never accountability-rebuild.test.ts).

## Final report
Files changed, what passed, what could not be tested.
