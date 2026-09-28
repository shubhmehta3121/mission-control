# Mission Control

A multi-tenant crew-assignment platform for space organisations: an API plus the `mc` CLI.

- **Plan missions as roles** (Pilot ×1: Orbital Navigation ≥ 4 …).
- **Explainable matching.** An engine seats the whole crew at once (Hungarian assignment) and explains every choice.
- **Director approval** of the plan and the named crew.
- **Offers after approval**, with deadlines; double booking is impossible.
- **Seat repair** when someone drops out, without re-planning.
- **Strict tenant isolation**, enforced down to the database constraints.

📐 **[DESIGN.md](./DESIGN.md)** — the design document: decisions, data model, lifecycle, matching engine.
➡️ **[TODO.md](./TODO.md)** — next up · 🗺️ **[ROADMAP.md](./ROADMAP.md)** — v2/v3, including approval modes.

---

## Setup (about 2 minutes)

Requires **Node.js ≥ 22.12** and npm.

```bash
npm install
npm run setup     # creates .env, builds prisma/dev.db from migrations, seeds two organisations
npm run dev       # API on http://127.0.0.1:3000 — leave it running
```

In a second terminal, get the `mc` command:

```bash
npm link          # puts `mc` on your PATH   (alternative: npm run mc -- <command>)
```

`npm run setup` prints a ready-to-run login line for every seeded user.

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
npm run demo      # 26 steps, 8 people, 2 organisations — also a smoke test (non-zero exit on any surprise)
```

## Tests

```bash
npm test          # 53 tests: matcher, Hungarian vs brute force, lifecycle, workflows, security and tenancy
npm run typecheck
```

## The CLI at a glance

| Who | Commands |
| --- | --- |
| Everyone | `mc login <token>` · `mc use <profile>` · `mc profiles` · `mc whoami` · `mc inbox` |
| Mission lead | `mc missions create/edit/roles set/match/nominate/unnominate/submit/offer/retract/activate/complete/history` |
| Director | `mc missions approve/reject/cancel` · `mc org settings set` · `mc skills add` |
| Crew | `mc offers` · `mc offers accept/decline/drop` · `mc profile` · `mc profile skills set` · `mc profile unavailable add` |
| Directory | `mc crew [--skill nav --min 4]` · `mc crew show <handle>` · `mc skills` |

- **Next steps are built in.** Every command ends with a "Next:" suggestion, and `mc missions show` lists what *you* can do on that mission.
- `mc <command> --help` shows options and examples.
- **Keys:** missions are `AST-6` (a bare `6` also works), crew are handles (`leo`), skills are keys (`nav`).
- **Roles:** written `"Name:headcount:skill=min,skill=min"`, e.g. `--role "Flight Engineer:1:eva=4,comms=3"`.
- **Scripting:** `--json` prints the raw API payload; `-p <profile>` runs one command as someone else.
- **Exit codes:** 0 ok · 2 usage · 3 not logged in · 4 forbidden · 5 not found · 6 state conflict / not ready · 7 invalid input · 8 API unreachable.
- **Environment:** `MC_API_URL` (default `http://127.0.0.1:3000`), `MC_PROFILE`, `MC_TOKEN` (one-off, not saved), `MC_CONFIG_DIR` (default `~/.mission-control`), `NO_COLOR`.

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
  lib/         dates (inclusive ranges), errors, clock, token hashing
  domain/      lifecycle.ts (rules as data), scheduling.ts, types, events
  matcher/     hungarian.ts, scoring.ts, matcher.ts   ← pure, no I/O
  services/    missions, staffing, offers, people, org, inbox (all org-scoped)
  http/        app.ts (auth + errors), validation.ts (zod), routes/
  cli/         index.ts, ui.ts, config.ts (profiles), client.ts, commands/
tests/         unit/, integration/, support/
scripts/       setup.mjs, demo.ts
bin/mc.mjs     CLI launcher (runs the TypeScript directly via tsx)
```

## Troubleshooting

- **Port 3000 is in use:** `PORT=3100 npm run dev`, then `export MC_API_URL=http://127.0.0.1:3100` (PowerShell: `$env:MC_API_URL=...`).
- **`EPERM … query_engine` during install or generate on Windows:** a running API process holds Prisma's engine. Stop `npm run dev` and retry.
- **A database created from an older schema:** run `npm run setup` again. It rebuilds `prisma/dev.db` from migrations (this wipes local demo data).
- **"You are not logged in":** run `mc login <token>` with a token printed by `npm run setup` / `npm run seed`.
