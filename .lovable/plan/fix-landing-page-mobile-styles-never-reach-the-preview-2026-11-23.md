# Fix: landing page mobile styles never reach the preview

## What I found (checked this turn, nothing changed yet)

- Preview server: running, no build errors, no runtime errors, no failed requests. A fresh load of `/` returns the landing page at 360, 390, 430 and 1280px with no console errors.
- Pending draft: "Draft 6" has no changes and is behind the main project. It is not the cause.
- **First root cause:** the earlier mobile fix added `landing-mobile.css` as a plain side-effect import (`import "./landing-mobile.css"`). The preview's dev server drops this kind of import: its log says the file "matched no module", and the browser loads only `styles.css`. At 390px the buttons are still side by side (`flex-direction: row`), so none of the mobile rules apply. Every other screen uses `*.module.css` files, and those load correctly.
- The earlier "desktop identical" check passed only because the file never loaded at any width.
- `/alarm` without styling (your screenshot): `alarm.module.css` is served normally (HTTP 200). That page needs sign-in, and I can't test it without creating an account, so I can't confirm why your tab showed it unstyled. I won't change it.

## Fix (landing page files only)

1. Rename `src/components/landing/landing-mobile.css` to `landing-mobile.module.css`. Keep the same 28 rules and the same `@media (max-width: 640px)` block. Each selector gets scoped under one local root class, for example `.root :global(.axl-cta-row)`.
2. In `src/components/landing/LandingPage.tsx`, change the import to `import m from "./landing-mobile.module.css"` and add `m.root` to the outer `<div className="axl-page">`.

Nothing else changes: no `styles.css`, no root file, no `/alarm`, no other page, shared component, database or sign-in. There's no `index.html` in this project, and the viewport tag stays as it is, as you decided earlier.

## Verification (before reporting)

- Read the newest build log entry, and run the typecheck if no entry appears.
- Fresh headless load of `/` at 360, 390, 412 and 430px: confirm the mobile rules are live (buttons stacked, `flex-direction: column`), no horizontal scroll, no console errors, no failed requests.
- 1280px: compare screenshots before and after. Desktop must be identical, because every rule sits inside the 640px media query.
- `git status`: only the two landing files changed.
- Report the exact results. If the module file also fails to load, stop and report it as a platform blocker instead of trying other changes.
