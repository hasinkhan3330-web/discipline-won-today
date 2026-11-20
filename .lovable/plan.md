# Secret scan result and plan

## Scan result (code, config, env files, Android, migrations, tests, docs)

| File | Service | Type | First 4 |
|---|---|---|---|
| .env (VITE_SUPABASE_PUBLISHABLE_KEY, SUPABASE_PUBLISHABLE_KEY) | Lovable Cloud publishable key | Public, safe | sb_p |
| .env (project id, URL) | Lovable Cloud address | Public, safe | nfmg / http |
| .env.development (VITE_PAYMENTS_CLIENT_TOKEN) | Payments, test publishable key | Public, safe | pk_t |
| .env.production (VITE_PAYMENTS_CLIENT_TOKEN) | Payments, live publishable token | Public, safe | live |
| android/keystore.properties.example | Android signing placeholders ("CHANGE_ME") | Not real, safe | — |
| src/routes/index.tsx:265 | "current-password" is a browser autofill hint, not a password | False alarm | — |

No secret key, private token or password is hardcoded anywhere. Server-only keys (service role, Gemini, payments secret, webhook secrets) are already read from backend secrets at runtime, never from frontend code.

## Plan

1. No files move and no frontend code changes, because there are no secret keys to remove.
2. No key needs to be revoked or regenerated.
3. Keep the real Android keystore.properties and .jks file out of the project, as they are now.

## Technical details

- Scanned patterns: Stripe sk/pk/rk/whsec, Google AIza, JWTs (eyJ…), sb_secret/sb_publishable, GitHub/Slack/Resend/AWS tokens, PEM private keys, and generic api_key/secret/password/token assignments.
- process.env uses in src are only SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and SUPABASE_SERVICE_ROLE_KEY (server-only, injected at runtime).
- Not checked: scheduled-job commands in the database (no read permission from here).
