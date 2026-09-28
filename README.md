# Mission Control

Multi-tenant crew assignment platform for space organisations — API + CLI.
See [DESIGN.md](./DESIGN.md) for the full design document (data model, lifecycle,
matching engine, decision log).

## Prerequisites

- Node.js ≥ 20
- npm

## Setup

```bash
npm install
cp .env.example .env        # Windows cmd: copy .env.example .env
npm run migrate             # creates SQLite DB and applies migrations
npm run seed                # loads two demo organisations, prints API tokens
```

## Run

```bash
npm run dev                 # API on http://127.0.0.1:3000 (watch mode)
```

Health check: `curl http://127.0.0.1:3000/v1/health`

## Test

```bash
npm test                    # vitest: unit + integration
npm run typecheck           # tsc --noEmit
```

## Seeded demo data

Two organisations — **Astra Dynamics** and **Lunar Collective** — each with a
director, two mission leads, eight crew members, a distinct skill taxonomy,
availability windows, assignment history, and missions in every lifecycle state.
`npm run seed` prints every user's API token.

## Project layout

```
prisma/         schema, migrations, seed
src/
  server.ts     API entrypoint
tests/          vitest suites
DESIGN.md       design document (read this first)
```
