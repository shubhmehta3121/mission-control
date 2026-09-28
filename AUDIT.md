# Mission Control — Audit Report

**Date:** 2026-09-28 · **Status:** COMPLETE — all 9 sections delivered · **Scope:** all uncommitted v1 changes (64 files) · **Method:** orchestrated audit — 9 parallel read-only sub-agents (Composer 2.5) plus direct verification · **Code changes made by this audit:** none

---

## 0. Baseline (verified directly)

| Check | Result |
| --- | --- |
| `npm run typecheck` (tsc --noEmit, strict) | ✅ clean |
| `npm test` (vitest) | ✅ 53/53 across 6 files |
| `npm run demo` (26-step CLI end-to-end, throwaway DB) | ✅ all steps behaved as expected |

Demo evidence: full happy path (create → nominate → submit → approve → accept → activate), dropout ("Medical hold") → backfill (Sara offered + accepted), cross-tenant isolation (Lunar Collective lead gets `NOT_FOUND` for AST-6, exit 5), and a readable audit history.

---

## 1. Decision-trail verification (21 decisions + 12 self-made calls)

**Result: 19/20 decisions VERIFIED, 1 PARTIAL · 11/12 self-made calls VERIFIED, 1 PARTIAL.** Typecheck re-verified clean during audit. (Brief numbering skips #6; DESIGN D6 is covered under #17.)

### Decisions

| # | Verdict | Evidence (file:line) | Notes/divergence |
|---|---------|----------------------|------------------|
| 1 | **VERIFIED** | `prisma/schema.prisma:176-205` (MissionRole, RoleSkillRequirement); `src/services/snapshot.ts:151-158`; `src/matcher/matcher.ts:174-207`; `src/http/validation.ts:36-43`; `src/cli/commands/missions.ts:66-67,114`, `shared.ts:55-57` | Roles have name, headcount, per-role skill mins; matcher seats by role; CLI `--role "Name:1:nav=4"`. |
| 2 | **VERIFIED** | `src/matcher/hungarian.ts:1-90`; `src/matcher/matcher.ts:40-41,203-209`; `tests/unit/matcher.test.ts:9-24` | `ELIGIBLE_BONUS = 1_000_000`; weight `ELIGIBLE_BONUS + round(effective × 100)`; Hungarian max-weight assignment. |
| 3 | **VERIFIED** | `src/matcher/scoring.ts:12-16,27,75-91,115-119`; `tests/unit/matcher.test.ts:26-56` | `RARITY_MAX_PENALTY = 5`; effective = total − penalty; >5pt gap still picks rare specialist (test). |
| 4 | **VERIFIED** | `src/matcher/scoring.ts:24,38-48`; `src/domain/scheduling.ts:29-55`; `prisma/schema.prisma:66-67` | ±90-day horizon; rest gap hard filter + org default 14; concurrent cap not present (as redesigned). |
| 5 | **VERIFIED** | `prisma/schema.prisma:43-44,214,242`; `src/services/staffing.ts:120-151,190-213`; `src/services/missions.ts:218-287,322-339,46-55` | PROPOSED without `offeredAt`; approve flips to OFFERED; snapshot JSON at submit; crew need `offeredAt` to see mission. |
| 7 | **VERIFIED** | `src/domain/lifecycle.ts:60,382-419`; `src/services/missions.ts:382-419`; `src/services/inbox.ts:1-11,240-248`; no `notifications` table in schema | Directors only, all non-terminal; WITHDRAWN/RELEASED + reason; inbox derived from state. |
| 8 | **VERIFIED** | `prisma/schema.prisma:37-40,213`; `TODO.md:12-24` | `AssignmentKind` PRIMARY\|BACKUP; no promote/backup-nominate shipped (TODO §1 only). |
| 9 | **VERIFIED** | `src/services/offers.ts:4-8,41-79,109-129`; `src/services/views.ts:21-27`; `src/services/missions.ts:596-609`; `src/services/inbox.ts:163-170`; `tests/integration/workflow.test.ts:193-196` | Multiple OFFERED rows; accept throws `SCHEDULE_CONFLICT` before update; lead sees `BLOCKED_FOR_LEAD`; crew sees detailed blocked. |
| 10 | **VERIFIED** | `src/services/expiry.ts:9-18`; `prisma/schema.prisma:67`; `src/services/missions.ts:331`; `src/services/staffing.ts:198` | `min(now+ttl, start−14d)` with floor `addDays(now,1)` (24h). |
| 11 | **VERIFIED** | `src/domain/lifecycle.ts:58-59,85-99,112-114`; `tests/integration/security.test.ts:42-57` | `directorNotOwner`; `CANNOT_APPROVE_OWN` when owner approves. |
| 12 | **PARTIAL** | `src/http/validation.ts:45-50,69-71`; `src/http/routes/missions.ts:67-71`; `src/services/missions.ts:362-366` | Reject: required note ✅. Approve: optional note ✅. **Create requires `title` + `startDate` + `endDate` (+ optional description) — not "title + note only" as the review manifest claimed.** |
| 13 | **VERIFIED** | `src/services/people.ts:110-127`; `src/http/routes/me.ts:22-23` | Skills only via `/v1/me/skills`; no lead API to set others' ratings. |
| 14 | **VERIFIED** | `src/matcher/scoring.ts:10,25,60-61,105`; `tests/unit/matcher.test.ts:188-196` | `(accepts − dropouts + 2) / (accepts + 2)`; only DROPPED counted. |
| 15 | **VERIFIED** | `src/services/missions.ts:672-728`; `src/services/offers.ts:21-37` | Crew view: single assignment, no roles/scores; roster only ACTIVE/COMPLETED + ACCEPTED; offers list has no matcher score. |
| 16 | **VERIFIED** | `prisma/schema.prisma:3-7,96-98,170-171,227-228`; `tests/integration/security.test.ts:132-141` | Composite FKs on tenant relations; cross-org `crewSkill.create` rejected. |
| 17 | **VERIFIED** | `src/services/snapshot.ts:1-4,112-163`; `src/matcher/matcher.ts:174-175` (no DB) | Snapshot load in service; `runMatch` pure. |
| 18 | **VERIFIED** | `src/domain/lifecycle.ts:52-64,131-133`; `src/services/missions.ts:664-668`; `src/cli/commands/missions.ts:396-404`; `tests/integration/security.test.ts:60-69` | `MISSION_RULES` → `allowedMissionActions` → API → CLI hints. |
| 19 | **VERIFIED** | `src/cli/commands/missions.ts:53,131,396-404`; `src/cli/commands/session.ts:34-75`; `src/cli/commands/crew.ts:11-22`; `src/cli/config.ts:2-3`; `prisma/schema.prisma:152-153,64-65` | Keys `AST-6`, profiles, `mc inbox`, show + actions, `--explain`. |
| 20 | **VERIFIED** | `src/services/snapshot.ts:132-135`; `src/services/staffing.ts:34-39` | Match pool and nominate target `role === 'CREW_MEMBER'`. |
| 21 | **VERIFIED** | `prisma/migrations/20260928095500_roles_nominations_tenancy/migration.sql`; `CLAUDE.md`; `TODO.md`; `ROADMAP.md`; `scripts/demo.ts` | Append-only migration; process docs + demo present. |

### Self-made calls

| # | Verdict | Evidence (file:line) | Notes/divergence |
|---|---------|----------------------|------------------|
| A | **VERIFIED** | `src/services/people.ts:145-156`; `tests/integration/workflow.test.ts:225-227` | Unavailability blocked over accepted commitments; message points to drop-out. |
| B | **VERIFIED** | `src/services/missions.ts:109-130,200-215`; `src/cli/commands/missions.ts:112-122,600` | `replaceRoles` deletes PROPOSED; API returns `clearedNominations`; CLI warns. |
| C | **VERIFIED** | `src/services/missions.ts:170-195,229-264` | Date edit keeps nominations; submit re-runs `evaluateCandidate` per PROPOSED seat. |
| D | **PARTIAL** | `src/services/missions.ts:716-725` (no assignment score ✅); `src/services/people.ts:67-71,102-107` ⚠️ | Mission/offer views omit matcher scores. **But crew profile responses include `record.commitment` — a numeric score-like metric — contradicting D14 "crew never see scores".** |
| E | **VERIFIED** | `src/services/people.ts:50-64`; `prisma/schema.prisma:140`; `tests/integration/security.test.ts:83-87` | Notes only if `self \|\| DIRECTOR`; leads get dates only. |
| F | **VERIFIED** | `src/matcher/matcher.ts:79-98`; `tests/unit/matcher.test.ts:108-114` | DECLINED/DROPPED/EXPIRED → ON_MISSION exclusion; WITHDRAWN/RELEASED → eligible. |
| G | **VERIFIED** | `src/services/snapshot.ts:79-91`; `src/matcher/matcher.ts:148-155`; `tests/unit/matcher.test.ts:198-205` | Overlapping pending OFFERED/PROPOSED flagged in notes, not hard-filtered. |
| H | **VERIFIED** | `src/domain/lifecycle.ts:62-63`; `tests/integration/security.test.ts:67` | `activate` → owner; `complete` → ownerOrDirector. |
| I | **VERIFIED** | `src/domain/lifecycle.ts:55,89-90`; `tests/integration/security.test.ts:67-68` | Non-owner lead: `['match']` only on draft; owner gets edit/nominate/submit. |
| J | **VERIFIED** | `src/services/expiry.ts:12-18` | Floor is one day after `now`. |
| K | **VERIFIED** | `prisma/seed.ts:52,84-92,415`; `src/lib/tokens.ts:3-6`; `tests/integration/security.test.ts:22-25` | `mct_${slug}_${handle}` printed; stored as sha256 hex. |
| L | **VERIFIED** | `src/services/missions.ts:46-55,683`; `src/services/people.ts:96-98`; `tests/integration/security.test.ts:77-79,107-109,122-123` | Cross-org / unoffered missions / other crew → 404. Legitimate forbidden actions on visible resources still 403. |

### Surprises

1. **Decision #12 divergence:** mission create requires start/end dates, not "title + note only" as the review manifest stated. The code behaviour (dates required) is arguably correct — the manifest text was wrong, not the code. **Action: fix the manifest/claim, or decide dates-optional is desired.**
2. **Commitment metric visible to crew (D14 tension):** `people.ts:67-71,102-107` exposes `record.commitment` in profile responses. Not a matcher score, but score-like; D14/CLAUDE invariant 5 say crew never see scores. **Action: decide — hide commitment from crew self-view, or amend D14 wording to permit aggregate reliability metrics.**
3. **BACKUP copy without feature:** `inbox.ts:235` references backup seats in offer text while backup nominate/promote is TODO §1 only — schema-ready, behaviour not shipped. Harmless but check the copy never renders for v1 offers.
4. Brief numbering skipped #6; DESIGN D6 maps to implemented #17. No gap.

## 2. Type safety

**Verdict: strong at HTTP ingress and in the pure matcher domain; weaker at API/CLI egress.** Clean `tsc`, zero `@ts-ignore`/`@ts-expect-error`, one production `any`. Weaknesses concentrate at trust boundaries on the way out: DTOs widen Prisma enums to `string`, JSON columns/event payloads unvalidated on read, CLI trusts `fetch` generics, discriminated switches omit `never` checks. SQLite stores enums/JSON as TEXT/JSONB without DB CHECK constraints — runtime integrity relies on Prisma writes and app discipline.

### 2.1 `any` / casts / assertions / suppressions

- **Suppressions:** none found anywhere.
- **Explicit `any`:** one in production — `src/cli/commands/missions.ts:587` (`EventRow.payload: Record<string, any>`) — MED. Test helpers default `T = any` (`tests/support/testApp.ts:32–42`) — LOW.

**Notable casts (`as`):**

| Severity | Location | Issue | Recommendation |
|----------|----------|-------|----------------|
| HIGH | `src/cli/client.ts:54` | `return payload as T` — success responses unvalidated; any JSON satisfies the generic | Shared zod response schemas, or document as intentional trust boundary |
| MED | `src/cli/client.ts:45` | Error body cast without guard | Small zod schema before `CliError` |
| MED | `src/cli/config.ts:42` | `JSON.parse(...) as Partial<ConfigFile>` — no validation | Validate config shape with zod |
| MED | `src/cli/commands/missions.ts:335–336` | `seat.breakdown as Partial<ScoreBreakdown>` then `as ScoreBreakdown` | Runtime guard before rendering |
| MED | `src/cli/index.ts:55` | `error.details as { blockers?: string[] }` | Discriminate on `error.code` |
| MED | `src/services/missions.ts:247,285`; `src/services/staffing.ts:149,209` | `breakdown as unknown as Prisma.InputJsonObject` double cast | Acceptable Prisma JSON workaround; consider helper |
| MED | `src/services/snapshot.ts:90,141,177` | `row.status as 'OFFERED'\|'PROPOSED'`; `as AssignmentRow[]` on Prisma results — hand-written `AssignmentRow` can drift from `assignmentSelect` | Use `Prisma.AssignmentGetPayload<{ select: typeof assignmentSelect }>` |

**Notable non-null assertions:** MED — `missions.ts:247,253` (`verdict.breakdown!.total`); CLI render paths (`missions.ts:358,426,539,551` — `mission.staffing!` etc.). LOW — matcher/hungarian internals (test-covered), map gets after existence checks.

### 2.2 Boundary validation

- Bodies: all routes use zod `strictObject` (or strict unions) ✅. Lifecycle POSTs without bodies correctly omit parsing ✅.
- **MED:** path params (`:key`, `:handle`, `:id`) are **not** zod-parsed — raw strings.
- **LOW:** query schemas use `z.object` not `.strict()` — extra query keys stripped, not rejected.
- **HIGH:** `scoreBreakdown`/`payload` passed through from Prisma `Json` as `unknown` **without zod validation on read** (`missions.ts:604,809`). No `JSON.parse` in app code (Prisma deserializes). Matters only if DB rows are corrupted/hand-edited.

### 2.3 String-typed DB enums / narrowing

- Prisma declares enums (`Role`, `MissionStatus`, `AssignmentStatus`, `AssignmentKind`, `SubmissionDecision`) but SQLite stores TEXT without CHECK constraints — compile-time contracts only.
- **MED:** `mission_events.type` is `String` in schema; reads expose `type: string` (`domain/events.ts` has the app-side catalog).
- **MED:** API DTOs widen enums to `string`: `MissionView`/`MissionSummary`/`SeatView` (`missions.ts:504–556,733–744`), `OfferView` + `STATUS_ORDER: Record<string, number>` (`offers.ts:21–39`), `getMyProfile` `role: string` (`people.ts:102+`), CLI `Me.role: string` (`session.ts:7–11`).
- **LOW (good):** `listMissionsQuery.status` pipes to `z.array(z.enum([...]))` — proper boundary narrowing.

### 2.4 Exhaustive switches

- **MED:** no switch codebase-wide uses the `default: { const _: never = x }` pattern (violates the workspace typescript-exhaustive-switch rule). Specific: `matcher.ts:83–98` (`default: return null` — intentional but not compile-checked), `offers.ts:93–103` (`default` for "already responded"), `cli/commands/missions.ts:594–632` (switches on `string` event type with `default: return event.type` — new EventTypes silently render raw). `lifecycle.ts:80–91` and `scheduling.ts:60–67` are implicitly exhaustive (no default) — LOW.

### 2.5 Error handling typing

`AppError` + `ErrorCode` keyed by `ERROR_STATUS` — coherent. CLI maps exit codes by HTTP status, not `ErrorCode` (multiple codes share a status) — LOW. Top-level CLI catch is implicit `unknown` — LOW.

### 2.6 Prisma vs hand-written shapes

**MED:** `AssignmentRow` (`snapshot.ts:15–35`) duplicates `assignmentSelect` shape, enforced only by casts — prefer `Prisma.AssignmentGetPayload`. **LOW (good pattern):** `PersonRow = Awaited<ReturnType<typeof loadPeople>>[number]` (`people.ts:25`) — replicate for snapshot rows.

### 2.7 CLI response typing

Mission/crew commands import shared DTOs (`MissionView`, `OfferView`, etc.) ✅. **HIGH:** all `api().get<T>`/`post<T>` trust network JSON without runtime validation (`client.ts:54`). **MED:** local `Me` interface instead of shared type; history uses loose `EventRow`.

### 2.8 `noUncheckedIndexedAccess` hazards

Mostly justified with guards. **MED:** `matcher.ts:261` `evaluation.shortfalls[0]!` assumes non-empty in branch. LOW: `inbox.ts:64,223`, `missions.ts:316` (length-checked but TS can't correlate).

### 2.9 Overall

Thoughtful typing where it matters (HTTP in, domain, matcher) with pragmatic looseness at serialization and CLI presentation layers. **Top fixes by value:** (1) narrow DTO enums from `string` to Prisma unions; (2) add `never` defaults to discriminated switches; (3) validate or document the CLI `as T` trust boundary; (4) derive `AssignmentRow` from `Prisma.AssignmentGetPayload`.

## 3. Security review

**Verdict: no medium, high, or critical vulnerabilities found in the uncommitted diff.** Controls match the stated design and are covered by `tests/integration/security.test.ts` and workflow privacy tests.

### 3.1 Cross-tenant isolation — OK
Composite `(org_id, id)` FKs in schema + migration; every service path uses `ctx.actor.orgId`; mission key prefix checks (`parseMissionKey`) → `LUN-1` from an Astra token = 404; foreign skill keys/crew handles → 400/404 without touching other orgs' data; cross-tenant `crewSkill.create` rejected by composite FKs (tested).

### 3.2 Authentication & tokens — OK (within stated trade-offs)
Plaintext demo tokens hashed before storage (`seed.ts:92` — `tokenHash: hashToken(plain)`). Auth hook: Bearer → SHA-256 → DB lookup; org/role never from body (`app.ts:35–50`). Tokens not stored plaintext (tested); invalid/missing → 401 generic; CLI config `chmod 0o600`; `mc profiles` strips tokens. No `timingSafeEqual` — hash + indexed lookup is standard for hashed API tokens; not a finding. Server binds `127.0.0.1` by default (`config.ts`).

### 3.3 Same-org privacy — OK
Crew never see PROPOSED/scores (`offeredAt` gate; `crewView` omits scores/roles; tested). Unavailability notes self+directors only (tested). Blocked-offer reason hidden from other lead (`BLOCKED_FOR_LEAD`; crew gets specifics via `blockedForCrew`; tested). Roster only when ACTIVE + accepted (tested).

### 3.4 Authorization — OK
Data-driven lifecycle rules enforced via `assertMissionAction` before mutations. Tested: owner-only edit; directors-only approve + `CANNOT_APPROVE_OWN`; crew 404 (not 403) on directory/audit/unoffered missions; directors-only org settings.

### 3.5 Injection / validation — OK
Bodies use `z.strictObject` (extra `orgId` rejected, tested). Only raw SQL is health-check `SELECT 1`. Create/update paths use explicit field mapping, not request spread.

### 3.6 Error responses — OK
Out-of-view → 404 via `notFound()`; 500s generic; no token/PII/stacks in error payloads.

### 3.7 Considered and not raised (documented trade-offs)
Predictable demo tokens; SQLite; self-rated skills (D18 product risk, not a bypass); no `CREW_MEMBER` check on `acceptOffer` (offers only creatable for crew via `crewByHandle` — no API path otherwise); crew `listMissions` aggregate `offered` count (no identities); `design.html` CDN script (local doc artifact).

### 3.8 Conclusion
The diff strengthens tenancy (composite FKs, hashed tokens, org-scoped seed) and wires the server through `buildApp` with auth and safe error mapping. **No actionable medium+ issues.** Roadmap hardening items (token expiry/rotation, Postgres RLS, explicit role guard on offer accept) are defence-in-depth, not exploitable gaps.

## 4. Bugbot logic review

**Result: 1 HIGH finding.**

### HIGH — `acceptOffer` lacks compare-and-set guard

**Location:** `src/services/offers.ts:131-141`

`acceptOffer` checks the role's accepted PRIMARY count and that the row is `OFFERED`, then updates the assignment by `id` only. Unlike mission transitions via `moveMission`, the write is not conditional on `status = 'OFFERED'`. Two consequences:

1. **Overbooking race:** concurrent accepts for the last seat can both pass the count check and both become `ACCEPTED`, exceeding `headcount`.
2. **Broken idempotency under race:** a parallel retract/cancel/decline can move the row out of `OFFERED` while another transaction still promotes it to `ACCEPTED` — breaking the promised 409 semantics for offer responses.

**Recommended fix direction (not applied — audit is read-only):** make the accept write conditional, e.g. `assignment.updateMany({ where: { id, status: 'OFFERED' }, data: … })` with a `count !== 1 → ALREADY_RESPONDED` check (mirroring `moveMission`'s compare-and-set in `context.ts:59-72`), and re-derive the seat-cap check inside the same transaction. Add a regression test: two concurrent accepts for a headcount-1 role → exactly one succeeds.

**Cross-reference:** this is the same class of issue as §5 finding MED-1 (updates by bare `id` without tenant/status predicates) — fix both together.

## 5. Cross-tenant isolation & privacy

**Verdict: no CRITICAL or HIGH cross-tenant leaks found. Isolation is defence-in-depth.** Org comes only from the token; all ~60 service queries scope by `ctx.actor.orgId`; mission keys reject foreign prefixes before DB; composite `(org_id, id)` FKs block cross-org references at the database; crew visibility gated on `offeredAt`; 53/53 tests green including direct cross-org insert rejection.

### 5.1 Query inventory (every Prisma op audited)

- **~60 Prisma operations** in services + 2 in HTTP (auth lookup, health `SELECT 1`). **Zero `$queryRaw`** in services.
- All service reads/writes include `orgId` from the actor or composite keys (`orgId_number`, `orgId_handle`, `orgId_key`) — **except post-load updates by bare `id`** (finding MED-1 below).
- Auth: `tokenHash` → `user.findUnique` (global by design); org bound to resolved user only.

### 5.2 Auth

- Token → SHA-256 → DB lookup ✅. Malformed/empty `Authorization` → 401 ✅.
- No constant-time compare (DB lookup on 64-char hex digest) — LOW for high-entropy tokens.
- `buildApp` defaults `logger: false`; no code logs `Authorization` headers. Production logger enabled (`server.ts`) — recommend pino redact of `req.headers.authorization` (LOW).

### 5.3 404-not-403 (confirmed)

| Scenario | Behaviour |
|----------|-----------|
| Other org's mission key | 404 (prefix check pre-DB) |
| Crew → unoffered mission | 404 |
| Crew → other crew profile | 404 |
| Crew → mission events | 404 |
| Foreign crew handle (nominate) | 404 |
| Same-org wrong role (crew directory) | 403 (capability disclosure only — intentional) |

Generic 404 body (`"${what} not found"`) — no "exists but forbidden" signal.

### 5.4 Same-org privacy (D14/D17) — confirmed

Crew: 403 on directory list, 404 on other handles, 200 self only. Crew mission view: no roles/scores, own assignment only, `offeredAt` gate. PROPOSED seats hidden from crew. Offers list: no score/breakdown. Roster: only ACTIVE/COMPLETED + own ACCEPTED. Unavailability notes: leads see dates only; self+director see note. Blocked offers: other lead sees only `BLOCKED_FOR_LEAD` string. Match scores: lead/director only.

### 5.5 Mass assignment

All request bodies `z.strictObject` ✅ (extra `orgId` in create → 400, tested). Query schemas non-strict `z.object` — LOW (no path for `orgId` to reach services).

### 5.6 Error paths

P2002 → 409 generic; P2003 → 422 "referenced record does not exist in your organisation" (doesn't name foreign org); AppError → `{code, message, details?}` no stack; 500 → generic. Foreign skill on roles → 400 `unknownSkills` (doesn't confirm other org's taxonomy). ✅

### 5.7 CLI

`--json` dumps API payload (server already strips by role); session commands strip `token`. Config saved with `chmod 0o600` — but not re-applied on read of a manually-created loose file (LOW). `mc login <token>` puts token in argv; `MC_TOKEN` in env — both visible to same-user process inspection (LOW, document).

### 5.8 Findings

| Severity | Location | Finding | Fix |
|----------|----------|---------|-----|
| **MED** | `missions.ts:177,245,315`; `offers.ts:138,169,195` | `update`/`updateMany` by bare `id` without `orgId` in WHERE. No demonstrated exploit (IDs come from org-scoped reads; CUIDs unguessable; composite FKs block bad creates) — defence-in-depth gap | Add `orgId` to every update/delete WHERE |
| LOW | `validation.ts:97–114` | Query schemas non-strict | `z.strictObject` for parity |
| LOW | `cli/config.ts:38–47` | `chmod 0o600` only on write | Re-apply on load if loose |
| LOW | `session.ts:26–30` | Token in argv / `MC_TOKEN` in env | Document; consider stdin login |
| LOW | `app.ts:41` | No constant-time token compare / no 401 rate limit | Document threat model |
| LOW | `people.ts:79`, `missions.ts:137` | Same-org 403s disclose capability existence | Only if product requires |
| LOW | `server.ts:6` | Production logger — ensure auth header redaction | pino redact config |

### 5.9 Verified safe (10 mechanisms)

1. `orgId` never from request body (strict zod + actor-only). 2. Composite `(org_id, id)` FKs with direct-insert test. 3. Mission key prefix → 404 pre-DB. 4. Crew visibility gated on `offeredAt != null`. 5. Crew API shape: no scores/PROPOSED/roster gates. 6. Lead blocked-offer privacy (`BLOCKED_FOR_LEAD` only). 7. Unavailability note privacy. 8. Cross-tenant writes rejected (validation/404/422 layers). 9. Tokens: SHA-256 at rest; seed prints plaintext demo tokens only. 10. Automated regression in `security.test.ts`.

## 6. Workflow & logic correctness

**Verdict: all 12 workflows CONFIRMED against DESIGN.md §9–12 and CLAUDE.md invariants. Zero bugs found in traced paths.** Gaps are test-coverage holes and one API surface limitation, not logic errors.

### Summary table

| # | Workflow | Verdict | Notes |
|---|----------|---------|-------|
| 1 | Happy path (create→nominate→submit→approve→accept→activate→complete) | CONFIRMED | Every guard verified: future-start, org-scoped skills, owner/role gates, nominee re-check at submit with score refresh + snapshot + round, PROPOSED→OFFERED with deadline at approve, schedule re-check in accept tx, seat-cap check, activate blockers |
| 2 | Reject loop | CONFIRMED | Note required (400 without); nominations kept on reject; round increments on resubmit. **GAP: API `review` exposes only latest submission round** (`missions.ts:577–579` — `take: 1`); prior snapshots in DB/events only |
| 3 | Decline → backfill | CONFIRMED | Seat reopens (derived); matcher excludes DECLINED/DROPPED/EXPIRED, not WITHDRAWN/RELEASED; backfill offers without re-approval; draft-nominate on approved mission → 409 |
| 4 | Dropout after approval | CONFIRMED | ACCEPTED→DROPPED with reason; mission state untouched; backfill same path as §3. **GAP (test): no ACTIVE-dropout E2E test** (code path allows it) |
| 5 | Cancel in every state | CONFIRMED (code) | Director-only; reason required; PROPOSED/OFFERED→WITHDRAWN, ACCEPTED→RELEASED atomically in one tx; pending submission→CANCELLED; crew inbox UPDATE; no notifications table. **GAP (test): E2E only cancels APPROVED** |
| 6 | Offer expiry | CONFIRMED | `min(now+ttl, start−14d)`, floor `now+1d`; lazy sweep with `actorId: null` system events, called from offers/missions/match/inbox; expired excluded from re-match; **no raw `Date.now` in src/** — injected clock everywhere |
| 7 | Accept-time conflicts | CONFIRMED | Overlapping PRIMARY ACCEPTED → `SCHEDULE_CONFLICT` before update; blocked offer stays OFFERED; lead sees `BLOCKED_FOR_LEAD` (privacy-safe, tested); crew sees specifics; switch = drop+accept two-step. Backup non-blocking is PRIMARY-only by design (TODO §1) |
| 8 | Matcher | CONFIRMED | Filter order ON_MISSION→SKILL→UNAVAILABLE→CONFLICT→REST_GAP with first-rejection funnel counts; near-miss (one skill one level); rarity −5 max with notes; Hungarian `ELIGIBLE_BONUS = 1_000_000` seats-then-quality (greedy-trap test); determinism via handle/id sort (order-independence test); `evaluateCandidate` with `ignoreOwnSeat` at submit |
| 9 | Lifecycle rules table | CONFIRMED | `MISSION_RULES` single source; exhaustive status×action×actor matrix tested (`lifecycle.test.ts:81–89`); 403 actor-first then 409 state; `CANNOT_APPROVE_OWN`; crew always FORBIDDEN. Data guards (submit/activate blockers) intentionally outside the table → 422 PRECONDITION_FAILED |
| 10 | Idempotency / transactions | CONFIRMED (code) | Double respond → `ALREADY_RESPONDED` (409); `moveMission` compare-and-set via `updateMany` + count check; submit/approve/cancel/accept/nominate/offerSeats all wrapped in `tx()`. **GAP (test): no double-respond or CAS-race tests** |
| 11 | Date math | CONFIRMED | Inclusive calendar days; overlap/gap/overlapDays tested; rest-gap boundary exactly-14 = pass, 13 = fail (tested); strict YYYY-MM-DD rejects 2026-02-30; UTC midnight storage |
| 12 | Visibility | CONFIRMED | Crew: offered-only missions (else 404), roster ACTIVE/COMPLETED + own ACCEPTED, scores never in crew payloads (tested); `allowedActions` per role/state with blockers; leads see PROPOSED/scores |

### Gaps (non-blocking)

1. **Prior review rounds not in API** — DB retains all `mission_submissions`; `review` returns latest only.
2. **Test coverage holes** — double accept/decline (`ALREADY_RESPONDED`), concurrent `moveMission` CAS race, cancel from DRAFT/SUBMITTED/REJECTED/ACTIVE, director `complete` E2E, ACTIVE dropout.
3. **Backup seats** — schema supports BACKUP; matcher/accept are PRIMARY-only, aligning with TODO §1 deferral.

## 7. Real-world edge cases (web research)

**Method:** web research across NASA/ESA/NSF/FAA/regulatory sources, mapped to DESIGN/TODO/ROADMAP. 22 candidates, each tagged HANDLES / PARTIAL / MISSING and prioritised V1.1 / ROADMAP / OUT-OF-SCOPE. **Key meta-finding: every already-planned item (backups, cert expiry, reschedule, pairing rules, per-org weights, outbox, direct-assignment) aligns with documented real-world practice — the roadmap is validated, not just invented.**

### 7.1 Confirmation table (planned items vs real practice)

| Planned item | Real-world anchor | Alignment |
| --- | --- | --- |
| Prime + backup (TODO §1) | ESA MCOP selects prime+backup together; Artemis II backup trains with prime; Soyuz backup→next prime pipeline | Strong |
| Offer deadline + launch−14 (D17) | NASA Health Stabilization Program L-14 quarantine | Strong (simplified) |
| Rest gap, org setting (D12) | HSP quarantine + 45-day post-flight reconditioning | Moderate (symmetric single gap) |
| Cert expiry (ROADMAP) | FAA §61.58 currency; NASA annual medical recert | Strong |
| Reschedule/launch slip (ROADMAP) | HSP extends/terminates quarantine on delay | Strong |
| Pairing rules (ROADMAP) | NASA Team Risk composition research; OR team matching | Directionally right |
| Per-org weights (ROADMAP) | Airline FRMS / hospital fairness metrics | Reasonable abstraction |
| Direct assignment (ROADMAP) | Agencies *assign*; MC *offers* for B2B consent | Explicit deliberate difference |
| Director-only approval (D5) | MCOP consensus simplified to director gate | Simplified but valid v1 |

### 7.2 Real-world cases mapped (22 total, condensed)

**Theme A — People:**
- **A1. Late medical grounding after offers sent** (Soyuz MS-16, ~3 weeks pre-launch) — PARTIAL: backfill + retract exist; promote backup is TODO §1. **V1.1** tests around backfill.
- **A2. Exposure-based removal inside quarantine window** (Apollo 13: Mattingly→Swigert 72h pre-launch) — PARTIAL: promote backup is closest path. **V1.1** (blocked on TODO §1).
- **A3. Certification expires between nomination and launch** (FAA PIC currency; NASA annual recert) — PARTIAL: ROADMAP `expires_at` hard filter through mission **end**. **ROADMAP**; test boundary = mission end date.
- **A4. Self-rated skill gaming vs verified ratings** — PARTIAL: TODO §2. **V1.1**.
- **A5. Operational medical waiver** (NASA Administrator-level exception) — MISSING. **OOS** (governance/liability).
- **A6. Must-not-fly-together / mentor pairing** — PARTIAL: ROADMAP pairing rules. **ROADMAP**.
- **A7. Training-eligibility gate** (ESA: no assignment before pre-assignment training) — MISSING. **OOS** / ROADMAP as training records.

**Theme B — Schedule:**
- **B1. Offer decided before quarantine window (L−14)** — HANDLES (D17). **V1.1** regression tests only.
- **B2. Launch slip after approval resets quarantine clock** — PARTIAL: ROADMAP reschedule. **ROADMAP**.
- **B3. Post-flight reconditioning asymmetry** (45-day ASCR vs 14-day pre-flight) — PARTIAL: single symmetric gap. **V1.1** boundary tests; asymmetric gaps ROADMAP.
- **B4. Cumulative duty tables** (FAR 117: 30h free in 168h) — PARTIAL: workload score approximates. **ROADMAP**; full rules OOS.
- **B5. Crew declares insufficient rest before accept** (§117.25(f)) — MISSING beyond decline-with-reason. **OOS** / V1.1 as decline+note.
- **B6. Double-booking via overlapping pending offers** — HANDLES (accept-time re-check). **V1.1** extend privacy tests.

**Theme C — Approval/governance/repair:**
- **C1. Backup accepts overlapping primary elsewhere** — PARTIAL: TODO §1 (notify lead, no auto-release). **V1.1**.
- **C2. Director ≠ owner approval; peer/N-of-M** — HANDLES (D5); modes ROADMAP. **V1.1**: seed second director per org (TODO §6).
- **C3. Lead withdraws submission pre-decision** — PARTIAL: TODO §3. **V1.1**.
- **C4. Reject→revise with note preserved** — HANDLES. **V1.1** smoke test.
- **C5. Person swap without re-approval; role change requires it** — HANDLES backfill; reschedule ROADMAP. Verify `PUT roles` on APPROVED is forbidden.
- **C6. In-mission medical evacuation** (Crew-11 early return, Jan 2026) — PARTIAL: cancel/complete exist; no "abort early without crew penalty" variant. **V1.1** commitment semantics test (RELEASED vs DROPPED).
- **C7. Atomic offer switch** — PARTIAL: TODO §5 `--replace`. **V1.1**.

**Theme D — Tenancy/ops/compliance:**
- **D1. Cross-tenant write via composite FK** — HANDLES. Keep green.
- **D2. No existence inference across tenants** — HANDLES (404).
- **D3. Per-org rest gap/TTL differ** — HANDLES (seed demonstrates 14 vs 21).
- **D4. Tenant offboarding with audit retention** — MISSING. **ROADMAP v3**.
- **D5. User erasure vs immutable audit trail** (GDPR DSAR) — PARTIAL: events keep actor_id; no erasure flow. **ROADMAP v3**.
- **D6. Notifications delivery vs inbox source of truth** — PARTIAL: inbox derived; outbox ROADMAP. **ROADMAP**.

### 7.3 Recommended minimum test pack (12 scenarios)

1. B1 — L−14 offer cap (regression) · 2. B3 — rest-gap boundary · 3. B6 — overlapping offers + accept conflict + privacy · 4. C4 — reject/resubmit round trip · 5. C5 — decline→backfill without re-approve · 6. A2/C1 — backup promote + backup/primary conflict inbox (post-TODO §1) · 7. A4 — verified skills override (post-TODO §2) · 8. C3 — submission withdraw (post-TODO §3) · 9. C7 — atomic replace (post-TODO §5) · 10. D1/D2 — tenancy FK + 404 · 11. D3 — org-specific rest gap · 12. B2 — reschedule releases crew (post-ROADMAP)

### 7.4 Sources (primary)

ESA crew assignment & pre-assignment training (esa.int) · NASA Artemis II backup announcement (nasa.gov) · NASA Health Stabilization Program Rev F, L-14 quarantine (ntrs.nasa.gov) · Apollo 13 crew change (apollojournals.org) · Soyuz MS-16 medical replacement (spaceflightnow.com) · NASA–Roscosmos seat barter (interfax, spacenews.com) · NPR 8900.1B App E operational exceptions (nodis3.gsfc.nasa.gov) · NASA Team Risk (nasa.gov/hhp) · Post-flight reconditioning ASCR 45-day (ntrs.nasa.gov 20110020318) · NSF Antarctic PQ guidelines + 45 CFR 675 · Shemenski mid-winter replacement 2001 (nsf.gov) · FAR 117 rest (ecfr.gov) · FAA §61.58 currency (ecfr.gov) · Crew-11 early medical return (spacepolicyonline.com, AP) · Multi-tenant offboarding/GDPR DSAR (multi-tenant-saas.com, learn.microsoft.com).

## 8. Adversarial race & boundary analysis

**Verdict: the `acceptOffer` race (§4) is the most severe instance of a repeatable pattern — read eligibility → count seats → `update` by bare `id` without `WHERE status = …`. The same class appears in decline, drop-out, nominate, offer, and activate.** SQLite serializable transactions mask these in single-process tests but do not fix the logic for Postgres or multi-instance deployments. 11 REAL issues beyond the known race.

### 8.1 SQLite/Prisma transaction semantics (cross-cutting)

`tx()` wraps one transaction ✅; Prisma uses SQLite SERIALIZABLE for interactive transactions; single-file + one writer makes races hard to reproduce in-process. **But the logic is still check-then-act without conditional writes** — on Postgres or multiple API instances the races become routine, and Prisma does not auto-retry business checks. `sweepExpiredOffers` often runs on `ctx.db` *before* `tx()`, widening stale-read windows.

### 8.2 Findings table

| ID | Severity | Status | Location | Issue |
|----|----------|--------|----------|-------|
| H0 | **CRITICAL** | REAL | `offers.ts:131-141` | acceptOffer: seat cap + no `OFFERED` CAS (the §4 finding, escalated) |
| H1 | HIGH | REAL | `offers.ts:169-171`, `195-197` | declineOffer / dropOut lack status CAS — accept+decline or drop+cancel → last writer wins (ACCEPTED overwritten by DECLINED, DROPPED after RELEASED) |
| H2 | HIGH | REAL | `staffing.ts:139-151`, `200-213` | Concurrent nominate / offerSeats (double-click) → duplicate PROPOSED/OFFERED rows for one seat; no DB uniqueness guard |
| H3 | HIGH | REAL | `missions.ts:484-492`, `336-338` | Submit enforces `nominated >= headcount` (not `==`); approve promotes **all** PROPOSED → multiple offers per seat, amplifies H0 |
| H4 | HIGH | REAL | `missions.ts:426-430` | activateBlockers checks `accepted >= headcount`, not `==` → can activate with over-accepted crew (downstream of H0/H2) |
| H5 | MED | REAL | `offers.ts:109-141` vs `expiry.ts:27-28` | Expiry boundary: sweep uses `expiresAt < now`; accept path doesn't re-check `expiresAt <= now` in tx — accept at exact deadline instant succeeds |
| H6 | MED | REAL | `staffing.ts:247-250` vs `offers.ts:138-141` | Retract uses `status: OFFERED` predicate; accept uses bare id → accept can land after retract |
| H7 | MED | REAL | `cli/client.ts:42-43` | Non-JSON API error (proxy HTML 502) breaks `--json` — uncaught `JSON.parse` → exit 1 instead of structured error |
| H8 | MED | THEORETICAL | `missions.ts:422-430` | Activate TOCTOU: blockers read once; dropOut between check and `moveMission` not re-checked |
| H9 | MED | REAL | `people.ts:144-168` | Overlapping unavailability windows allowed (no merge/dedupe) → duplicate UNAVAILABLE issues in matcher |
| H10 | MED | REAL | `expiry.ts:13-18` | Missions starting ≤15 days out: deadline clamps to `now+24h` floor — crew get ~24h to respond; consider failing approve if review window too short |
| H11 | LOW | REAL | `missions.ts:70-71`, `dates.ts:21-22` | "Start in future" = UTC day of now, not operator locale — document UTC-only |
| H12 | LOW | REAL | `context.ts:22-27` | Mission keys `AST-012` and `AST-12` parse to same number — reject leading zeros |
| H13 | LOW | REAL | `people.ts:117-124` | Duplicate skill keys in one setMySkills body — last wins silently |
| H14 | LOW | REAL | `schema.prisma:207-232` | No uniqueness on live seat per (mission, role, user) — enabler for H2/H3 |
| H15 | LOW | REAL | migration `20260928095500` header, `README.md:125` | v2 migration drops tables; documented as rebuild-required |
| H16 | LOW | THEORETICAL | `context.ts:17-18` | Green CI on SQLite ≠ race freedom; do not rely on single-writer serialization |

### 8.3 Positive controls (confirmed safe under concurrency)

- `moveMission` compare-and-set for mission status — approve/reject/cancel/submit/double-submit races all handled (`context.ts:59-72`)
- Edit vs submit: edit only from DRAFT/REJECTED; concurrent submit wins
- Accept-time schedule re-check inside tx (overlapping ACCEPTED blocked)
- cancel from SUBMITTED valid; cancel CANCELLED / complete COMPLETED → INVALID_TRANSITION; activate twice → second CAS fails
- One person two roles same mission: blocked by ON_MISSION after first accept; matcher seats one person globally
- Input abuse mostly covered: headcount 1–20, proficiency int 1–5, title trim+max(120), strict dates, duplicate skills/roles rejected, key injection → 404

### 8.4 Recommended race-confirmation tests

1. Two parallel accepts, headcount 1 → exactly one success (H0)
2. Parallel nominates same open seat → one success (H2)
3. Accept + decline same offer → one terminal state (H1)
4. Accept + retract concurrently (H6)
5. Submit with forced duplicate PROPOSED fixture → submit/approve should fail or trim (H3)
6. `expiresAt === now` accept (H5)
7. CLI `--json` with HTML error body (H7)

### 8.5 Bottom line

**Treat assignment status transitions like mission transitions: conditional updates + row-count checks, plus DB constraints on live seats.** The fix pattern is uniform — `updateMany({ where: { id, orgId, status: <expected> } })` with `count !== 1 → conflict`, mirroring `moveMission`. On Postgres: partial unique index on live PRIMARY seats per (mission, role) and per (mission, user).

## 9. Edge-case & test-gap enumeration

**Result: 62 concrete missing test cases** (28 P1, 28 P2, 14 P3), each with full Given/When/Then, grouped by module. Includes regression tests for the §8 race findings. Types: Unit (pure logic) · Integration (testApp + Fastify inject) · CLI-smoke (subprocess `bin/mc.mjs`).

### 9.1 Offers & assignment responses (P1-heavy)

| ID | Test | Type | Pri | Given/When/Then (condensed) |
| --- | --- | --- | --- | --- |
| OFF-001 | Double accept → ALREADY_RESPONDED | Integration | P1 | Accepted offer → accept again → 409 `ALREADY_RESPONDED`, single ACCEPTED row, no duplicate event |
| OFF-002 | Double decline → ALREADY_RESPONDED | Integration | P1 | Declined → decline again → 409, one event |
| OFF-003 | Accept after decline → ALREADY_RESPONDED | Integration | P1 | Declined → accept → 409 (not OFFER_EXPIRED) |
| OFF-004 | Decline without reason allowed | Integration | P2 | Empty body → 200 DECLINED, reason null |
| OFF-005 | Drop-out without reason → 400 | Integration | P1 | ACCEPTED → drop with `{}` → 400, stays ACCEPTED |
| OFF-006 | Accept EXPIRED row → OFFER_EXPIRED | Integration | P1 | Past deadline + swept → accept → 409 |
| OFF-007 | Lazy sweep writes system OFFER_EXPIRED | Integration | P1 | Two expired offers → any accept triggers sweep → both EXPIRED, events with `actor: null` |
| OFF-008 | **Concurrent accept overbooking (headcount 1)** | Integration | P1 | Two crew OFFERED same role → `Promise.all` accepts → exactly one 200; **regression test for the H1 CAS fix — will fail until fixed** |
| OFF-009 | Accept when role filled (sequential) → ROLE_FILLED | Integration | P1 | leo ACCEPTED → tomas (still OFFERED) accepts → 409 |
| OFF-010 | Drop-out on ACTIVE mission E2E | Integration | P1 | ACTIVE + all accepted → drop with reason → 200 DROPPED, mission stays ACTIVE, lead inbox OPEN_SEATS, matcher excludes |
| OFF-011 | Respond when mission CANCELLED | Integration | P2 | Offer WITHDRAWN by cancel → accept → 409 INVALID_TRANSITION |

### 9.2 Mission lifecycle & concurrency

| ID | Test | Type | Pri | Given/When/Then (condensed) |
| --- | --- | --- | --- | --- |
| LFC-001 | Concurrent double-approve CAS | Integration | P1 | Two directors `Promise.all` approve → exactly one 200, other 409 INVALID_TRANSITION, no duplicate OFFERS_SENT |
| LFC-002–005 | Cancel from DRAFT / SUBMITTED / REJECTED / ACTIVE | Integration | P1–P2 | Each state → 200 CANCELLED; SUBMITTED also marks submission CANCELLED + clears director inbox; ACTIVE releases ACCEPTED with reason + crew inbox UPDATE |
| LFC-006 | Director (non-owner) completes | Integration | P1 | ava completes marcus's ACTIVE mission → 200, event actor ava |
| LFC-007 | Owner cannot complete from APPROVED | Integration | P2 | → 409 INVALID_TRANSITION |
| LFC-008 | Double submit | Integration | P1 | SUBMITTED → submit again → 409, round unchanged |
| LFC-009 | Submit with zero roles | Integration | P1 | → 422 PRECONDITION_FAILED, blocker "Add at least one role" |
| LFC-010 | Activate with partially accepted seats | Integration | P1 | 1 of 2 roles accepted → 422 naming the under-filled role |
| LFC-011 | Edit from SUBMITTED forbidden | Integration | P2 | PATCH title → 409/403 |
| LFC-012/013 | Every action from COMPLETED / CANCELLED | Integration | P2 | Table-driven: all non-read actions → 409 |

### 9.3 Staffing, deadlines, org settings

| ID | Test | Type | Pri | Given/When/Then (condensed) |
| --- | --- | --- | --- | --- |
| STF-001 | Deadline uses launch−14d cap | Integration | P1 | TTL 7d, start in 10d → expiresAt = start−14d (not now+7d) |
| STF-002 | 24h minimum floor | Integration | P1 | Start tomorrow → expiresAt ≥ now+24h |
| STF-003 | Backfill inherits deadline rule | Integration | P2 | Post-decline offer → expiresAt matches formula |
| STF-004 | Manual nominate NOT_ELIGIBLE | Integration | P1 | nav=3 into nav≥4 role → 422/409 with rejection detail, no PROPOSED row |
| STF-005/006 | Retract non-existent / after ACCEPTED | Integration | P2 | → 404 both ways |
| STF-007 | Nominate on APPROVED → 409 | Integration | P2 | Explicit code assertion |
| STF-008 | Org rest gap Astra 14 vs Lunar 21 | Integration | P1 | Same 13-free-day gap → Astra accept 200, Lunar 409 SCHEDULE_CONFLICT |
| STF-009 | Rest-gap boundary via API (14 pass / 13 fail) | Integration | P1 | Mirror unit boundary through HTTP approve/accept |
| STF-010 | `offerDeadline` pure cases | Unit | P2 | Long horizon / L−14 cap / 24h floor tuples |

### 9.4 Matcher

MAT-001 role headcount 0 rejected (P2) · MAT-002 zero-skill crew funnel (P2) · MAT-003 funnel counts sum to considered (P2) · MAT-004 tie-break stability with identical scores, order swapped (P2) · MAT-005 rarity when nobody holds the rare skill — no NaN (P3) · MAT-006/007/008 near-miss boundaries: exactly one level short included, two short or missing excluded (P2) · MAT-009 one-day window no divide-by-zero (P2) · MAT-010 workload ±90d horizon edge (P2) · MAT-011 headcount met → no recommendations (P2) · MAT-012 all candidates ON_MISSION → funnel explains (P2).

### 9.5 Hungarian

HUN-001 0×n (P3, keep as regression) · HUN-002 n×0 (P2) · HUN-003 single candidate multiple roles (P2) · HUN-004 all-disallowed (P2) · HUN-005 rectangular 1×5 (P3) · HUN-006 large-N determinism 20×20 twice (P3) · HUN-007 explicit tie optima (P3).

### 9.6 Dates & scheduling

DAT-001 leap-day window (P2) · DAT-002 Dec→Jan year-boundary workload (P2) · DAT-003 start==end one-day mission (P2) · DAT-004/005 unavailability touching mission start/end day = conflict, inclusive (P2) · DAT-006 rest gap both sides of mission (P2) · DAT-007 adjacent ranges gap 0 (P3).

### 9.7 People, org, validation

PPL-001/002 skill level 0 / 6 rejected (P2) · PPL-003 duplicate skill key in one PUT — lock actual behaviour (P2) · PPL-004 remove absent skill → 404 (P3) · PPL-005 unavailability end<start → 400 (P1) · PPL-006 overlapping unavailability — document policy (P3) · PPL-007/008 restGapDays −1 / offerTtlDays 0 → 400 (P2) · PPL-009 duplicate skill key → 409 DUPLICATE (P2) · PPL-010 crew filter unknown skill → 400 (P3).

### 9.8 Tenancy, security, visibility

SEC-001 Bearer trailing whitespace trimmed (P2) · SEC-002 `bearer` case-insensitive (P2) · SEC-003 wrong-prefix key cross-org → 404 (P2) · SEC-004 numeric id scoped per org (P2) · **SEC-005 crew mission list excludes PROPOSED-only missions (P1)** · SEC-006 crew inbox never contains REVIEW/OPEN_SEATS (P2) · SEC-007 lead inbox no cross-org keys (P2) · SEC-008 strict body rejects extra fields on offers (P3).

### 9.9 CLI

CLI-001 `--json` parseable on representative commands (P2) · CLI-002 exit 3 invalid token (P1) · CLI-003 exit 8 unreachable API (P1) · CLI-004 exit 6 conflict (P2) · CLI-005 exit 7 validation (P2) · CLI-006 exit 4 forbidden (P2) · CLI-007 exit 5 not found (P2) · CLI-008 cancel confirmation abort (P2) · CLI-009 `mc use` prefix ambiguity error (P3) · CLI-010 drop requires `--yes` in scripts (P2).

### 9.10 Seed/demo + lifecycle unit extensions + misc

DEM-001 seed idempotency — lock intended contract (P3) · DEM-002 demo never touches default config dir (P3) · DEM-003 setup destructive rebuild (P3) · LFC-U01/U02 offer/match/nominate from terminal/approved states (P2–P3) · **WF-001 submit re-checks ineligible nominee with nominee-specific blockers (P1)** · WF-002 roles redefine clears PROPOSED + reports count (P2) · WF-003 unnominate draft seat (P3) · WF-004 history includes OFFER_RETRACTED (P3).

### 9.11 Implementer notes

1. Concurrency tests: `Promise.all` against a single shared app instance; assert DB state after both settle.
2. OFF-008 will fail until the H1 CAS fix lands — mark `@expect-fail` with a comment referencing this audit.
3. CLI-smoke: vitest `spawn` + temp `MC_CONFIG_DIR`, mirroring `scripts/demo.ts`.
4. STF-009: reuse dates from `matcher.test.ts:127–142` through HTTP instead of `runMatch`.
5. Hungarian brute-force (300 matrices) already covers optimality — new cases add edge dimensions only.

---

## Appendix A — Findings summary (deduplicated, ranked)

### CRITICAL / HIGH

**Root cause shared by H1–H5: assignment status transitions lack the compare-and-set discipline that mission transitions have.** Uniform fix pattern: `updateMany({ where: { id, orgId, status: <expected> } })` with `count !== 1 → conflict` (mirror `moveMission`), plus DB constraints on live seats when moving to Postgres. SQLite's single-writer serialization masks all of these in tests.

| # | Finding | Source | Location |
|---|---------|--------|----------|
| H1 | **CRITICAL — `acceptOffer` missing CAS** — concurrent accepts overbook the last seat; retract/cancel/decline race a promote to ACCEPTED | §4 Bugbot, §8 Adversarial | `offers.ts:131-141` |
| H2 | **`declineOffer`/`dropOut` lack CAS** — last-writer-wins vs accept/cancel (ACCEPTED overwritten by DECLINED; DROPPED after RELEASED) | §8 Adversarial | `offers.ts:169-171,195-197` |
| H3 | **Concurrent nominate/offerSeats duplicate live seats** — double-click backfill creates two OFFERED for one seat; no DB uniqueness | §8 Adversarial | `staffing.ts:139-151,200-213`; schema `207-232` |
| H4 | **Submit enforces `>=` not `==`; approve fans out ALL PROPOSED** → multiple offers per seat, amplifies H1 | §8 Adversarial | `missions.ts:484-492,336-338` |
| H5 | **Activate allows over-accepted crew** (`accepted >= headcount`, not `==`) | §8 Adversarial | `missions.ts:426-430` |
| H6 | **CLI trusts `fetch` generics** — `return payload as T`, no runtime validation of API responses | §2 Type safety | `cli/client.ts:54` |
| H7 | **JSON columns unvalidated on read** — `scoreBreakdown`/`payload` flow from Prisma Json to API/CLI without zod | §2 Type safety | `missions.ts:604,809` |

### MED

| # | Finding | Source | Location |
|---|---------|--------|----------|
| M1 | **Updates by bare `id`** without `orgId`/status predicates in WHERE (6 locations) — defence-in-depth; no demonstrated exploit | §5 Privacy, §4 Bugbot | `missions.ts:177,245,315`; `offers.ts:138,169,195` |
| M2 | **Crew profile exposes `commitment` metric** — numeric, score-like; tension with D14 "crew never see scores". **Product decision needed:** hide from crew self-view, or amend D14 to permit aggregate reliability metrics | §1 Decision trail (call D) | `people.ts:67-71,102-107` |
| M3 | **Decision #12 manifest mismatch** — create requires start/end dates; manifest said "title + note only". Code arguably correct; **fix the doc/claim** | §1 Decision trail | `validation.ts:45-50` |
| M4 | **No `never`-checked exhaustive switches** (violates workspace rule) — new enum/event variants won't fail compile | §2 Type safety | `matcher.ts:83-98`; `offers.ts:93-103`; `cli/commands/missions.ts:594-632` |
| M5 | **API DTOs widen enums to `string`** — compile-time alignment lost at the boundary | §2 Type safety | `missions.ts:504-556,733-744`; `offers.ts:21-39`; `people.ts:102+` |
| M6 | **`AssignmentRow` hand-written**, can drift from `assignmentSelect` | §2 Type safety | `snapshot.ts:15-35` |
| M7 | `evaluation.shortfalls[0]!` assumes non-empty in branch | §2 Type safety | `matcher.ts:261` |
| M8 | **Prior submission rounds not exposed** — DB retains all; API `review` returns latest only | §6 Workflow | `missions.ts:577-579` |
| M9 | **Expiry boundary** — sweep uses `expiresAt < now`; accept doesn't re-check `expiresAt <= now` in tx (accept at exact deadline instant succeeds) | §8 Adversarial | `offers.ts:109-141`; `expiry.ts:27-28` |
| M10 | **Accept vs retract race** — retract has status predicate, accept doesn't | §8 Adversarial | `staffing.ts:247-250` vs `offers.ts:138-141` |
| M11 | **CLI `--json` breaks on non-JSON error bodies** (proxy HTML 502 → uncaught parse → exit 1). **Observed in the wild 2026-09-28:** an unrelated Next.js dev server occupied port 3000; `mc login` received its HTML 404 page and printed `Unexpected token '<'` instead of a useful error | §8 Adversarial + live repro | `cli/client.ts:42-43` |
| M14 | **CLI doesn't verify the server is Mission Control** — any HTTP server on the default port is treated as the API. Live repro: login against a Next.js server. Fix: check a marker field on `/v1/health` (e.g. `{ service: "mission-control" }`) during `login` before saving the profile | Live repro 2026-09-28 | `cli/commands/session.ts:28-36` |
| M12 | **Overlapping unavailability windows allowed** — no merge/dedupe | §8 Adversarial | `people.ts:144-168` |
| M13 | **Short-fuse missions clamp offer deadline to ~24h** — crew get a day to respond; consider failing approve if review window too short | §8 Adversarial | `expiry.ts:13-18` |

### LOW

Query schemas non-strict (`validation.ts:97-114`) · config `chmod 0o600` only on write (`cli/config.ts`) · token in argv/`MC_TOKEN` in env · no 401 rate-limit / constant-time compare (documented trade-off) · same-org 403s disclose capability existence · pino auth-header redaction not configured · path params not zod-parsed · CLI exit codes keyed by HTTP status not `ErrorCode` · production `any` in `EventRow.payload` (`missions.ts:587`).

### Test-coverage gaps (§6 + §7)

Double accept/decline → 409 (`ALREADY_RESPONDED`) · concurrent `moveMission` CAS race · cancel from DRAFT/SUBMITTED/REJECTED/ACTIVE (E2E covers APPROVED only) · director `complete` E2E · ACTIVE dropout · rest-gap boundary (14 pass / 13 fail — unit-covered, add integration) · L−14 offer cap regression · org-specific rest-gap difference (Astra 14 vs Lunar 21) · backup promote + backup/primary conflict inbox (post-TODO §1) · verified-skills override (post-TODO §2) · submission withdraw (post-TODO §3) · atomic `--replace` (post-TODO §5).

### Product decisions needed (not bugs)

1. **M2** — commitment metric in crew self-view: hide or amend D14.
2. **M3** — mission create: dates required (code) vs "title + note only" (manifest). Align doc or code.
3. **BACKUP copy in inbox text** (`inbox.ts:235`) references a feature not shipped until TODO §1 — verify it never renders for v1 offers.

### What held up (verified safe/correct across all reviewers)

Tenancy isolation (composite FKs, org-scoped queries, 404-not-403, key prefix) · hashed tokens · strict zod bodies · all 12 workflows · matcher (Hungarian, rarity, filters, determinism) · lifecycle rules table · date math · privacy rules (D14/D17) · idempotent offer responses (single-threaded) · transactional multi-row writes · audit log.

---

## Appendix B — How to exercise the system yourself

**One-time setup** (from `mission-control/`):

```bash
npm run setup     # rebuilds + seeds the DB (destructive, dev only)
npm run dev       # terminal 1: API on http://127.0.0.1:3000
```

**CLI access:** `npm link` once to put `mc` on PATH, or prefix with `npm run mc -- `.

**Personas** (seed prints the full table):

```bash
mc login mct_astra_marcus    # mission lead, Astra
mc login mct_astra_ava       # director, Astra
mc login mct_astra_leo       # crew, Astra
mc login mct_lunar_owen      # lead, Lunar Collective (other tenant)
```

Each login creates a named profile; switch with `mc use marcus`, list with `mc profiles`.

**Five-minute tour:**

```bash
mc whoami
mc inbox                          # role-specific to-do list
mc missions list
mc missions show AST-6            # seats, review state, "You can" hints
mc missions match AST-5           # ranked crew with notes; add --explain
mc offers list                    # as leo: pending offers
mc offers accept <id>
mc missions history AST-6         # audit trail
mc org settings                   # rest gap, offer TTL
```

**Deliberate negative tests:** as `mct_lunar_owen`, `mc missions show AST-6` → 404 (existence never confirmed cross-tenant). As marcus, approve a mission he created → `CANNOT_APPROVE_OWN`.

**Watch the DB live:** `npx prisma studio`.

**Full scripted proof:** `npm run demo` — 26 CLI steps on a throwaway DB with expected exit codes (verified green at audit time).

---

## Appendix C — Resolution (2026-09-29)

Every finding, what was done, and the test that now guards it. Totals after the fixes: **142 tests in 14 files, all green**; typecheck clean; `npm run demo` 45/45 (extended with login and 14 refused attempts).

### Critical / high

| # | Finding | Resolution | Guarded by |
|---|---------|------------|------------|
| H1 | `acceptOffer` without compare-and-set | **Fixed.** Accept locks the person, then the mission, re-reads the offer, checks schedule and seats, and writes with `moveAssignment` (`WHERE status = 'OFFERED'`). Severity note: Prisma runs SQLite transactions one at a time (measured), so the shipped single-process deployment could not hit it; the fix keeps Postgres / multi-instance correct. | `concurrency.test.ts` "two people accepting the last seat", `edges.test.ts` "never lets a role go over headcount" |
| H2 | decline / drop last-writer-wins | **Fixed** — same lock + compare-and-set. | `concurrency.test.ts` "accept racing decline" |
| H3 | duplicate live seats from concurrent nominate / offer | **Fixed** — all staffing writes go through `withLockedMission`. DB-level partial unique index stays on TODO §7 (Postgres). | `concurrency.test.ts` double-clicked backfill / nominate |
| H4 | submit accepted `>=` nominees | **Fixed** — exact count; over-nomination blocked with "remove N". | `edges.test.ts` "more nominees than seats" |
| H5 | activate accepted over-filled roles | **Fixed** — exact count. | covered by the same guard + simulation invariants |
| H6 | CLI trusts `fetch` generics | **Partly.** Non-JSON and non-Mission-Control replies are detected (exit 8), error bodies are type-guarded, success bodies must be JSON objects. Full per-endpoint response schemas declined: first-party client sharing the server's types. | `cli-client.test.ts` |
| H7 | JSON columns unvalidated on read | **Won't fix** — written only by the app. CLI renders them through defensive readers (typed event payload reader, breakdown guard). | — |

### Medium

| # | Finding | Resolution |
|---|---------|------------|
| M1 | updates by bare `id` | **Fixed** — `orgId` (and expected status) in every update's WHERE; submission decisions use compare-and-set too. |
| M2 | crew see their commitment score | **Decided and fixed** — crew see counts only; leads/directors see the score (DESIGN D14). Test: `edges.test.ts`. |
| M3 | "title + note only" | **Clarified** — referred to approval decisions, not mission creation; DESIGN D5 reworded. No code change. |
| M4 | no `never`-checked switches | **Fixed** — matcher, offers, lifecycle, scheduling, CLI event describer. |
| M5 | DTOs widen enums to `string` | **Fixed** — mission, seat, review, summary, offer, match and profile views use Prisma enums; CLI `Me` derives from the service type. |
| M6 | hand-written `AssignmentRow` | **Fixed** — `Prisma.AssignmentGetPayload<{ select: typeof assignmentSelect }>`. |
| M7 | `shortfalls[0]!` | **Fixed** — destructured with an explicit check. |
| M8 | earlier review rounds hidden | **Fixed** — `reviews[]` in the mission view; CLI prints earlier rounds. Test: `edges.test.ts`, Vanguard scenario. |
| M9 | expiry at the exact deadline | **Fixed** — expired when `now ≥ deadline`, on the sweep and inside accept/decline. Tests: `expiry-ports.test.ts`, `edges.test.ts`. |
| M10 | accept vs retract race | **Fixed** by H1's locking. Test: `concurrency.test.ts`. |
| M11 | CLI crashes on HTML error bodies | **Fixed** — "isn't the Mission Control API (it replied with a web page)", exit 8. Test: `cli-client.test.ts`. |
| M14 | CLI doesn't verify it is talking to Mission Control | **Fixed** — `/v1/health` returns `service: "mission-control"`; `mc login` and new `mc doctor` check it. The API also **moves to the next free port** when 3000 is taken (knocking on IPv4 + IPv6 before binding — on Windows a bind to 127.0.0.1:3000 succeeds even while Next.js holds 0.0.0.0:3000) and records its address in `~/.mission-control/server.json`, which the CLI reads (DESIGN D22). Verified live against the Next.js server on :3000. Tests: `expiry-ports.test.ts`, `cli-client.test.ts`. |
| M12 | overlapping unavailability | **Fixed** — rejected with guidance to merge. Test: `edges.test.ts`. |
| M13 | short-fuse missions get ~24 h | **Decided: warn, don't block** — approve and backfill return `warnings`, shown by the CLI. Tests: `edges.test.ts`, Aurora scenario. |

### Low

| Finding | Resolution |
|---------|------------|
| Query schemas non-strict | **Fixed** (`z.strictObject`); unknown query params → 400. |
| `chmod 0o600` only on write | Not changed (low value on Windows; documented). |
| Token in argv / env | **Mitigated** — `mc login` with no argument prompts (or reads stdin). |
| No 401 rate limit / constant-time compare | Documented trade-off; unchanged. |
| Same-org 403s disclose capability | Intentional; unchanged. |
| pino auth-header redaction | **Fixed** (`redact: ['req.headers.authorization']`); server logs default to `warn`. |
| Path params not zod-parsed | Keys/handles are resolved through scoped lookups (404); keys with leading zeros are now rejected. |
| CLI exit codes keyed by HTTP status | Kept; documented. |
| Production `any` in `EventRow.payload` | **Fixed** — `Record<string, unknown>` + typed reader. |
| H12 `AST-012` == `AST-12` | **Fixed** — leading zeros → 404. |
| H13 duplicate skill keys in one request | **Fixed** — 400. |

### Test-coverage gaps (§6, §9) — now covered

Double accept / decline, accept after decline, decline without reason, drop without reason, exact-deadline expiry, responses after cancel, cancel from DRAFT / SUBMITTED / REJECTED / APPROVED / ACTIVE, director completes, complete before active, double submit, submit without roles, edit while submitted, every action on terminal missions, ACTIVE drop-out + backfill, L−14 cap, 24 h floor, backfill deadline, NOT_ELIGIBLE manual nomination, retract non-existent, per-org rest gap, nominee re-check at submit, crew list excludes nominations, concurrent approve / accept / nominate / backfill. Beyond the audit's list: four scenario organisations, a six-org tenancy matrix (30 directions), 2,000-org matcher fuzzing against independent reference implementations, and a 500-step randomised workflow simulation with invariants checked after every step (`tests/scenarios`, `tests/property`).

### Found while writing the new tests

- Unfillable-seat message read "only 1 eligible; 0 are needed in other roles" → now "only 1 eligible for 2 open seats".
- A director's own mission in a one-director org waited silently for a review that could never happen → owner's inbox now shows `NO_REVIEWER` with the cancel command.
- Crew asking for the audit log of a mission they are on got "Mission AST-6 not found" — denying a mission they had just viewed → now a named refusal ("The audit log is for mission leads and directors."); a mission they were never offered is still "not found". Guarded by `edges.test.ts` and demo step 37.
