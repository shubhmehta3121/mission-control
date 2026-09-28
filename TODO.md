# TODO — next, after the happy path

The happy path is built and tested (see DESIGN.md §20). These are the next items, **in order**, each small enough to be one pull request. Longer-horizon work lives in [ROADMAP.md](./ROADMAP.md).

Every item's definition of done:
- `npm test`, `npm run typecheck` and `npm run demo` are green;
- new rules have unit tests; new endpoints have security and tenancy tests;
- DESIGN.md is updated where the design changes.

---

## 1. Backup crew (prime + backup, as real missions do)

The schema is ready: `assignments.kind = PRIMARY | BACKUP`.

- **Nominate backups with the prime crew.**
  - `mc missions nominate <key> --recommended --backups` runs the matcher a second time with the primaries excluded, and takes the best remaining candidate per role.
  - Or nominate one manually: `--role Pilot --crew sara --backup`.
  - At most one backup per role in this iteration.
- **Approved together.** The submission snapshot lists backups. On approval they are offered as *"Backup for Pilot on AST-6"*.
- **Backups never fill a seat.**
  - Open-seat and activation counts consider `PRIMARY` only (already true in the code).
  - Accepting a backup seat does not block other offers: it is a soft commitment.
- **`mc missions promote <key> <handle>`** (owner, when a primary seat is open) turns an accepted backup into the primary for that role. No re-approval is needed: backups were part of the approved plan.
- **When a backup accepts a primary seat on an overlapping mission, notify the lead — do not auto-release** (decision from the design review: the lead decides whether they still want a backup).
  - The lead's inbox shows *"Sara (backup, Pilot) accepted a primary seat on AST-9 — keep, or release and nominate another backup"*.
- **Touches:** `services/staffing.ts` (nominate/offer with `kind`), `services/missions.ts` (snapshot, views), `services/inbox.ts`, `matcher` (second pass), CLI `nominate --backups`, `promote`, and the crew offer text.
- **Tests:** backups excluded from seat counts; promote only when a seat is open; backup-conflict inbox item.

## 2. Lead- or director-verified skill ratings

Self-rating (v1) can be gamed; real organisations certify skills.

- Add `verified_level`, `verified_by_id` and `verified_at` to `crew_skills` (a new migration; do not edit old ones).
- `mc crew verify <handle> nav=4` (lead+): sets the verified level. Crew changing their self-rating never touches the verified value.
- The matcher uses the verified level when present, otherwise the self-rated one with an **"unverified"** flag in the output. An org setting `require_verified_skills` makes unverified ratings ineligible.
- **Tests:** verified overrides self; the unverified flag appears; the setting enforces it.

## 3. A lead can withdraw a submission

`SUBMITTED → DRAFT` (owner), when the lead spots a mistake before the director has decided. The pending submission is marked `WITHDRAWN` (a new `SubmissionDecision`), and the director's inbox item disappears. This is one new row in `MISSION_RULES` plus the service function.

## 4. Directors manage people

- `mc users add --name "…" --handle … --role crew` creates the user and prints a one-time token (only the hash is stored).
- `mc users role <handle> <role>`; `mc users rotate-token <handle>`.
- Removes the dependency on seed data for onboarding a real customer.

## 5. One-step offer switch

`mc offers accept AST-7 --replace AST-6` drops out of AST-6 and accepts AST-7 **atomically**, with a confirmation that names the consequences. Today crew do this in two steps (drop, then accept), which is correct but not atomic.

## 6. Leads (and directors) can fly too

Today only `CREW_MEMBER` users are matchable (DESIGN.md D3). In reality mission leads are often experienced crew themselves, and a commander can also lead the mission.

- **Model it as a profile, not a role.** Add `users.flies` (or a `crew_profiles` row). Role still governs *permissions*; the flag makes someone *matchable*. A lead with the flag keeps their lead permissions and also gets skills, unavailability and offers like any crew member.
- **Skills.** Flying leads self-rate like crew (lead verification from item 2 applies to them too).
- **The matcher** includes flagged users in the snapshot (`services/snapshot.ts` filters on `role = CREW_MEMBER` today; change that to `flies = true`).
- **Conflict-of-interest rules:**
  - a lead can't nominate or offer a seat to themselves on a mission they own — another lead or a director must do it;
  - nobody reviews a mission they are crewing (extends the "not your own mission" rule in `domain/lifecycle.ts`);
  - a director crewing a mission can't cancel it alone.
- **Visibility.** A flying lead sees the same crew-side limits (no rankings) on missions where they are *crew*, and full lead views on missions they *own*.
- **Seed.** Give one Astra lead the flag, and add a second director to each org: today each seeded org has one director, so a mission a director creates can never be approved in the seed data.
- **Tests:** a flying lead is matched; they can't nominate themselves; they can't review a mission they crew.

## 7. Storage hardening for Postgres

When moving off SQLite, move these rules from service code into the database:
- a **partial unique index**: one live seat per person per mission (`WHERE status IN ('PROPOSED','OFFERED','ACCEPTED')`);
- an **exclusion constraint**: no two accepted seats with overlapping date ranges for the same person (`EXCLUDE USING gist`).

## Small polish (any time)

- `mc missions show` for a director reviewing a submission: add a "diff since last round" (the snapshot is already stored).
- `mc inbox --watch` (poll every N seconds) for live demos.
- Paginate `GET /missions` and `GET /crew` (cursor-based) before any org has thousands of rows.
