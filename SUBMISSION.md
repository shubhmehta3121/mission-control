# Mission Control — reviewer's guide

Everything submitted for the Mission Control challenge is in this repository. This page is the map: what each file is, where to look for a given question, and what changed along the way.

> **Short on time?** Open **[test-report.html](https://raw.githack.com/shubhmehta3121/mission-control/master/test-report.html)** (the system working, with proof) and **[design.html](https://raw.githack.com/shubhmehta3121/mission-control/master/design.html)** (the design, with diagrams). These links open the pages straight from this repository through raw.githack.com, because GitHub itself shows `.html` files as source. In a local clone, open the files directly.

## What the brief asks for, and where it is

| The brief asks for | Where it is |
| --- | --- |
| The **initial design document**, prepared before implementation and used to guide the AI agent | [DESIGN.md at commit `cdab97d`](https://github.com/shubhmehta3121/mission-control/blob/cdab97d/DESIGN.md) (v1). The design as built is [DESIGN.md](./DESIGN.md) (v2.1), rendered with diagrams as [design.html](https://raw.githack.com/shubhmehta3121/mission-control/master/design.html). Its [revision history](./DESIGN.md#revision-history) records what changed and why. |
| A **working API and CLI**, easy to run locally, with clear setup and representative seed data | [README.md → Setup](./README.md#setup-about-2-minutes): four commands. The seed is two organisations, 22 people and 12 missions across the lifecycle ([prisma/seed.ts](./prisma/seed.ts)). |
| **Source code** with a meaningful commit history | This repository: one commit per layer or feature (`git log --oneline`). |
| **Full AI transcripts**, unedited | [transcripts/](./transcripts/) |
| Evidence of verification | [test-report.html](https://raw.githack.com/shubhmehta3121/mission-control/master/test-report.html): 142 automated tests and a 45-step CLI demo, generated from a real run by `npm run report`. |

## Reading paths

- **10 minutes.** In [test-report.html](https://raw.githack.com/shubhmehta3121/mission-control/master/test-report.html): the summary, [Brief → design → proof](https://raw.githack.com/shubhmehta3121/mission-control/master/test-report.html#brief), [Who is refused](https://raw.githack.com/shubhmehta3121/mission-control/master/test-report.html#refusals), then skim the [CLI demo](https://raw.githack.com/shubhmehta3121/mission-control/master/test-report.html#demo). In [design.html](https://raw.githack.com/shubhmehta3121/mission-control/master/design.html): the [revision history](https://raw.githack.com/shubhmehta3121/mission-control/master/design.html#revision-history) and the [decision log](https://raw.githack.com/shubhmehta3121/mission-control/master/design.html#5-decision-log).
- **30 minutes.** Add the design's [data model](./DESIGN.md#9-data-model), [mission lifecycle](./DESIGN.md#10-mission-lifecycle) and [matching engine](./DESIGN.md#12-matching-engine) sections, then the code they describe: [src/domain/lifecycle.ts](./src/domain/lifecycle.ts) and [src/matcher/](./src/matcher/). Run the [five-minute tour](./README.md#a-five-minute-tour).
- **How the AI was directed and checked.** [How we worked](#how-we-worked) (three models, two tools, manual review); the [build order with acceptance criteria](./DESIGN.md#20-build-order-and-acceptance-criteria-used-to-direct-the-agent) given to the agent; [CLAUDE.md](./CLAUDE.md), the invariants it must not break; [AUDIT.md](./AUDIT.md), an independent audit of the generated code, with each finding's resolution in [Appendix C](./AUDIT.md#appendix-c--resolution-2026-09-29); and the [transcripts](./transcripts/).

## Every document

| File | What it is | Read it for |
| --- | --- | --- |
| [README.md](./README.md) | Setup, a five-minute CLI tour, the test layers, troubleshooting | Running it |
| [DESIGN.md](./DESIGN.md) · [design.html](https://raw.githack.com/shubhmehta3121/mission-control/master/design.html) | The design document: problem, research into real crew assignment, 22 numbered decisions with the alternatives considered, architecture, data model, lifecycles, matching engine, visibility rules, API, CLI, verification, build order | The design |
| [test-report.html](https://raw.githack.com/shubhmehta3121/mission-control/master/test-report.html) | The verification report, generated from a real run: every test by layer, each brief requirement traced to its design section and tests, 14 refused attempts, and the full CLI demo as it appears in a terminal | Proof |
| [AUDIT.md](./AUDIT.md) | A multi-agent audit of the AI-generated code (decision trail, type safety, security, tenancy, races, edge cases). Appendix C maps every finding to its fix and the test that guards it | How the output was checked |
| [CLAUDE.md](./CLAUDE.md) | The working agreement for AI agents in this repository: commands, invariants, where changes go, gotchas | How the agent was constrained |
| [TODO.md](./TODO.md) | The next seven items, in order, each one pull request | What comes next |
| [ROADMAP.md](./ROADMAP.md) | v2 (product depth) and v3 (platform scale) | The longer term |
| [notion_challenge_brief.md](./notion_challenge_brief.md) | The challenge brief | Reference |
| [transcripts/](./transcripts/) | Unedited AI sessions | The process |

## Where to look for…

| Question | Decided in | Code | Proven by |
| --- | --- | --- | --- |
| How is tenant data kept apart? | [§7 Tenancy](./DESIGN.md#7-tenancy-and-authentication), [§9 Data model](./DESIGN.md#9-data-model) | [prisma/schema.prisma](./prisma/schema.prisma) (composite `(org_id, id)` foreign keys), [src/services/context.ts](./src/services/context.ts) | [security.test.ts](./tests/integration/security.test.ts), [tenancy-matrix.test.ts](./tests/scenarios/tenancy-matrix.test.ts) (six orgs, 30 directions) |
| Who can do what? Can a lead approve their own mission? | [§8 Roles](./DESIGN.md#8-roles-and-permissions), [§10 Lifecycle](./DESIGN.md#10-mission-lifecycle) | [src/domain/lifecycle.ts](./src/domain/lifecycle.ts) (rules as data) | [lifecycle.test.ts](./tests/unit/lifecycle.test.ts), ["Who is refused" in the test report](https://raw.githack.com/shubhmehta3121/mission-control/master/test-report.html#refusals) |
| How does matching work? | [§3 Real crew assignment](./DESIGN.md#3-how-real-crew-assignment-works-and-what-we-took-from-it), [§12 Matching engine](./DESIGN.md#12-matching-engine) | [matcher.ts](./src/matcher/matcher.ts), [scoring.ts](./src/matcher/scoring.ts), [hungarian.ts](./src/matcher/hungarian.ts) | [matcher.test.ts](./tests/unit/matcher.test.ts), [hungarian.test.ts](./tests/unit/hungarian.test.ts), [matcher.property.test.ts](./tests/property/matcher.property.test.ts) (2,000 random orgs) |
| How is double booking prevented, even under simultaneous requests? | [§13 Offers and conflicts](./DESIGN.md#13-offers-deadlines-and-conflicts), D21 in the [decision log](./DESIGN.md#5-decision-log) | [scheduling.ts](./src/domain/scheduling.ts), [offers.ts](./src/services/offers.ts), [staffing.ts](./src/services/staffing.ts), [context.ts](./src/services/context.ts) (`lockMission`, `moveAssignment`) | [workflow.test.ts](./tests/integration/workflow.test.ts), [concurrency.test.ts](./tests/integration/concurrency.test.ts), [workflow.simulation.test.ts](./tests/property/workflow.simulation.test.ts) |
| What does each role see? | [§14 Visibility](./DESIGN.md#14-visibility-rules-who-sees-what) | [missions.ts](./src/services/missions.ts) (lead and crew views), [people.ts](./src/services/people.ts) | [edges.test.ts](./tests/integration/edges.test.ts), [security.test.ts](./tests/integration/security.test.ts) |
| What is the CLI like to use? | [§17 CLI](./DESIGN.md#17-cli), D20 and D22 in the [decision log](./DESIGN.md#5-decision-log) | [src/cli/](./src/cli/) | [The CLI demo in the test report](https://raw.githack.com/shubhmehta3121/mission-control/master/test-report.html#demo), [scripts/demo.ts](./scripts/demo.ts), [cli-client.test.ts](./tests/unit/cli-client.test.ts) |
| Edge cases? | [§15 Edge cases](./DESIGN.md#15-edge-cases-handled) | across [src/services/](./src/services/) | [edges.test.ts](./tests/integration/edges.test.ts), [scenario-orgs.test.ts](./tests/scenarios/scenario-orgs.test.ts) (four very different organisations) |

## What changed along the way

The [revision history](./DESIGN.md#revision-history) in DESIGN.md has the full detail. In short:

| Version | When | What changed | Why |
| --- | --- | --- | --- |
| **v1** | Before implementation (`cdab97d`) | The initial design. | — |
| **v2** | After a design review, before the main build (`852c155`) | Requirements expressed as **roles**. The whole crew seated at once (**Hungarian assignment**) with a **rarity** penalty. Workload over **±90 days** plus a per-organisation **rest gap**. **Offers only after director approval**, and approval by **directors only**. A **commitment** score from drop-outs. The roster revealed at ACTIVE. **Composite foreign keys**. Lifecycle rules **as data**. Offer **deadlines**. Readable keys and CLI profiles. | The review found contradictions an agent would resolve by guessing, and a brief requirement v1 had left out. |
| **v2.1** | After the audit | See the list below. | [AUDIT.md Appendix C](./AUDIT.md#appendix-c--resolution-2026-09-29) |

**v2.1, in detail:**
- **Every seat change locks, re-reads, then writes with compare-and-set** (D21), so two simultaneous requests can never double-book a seat.
- **Exact seat counts** at submit and activate; offers expire at the exact deadline instant; short-notice approvals **warn** the director.
- **The API moves to a free port** when 3000 is taken and identifies itself; the CLI finds it, refuses to talk to any other app, and gains `mc doctor`. `mc login` can prompt for the token (D22).
- **Privacy:** crew see their counts but not their commitment score. Crew asking for a mission's audit log get a clear refusal, instead of "not found" for a mission they can see.
- The inbox flags a director's own mission when **no other director can review it**.
- **Tests grew from 53 to 142** across five layers. **The CLI demo grew from 26 to 45 steps**, including 14 attempts that must be refused. **`npm run report`** builds [test-report.html](https://raw.githack.com/shubhmehta3121/mission-control/master/test-report.html).

## How we worked

No single tool built this. The work moved between three AI models in two tools:

- **Claude Code**, with **Claude Opus 5.5**;
- **Cursor**, with **Kimi K3 Max** and **Composer 2.5**.

Ideas, drafts and reviews passed back and forth between them. One model's output was often the next one's input to challenge or refine, and the code was read and checked by hand throughout. What you see is the combination of all three models and that manual review.

What kept them consistent was the repository itself: [DESIGN.md](./DESIGN.md) as the single source of truth, [CLAUDE.md](./CLAUDE.md) for the invariants no change may break, and a test suite every change had to pass. The first 71 commits carry Cursor's co-author line and the final ones carry Claude's. Neither says which tool wrote the code; the [transcripts](./transcripts/) show who did what.

## How the work went

1. **Brief → initial design and scaffold:** `cdab97d` … `96d07f4`.
2. **Design review:** research into how real crew assignment works ([§3](./DESIGN.md#3-how-real-crew-assignment-works-and-what-we-took-from-it)), with each decision agreed one by one. The result was design v2 (`852c155`), plus TODO.md, ROADMAP.md and CLAUDE.md.
3. **Build v2, layer by layer**, following the [build order](./DESIGN.md#20-build-order-and-acceptance-criteria-used-to-direct-the-agent): database → lib → domain → matcher → services → HTTP → CLI → seed → demo, each with its tests (`522c6d4` … `daeec48`).
4. **Audit:** a multi-agent review of the generated code → [AUDIT.md](./AUDIT.md) (`69454e3`).
5. **Resolution and verification:** every finding fixed or deliberately declined, with the reason ([Appendix C](./AUDIT.md#appendix-c--resolution-2026-09-29)), plus the test layers, the extended demo and the report. The result was v2.1.

The [transcripts](./transcripts/) show each phase as it happened.

## Run it yourself

Requires Node.js ≥ 22.12.

```bash
npm install
npm run setup               # database from migrations + seed data; prints a login line per person
npm run dev                 # the API (moves to 3001, 3002… if 3000 is taken) — leave it running
npm link                    # in a second terminal: puts `mc` on your PATH
mc doctor                   # checks the CLI reaches Mission Control
mc login mct_astra_marcus   # a mission lead; then try `mc inbox`
```

Without starting anything: `npm test` (142 tests), `npm run demo` (the 45-step story on a throwaway database), `npm run report` (both, rendered into test-report.html). The [README](./README.md) has the full tour and troubleshooting.

## Repository layout

- [src/](./src/)
  - [lib/](./src/lib/): dates (inclusive calendar days), errors, injectable clock, token hashing, free-port finding, local server discovery
  - [domain/](./src/domain/): lifecycle and permission rules as data, the single schedule-rules implementation, types, audit event catalogue
  - [matcher/](./src/matcher/): the pure matching engine (scoring, Hungarian assignment, explanations); no I/O
  - [services/](./src/services/): every business operation, always scoped to the caller's organisation
  - [http/](./src/http/): Fastify app, authentication, error mapping, zod validation, routes
  - [cli/](./src/cli/): the `mc` CLI (commands, profiles, API client, terminal rendering)
- [prisma/](./prisma/): schema, append-only migrations, seed data
- [tests/](./tests/): [unit/](./tests/unit/), [integration/](./tests/integration/), [scenarios/](./tests/scenarios/), [property/](./tests/property/), [support/](./tests/support/)
- [scripts/](./scripts/): setup, the CLI demo, and the generators for design.html and test-report.html
- [bin/mc.mjs](./bin/mc.mjs): CLI launcher
- [transcripts/](./transcripts/): AI sessions

## Known limits

What the tests do not prove yet is listed at the end of [the test report](https://raw.githack.com/shubhmehta3121/mission-control/master/test-report.html#gaps): true parallel transactions on Postgres ([TODO §7](./TODO.md#7-storage-hardening-for-postgres)), a per-flag CLI suite, scale beyond 60 crew, and features not built yet. The next items are in [TODO.md](./TODO.md), in order; the longer term is in [ROADMAP.md](./ROADMAP.md).
