# Mission Control

> **Reviewing this submission?** Start with **[SUBMISSION.md](./SUBMISSION.md)**: a map of the whole package (design, verification report, audit, transcripts) and where to look for what.

A multi-tenant crew-assignment platform for space organisations: an API plus the `mc` CLI.

- **Plan missions as roles** (Pilot ×1: Orbital Navigation ≥ 4 …).
- **Explainable matching.** An engine seats the whole crew at once (Hungarian assignment) and explains every choice.
- **Director approval** of the plan and the named crew.
- **Offers after approval**, with deadlines; double booking is impossible.
- **Seat repair** when someone drops out, without re-planning.
- **Strict tenant isolation**, enforced down to the database constraints.

📐 **[DESIGN.md](./DESIGN.md)** — the design document: decisions, data model, lifecycle, matching engine.
➡️ **[TODO.md](./TODO.md)** — next up · 🗺️ **[ROADMAP.md](./ROADMAP.md)** — v2/v3, including approval modes.

## For reviewers

| What | Where |
| --- | --- |
| **Initial design document**, written before any code and used to direct the agent | [DESIGN.md at `cdab97d`](https://github.com/shubhmehta3121/mission-control/blob/cdab97d/DESIGN.md) |
| **Design document as built** (v2.1), with a revision log of what changed after review and audit, and why | [DESIGN.md](./DESIGN.md), or rendered with diagrams: [design.html](https://raw.githack.com/shubhmehta3121/mission-control/master/design.html) |
| **Verification report**: every test by layer, each brief requirement traced to its design section and tests, and the full CLI demo output | [test-report.html](https://raw.githack.com/shubhmehta3121/mission-control/master/test-report.html) (regenerate with `npm run report`) |
| **Audit** of the AI-generated code, and how each finding was resolved | [AUDIT.md](./AUDIT.md) (Appendix C) |
| **Guardrails** the AI agent works under | [CLAUDE.md](./CLAUDE.md) |
| **AI transcripts**, unedited | [transcripts/](./transcripts/) |

The two pages open straight in the browser from these links (served from this repository by raw.githack.com, because GitHub itself shows `.html` files as source). In a local clone, open the files directly. The full map of the package, with where to look for each question, is **[SUBMISSION.md](./SUBMISSION.md)**.

**How it was built:** by moving work between three AI models (Claude Opus 5.5 in Claude Code; Kimi K3 Max and Composer 2.5 in Cursor), with the code reviewed by hand throughout. The result combines all of them, held together by one design document, one set of invariants and the test suite. More in [How we worked](./SUBMISSION.md#how-we-worked).

---

## Setup (about 2 minutes)

Requires **Node.js ≥ 22.12** and npm.

```bash
npm install
npm run setup     # creates .env, builds prisma/dev.db from migrations, seeds two organisations
npm run dev       # API on http://127.0.0.1:3000 (or the next free port) — leave it running
```

If port 3000 is already taken (another dev server, say), the API moves to 3001, 3002, … and prints where it landed. You don't need to configure anything: the CLI finds it.

In a second terminal, get the `mc` command:

```bash
npm link          # puts `mc` on your PATH   (alternative: npm run mc -- <command>)
```

`npm run setup` prints a ready-to-run login line for every seeded user. Check everything is wired up with:

```bash
mc doctor         # which server the CLI is using, whether it really is Mission Control, who you are
```

## A five-minute tour

```bash
# Mission lead — the matcher explains every choice
mc login mct_astra_marcus
mc inbox
mc missions match AST-6                      # recommended crew, alternatives, why
mc missions match AST-6 --explain elena      # why isn't Elena on it? (rest gap)
mc missions nominate AST-6 --recommended     # nominees stay hidden until approval
mc missions submit AST-6

# Director — reviews the plan and the named crew
mc login mct_astra_ava
mc inbox
mc missions show AST-6
mc missions approve AST-6 --note "Good crew. Go."

# Crew — several offers are fine, double booking is not
mc login mct_astra_jamal
mc offers
mc offers accept AST-6
mc offers accept AST-7                       # refused: overlaps AST-6 — says how to switch

# Back to the lead (profiles make switching instant)
mc use marcus
mc missions show AST-6
```

Or watch the whole story run by itself, through the real CLI, against a throwaway database:

```bash
npm run demo      # 45 steps, 9 people, 2 organisations, 14 refusals — also a smoke test (non-zero exit on any surprise)
```

## Tests

```bash
npm test          # 142 tests in ~9 s — see below
npm run typecheck
npm run report    # runs the tests and the demo, and renders both into test-report.html
```

| Layer | What it covers |
| --- | --- |
| `tests/unit` | Matcher, Hungarian vs brute force, lifecycle table, dates, offer deadlines, port detection, CLI server detection |
| `tests/integration` | Workflows, security and tenancy, audit edge cases, simultaneous requests |
| `tests/scenarios` | Four stress organisations (tiny, 60-crew agency, long-duration polar station, high-churn contractors) and a six-org tenancy matrix |
| `tests/property` | 2,000 random organisations through the matcher, and a 500-step random workflow simulation, with invariants checked after every step |

The randomised tests use fixed seeds. Explore other ones with `PROPERTY_SEED=5000 npm test` or `SIM_SEED=77 npm test`.

## The CLI at a glance

| Who | Commands |
| --- | --- |
| Everyone | `mc login <token>` · `mc use <profile>` · `mc profiles` · `mc whoami` · `mc doctor` · `mc inbox` |
| Mission lead | `mc missions create/edit/roles set/match/nominate/unnominate/submit/offer/retract/activate/complete/history` |
| Director | `mc missions approve/reject/cancel` · `mc org settings set` · `mc skills add` |
| Crew | `mc offers` · `mc offers accept/decline/drop` · `mc profile` · `mc profile skills set` · `mc profile unavailable add` |
| Directory | `mc crew [--skill nav --min 4]` · `mc crew show <handle>` · `mc skills` |

- **Next steps are built in.** Every command ends with a "Next:" suggestion, and `mc missions show` lists what *you* can do on that mission.
- `mc <command> --help` shows options and examples.
- **Keys:** missions are `AST-6` (a bare `6` also works), crew are handles (`leo`), skills are keys (`nav`).
- **Roles:** written `"Name:headcount:skill=min,skill=min"`, e.g. `--role "Flight Engineer:1:eva=4,comms=3"`.
- **Scripting:** `--json` prints the raw API payload; `-p <profile>` runs one command as someone else.
- **Exit codes:** 0 ok · 2 usage · 3 not logged in · 4 forbidden · 5 not found · 6 state conflict / not ready · 7 invalid input · 8 API unreachable or not Mission Control.
- **Environment:** `MC_API_URL` (overrides the automatic lookup), `MC_PROFILE`, `MC_TOKEN` (one-off, not saved), `MC_CONFIG_DIR` (default `~/.mission-control`), `NO_COLOR`. Server side: `PORT` (first port to try), `LOG_LEVEL=info` to see every request.

## Seeded world

| | Astra Dynamics (`AST`) | Lunar Collective (`LUN`) |
| --- | --- | --- |
| People | director **ava**, leads **marcus**, **priya**, 8 crew | director **nora**, leads **owen**, **fatima**, 8 crew |
| Skills | nav, eva, robotics, piloting, comms, medic | regolith, lifesupport, geology, habitat, comms |
| Settings | rest gap 14 days, offers expire after 7 | rest gap 21 days, offers expire after 5 |
| Missions | 4 completed, 1 active, 1 approved, 1 submitted, **AST-6 draft (the demo)** | 1 completed, 1 draft, 1 submitted, 1 rejected |

Tokens follow `mct_<org>_<handle>`, e.g. `mct_lunar_nora`. They are stored hashed.

## Project layout

```
prisma/        schema.prisma, migrations/, seed.ts
src/
  lib/         dates (inclusive ranges), errors, clock, token hashing, ports, server discovery
  domain/      lifecycle.ts (rules as data), scheduling.ts, types, events
  matcher/     hungarian.ts, scoring.ts, matcher.ts   ← pure, no I/O
  services/    missions, staffing, offers, people, org, inbox (all org-scoped)
  http/        app.ts (auth + errors), validation.ts (zod), routes/
  cli/         index.ts, ui.ts, config.ts (profiles), client.ts, commands/
tests/         unit/, integration/, scenarios/, property/, support/
scripts/       setup.mjs, demo.ts, build-test-report.mjs, build-design-html.mjs
bin/mc.mjs     CLI launcher (runs the TypeScript directly via tsx)
transcripts/   unedited AI sessions (cursor/, claude-code/)
```

## Troubleshooting

- **`git clone` on Windows says "Filename too long":** some exported transcripts are nested deeply. Run `git config --global core.longpaths true` and clone again, or clone into a shorter folder (e.g. `C:\src`).
- **`npm install` reports 3 high-severity vulnerabilities:** all three are one advisory in `deepmerge-ts`, used by the Prisma command-line tool to merge its own config files. It is development tooling, not reachable from the API, and the suggested `npm audit fix --force` would change the Prisma major version, so it is left as is.
- **Port 3000 is in use:** handled — the API moves to the next free port and the CLI follows it. Run `mc doctor` to see where it is.
- **`mc doctor` shows an old port (e.g. "pinned at login") that nothing answers on:** profiles saved by an earlier version of the CLI stored the URL they used at login. The CLI now ignores a stored local URL from those profiles and follows the running server. If you pinned one yourself with `mc login --api`, log in again without `--api`.
- **"The server at … isn't the Mission Control API":** the CLI reached a different app (for example a Next.js dev server on 3000). Start Mission Control with `npm run dev`, or set `MC_API_URL` to where it is running.
- **`EPERM … query_engine` during install or generate on Windows:** a running API process holds Prisma's engine. Stop `npm run dev` and retry.
- **A database created from an older schema:** run `npm run setup` again. It rebuilds `prisma/dev.db` from migrations (this wipes local demo data).
- **"You are not logged in":** run `mc login <token>` with a token printed by `npm run setup` / `npm run seed`. Or run `mc login` on its own and paste the token at the prompt.
