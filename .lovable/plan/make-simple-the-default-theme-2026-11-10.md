# Make Simple the default theme

Only the "nothing saved" case changes. Saved Dark or Simple choices keep working exactly as today.

## Changes (one file: `src/lib/theme/theme.tsx`)
1. **Startup script (runs before the page is drawn):** turn Simple on unless the saved value is exactly `dark`. That covers new visitors, new sign-ups and cleared storage, and nothing flashes Dark first.
2. **Reading the saved choice:** saved `dark` gives Dark, saved `simple` gives Simple, and nothing saved (or blocked storage) gives Simple. Nothing gets written to storage until the user taps an option.
3. **First value on screen:** starts as Simple, so the Appearance sheet shows Simple selected on first load.
4. Switching between Dark and Simple works and saves the same way as today.

## Not touched
Dark/Simple styles, theme colours, Appearance sheet, auth, database, payments, routes, copy. Splash and Sign-in screens already follow the app-wide theme switch, so they will open in Simple too, with no redesign.

## Verification
- Update the existing theme tests so the "nothing saved" case expects Simple, and add one test that a saved `dark` stays Dark.
- Run typecheck and build.
- Test in a browser three ways: with cleared storage it opens in Simple; choose Dark and reload, it stays Dark; choose Simple and reload, it stays Simple.
- Report anything left unchecked, such as real phones.
