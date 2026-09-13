# Remove the free trial

## Changes
- Remove every visible “3 days free” and trial-status message from pricing, paywall, and account screens.
- Change premium access to require an active paid store subscription; existing trial dates will no longer unlock Pro features.
- Remove development trial simulation and trial-only UI components from active app flows.
- Add a database migration that disables app-managed trials while preserving existing paid subscription and billing behavior.
- Verify the app type-checks and the pricing/auth screens no longer mention a free trial.

## Technical details
- Keep the existing monthly/yearly plans and native store checkout unchanged.
- Store-reported trial states will not grant entitlement; only active paid subscription records will grant Pro access.
- Historical trial columns may remain for migration compatibility, but they will be ignored and cleared.
