# Delete the 78 test accounts

## What happens
- Remove exactly the 78 accounts listed earlier: 3 `acct-test-…@example.com` (Nov 18) and 75 `coin-test-…@example.com` (Nov 23).
- Remove the data that belongs only to those accounts, such as profile, coins, tasks and alarms.
- Real users and app features stay exactly as they are. No design, code or settings change.

## Steps
1. Re-count first: the match must be exactly 78, all ending in `@example.com` and starting with `acct-test-` or `coin-test-`. If the count is different, stop and report.
2. Find every app table with a user id column and count the rows these 78 accounts own.
3. Delete those rows, then delete the 78 accounts.
4. Check again: 0 test accounts left, 0 leftover rows, and the number of real users unchanged.

## Technical details
- The match uses the exact 78 user ids collected in step 1, not a broad pattern.
- Rows linked by foreign key are removed by cascade. Rows in other tables are deleted explicitly by user id.
- The deletes run as data changes, not schema migrations. Nothing in tables, policies or functions changes.
