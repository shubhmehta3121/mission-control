# CLAUDE.md — working agreement for AI agents in this repo

Read **DESIGN.md** first. It is the source of truth for behaviour, and every rule below traces back to a numbered decision there (D1–D20). If a change needs a new decision, add it to DESIGN.md in the same change.

## Commands

```bash
npm test            # vitest: unit + integration (each integration file gets its own migrated SQLite copy)
npm run typecheck   # tsc --noEmit — must be clean
npm run demo        # 45-step end-to-end CLI run (including refusals) on a throwaway DB; must print "all behaved as expected"
npm run dev         # API on :3000 (PORT to override)
npm run setup       # rebuild prisma/dev.db from migrations + seed (destructive — dev only)
npm run mc -- <args>   # CLI without npm link
npm run report      # tests + demo rendered into test-report.html (regenerate before submitting or releasing)
npm run docs        # DESIGN.md → design.html
```

Definition of done for any change: `npm test`, `npm run typecheck` and `npm run demo` are green, and DESIGN.md, TODO.md or ROADMAP.md are updated if behaviour changed.

## Invariants — do not break these

1. **Tenancy.**
   - Every query in `src/services` filters by `ctx.actor.orgId`.
   - Never read an org id from the request.
   - New tenant-owned tables get `org_id` plus composite `(org_id, id)` foreign keys (see `prisma/schema.prisma`).
   - Anything outside the caller's view is **404**, never 403.
2. **Lifecycle and permissions live in `src/domain/lifecycle.ts`.**
   - Add or change an action there, never with ad-hoc `if (role === …)` checks in services.
   - Call `assertMissionAction` first in every mission command.
   - Change state only through `moveMission` (compare-and-set).
3. **The matcher is pure.**
   - `src/matcher/*` does no I/O; data comes from `services/snapshot.ts`.
   - Weights and thresholds are named constants in `scoring.ts`.
   - Every new rule needs a unit test and an explanation string: nothing may be silently filtered.
4. **Schedule rules have one implementation:** `domain/scheduling.ts`, used by both the matcher and accept. Never duplicate conflict or rest-gap logic.
5. **Visibility (D14).**
   - Crew never see `PROPOSED` seats, other people's offers, or any scores.
   - The roster is visible only when the mission is ACTIVE or COMPLETED, and only to confirmed crew.
   - Leads never see why another lead's candidate is blocked.
6. **Dates are inclusive calendar days.** Use `src/lib/dates.ts`, never raw `Date` arithmetic. Anything time-based takes the injected `ctx.clock`, which keeps it testable.
7. **The CLI is a pure API client.**
   - No business rules in `src/cli`: render, suggest the next step (from `allowedActions`), map errors to exit codes.
   - Every command supports `--json`.
8. **Migrations are append-only.** Never edit a committed migration; add a new one.
9. **Every write to a mission or its seats goes through `withLockedMission`** (and accept / unavailability also `lockUser` first — person before mission, always). Re-read after the lock; change assignment status only with `moveAssignment` (compare-and-set). Never `update` a seat by bare id (D21).
10. **Tests come in layers** — unit, integration, scenarios, property. A new rule gets a unit test; a new flow gets an integration test; anything that could break an invariant must keep `tests/property/*` green (try a few `SIM_SEED`s).

## Adding things — where they go

| Change | Files |
| --- | --- |
| New mission action | `domain/lifecycle.ts` (rule) → `services/missions.ts` or `staffing.ts` → `http/routes/missions.ts` → `cli/commands/missions.ts` → tests in `unit/lifecycle` and `integration/*` |
| New matching signal | `matcher/scoring.ts` (constant + function) → `ScoreBreakdown` in `matcher/types.ts` → the CLI `--explain` renderer → `unit/matcher.test.ts` with a hand-computed example |
| New endpoint | zod schema in `http/validation.ts` (strict objects) → route → service → security test (role and tenancy) |

## Gotchas we hit (save yourself the time)

- **Prisma 6 + SQLite + `Json @default("{}")`** generates invalid SQL. Always write JSON fields explicitly.
- **Nested creates inherit composite keys.** When creating a child through its parent (e.g. role → requirements), do **not** pass `orgId`; Prisma fills it in.
- **Prisma blocks `migrate reset` when it detects an AI agent** unless the user gives explicit consent. Don't work around it: ask the user, or use a fresh database file via `DATABASE_URL`.
- **Windows:** a running API process locks Prisma's query engine (`EPERM` on generate). Stop it first.
- **The demo hosts the API in-process**, so it must spawn the CLI **asynchronously**. A sync spawn deadlocks.
- **Commander 15** is ESM-only and needs Node ≥ 22.12.
- **Prisma runs SQLite transactions one at a time**, so concurrency tests there check outcomes, not true interleaving. Do not "simplify" the locks away because tests pass without them — they exist for Postgres.
- **Port 3000 on Windows:** another app on `0.0.0.0:3000` does not stop a bind to `127.0.0.1:3000`. `src/lib/ports.ts` knocks before binding; keep it that way.
