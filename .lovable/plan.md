## Backend and Phase 2 preflight (read-only report, nothing changed)

**Backend**
- Sign-in and data both use Lovable Cloud. There is no connection to a separate Supabase account you own.
- The preview, the published site (axonhabit.app) and the app's extra connection points all use this same Lovable Cloud backend.
- The internal project address is not shown here. You can open it with View Backend.
- So the app is not using your external Supabase project.

**Phase 2 preflight**
- `acct_pact_advance(uuid)`: does not exist yet.
- `acct_cofocus_advance(uuid)`: does not exist yet.
- `acct_sweep()`: does not exist yet.
- pg_cron: installed (version 1.6.4), so the background job can be scheduled.

**Next step (only with your approval)**
- Run the Phase 2 migration exactly as you reviewed it. Nothing has been run yet.
