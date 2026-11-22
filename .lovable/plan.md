# Fix: tapping Simple in Appearance does nothing

Scope: only `src/components/AppearanceSwitcher.tsx` and `src/lib/theme/theme.tsx`. No redesign, no database, no other files.

## What the code shows now (read this turn)
- The switcher lists both Dark and Simple, and each tap calls `setTheme(id)`.
- `setTheme` saves `axen-theme`, sets `data-theme="simple"` on the page (or removes it for Dark) and updates its state. `ThemeProvider` wraps the whole app in `__root.tsx`.
- New visitors default to Dark (restored earlier today).
- So the tap path looks right on paper. The cause is not confirmed yet.

## Step 1: reproduce before changing anything
- In the preview at 390px, open the Appearance sheet with real touch taps (not mouse clicks), tap Simple and then Dark, and record: the saved `axen-theme` value, `data-theme` on the page, and whether the checkmark moves.
- Also check the published site. It still runs the build you published by accident, and today's Dark-default fix only reaches it after the next Publish. If the bug only happens there, the fix is to Publish, with no code change.

## Step 2: fix only what Step 1 finds, in the two files
- If taps don't reach the buttons: make each option respond to a touch tap directly (one handler, no double firing). Keep the 44px targets and the same look.
- If the theme gets re-applied as Dark after the tap (for example the provider re-reading storage, or the startup script fighting the choice): make `setTheme` the only writer after startup, so the choice applies right away and is read back on reload.
- Keep: Dark is the default when nothing is saved, and an explicit choice always wins.

## Step 3: verify
- Tap Simple: the page turns Simple, `axen-theme='simple'`, and it stays Simple after reload. Tap Dark: the same, the other way round. A fresh visit shows Dark.
- Show the diff, then stop.
