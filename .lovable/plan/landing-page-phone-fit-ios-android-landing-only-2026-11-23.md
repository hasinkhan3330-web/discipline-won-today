# Landing page phone fit (iOS + Android) — landing only

Scope: only the public landing page at "/" when signed out. No change to Home, Rank, Zen, Coach, Stats, You, alarm/4AM, sign-in, database, text, colors, fonts, images, order, or desktop (768px and up stays identical).

## What changes on phones (below 640px)
- Sections: less empty space — section padding about 32–40px, heading-to-content gap 16–20px, final call-to-action box margins reduced.
- Side gutters 16px, with safe side/bottom padding for notched phones on header and footer.
- Feature, Why AXEN and Pricing cards: 16px padding, 12px gap, icon 40px, text 14–15px.
- "Inside the app" screenshots: keep the swipe row; each card snaps to center, width min(72vw, 260px), 12px gap, the full screenshot is visible (no cropping, so "Home" and "You" labels show), captions wrap.
- Hero: full-screen height uses dvh/svh with vh fallback; buttons stay as they are, at least 48px tall.
- iOS: stop automatic text enlargement, add the Safari blur prefix on the top bar, smooth momentum swipe on the screenshot row.
- Android: checked at 360px; tap targets at least 48px.

## Technical details
- Only file: `src/styles.css`, adding rules inside the existing marked landing block at the end (`@media (max-width: 640px)`), every selector starting with `.axl-page`. That is the only place landing styles load in Preview. Plus one `-webkit-backdrop-filter` added to the `.axl-nav` rule (no visual change on desktop; same blur).
- Screenshots: `.axl-shot img` gets `object-fit: contain` on phones inside the same frame ratio, so nothing is cut.
- No `viewport-fit=cover`, no root/index changes, no new packages, no Tailwind class edits in other files.

## Verification
- Preview "/" at 360, 390, 430px: no sideways scroll, no clipped text, nav labels visible in screenshots, buttons stacked.
- 768px and 1280px screenshots compared before/after: identical.
- Build log clean.
