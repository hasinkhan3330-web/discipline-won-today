# Roadmap — AXEN payments & subscriptions

## Done (this pass)
- [x] Removed all third-party payment code from the app: Razorpay order/verify functions, Razorpay webhook route, PaymentOptions, RazorpayPayButton, PayPal leftovers.
- [x] Checkout is store-only: Android → Google Play Billing (RevenueCat), iOS → Apple StoreKit 2 (RevenueCat). Browser build shows "subscribe in the AXEN app" with no external link.
- [x] Monthly ₹99 / Yearly ₹499 plan display with no free-trial offer.
- [x] Entitlement state server-verified via RevenueCat REST; only paid subscription periods unlock PRO.
- [x] RevenueCat webhook endpoint `/api/public/payments/revenuecat-webhook` mirrors store renewals/cancellations into `subscriptions` (guarded by REVENUECAT_WEBHOOK_SECRET).
- [x] Clean typecheck + production build.

## Pending (user / dashboard configuration)
- [ ] RevenueCat dashboard: replace test Android key (`test_xnCGAoUukcDaVpDzpJEpBxtDghu` in src/lib/play-billing.ts) with the real `goog_...` public key; add `appl_...` iOS key via VITE_REVENUECAT_IOS_API_KEY.
- [ ] Play Console / App Store Connect: remove introductory free-trial offers from `dwt_premium_monthly` and `dwt_premium_yearly`.
- [ ] Save REVENUECAT_SECRET_KEY and REVENUECAT_WEBHOOK_SECRET; point RevenueCat webhook at /api/public/payments/revenuecat-webhook.
- [ ] Delete leftover Razorpay runtime secrets (RAZORPAY_KEY_ID/SECRET/WEBHOOK_SECRET) — deletion was interrupted; retry later.

## Later — website checkout (separate web build, NOT this app)
- [ ] User pasted Razorpay live key id + partial secret in chat. Treat as exposed: regenerate in Razorpay dashboard before reuse, then save via secure secret form. Webhook URL for web: .../api/public/payments/webhook (route deleted; re-add when building web checkout).

## UI pass (in progress)
- [x] Paywall/plan display: ₹99/month and ₹499/year only (₹83 card removed), SAVE badge on yearly.
- [x] Dashboard home: denser native-app layout, collapsible Streak shields / Reminders / Deep Focus.
- [x] You/Profile: reference-matched cosmic dashboard with functional Journey, Achievements, Habits, Goals, Reminders, Statistics, and Account views.
- [x] Habits and goals persist in Lovable Cloud and synchronize through the existing completion reward flow.

## Requested next
- [x] Roboflow photo detection wired into habit verification (server-side call, key in secrets). Pending: ROBOFLOW_API_KEY.
- [x] Redesign AI Coach as the selected full-screen tech-noir room while preserving live voice, text coaching, and app navigation.
- [x] Remove coach-scene branding overlays and add immediate Gemini voice interruption with bounded audio playback.
- [x] Upgrade Zen Mode with three uploaded meditation tracks, circular progress, waveform motion, looping, volume, and haptic playback controls.
- [x] Add the supplied golden meditation scene with timer-synchronized mandala rotation, chakra glow, exact pause/resume, and cinematic stop.
- [x] Rebuild Stats from the supplied futuristic mobile reference while preserving live user data and navigation.
- [x] Rebuild Rank from the supplied reference with live rank metrics, interactive details, coin rewards, and usable unlockable themes.
