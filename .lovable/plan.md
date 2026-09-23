# Connect Supabase Staging Alongside (Preview Uses Staging)

## Goal
Add the user's own Supabase staging project as a second backend. The current Lovable Cloud backend stays untouched and production keeps using it. The preview app gets a safe way to run against staging for Verified Discipline testing.

## Key constraints (checked against the project)
- `src/integrations/supabase/client.ts` and `.env` are auto-generated — they will NOT be edited. Production stays on the current backend automatically.
- Publishable/anon keys are safe in frontend code; still stored via env, never hardcoded.
- Additive only: no changes to existing UI, theme, routes, auth flows, or business logic.

## Steps

1. **Collect credentials securely (one at a time, as requested)**
   - `secrets--add_secret` for `STAGING_SUPABASE_URL`, then separately for `STAGING_SUPABASE_ANON_KEY` — values go straight into the encrypted store, never through chat.

2. **Frontend env vars (preview only)**
   - Add `VITE_STAGING_SUPABASE_URL` and `VITE_STAGING_SUPABASE_ANON_KEY` to `.env.development` (preview builds only; `.env.production` and auto-gen `.env` untouched, so the published app cannot see staging).

3. **New staging client module (additive)**
   - `src/integrations/supabase/staging-client.ts`: creates its own Supabase client from the staging env vars, with its own auth storage key so staging and Cloud sessions never mix.
   - Existing `client.ts` remains the default everywhere.

4. **Staging switch**
   - A small helper (`src/lib/staging.ts`): staging activates only in the preview when explicitly enabled (e.g. `?staging=1` URL flag, remembered in sessionStorage). Without the flag, everything behaves exactly as today — zero regression.
   - A tiny badge/banner shows "STAGING BACKEND" when active so you always know which backend you're on.

5. **Verification**
   - Confirm production/preview default path unchanged (flag off → current backend).
   - Flag on → auth + data reads hit the staging project.
   - Note: staging must have the AXEN schema (migrations) applied on your side; Phase 1 SQL can then run against staging.

## What this does NOT do
- Does not modify, delete, rename, reset, or overwrite the existing production backend or its data — all work targets only your AXEN Staging project.
- Does not modify GitHub main/production configuration or the published app.
- Does not request or expose service_role keys, database passwords, or access tokens — only the publishable anon key, which is safe for frontend use by design.
- All staging database changes (later phases) will be forward-only, reversible, and tested on staging first.
- Does not apply any Phase 1 migration yet (that comes after, against staging only).
