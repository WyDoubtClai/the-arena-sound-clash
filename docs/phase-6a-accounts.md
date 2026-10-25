# Phase 6A: authentication and creator profiles

Local implementation; NOT configured for public launch. No cloud migrations, Auth changes, users, buckets or functions were created. Real accounts do not own demo content or rewards.

## Existing integration and configuration

Main introduced generated Supabase clients, a preview broker, empty database types, `supabase/config.toml`, and a tracked public-only `.env`. Reuse its URL/publishable key for project `hfzgjynralokuqjfdaxr` (`the-arena-dev`); generated files are unchanged. The existing generated browser client and admin client are deliberately unused by this account flow. No service-role key is required. Do not put secrets in the tracked `.env`; use ignored `.env.local` or approved runtime secrets.

`ARENA_SITE_URL` is currently missing. Set it to the exact app origin (HTTPS; HTTP only for localhost/127.0.0.1) in local/runtime configuration. The code does not invent a deployment URL or accept client-provided email redirects. The URL must match the request origin for sending signup/verification/recovery mail. Approve allowlisted `/account` and `/account?recovery=1` redirects separately in Supabase. Preview iframe cookie restrictions may require opening the preview as a top-level tab. This server-only session intentionally does not use the editor's token-sharing preview broker.

Before live use, separately approve and verify email confirmations, SMTP delivery, rate limits/CAPTCHA, password policy, redirect allowlists, HTTPS/cookie forwarding and CDN cache exclusions. No Auth setting was inspected or modified remotely; confirmation being enabled is a launch prerequisite, not an established fact. The server/database require Auth-confirmed non-anonymous users, but cannot prove email delivery if the provider is configured to auto-confirm users.

## Auth/session flow

`/account` uses same-origin JSON `/api/account`. Signup/resend send a fixed verification callback; recovery sends `/account?recovery=1`. Supabase PKCE binds the email code to this browser's HttpOnly verifier cookie. The page strips code/error query parameters before exchanging the code via POST; expired/replayed/cross-browser links fail closed. Set a new password after recovery, or sign in normally. Logout revokes the local session; already-issued access tokens follow Supabase expiry semantics.

Every request creates a fresh Supabase SSR client using the public key. Session/refresh/PKCE cookies are HttpOnly, SameSite=Lax, Secure on HTTPS and path `/`. Tokens/passwords never enter the JSON response, demo localStorage, logs, or the generated browser client. `getUser()` validates identity with Auth before owner writes. Account responses are private/no-store. POST requires matching Origin and JSON; arbitrary cross-origin mutations and callback targets are rejected. Provider errors are sanitized.

There is no new global account cache. Focus reloads session/profile state. Writes carry an expected authenticated UUID as a stale-account guard; it is compared with the server-verified user, never used as authorization. Missing schema is reported distinctly and does not block sign-out. Request replay, database errors and old revisions cannot silently overwrite newer saves.

## Durable profiles and UI

The SQL migration creates only `creator_profiles`: one row per authenticated UUID, unique permanent normalized handle, bounded name/bio/location, exactly one Rapper/Producer/Both role, server timestamps/revision. Explicit onboarding creates a public profile; authentication alone creates no public row. Auth handles email/passwords separately.

RLS permits public reads of these public fields; verified owners can create/update their row. Verification is read from protected `auth.users`, not editable metadata. Column grants plus a trigger prevent changing ownership, handle, created timestamp or manually setting revisions. No client delete policy. The fixed-search-path verification function exposes only the caller's boolean verification state. Profile fields are plain React text, not HTML. Updates use a revision match; conflicts require reload. Settings controls role changes; Edit Profile cannot submit a role. Screen provenance is not an authorization boundary—an authenticated owner can directly request their own valid role update.

`/creators/<handle>` is a public real-profile route; it never looks up fictional catalog IDs. `/account` is the owner screen. `/profile` remains the labeled demo flow, with a link to the real account. Shell account links are available on desktop/mobile; the fictional Blaze badge remains labeled demo. New accounts show no fictional songs, XP, records or Vault contents. There is no automatic local import, deletion or identity merge. A future optional preference import must require explicit confirmation and may not import rewards/content provenance.

Existing `challengeRole()` maps Rapper to Artist and Both to combined eligibility. No daily assignments are created or changed here; future authoritative account/day assignments must freeze the saved role. Role changes cannot issue XP. The existing 00:00 UTC policy and all progression modules are unchanged.

## Validation and approval gates

Vitest account tests mock Auth/database and exercise request parsing, actions, CSRF, cookie isolation/security, minimal responses, verified ownership, account-switch guards, concurrency conflicts, public reads, and static migration contracts. Static SQL checks are NOT executable RLS validation.

`supabase/tests/creator_profiles.sql` is an executable transactional authorization script for a disposable LOCAL Supabase database only. It creates local fixture users, exercises owner/visitor/anonymous/unverified permissions, identity constraints, role updates, unique handles and stale revisions, then rolls back. It has NOT been run: this machine has no local Docker/psql runtime. Never run this script against the linked cloud project. After separate approval, run the reviewed migration and this script against local Supabase; subsequently apply the reviewed migration to cloud only with explicit authorization. Live email, refresh/revocation and cross-browser persistence also remain pending. No cloud calls are required by automated tests or build.

Before any real XP: trusted canonical track/publication provenance, verified activities/results and times, complete history, immutable daily assignments and atomic account-level reward/allowance enforcement are still required. Accounts and schema checks alone are not anti-farming protection. Keep rewards dormant.

