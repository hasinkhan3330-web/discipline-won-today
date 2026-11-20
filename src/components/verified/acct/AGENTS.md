# Accountability UI rules
- Accountability visuals live only in `src/components/verified/acct/` (CSS module tokens on the screen root); pacts stay rows in `daily_contracts` so Home and Accountability share one source of truth. Why: no leakage to shared styles and no parallel pact system.
- Accountability overlays (menu sheet, confirm dialog, floating New pact) render through a portal with the `.portal` token class from acct.module.css. Why: the You tab wrapper is transformed, so fixed overlays inside it sat under the bottom nav.
- Pact time pickers use tested helpers in `acct/datetime.ts`; `validatePact` stays the single rule source. Why: saved data unchanged.
- Accountability device-only state lives in localStorage `axen.acct.*`; share cards render on a browser canvas. Why: no schema change, no private data leaves the device.
