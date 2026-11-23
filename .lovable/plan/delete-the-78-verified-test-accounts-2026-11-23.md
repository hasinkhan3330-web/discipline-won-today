# Delete the 78 verified test accounts

## Checks already done (read-only)
- Exactly 78 accounts match the strict test format (`acct-test-` or `coin-test-` + id + `@example.com`), the same 78 shown earlier.
- No shared records with real users: 0 mixed friendships, pacts, partner links, partner events, nudges or accepted invites.
- 0 real users were referred by a test account.
- Test accounts have 0 payments, 0 subscriptions and 0 contracts.

## Steps
1. Backup: I can't see backups from here. Before I delete anything, open More → Database → Manage → Backups and confirm the newest backup is from today. You can also export a full copy first.
2. Lock the targets: compare the live list against the exact 78 emails and user ids shown earlier. If even one is different, stop.
3. Run the shared-record check again just before deleting. If any real user's data is linked, stop and report.
4. Delete each test account's own rows in tables that don't clean up automatically (for example coach, plan, accountability check-in, wake and partner event rows), using those exact user ids only.
5. Delete the 78 accounts. Their profile, tasks, coins, alarms and other linked rows are removed automatically.
6. Confirm: 0 test accounts left, 0 leftover rows, and the same number of real users.

## Technical details
- The target set is a fixed list of 78 UUIDs, not a pattern.
- Foreign-key cascades only reach rows owned by those UUIDs. For two-person tables, the check found no row linking a test account to a real user.
- Only data changes. No schema, policy, function, code or design changes.
