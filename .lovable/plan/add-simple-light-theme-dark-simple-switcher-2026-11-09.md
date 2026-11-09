# Add "Simple" light theme + Dark/Simple switcher

Dark stays the default and stays exactly as it is now. The only change you'll see in Dark is a new small arrow button on the right side of the Command Center header on Home. Simple is a separate light look, styled like your screenshots: off-white background, white cards, black pills and rings, color only for status.

## What gets built

1. **Switcher (Home, Command Center header, right side)**
   - A 36px round arrow button (chevron-down) next to the coin badge. Nothing in the header moves or resizes.
   - Tapping it opens an "Appearance" bottom sheet (a centered dialog on wide screens) with two cards: **Dark – Neon focus** and **Simple – Clean & light**, each with a small phone preview.
   - Tapping a card applies the look instantly, saves it on this device and closes the sheet after 250ms. The arrow flips while the sheet is open. Both looks are free for everyone.

2. **Saved choice, no flash**
   - The choice is saved on the device ("axen-theme"), with no database changes. A tiny early script applies it before the app draws, so you never see the wrong look flash on load.
   - Simple also turns the phone's browser bar, scrollbars and pickers light. Dark keeps all of its current settings.

3. **Simple look across every screen, in this order**
   - A. Shell: subscription strip, header, coin pill, bottom nav
   - B. Home
   - C. Rank: Leaderboard, verified list and seal cards all get Simple white cards with hairline borders. Only the seal artwork itself keeps its colors.
   - D. Zen
   - E. Coach: orb screen, text sheet, quick setup, plan panel. Only colors change; voice and audio code are not touched.
   - F. Stats
   - G. You
   - H. Alarm and its ringing/mission screens
   - Shared pieces come first, before any screen: buttons, cards, chips, rings, nav, inputs, sheets, charts and all shared ui controls.
   - Accountability matches your screenshot 1:1.
   - Images, illustrations and emblem tiles with dark backgrounds get a light version, for example the rank emblem box in the Daily Motivation card. No dark boxes on light.
   - I. Everything else: Accountability, Contract card/sheet, Goals, Habits, Paywall/Pricing, Onboarding, sign-in/sign-up/reset pages, legal pages, Deep Focus, every dialog, sheet, toast and popup, plus empty, loading and error pages
   - Colors, sizes, radii, type and component rules follow your spec exactly (Canvas #F5F5F3, Ink #111, Inter only inside Simple, and so on).

4. **Final sweep**: search for every leftover dark-only color, glow and gradient, and give each one a Simple version.

## How Dark stays frozen

- Every Simple rule only applies when the page is set to Simple. Existing Dark classes, CSS and literal colors are never edited or swapped. Simple overrides are added next to them, so Dark's output does not change.
- The arrow button is the only new thing in Dark.

## Verification

- Before and after screenshots of each main tab in Dark at 390px, compared pixel by pixel. They should be identical apart from the arrow.
- Screenshots of every reachable screen in Simple at 360x800 and 390x844, checking for horizontal scroll, clipped text, dark boxes and unreadable text.
- Choice survives a page reload, with no flash. Switching back to Dark restores everything. No console errors.
- A small test for the saved setting: default is Dark, the choice persists, and unknown values fall back to Dark.

## Technical details

- `src/lib/theme.tsx`: ThemeProvider and `useTheme()` set `<html data-theme>`. No attribute means Dark. An inline script runs first in `__root.tsx` head; the app has no `class="dark"` to handle.
- `src/styles.css`: `@custom-variant simple (&:where([data-theme=simple], [data-theme=simple] *))`, plus a `[data-theme="simple"]` token block (--background, --card, --primary, etc. in oklch, plus the new tokens surface-2/3, ink-2..4, success, warning, danger, info, banner, overlay and shadows). Inter loads with a `<link>` and is applied only under Simple.
- Per-screen overrides: `[data-theme="simple"] .class {}` rules in `styles.css`, and `:global([data-theme="simple"]) .x` inside the existing CSS modules (coach-orb, acct, contract-visuals, zen, missions, coin-badge). `simple:` classes for hardcoded Tailwind colors in TSX. Existing Dark values are left as they are.
- Canvas/SVG color users (OrbCanvas, NeuralWaveCanvas, SpaceWallpaper, ZenMandalaScene, charts, EclipseHero) read `useTheme()` and pick Simple colors only when Simple is on. SpaceWallpaper and other dark backgrounds are hidden or swapped for flat Canvas in Simple.
- Inline `style={{color/background}}` values and SVG `fill`/`stroke` literals can't be overridden by CSS. Each one is switched with `simple:` classes or a `useTheme()` choice, and the Dark literal stays as the default branch.
- Any new test uses the existing bun:test and Playwright setup, with no new dependencies.
- `theme-color` meta is #F5F5F3 in Simple; the Dark value is unchanged.
- Cross-fade: a `theme-switching` class is added for 250ms on user action only, and is turned off under reduced motion.
- Not touched: auth, database, server functions, payments, Coach/Gemini Live logic, alarms, planner, rewards, routes, copy.
- Each Simple screen needs many overrides (about 155 color literals in styles.css, plus about 50 files with hardcoded colors). I'll work in the phase order above and list anything left unfinished at the end.
