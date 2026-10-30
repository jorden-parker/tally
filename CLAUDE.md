# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Commands

Bun is the package manager and script runner; the runtime is Node 22.22.2+ (the
store needs `node:sqlite`).

```sh
bun run dev                                    # next dev on 127.0.0.1:4488
bun run test                                   # all tests, with coverage thresholds
bunx vitest run src/lib/sync.test.ts           # one file, no coverage
bunx vitest run src/lib/sync.test.ts -t "name" # one test by name
bunx vitest run --project node                 # one project: node (*.test.ts) or dom (*.test.tsx)
bun run typecheck
bun run lint
bun run fallow                                 # dead code and duplication
bun run verify                                 # test, typecheck, lint, fallow, build
```

`.claude/verify` is the finish check. The pre-commit hook runs lint-staged,
typecheck, lint, tests and `fallow --fail-on-issues`; commit-msg enforces
Conventional Commits. Coverage thresholds are in `vitest.config.ts` (90%
statements, functions and lines, 84% branches).

## Architecture

Tally is a single-user Next.js app bound to loopback. It shells out to CLIs for
all remote data, stores normalized rows in local SQLite, and computes every
metric on read.

**Request gate.** `src/proxy.ts` guards every route. It rejects non-loopback
hosts, cross-site fetches and non-JSON or cross-origin writes, then requires a
session cookie. At boot, `src/instrumentation.ts` issues a new random token,
writes it to the data directory and prints the login URL. A `?token=` visit is
exchanged for an HttpOnly cookie holding an HMAC of the token, never the token
itself. Restarting the server invalidates every session, because
`src/lib/access-token.ts` reads the token from disk on each check.

**Services seam.** `src/lib/server/services.ts` is the backend's interface:
`summary`, `sync`, `settings`, `updateSettings`. `createServices` takes
`SyncDependencies` (`db`, `run`, `shortcut`, `now`), so tests pass an in-memory
database and a fake `Runner`. `default-services.ts` wires the real ones and
caches them on `globalThis`. Route handlers in `src/app/api` stay thin and call
`getServices()`; `updateSettings` validates with zod and throws
`InvalidSettingsError`.

**Sync.** `src/lib/sync.ts` fetches a 60-day window (`SYNC_WINDOW_DAYS`).

- GitHub and Shortcut run independently, and failures are captured per source in
  `SyncResult.errors`. `lastSyncedAt` only advances when both succeed.
- Each GitHub call is settled separately, so one failure keeps the other calls'
  data and is reported in `SyncResult.errors`. `SyncResult.uncountedReviewRepos`
  names repos whose reviews the allow-list dropped; those events are never
  stored.
- GitHub sync is skipped while the allow-list is empty.
- All remote access goes through `Runner` (`src/lib/exec.ts`): `gh` for GitHub
  and `short api` for Shortcut. `short` comes from `node_modules/.bin`, so start
  the server through `bun run`. The CLI uses its own `short install` credentials
  or an inherited `SHORTCUT_API_TOKEN`, which Next loads from `.env.local`.
- `createShortcutGet` keeps the `/api/v3/...` path shape and translates it to
  `short api` arguments.

**Storage.** `src/lib/store/database.ts` holds the schema, applied with
`CREATE TABLE IF NOT EXISTS` on open; there are no migrations. `events` is keyed
on `(source, kind, external_id)`, so `upsertEvents` is idempotent and re-syncing
overlapping windows is safe. `settings` is key/value. `snapshots` holds point-
in-time counts (open PRs, requested reviews, stories in progress) that have no
history. `open_items` holds the current open PRs and assigned stories, replaced
per source on each successful fetch.

**Metrics.** `src/lib/metrics/summary.ts` `summarize` is a pure function of
events, snapshots, settings, range and `now`. Nothing derived is stored. The
allow-list is applied again here, so removing an entry hides already-synced
events. Day and week boundaries come from `buckets.ts` using the configured time
zone and week start.

**Frontend.** Pages are thin; logic lives in `src/components`. Components take
optional `api` (`TallyApi`, `src/components/api.ts`) and `now` props that
default to the real implementations, and `src/test/fake-api.ts` provides the
test double. `use-dashboard.ts` owns dashboard state and triggers one automatic
sync per load when data is older than 10 minutes.

## Conventions

- Inject time and side effects (`now`, `Runner`, `db`, `TallyApi`) rather than
  importing them, so tests stay deterministic.
- Tests sit beside their source. Node tests are `*.test.ts` and component tests
  are `*.test.tsx`.
- Fixtures use placeholder orgs such as `acme`; this repository is public.
- The source has no code comments.
- Data lives in `~/.local/share/tally` unless `TALLY_DATA_DIR` is set. Keep the
  directory `0700` and its files `0600`.
