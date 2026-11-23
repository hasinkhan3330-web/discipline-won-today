# Preview unstyled screens: diagnosis result (no edits)

## Decision
Option C. Nothing in the project is wrong. Preview's own page bundler drops every screen style file. No files will be changed.

## Evidence (checked 23 Nov, read-only)
- a) Since before "Added landing mobile CSS" (commit 7d876e8): vite.config.ts, package.json, lockfile, root page shell and src/styles.css have zero changes. Only LandingPage.tsx (1 import + 1 class) and its new style file changed. The last package change (Capacitor plugins, earlier) does not touch styling.
- b) vite.config.ts uses the standard Lovable config with no custom CSS settings.
- c) LandingPage.tsx has exactly one style import, `./landing-mobile.module.css`, and that file exists with the same name. The old `landing-mobile.css` import is gone. No stale import.
- d) Preview at "/" and "/alarm" (390px): the only stylesheet requested is src/styles.css. No screen style file is requested or injected.
- Root cause: Preview's bundled page file (`/@oj-start/routes-*.js`) turns the landing style file into only its class names (`{ root: "_root_evcnx_3" }`) and leaves out the style rules. The same happens to alarm.module.css. Preview's server does serve the file correctly when asked directly, but the bundle never asks for it.
- Dev server log: no CSS errors.
- Production build output (dist) contains the phone rules, including stacking the hero buttons. Live phone test on axonhabit.app is not done yet.

## Next step for you
Wait for the Lovable team to fix Preview (already reported with this evidence). Then reply "check Preview" and the 360/390/412/430/1280px test runs again.

## Optional (only with your approval)
Option B workaround for the landing page only: copy the phone rules into the main stylesheet as one marked block under @media (max-width: 640px) and remove the module import. Changes 2 files. Alarm and other screens would still look plain in Preview until the platform fix.

## Approved: Option B (landing page only)
1. src/styles.css: add one marked block at the very end, wrapped in `@media (max-width: 640px)`, with the rules copied from landing-mobile.module.css. Each selector starts with an `.axl-` class (for example `.axl-page .axl-cta-row`). No bare element selectors at the start, no !important. Existing lines stay exactly as they are.
2. src/components/landing/LandingPage.tsx: remove the import line. **Needed with it:** line 42 uses that import (`axl-page ${m.root}`), so removing only the import breaks the build. That line becomes `className="axl-page"`. This is the same file, and nothing changes visually.
3. landing-mobile.module.css stays where it is, unused, so no other file changes.
4. Check: 360/390/412/430px in Preview (buttons stacked full width, no sideways scroll), 1280px screenshot compared with before, production build has the rules.
