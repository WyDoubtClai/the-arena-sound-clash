# Phase 6A.1 dependency security hardening

Reviewed on 2026-10-25, based on main `4777c405a4525ec787dffe8f2468e281d8cf6b6f` (merged PR #11).

## Changes and audit results

The fresh npm audit reported 10 affected package entries: 1 critical, 7 high and 2 moderate. These are package entries, not a count of independent advisories. After the targeted updates, both npm's installed-tree audit and Bun's lockfile audit returned zero vulnerabilities. This is a point-in-time registry result, not proof that all dependencies are free of defects.

| Package | Previous resolved versions | Updated versions |
| --- | --- | --- |
| Vite | 8.1.5 | 8.1.6 |
| Vitest | 4.1.11 | 4.1.12 |
| @vitest/expect, mocker, pretty-format, runner, snapshot, spy, utils | 4.1.11 | 4.1.12 |
| Zod | 3.25.76 and nested 4.6.5 | 4.6.6 |
| brace-expansion | 1.1.16 / 5.0.8 | 1.1.21 / 5.0.12 |
| js-yaml | 4.3.0 | 4.3.2 |
| launch-editor | 2.14.1 | 2.14.2 |
| nanoid | 3.3.16 | 3.3.20 |
| shell-quote | 1.10.0 | 1.12.0 |
| source-map-js | 1.2.1 | 1.2.2 |

Only Zod, Vite and Vitest change in package.json, pinned to reviewed versions. The transitive updates stay within their requesting parents' compatible ranges. Bun also consolidates duplicate Zod entries and rearranges existing hoisted dependencies; no unrelated package version sets change. Lovable/TanStack/Supabase versions, the rolldown override and the 24-hour release-age guard remain unchanged. No dependencies were added and no automatic force upgrade was used.

## Zod compatibility

The [collection-exhaustion advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) has no patched 3.x release listed; 4.6.6 is the first patched version. This upgrade was reviewed separately against the [migration guide](https://zod.dev/v4/changelog).

Only src/lib/account.ts directly imports Zod in application source. Its bounded, strict object/scalar schemas remain in place. Email normalization, password limits (including legacy sign-ins), role/profile/preference validation and safe integer revisions are preserved. Zod 4's stricter UUID variant check would change the previous input contract, so the account-ID schema explicitly uses z.guid(), matching the previous UUID-shaped validation. An input ID never establishes ownership: the server still verifies Supabase Auth and compares its user ID before database access. Added tests exercise format compatibility and rejection of a mismatched UUID-shaped owner.

Error internals differ between Zod major versions. The account endpoint uses safeParse success/failure and returns its existing generic validation response, rather than exposing Zod issue codes/messages. Existing account API/UI tests pass without weakened assertions. Future schema additions should use the reviewed Zod 4 API; retaining deprecated-compatible scalar methods here avoids unrelated refactoring.

## Executed validation

- Focused account/API/UI tests: 86 passed across 2 files, two workers, 2.67 seconds.
- Full Vitest suite: 469 passed across 18 files, zero failures/skips, two workers, 11.21 seconds (466 baseline plus 3 compatibility tests).
- TypeScript: `npx --no-install tsc --noEmit` passed.
- Production build: `npm run build` passed. It emits a non-fatal inlineDynamicImports/codeSplitting warning; tests emit Node's localStorage experimental warning.
- Frozen offline Bun install: passed without changing the lockfile.
- `npm audit --json --package-lock=false`: before 10, after 0. No npm lockfile was created.
- `bun audit --json`: empty advisory result, exit 0.
- Whitespace: `git diff --check` passed.

SQL, migration, database workflow and pinned Supabase CLI are byte-for-byte unchanged from main. The [existing successful database run](https://github.com/WyDoubtClai/the-arena-sound-clash/actions/runs/40189306347) was reconfirmed: 48 assertions in 13 groups on disposable PostgreSQL 17.11. It is reused, not a fresh execution. That workflow installs no application npm/Bun dependencies, and its path filters intentionally exclude this dependency-only change; it is not expected to rerun for this PR.

## Boundaries and remaining gates

No known advisories remain in the audited graph. Local tests do not substitute for the outstanding live email/recovery/session/cross-device checks recorded in Phase 6A. No cloud migration, Auth configuration, live account activation, XP activation, gameplay change, deployment or publication occurred.

Efficiency: one full test run and one focused run, one TypeScript check and one production build. Used targeted Bun updates, preserved the existing lockfile format, and reused applicable SQL validation rather than starting another database job. No token, billing or monetary savings are claimed. For the next dependency task, use the existing Bun tool cache directly, compare resolved version sets to catch unrelated updates, and retain the two-worker test limit.
