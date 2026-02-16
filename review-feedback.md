# Auth Module Code Review

## Security Issues

### 1. Race condition in `signUp` — TOCTOU on email/username uniqueness (`handlers.ts:40-57`)

The check-then-insert for email and username is not atomic. Two concurrent sign-up requests with the same email could both pass the `SELECT` check and then both `INSERT`, with one failing on the DB unique constraint — but it would throw an unhandled 500, not a clean 409. Wrap the uniqueness checks + inserts in a transaction, or catch the unique-constraint DB error and return 409.

### 2. `signUp` is not transactional (`handlers.ts:62-67`)

If `db.insert(users)` succeeds but `db.insert(usersPrivate)` fails, you're left with an orphaned user row with no email/password. These two inserts (and ideally the uniqueness checks) should be in a `db.transaction()`.

### 3. `refresh` handler doesn't check if user is soft-deleted (`handlers.ts:164-168`)

The refresh handler fetches the user and checks `if (!user)`, but unlike `signIn` it doesn't check `deletedAt`. A soft-deleted user can keep refreshing tokens indefinitely. Add `if (!user || user.deletedAt !== null)` and select `deletedAt` in the query.

### 4. Auth token `username` claim goes stale (`handlers.ts:69, 112, 175`)

The `username` is baked into auth JWTs. If a user changes their username, stale auth tokens will carry the old value for up to 15 minutes. This isn't critical (short TTL mitigates it), but consumers of `payload.username` in the guard should be aware it may be stale. The `refresh` handler does re-fetch from DB, which is correct.

### 5. No limit on refresh tokens per user

There's no cap on how many refresh tokens a user can accumulate. An attacker who compromises credentials could call `/sign-in` in a loop to fill the `refresh_tokens` table. Consider adding a per-user limit (e.g., 10 active sessions) and/or rate limiting on auth endpoints.

### 6. `sign-out` doesn't require authentication (`plugin.ts:65-75`)

Anyone who possesses a refresh token string can revoke it, which is arguably fine (the token is a bearer secret). But the endpoint also accepts arbitrary strings and silently succeeds — an attacker could brute-force hash lookups (though SHA-256 of a JWT makes this impractical). Not a real vulnerability, just worth noting the design choice.

## Code Quality / Correctness Issues

### 7. `typ` claim collides with JWT header `typ` (`handlers.ts:15, guard.ts:24`)

The standard JWT header already has a `typ` field (typically `"JWT"`). You're adding `typ` to the _payload_, which works but is non-standard. The registered claim for this purpose is actually not defined in RFC 7519 — consider using a namespaced claim like `token_type` or a short custom claim to avoid any confusion with libraries that inspect the header `typ`. This is a style concern, not a security bug — `@elysiajs/jwt` / jose won't confuse the two.

### 8. Dual expiry source for refresh tokens

Refresh tokens now have two independent expiry sources: the JWT `exp` claim and the DB `expiresAt` column. These are set to the same value at creation, but they can drift if the DB row's `expiresAt` is manually modified (as the tests do). The `refresh` handler checks both: JWT `exp` is checked by `jwtVerify.verify()` and DB `expiresAt` is checked explicitly. This is fine — defense in depth — but it means revoking by updating `expiresAt` in the DB won't work if the JWT `exp` hasn't passed yet. Document that DB-side early expiration should use `DELETE` rather than updating `expiresAt`.

### 9. `hashRefreshToken` is exported (`handlers.ts:6`)

This is only used internally and in no other module. Making it `export` exposes an implementation detail. If it's exported only for tests, consider testing through the public API instead.

### 10. Non-null assertions (`handlers.ts:62, 69-70`)

`newUser!` after `db.insert(...).returning()` — if the insert fails or returns empty, this throws an unhelpful runtime error. A guard or destructure with a proper error would be safer.

## Test Gaps

### 11. No test for soft-deleted user + refresh — directly related to issue #3.

### 12. No test for concurrent sign-up race condition — related to issue #1.

### 13. No test for sign-out requiring a valid JWT — the test passes `'non-existent-token'` (a plain string), confirming idempotency, but doesn't test with a structurally valid JWT that's been revoked and then re-submitted.

## Summary — Priority Order

| #   | Severity   | Issue                                                 |
| --- | ---------- | ----------------------------------------------------- |
| 3   | **High**   | Soft-deleted users can refresh tokens                 |
| 2   | **High**   | `signUp` inserts not transactional                    |
| 1   | **Medium** | Race condition on email/username uniqueness           |
| 5   | **Medium** | No per-user refresh token limit                       |
| 4   | **Low**    | Stale username in auth token (mitigated by short TTL) |
| 7   | **Low**    | `typ` claim naming convention                         |
| 8   | **Info**   | Dual expiry source documentation                      |
