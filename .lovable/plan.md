# AXEN Landing Page — Phone fit (iOS Safari + Android Chrome)

Sirf logged-out landing page "/" badlega. Home, Coach, Zen, Rank, Alarm, You, sign-in, database, coins, checkout — kuch nahi chhuega. Colors, fonts, copy aur section order same rahenge (sirf jo aapne list kiya woh copy change).

## Kya badlega (phone par)

**A) "Inside the app" carousel**
- Ek naya `PhoneMockup` (sirf landing ke liye) — sab 6 slides same width, 9/19 ratio, same rounded frame aur bezel.
- Phone par mockup chhota: screen width ka ~76%, agla slide ~12% dikhega (peek).
- Scroll-snap center, smooth touch swipe, scrollbar hidden, page ka horizontal scroll nahi.
- 6 dots neeche, active dot lime, tap karke slide pe jaate hain (44×44 tap area).
- Caption: title 16px/600, subtitle 13px readable grey (AA contrast), max 2 lines, "..." nahi.
- Image flaws: 4AM shot ke upar "YOU RISE?" ghost text ko object-position/scale se crop karne ki koshish; jo CSS se theek na ho, unki file list final reply mein.

**B) Hero**
- Hero text + buttons phone par compact; hero phone mockup bhi wahi `PhoneMockup`, chhota size (website jaisa bada nahi).
- "Sign in with Google" ek asli outlined button: full width, 48px, Google "G" icon — existing sign-in hi kholega.
- "Android app + web" ke neeche: "Works on iPhone in your browser".

**C) Pricing**
- Monthly button: "Get Started" → "Get PRO". Free = "Start free trial", Yearly = "Get PRO".
- "Best Value · Save 58%" badge 320px par na kate, na price par chadhe.

**D) Spacing / text**
- Har section same padding: phone 64px (py-16), desktop 96px (py-24) — Features/Why AXEN/Pricing ke beech ka extra gap hatega.
- Body text min 15px, secondary 13px, line-height 1.5.
- Header logo 28px+, Sign In / Get Started 44px height, kabhi wrap nahi.

**E) iOS/Android hardening (landing ke andar hi)**
- 100vh fallback + 100dvh.
- Sticky header aur footer mein safe-area padding.
- Text-size-adjust 100%, blur ke saath -webkit- prefix, buttons par tap-highlight transparent + touch-action manipulation.
- Horizontal scroll ka asli element fix; landing root par `overflow-x: clip` (poore app ke body par nahi).
- Header address-bar collapse par jump na kare.

## Do safety decisions (aapke "app mein kuch nahi badle" rule ki wajah se)
1. **viewport-fit=cover**: viewport tag poore app ka shared hai. Ise globally badalne se Android app/Capacitor screens ke kinare badal sakte hain. Isliye sirf landing page khulne par yeh tag lagega aur bahar jaate hi purana wapas — app screens par asar nahi.
2. **body { overflow-x: hidden }**: global body poore app ko affect karta hai, isliye yeh landing ke root par hi lagega.

## Verify
Playwright 320/360/390/412/430 + 1280: no horizontal scroll, mockups same size aur bottom crop nahi, snap + dots, tap targets ≥44px, badge not clipped. Build check. Reply mein har checklist item ka PASS/FAIL + re-export wali image list.

## Technical details
- Files: `src/components/landing/LandingPage.tsx`, naya `src/components/landing/PhoneMockup.tsx`, `src/styles.css` mein sirf end par naya `.axl-` block append (existing lines untouched — CSS modules Preview mein load nahi hote).
- Dots: scroll listener + IntersectionObserver, `scrollIntoView({inline:"center"})`.
- Viewport: LandingPage `useEffect` mein `meta[name=viewport]` content set/restore.
- Inputs: landing par input nahi hai; rule `.axl-page input` 16px ke saath add.
- Koi naya package nahi.