## Local validation snapshot

58 new tests cover account schemas, endpoint/ownership boundaries, UI flows and the actual SSR SDK's PKCE/cookie behavior using mocked HTTP (never cloud Auth). Final combined suite: 441 passed (383 existing + 58), zero failed or skipped, across 18 test files with at most two workers. Local signed-out API and hydrated `/account` smoke checks passed; cross-origin POST returned 403. TypeScript, production build and whitespace checks passed. No cloud/database authorization or live email assertion is implied by these checks.

The dependency install audit reported 10 vulnerable-package entries (2 moderate, 7 high, 1 critical), including existing Vite/Vitest/Zod and tooling transitives. The Bun lock diff preserves all existing package resolutions and adds only Supabase SDK dependencies; no Supabase vulnerability entry was reported. Do not run automatic broad upgrades in this account change. Review the existing dependency advisories separately before public launch; local test/build success does not establish production security.

## Follow-up: Fan role, recording preferences and focused review

The original uncommitted implementation is preserved. Real profiles now support Rapper, Producer, Both and Fan. Demo role fixtures and the existing three-role daily policy remain unchanged. `accountChallengeRole` explicitly returns no mapping for Fan; it must never be used to fabricate Fan assignments. Existing account/day role snapshots still take precedence over subsequent role changes. All four roles may eventually judge artist and producer competitions, but no judging/matchmaking/eligibility permission or reward is implemented here. Fans can create public profiles without uploading music or answering recording questions.

Recording preferences are optional Settings-only UI fields for Rapper/Producer/Both. Setup accepts Home studio, Phone/tablet/computer recording app, or External studio or limited access. Recording/export capability accepts Yes/Sometimes/No. Each may remain null or be cleared. Values are informational and never restrict competition access. Switching to Fan hides the controls without deleting previously saved private values.

Preferences live in a separate `creator_recording_preferences` table: owner-only SELECT/INSERT/UPDATE, verified Auth ownership, a fixed account foreign key and independent server-controlled revision. Public profile columns/responses never include these preferences. Separate save operations avoid partial multi-table Settings writes. Missing preference data is distinct from failed reads: errors disable preference saving rather than overwrite unknown values. Direct clients may edit their own valid preferences; Settings-only is a UI workflow, not screen-based authorization.

Verified review fixes: reject non-local HTTP account endpoints; clear recovery mode/password forms when the authenticated account changes so a password intended for account A is not applied to B after focus revalidation. Existing PKCE callbacks, fixed redirect targets, HttpOnly request-scoped cookies, verified ownership and demo separation remain intact.

No disposable Postgres/Supabase/Docker executable was found on PATH or standard local install paths. The updated SQL migration and authorization script remain UNEXECUTED, including private table RLS, Fan constraints, revision triggers, helper-function permissions and transactional/FK behavior. Static migration assertions and mocked SDK/API tests do not establish database security. Cloud migration, email configuration, real recovery/refresh/revocation and cross-device persistence still need separate approval and verification. `ARENA_SITE_URL` remains an external configuration prerequisite; no cloud settings or credentials were changed.

Follow-up validation: 466 tests passed across 18 files, no failures/skips, maximum two workers (383 existing + 83 Phase 6A account tests; 25 added in this follow-up). Final full-suite duration: 19.12 seconds. TypeScript, production build, tracked/untracked whitespace checks passed. One focused run passed before the final added owner-read test; the complete suite includes it. No new dependencies or cloud operations. Existing gameplay/progression/demo role/configuration files were checked unchanged. The earlier 441-test snapshot above is historical, superseded by this result.

## Final security/database review

Focused review preserved all application code and the existing migration. Confirmed four-role onboarding/Settings/storage, no Fan challenge coercion, verified server ownership, fixed email redirects, request-scoped HttpOnly cookies, CSRF/origin checks and private/public SELECT separation. Public profiles include their stable account UUID but no email, credentials, tokens or recording preferences. Existing gameplay, demo role/progression modules and connection configuration remain unchanged. A targeted new-file secret-pattern check found no matches outside intentionally invalid test fixtures; this is not an exhaustive secret audit.

Medium-severity validation-harness finding fixed in `supabase/tests/creator_profiles.sql`: enable psql ON_ERROR_STOP so SQL/assertion errors cannot be followed by a successful final ROLLBACK and mistaken for a passing run. Added explicit Fan edit/role round-trip and denied anonymous update cases. The script remains UNEXECUTED.

No local Docker, Podman, Supabase CLI, PostgreSQL executables or installed embedded PostgreSQL package was found in the targeted inventory. Zero migration/RLS/database assertions executed. Missing runtime is a validation blocker, not proof of a vulnerable or secure database. SQL grants/policies, Auth helper permissions, triggers, foreign keys, uniqueness and transaction behavior all remain pending executable validation. Use only disposable local infrastructure; do not substitute the linked cloud project.

Reused the unchanged 466-test, TypeScript and production-build baseline. No source/test file under src is newer than the recorded passing full-suite log; no runtime code changes were made during this final review. Whitespace checks passed for tracked and untracked files. No new Vitest, TypeScript or build runs were needed. Ready for a draft code-review PR with these gaps disclosed, not for production approval. Cloud migration, Auth/email/redirect/site-origin configuration and real-session/cross-device checks require separate approval/verification. Previously documented dependency audit findings remain outstanding.
