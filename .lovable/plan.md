# Mobile layout fix — public landing page only

## What I found
- The landing page's styles currently live inside the shared app stylesheet (`src/styles.css`, the `axl-*` block). You asked me not to edit global CSS, so I will **not** touch that file.
- There is no `index.html` here; the screen setting lives in `src/routes/__root.tsx`: `width=device-width, initial-scale=1`. **`viewport-fit=cover` is missing.** So I will add no new safe-area padding unless you approve that change (asked separately). The footer already has a bottom safe-area value from the earlier build; I'll leave it as is.
- The landing wrapper already uses a landing-only `overflow-x: clip`. No global overflow rule will be added. I'll find and fix whatever element is actually too wide.

## Files I will change (only landing-owned)
1. `src/components/landing/landing-mobile.css` — **new**, used only by the landing page. Every rule sits inside `@media (max-width: 639px)`, so desktop stays exactly the same.
2. `src/components/landing/LandingPage.tsx` — one added line: `import "./landing-mobile.css";`. No markup, text, class or order changes.

No other file changes.

## Phone rules (360–430px), all below 640px
- `.axl-hero`: `min-height: 100vh; min-height: 100svh;`, `align-content: start`, padding and gap via `clamp()`, smaller phone mockup (`.axl-phone` width with clamp) so the H1, lead text and CTA row show without scrolling.
- `.axl-cta-row`: smaller top margin and gap via clamp (buttons themselves unchanged).
- `.axl-section`, `.axl-final`, `.axl-grid`, `.axl-benefits`, `.axl-prices`: padding, margins and gaps via `clamp()` so the page gets much shorter.
- Features `.axl-grid` and "Why AXEN" `.axl-benefits`: 2 columns, smaller card padding and icon size; single column again below about 370px if text gets cramped.
- "Inside the app" `.axl-shots`: keep horizontal swipe and scroll-snap, frame width `clamp(150px, 46vw, 200px)`, side padding plus `scroll-padding` so the first/last frames aren't clipped.
- `.axl-prices` / `.axl-price`: one full-width column, slightly tighter padding, readable text.
- Nav: keep both buttons, just tighter spacing so they fit at 360px.

## Checks
- Playwright at 360, 390, 412, 430: no sideways page scroll (`scrollWidth === innerWidth`), CTA buttons inside the first screen, swipe row frames not cut off, page height before vs after.
- 1280 desktop: screenshot before and after must match exactly.
- Build check clean.
