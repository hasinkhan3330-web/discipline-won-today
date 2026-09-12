# Roadmap — AXEN payments & subscriptions

## Done (this pass)
- [x] Removed all third-party payment code from the app: Razorpay order/verify functions, Razorpay webhook route, PaymentOptions, RazorpayPayButton, PayPal leftovers.
- [x] Checkout is store-only: Android → Google Play Billing (RevenueCat), iOS → Apple StoreKit 2 (RevenueCat). Browser build shows "subscribe in the AXEN app" with no external link.
- [x] Monthly ₹99 / Yearly ₹999 plan display with 3-day free-trial copy everywhere.
- [x] Entitlement state server-verified via RevenueCat REST; `trialing` status now mapped from store `period_type: trial`; trial days left shown on profile subscription card.
- [x] RevenueCat webhook endpoint `/api/public/payments/revenuecat-webhook` mirrors store renewals/cancellations into `subscriptions` (guarded by REVENUECAT_WEBHOOK_SECRET).
- [x] Clean typecheck + production build.

## Pending (user / dashboard configuration)
- [ ] RevenueCat dashboard: replace test Android key (`test_xnCGAoUukcDaVpDzpJEpBxtDghu` in src/lib/play-billing.ts) with the real `goog_...` public key; add `appl_...` iOS key via VITE_REVENUECAT_IOS_API_KEY.
- [ ] Play Console / App Store Connect: subscription products with 3-day free trial offer (`dwt_premium_monthly`, `dwt_premium_yearly`).
- [ ] Save REVENUECAT_SECRET_KEY and REVENUECAT_WEBHOOK_SECRET; point RevenueCat webhook at /api/public/payments/revenuecat-webhook.
- [ ] Delete leftover Razorpay runtime secrets (RAZORPAY_KEY_ID/SECRET/WEBHOOK_SECRET) — deletion was interrupted; retry later.

## Later — website checkout (separate web build, NOT this app)
- [ ] User pasted Razorpay live key id + partial secret in chat. Treat as exposed: regenerate in Razorpay dashboard before reuse, then save via secure secret form. Webhook URL for web: .../api/public/payments/webhook (route deleted; re-add when building web checkout).

## UI pass (in progress)
- [x] Paywall/plan display: ₹99/month and ₹499/year only (₹83 card removed), SAVE badge on yearly.
- [x] Dashboard home: denser native-app layout, collapsible Streak shields / Reminders / Deep Focus.

## Requested next
- [x] Roboflow photo detection wired into habit verification (server-side call, key in secrets). Pending: ROBOFLOW_API_KEY.
- [x] Redesign AI Coach as the selected full-screen tech-noir room while preserving live voice, text coaching, and app navigation.
