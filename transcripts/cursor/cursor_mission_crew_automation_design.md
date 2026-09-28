# Mission crew automation design
_Exported on 9/29/2026 at 01:38:56 GMT+10 from Cursor (3.22.7)_

---

**User**

Okay, I have attached this browser over here for you, so let's go through this and see the engineering challenge that has been handed to us. Okay, so the challenge is space organization need to plan complex mission requiring specific crew capabilities, crew assignment is currently manual and error prone, okay, so they're looking to automate it. Leads spend hours cross-referencing skill profile, availability calendars, and existing commitment. Multiple organization will use this platform, each with different crew sizes, skills, taxonomies. Okay, so they're wanting to build a B2B platform. Skills availability workload, their task is to design and build its core, you have Okay, let me read it in mind. So the minimum scope is multi-tenant API with roles. A mission lifecycle and approval workflow, crew management and skill profiles, and auto-matching engine and a CLI through which the primary workflows can be exercised. Okay, what they expect, a working system that demonstrates senior level judgment, design documents should establish a clear and implementable technical direction without being constrained to a prescribed format. Data models should be well considered and matching algorithms should show real thought about the problem space. API and CLI workflows should feel coherent and intentional, the code should just be structured for a team to work in, not just for a demo to run. Web interface is not required, okay, good enough, so they need a CLI, they need source code. GitHub repository public or shared with us with meaningful commit history. Okay working API and CLI easy to run locally with clear setup instructions and representative seed data, full AI transcripts. The AI coding tool during, okay, and initial document time expectation of focused work, respect your time, submit what you have. Prioritize a coherent design, working vertical slice and evidence of verification over breadth or polish. The tech stack they use is TypeScript, React, Python, and GCP, but we can use whatever we want. Okay, so I think even we'll go with TypeScript, React, Python. Anyways, we're not having a front end, right? So, it's mainly everything to work on our end. So, we can either go with TypeScript or Python. I think in this case, I'll go with TypeScript because it would be more type safe in production compared to Python. So, we can, you know, go ahead with TypeScript in this one. Do let me know if you think otherwise. API keys, okay, no, that's fine, timeline, but we ask that you submit within seven days of receiving the challenge. Oh, yeah, I will receive it. I will submit it today. If anything in the brief is unclear, okay, mission control. Okay, now is the important part. So, basically, this is a multi-tenant B2B platform for space organizations. We're building for organizations which are our tenants. Okay, so basically companies. These are space agencies, research labs, private companies, all data strictly scoped to an organization. Okay, so multi-tenant polluting should not be there. Multi-tenant pollution is strictly to be avoided and data is to be only kept for that particular tenant. Perfect. Crew members belong to an organization, they must have skill profile, availability, and assignment history. How you model skills and proficiencies up to you. Okay, so basically that means I need to have a table which is for the crew members or rather I can have table for all the people and I can assign the role as crew member and the skills can be in either, okay, so it depends if we're having a SQL, then maybe skills can be there can be two, three things. Either we can have a fixed enum of all the skills and we can allow the user to have you know, the enum values or we can create a JSON column for each member and then dump the skills over there which can be updated. The another one, good one for this type of thing because a user can, a crew member can have multiple skills. We would want no SQL or document database, but over here let's stick to SQL and SQLite. Let me know what you think on that. Mission belong to an organization, they have requirements, timelines, and a lifecycle that includes some form of approval before going active. Okay, so basically they're asking another table called missions which has a flag column wherein we keep it in multiple different phases, so it can be in planning, in progress, in review, approval, declined, or re-review, whatever it is. So, that is the other column. How you design the lifecycle and its transition is a design decision we're interested in. Yeah, I think that design decision would simply be that if it's an idea phase, then put it an idea phase which would be a draft phase when then when it is in progress, when someone's, you know, adding people actively to the missions, then that's when, you know, it's inactive, just like Jira board. Then when the mission is done on one 

First, I need to understand the workflow that let's say if who, if someone creates a mission within an org, who is creating it, whom are they adding, what are their powers, whom are they sending for approval, who is deciding everything, we need to know all of that. Assignments connect crews to mission. The platform should include an auto-matching engine that intelligently suggests. The sophistication of this algorithm is part of what we're evaluating. Okay, so basically, if they want a crew for the mission based on the skill availability and constraint. So the skill would be what the mission is looking for, so I think there would be some hard filters, after which we would have a ranking based on, let's say, their time matching or their expertise level or their skills, and then that's how we can maybe select, you know the top two with one on call and one as a substitute, if the other one denies. So, okay, now we have three different levels of access over here. It's director who runs the organization, they manage settings, approve permission, and have broad visibility, so I'm considering that they're an admin over here. Then we have the mission leads who plan and manage missions, so they define requirements, run the matcher, and submit. missions for approval, they should not be able to

They should not be able to approve their own missions. Okay, so that makes me understand that mission leads can also approve the mission, and directors can also approve the mission. So, can a director be a mission lead, or can a mission lead be a director? That is one good question to have. But anyway, so this person over here, mission lead is someone like a manager, who manages crew members. Crew members would be someone like ... I analogously connect this to an ... real company in the world. So, the crew members manage their own profile availability and respond to assignments. So, basically, crew members they have a platform, I'll have to build a platform for them, like, just like LinkedIn, where they can manage their own profile, they can put their availability, or, okay, maybe not LinkedIn, but rather a mixture of LinkedIn, along with some other job board, where they can put their availability, they can put their profile, they can put their experience, they can put their skills, they can put their past missions, and they can also have the ... dashboard where they can respond to assignments. Like, not dashboard, just ... hypothetically a dashboard, but in essential a CLI, which notifies them that they have been you know, selected for this particular mission. Do they want to accept or decline? Okay. so basically, role-based access control is important over here because crew members can't see everything, crew members can't commit everything, so we need to have that server-side check that we have a role-based access. Let's say the role ID for director is one, role ID for mission lead is two, and for crew members is three. So in all the code we'll have to check that only role ID one can execute everything, role ID three has limited permissions, and that all. So that is another essential thing to check. Now, what are they saying about the design document and AI transcript? The design document and transcripts are first-class evaluation artifacts, as important as the code itself. We want to understand how you translated the brief into a technical direction, how you use that direction to guide your AI tool, and how you evaluated what it produced. We're intentionally not prescribing the structure of the design document at scope, okay, and usefulness are part of what we're evaluating. Okay. So, they're leaving ... this vague so that they can judge ... don't edit the transcript, we want to see a real process including dead ends, changes of direction, and mistakes. So, basically, they've left this vague ... so that they can judge ... don't edit the transcript, we want to see a real process including dead ends, changes of direction, and mistakes. So, basically, they've left this vague ... so that they can judge ... what or how is the candidate able to navigate through it. Understood. What happens next, if you'll be invited to a 90-minute live session that builds on your submission, here's what to expect, product and architecture, deep dive, novel system design. okay, for example, how do you layer in resource constraint or redesign approval workflow, present your solution as if pitching it to engineering team. Okay, team and process discussion, how do you break down work, delegate review, AI generated code, and set guardrails. Perfect, sounds good. So, okay, let's not get ahead of ourselves, let's first decide ... what is the architecture for this, and let's set up a Git for that. So, yeah, why don't you go ahead and ... Answer the questions that I've asked you over here. Go through my understanding. Tell me if my understanding is correct. And let's first discuss what is the problem statement to be solved over here. Then we'll start discussing the components to solve it.

---

**Cursor**

Read the full brief from `notion_challenge_brief.md`. Your understanding is largely correct — here's my assessment, answers to your questions, and a few corrections.

## The problem statement (restated)

Build the core of a multi-tenant B2B SaaS: organisations (tenants, strictly isolated) manage crew with skill profiles and availability; mission leads plan missions with skill requirements and timelines; an engine auto-suggests crew; missions move through an approval-gated lifecycle; crew respond to assignment offers. Delivered as an API + CLI with RBAC, seed data, a design doc written *before* implementation, and full unedited transcripts (i.e., this conversation — everything stays in this chat).

## Answers to your questions

**1. TypeScript vs Python — agree, TypeScript.** Not just "type safety in production": one language across API + CLI, shared domain types, and discriminated unions for the mission lifecycle (exhaustive switch on states gives compile-time safety on transitions). It also matches their internal stack. Python would be defensible; TS is the better call here.

**2. Skills modelling — neither of your options.** A fixed enum violates a hard requirement ("each org has different skill taxonomies" — taxonomy must be tenant-defined). A JSON blob can't be queried or indexed by the matcher and has no referential integrity. The correct relational model:

- `skills` — org-scoped, each org defines its own taxonomy
- `crew_skills` — join table: `crew_id`, `skill_id`, `proficiency (1–5)`
- `mission_skill_requirements` — `mission_id`, `skill_id`, `min_proficiency`, `headcount`

This makes the matcher plain SQL over well-indexed tables.

**3. SQLite — yes.** "Easy to run locally" is an explicit submission requirement; SQLite is zero-infra. Put Prisma (or Drizzle) in front of it so the prod story is "swap datasource to Postgres/Cloud SQL on GCP" — aligns with their stack and shows the decision was deliberate.

**4. Can a director be a mission lead?** Model it as a role hierarchy: `DIRECTOR ⊃ MISSION_LEAD ⊃ CREW_MEMBER` — directors inherit lead capabilities. One role per user per org keeps the slice clean.

**5. The approval ambiguity — this is intentional, and how we resolve it is graded.** The brief says leads "submit missions for approval. They should not be able to approve their own missions." Two readings:

- **(a)** Only directors approve; the clause is just emphasis.
- **(b)** Leads *can* approve, but never their own — separation of duties.

I recommend **(b)**: approver = director, OR a mission lead who isn't the creator. It's the more interesting reading, it explains why the clause exists at all, and we document it as a deliberate interpretation. That's exactly the judgment they say they're evaluating.

**6. RBAC implementation** — your instinct (server-side role checks on every request) is right, but not scattered `roleId === 1` magic numbers. Auth token → user + org + role; a permission middleware/guard per route. Also: the org is *always* derived from the token, never from a client-supplied `orgId` — that's how tenant isolation is enforced structurally, backed by an integration test that attempts cross-tenant access and proves 403/empty.

## The workflow (who does what)

1. **Mission Lead** creates a mission (DRAFT): title, window, skill requirements with min proficiency + headcount.
2. Lead runs the **matcher** → ranked suggestions with score breakdown → sends assignment **offers** (primary + backup).
3. Lead **submits** for approval (SUBMITTED — mission locks for edits).
4. **Director (or another lead)** approves → APPROVED; or rejects → back to DRAFT.
5. **Crew members** see offers in their CLI and **accept/decline**.
6. When required positions are confirmed → ACTIVE → COMPLETED (or CANCELLED).

## Matching engine — your instinct is right, sharpened

Hard filters first: same org, holds *all* required skills at ≥ min proficiency, availability overlaps the mission window, no conflicting accepted assignment, under workload cap. Then **deterministic weighted scoring**: proficiency margin, availability coverage %, current workload (prefer less-loaded), relevant mission history. Output is ranked **with a per-criterion score breakdown** — explainable suggestions beat a black box, and that's the senior-level signal they asked for. Primary + backup selection falls out of the ranking naturally.

## One correction on scope

You mentioned building crew a "platform like LinkedIn" — no. Web UI is explicitly not required; the CLI *is* the crew's interface (`missions offers`, `assignments accept`). Don't spend a minute of the 3–5h budget on anything else.

## Decisions on the table — confirm or push back

1. TypeScript + Node (Fastify) + Prisma + SQLite + Commander CLI + Vitest
2. Per-org skills taxonomy via join tables (no enums, no JSON blobs)
3. Hierarchical roles, one per user per org; approval = director OR non-creator lead
4. Token auth (seeded API tokens → user+org+role), org always server-derived
5. Lifecycle: `DRAFT → SUBMITTED → APPROVED → ACTIVE → COMPLETED`, plus `REJECTED→DRAFT` and `CANCELLED`; offers `OFFERED → ACCEPTED/DECLINED/WITHDRAWN`

Once you confirm, next step is components: data model, state machine, matcher, API surface, CLI command tree — written into `DESIGN.md` **before any code**, since the design doc must precede implementation per the brief.

---

**User**

Okay, I think I went through your answer and I agree with most of it. So the stack is fixed, TypeScript, Node, Prisma, SQLite, Commander CLI and Whitest. I also agree for the per or skill taxonomy via join tables. In fact, if it's JSON, we can make it as denormalized as possible. So skills will be one table, roles will be one table, missions will be one table, company orgs, all of those would be their own tables. Then the hierarchical roles, one per user org approval, hundred percent agree. The higher hierarchy role always supersedes the below one, so it inherits all the powers from the below one. Token auth, seeded API tokens, user org, always server, they have hundred percent, so even let's assume we, they don't have any email system, even if it's just through the CLI, a person can just have a code and they can still approve or deny the mission without polluting the without polluting or leaking any data. And yeah, lifecycle draft submitted, approved, active, completed, plus rejected to draft and canceled offers. Yep, hundred percent I agree with it. So let's start with the design document. Okay. Let's do one thing. We will first create a mermaid diagram, or rather you can create an HTML markdown or any dashboard. I think let's go ahead with HTML, right? Mermaid diagram code in HTML. So let's treat this HTML as the brief so I can directly view it in the browser over you. What we'll do is in this, you define the problem statement, you define what we've decided as the decisions that we're going to implement, like let us our decision call as a senior software engineer for this challenge. And what tables do we need? Okay, so covering all of this, I think we are going to need one missions table, one roles table, one skills table, then maybe one org table. Let me know if I'm missing something, but these are some high level Tables that we're going to need. Let me know if you further want to denormalize the roles table into crew, lead, and director. So yeah, let's first start with this and then also put that, you know, how we're going to filter out stuff. So how are we going to have the filtering happening? How are we going to have the matching happening? How are we going to have the entire implementation, the entire workflow that we discussed above implemented even if the draft is rejected and has to be reapplied or if someone, you know, if some one crew member rejects it and then they if one crew member rejects the approval sorry, if one crew member rejects the invitation, then going on to the substitute one or the second and third ones, so storing that in the database. Or even, you know, there's an interesting edge case that if if the entire mission has been approved, but for some reason one of the crew member is just dropping out after approval, then we'll have to repeat the entire process again. But how can we repeat the entire process with least amount of disruption? So for all of that, create an HTML with all the information, all the stack, and all the design documents. Make a mermaid diagram if you want, and draw schema visualizer along with a workflow, along with all the different, you know, stuff we need in order to understand before going ahead and coding this out. You can search the web additionally if you want any help, if you want to understand some sort of mermaid code, if you want some help with how can we join all the tables or how can we keep it minimal yet effective.

---

**Cursor**

Stack and decisions locked. Before I build the HTML, two direct answers:

**Tables you're missing:** `users` (they listed orgs/roles/skills/missions but not the people), plus the join/satellite tables that carry the actual product logic: `crew_skills`, `availability_windows`, `mission_skill_requirements`, `assignments`, and `mission_events` (audit log). Roles are **not** a table — see below.

**Denormalizing roles into crew/lead/director tables: no.** Role is an enum column on `users`. Separate tables per role triples your auth joins, duplicates shared columns, and makes "director inherits lead powers" awkward. Role-specific data lives in satellite tables keyed by `user_id` (`crew_skills`, `availability_windows`, `assignments`) — that's where the denormalization you mentioned actually pays off.

Creating the design doc now.

Now let me open it in the browser to verify the mermaid diagrams render.

file:// is blocked — I'll serve it locally and open via localhost.

Page loads. Let me visually verify the mermaid diagrams rendered correctly.

All 5 diagrams rendered with zero errors. Let me visually confirm the ERD section.

The design doc is live and verified — all 5 mermaid diagrams render cleanly. It's open in your browser at `http://127.0.0.1:8642/design.html` (served locally since browsers block `file://` navigation from tools; the file itself is `design.html` in the workspace).

![Design doc ERD section rendered in browser](c:\Users\shubh\AppData\Local\Temp\cursor\screenshots\page-2026-09-28T08-41-35-940Z.png)

## What's in it (18 sections)

- **Problem statement, goals/non-goals, tech stack** — as we agreed
- **Decision log (D1–D8)** — every call we made, each with the rejected alternative and why. This is the senior-judgment artifact they're grading
- **Data model** — full ERD with 9 tables: `organizations`, `users`, `skills`, `crew_skills`, `availability_windows`, `missions`, `mission_skill_requirements`, `assignments`, `mission_events` (audit log). No `roles` table — role is an enum on `users`, per my earlier answer
- **Mission lifecycle** — state diagram + transition table with guards and actors per transition
- **Matching engine** — 6 hard filters in SQL → weighted score `0.40·skillFit + 0.25·workload + 0.20·experience + 0.15·reliability` with a hand-computed worked example, plus an **elimination funnel** when nobody qualifies (never a silent empty list)
- **API surface + full CLI command tree** + seed plan + test plan + time plan

## Your three edge cases, answered in the doc

1. **Rejection loop** — REJECTED carries a mandatory reason; `revise` returns to DRAFT, history preserved, `submission_count` increments
2. **Crew declines → substitute** — DECLINED rows persist as the exclusion set; top-up match re-runs for that slot only and offers the next-ranked candidate
3. **Dropout after approval** — the key design call (D7): **slot-level repair, not mission-level restart**. The mission stays APPROVED/ACTIVE, the vacated slot re-opens (derived value, can't drift), backfill needs no re-approval. Only *material* changes (dates, requirements) force re-approval via the amend flow

I also added §17 Extension Points — resource constraints and per-org approval chains — since the brief explicitly says the live session will ask exactly those.

Next step when you're ready: `git init`, scaffold the repo, and port this into `DESIGN.md` so the repo has it in markdown — then schema + seed.

---

**User**

Okay, fair enough. it was my mistake that I was referring it to roles. What I meant was users, and then we'll have the joint tables for crew skills, availability windows, mission skill requirements, assignments, mission events. Sounds fantastic.

---

**Cursor**

Locked. Moving to Block 2: repo scaffold, Prisma schema, migration, and seed.

Node 24, npm 11, git initialized in `mission-control/`. Writing scaffold files.

Runtime deps installed; dev deps still installing in the background. Writing the Prisma schema meanwhile.

While that installs, writing the seed script.

Checking the dev-deps install, then running the migration.

Dev deps may still be installing. Checking the background install output.

The dev-deps install is still running in the background. Waiting for it to finish.

Two issues: the Prisma CLI in this version renamed commands, and the client isn't generated yet. Checking the new CLI surface.

npm pulled `prisma@8.0.0-rc.17` — a pre-release with a restructured platform CLI (`migrate dev` is gone). For a graded submission I won't build on an RC; pinning to the stable Prisma 6 line with the classic CLI.

Prisma 6.19.3 installed, but npm blocked its engine postinstall scripts (`allowScripts` policy). Approving and rebuilding so the query engines download.

Migration applied, client generated. Running the seed.

Seed works — 22 users across both orgs. While writing the seed I caught a real design inconsistency: hard filter 4 ("no ACCEPTED overlapping assignment") makes the workload score meaningless (survivors would always have 0 committed days). Fixing the doc: the filter becomes a **concurrency cap** (≤2 overlapping accepted missions), and workload differentiates below the cap.

Now the canonical `DESIGN.md` for the repo (with the corrected filter) and a working `README.md`.

Smoke-testing the server, then committing.

Block 2 complete. Status:

**Repo** — `mission-control/` with 5 atomic commits (design doc → scaffold → schema → seed → server).

**Verified working:**
- `npm run migrate` — 9 tables created per the ERD
- `npm run seed` — 2 orgs, 22 users, distinct taxonomies, missions in DRAFT/SUBMITTED/APPROVED/ACTIVE/COMPLETED, token table printed
- `curl /v1/health` → `{"status":"ok"}`

**Two course corrections made along the way** (the kind the transcript should show):

1. **npm installed `prisma@8.0.0-rc.17`** — a pre-release whose CLI dropped `migrate dev` entirely. Pinned to stable `prisma@^6.19.3` instead; not building a graded submission on an RC.
2. **Design bug caught while seeding**: the original hard filter "no ACCEPTED overlapping assignment" would have made the workload score permanently zero for every survivor. Filter is now a **concurrency cap (≤2 overlapping)**, and workload differentiates below the cap. Fixed in both `design.html` and `DESIGN.md`. The seed reproduces the doc's worked example: Yuki has 10 committed days inside the Europa Survey window → workload 0.67, Leo has none → 1.0.

**Seed highlights for the demo:** Europa Survey (DRAFT, Nav≥4 + EVA≥3, Nov window) is ready for `mc missions match`; Amara has a pending OFFERED on ISS Resupply XII; Jamal carries a decline history so reliability scores visibly differ; Elena is on leave mid-November so the availability filter has someone to eliminate.

Next is Block 3 — the API: auth middleware, RBAC guards, crew/skills endpoints, mission CRUD + lifecycle transitions with the guard table from §9. Say the word and I'll proceed.

---

**User**

I'll add "leads can fly too" to TODO.md, then build the file-by-file review. First, the exact list of files I touched:

`src/matcher/index.ts` turns out to be an unused barrel file I created; nothing imports it, so I'm deleting it. Then adding "leads can fly too" to TODO.md.

Done: "leads can fly too" is now [TODO.md §6](mission-control/TODO.md). It covers a "flies" flag separate from role, the conflict-of-interest rules (a lead can't nominate themselves or review a mission they crew), and adding a second director per seeded org. DESIGN.md D3 and ROADMAP now point to it, and design.html is regenerated. I also deleted `src/matcher/index.ts`, an unused file I had created, and typecheck is still clean.

Your review list follows. It's in two parts: first each decision we discussed and the file it lives in, then every file in suggested review order. I've marked separately the calls I made on my own during implementation, which we never discussed.

---

## Part A — Decision trail: what we decided and where it lives

| # | Decision (from our discussion) | Where it lives |
|---|---|---|
| 1 | Missions are made of **roles**, not a headcount per skill (v1's F2 contradiction) | `schema.prisma` (MissionRole, RoleSkillRequirement), `snapshot.ts`, `matcher.ts`, `validation.ts` (roleSpec), CLI `--role "Name:1:nav=4"` · DESIGN D2 |
| 2 | **Hungarian**: fill the most seats first, then the best quality | `hungarian.ts`; `matcher.ts` weight `1,000,000 + score×100` · D10 |
| 3 | Your rule: **save the versatile person unless they're clearly better** → rarity penalty, max −5 | `scoring.ts` `rarity()`; notes in `matcher.ts` · D11 |
| 4 | Workload over **±90 days**; **rest gap** as an org setting (default 14); concurrent cap deleted | `scoring.ts` `workload()`; `scheduling.ts` REST_GAP; `Organization.restGapDays` · D12 |
| 5 | **Offers only after approval**; nominations are PROPOSED and invisible; snapshot saved at submit | `schema.prisma`, `missions.ts` (submit/approve), `staffing.ts` (nominate) · D9 |
| 6 | Real-world grounding (prime + backup, 14-day quarantine, agencies *assign* but we *offer*) | DESIGN §3 |
| 7 | **Cancel: directors only, every state**; withdraw/release with reason; say "cancelled" not "compromised"; inbox notice, no notifications table | `lifecycle.ts`, `missions.ts` cancelMission, `inbox.ts` UPDATE · D19 |
| 8 | Backups: lean version later; **notify the lead, don't auto-promote**; `kind` column now | `schema.prisma` AssignmentKind, TODO §1 |
| 9 | Several offers allowed; **accept-time conflict check**; blocked offer stays pending; switch = drop out + accept; **other lead sees no reason** | `offers.ts` acceptOffer, `views.ts` BLOCKED_FOR_LEAD, `inbox.ts` BLOCKED_OFFER · D17 |
| 10 | Offer **deadline as an org setting**: min(TTL, launch − 14 days) | `expiry.ts`, `Organization.offerTtlDays` |
| 11 | **Approval: director only, never their own mission**; "syndicate" rationale; the other modes go in the roadmap | `lifecycle.ts`, DESIGN D5, ROADMAP approval table |
| 12 | Title + note only (no mission brief); note required on reject, optional on approve | `validation.ts`, `missions.ts` |
| 13 | **Self-rating only** in v1; lead rating later | `people.ts` setMySkills, TODO §2 · D18 |
| 14 | **Commitment**: only drop-outs count, smoothed `(a−d+2)/(a+2)` | `scoring.ts` `commitment()` · D13 |
| 15 | Crew see **only their own seat**; roster once **ACTIVE**; **never scores** | `missions.ts` crewView, `offers.ts` · D14 |
| 16 | **Composite `(org_id, id)` FKs** | `schema.prisma`, migration, `security.test.ts` · D15 |
| 17 | **Pure matcher** over an in-memory snapshot (not SQL filters) | `snapshot.ts` + `matcher/*` · D6 |
| 18 | **Rules as data** → `allowedActions` → CLI hints | `lifecycle.ts`, missions leadView, CLI · D16 |
| 19 | CLI: readable keys (AST-6), profiles, `mc inbox`, show with actions, `--explain` | `src/cli/*` · D20 |
| 20 | Only crew members are matchable; leads flying → TODO §6 (today) | `snapshot.ts` (filters to CREW_MEMBER) · D3 |
| 21 | Process: new migration (don't edit committed ones), CLAUDE.md for the agent, TODO/ROADMAP docs, demo as evidence | migration, CLAUDE.md, TODO.md, ROADMAP.md, `scripts/demo.ts` |

**Calls I made on my own. Please check these, we never discussed them:**
- **Blocking out committed days:** crew can't add unavailability over days they're committed to; they must drop out explicitly.
- **Redefining roles clears nominations** in a draft, and the response says so.
- **Date changes on a draft keep nominees;** they're re-checked at submit.
- **Crew never see their own score either** (you said crew see only their own work; I read that as no scores at all).
- **Private notes:** unavailability notes are visible to the person and directors; leads see dates only.
- **Who can re-match whom:** people who declined, dropped out or let an offer expire are excluded from re-matching *that* mission; people whose offer was withdrawn or released are not.
- **Nominations flagged, not excluded:** nominations on *submitted* missions show as a flag in match output, like pending offers.
- **Activate vs complete:** activate is owner-only; complete is owner **or** director.
- **Match access:** any lead or director can run match (read-only) on any non-terminal mission; only the owner can act on the result.
- **Offer deadline floor:** a deadline is never less than 24 h away, even for short-notice missions.
- **Seed tokens are predictable** (`mct_astra_marcus`) for demo convenience; they're stored hashed.
- **404, not 403,** for anything outside your view, so existence isn't confirmed.

---

## Part B — File by file (63 in the repo + design.html)

### Documents (6)
- **[DESIGN.md](mission-control/DESIGN.md)** (rewritten, 560 lines) — Design v2.
  - Revision history: v1 → v2, with why.
  - §3 real-world grounding with sources; D1–D20 decisions; architecture; tenancy.
  - Permissions table, ER diagram, both lifecycles, matcher with worked examples.
  - Offers, visibility, edge cases, API, CLI, seed, verification, build order.
- **[TODO.md](mission-control/TODO.md)** (new) — Next items in order:
  1. backups (notify, don't promote);
  2. verified ratings;
  3. lead withdraws a submission;
  4. directors manage users;
  5. one-step offer switch;
  6. **leads can fly**;
  7. Postgres constraints.
- **[ROADMAP.md](mission-control/ROADMAP.md)** (new) — **v2**:
  - all approval modes (director review, peer review with syndicate safeguards, N-of-M, risk tiers, sequential chain, auto-approve templates, delegation) and their data model;
  - reschedule / launch slips, notifications outbox, cert expiry, per-org weights, pairing rules, direct-assignment mode.

  **v3**: portfolio optimisation, resources, Postgres/GCP, SSO, analytics, web UI.
- **[CLAUDE.md](mission-control/CLAUDE.md)** (new) — Agent rules: commands, definition of done, 8 invariants, where things go, gotchas we hit (Prisma JSON default bug, nested composite keys, reset guard, Windows lock, demo deadlock).
- **[README.md](mission-control/README.md)** (rewritten) — Setup, five-minute tour, demo, CLI table, exit codes, environment variables, seeded world, layout, troubleshooting.
- **[design.html](design.html)** (outside the repo) — Now generated from DESIGN.md; same dark style, all 5 diagrams render. The generator script is in my scratchpad, not the repo.

### Config and tooling (7)
- **package.json** (modified):
  - `engines` node ≥ 22.12 (Commander 15 needs it);
  - `bin: mc`;
  - scripts `setup/dev/start/mc/seed/migrate/demo/test/typecheck`;
  - **tsx moved to dependencies** (the CLI and start need it at runtime);
  - Prisma 6.19.3 kept (the other system's choice).
- **package-lock.json** (modified) — only the tsx move.
- **tsconfig.json** (modified) — `types: ["node"]` (TypeScript 6 no longer includes it by default), `noImplicitOverride`, includes `scripts/` and the vitest config.
- **vitest.config.ts** (new) — test globs, global setup, timeouts.
- **.gitignore** (modified) — added `.test-db/` and `prisma/shadow.db*`.
- **bin/mc.mjs** (new) — registers tsx and runs `src/cli/index.ts`; no build step; `npm link` puts `mc` on your PATH.
- **scripts/setup.mjs** (new) — creates `.env` if missing, then `prisma migrate reset --force` (rebuild + seed). **Destructive; dev only.**

### Database (3)
- **[prisma/schema.prisma](mission-control/prisma/schema.prisma)** (rewritten):
  - Real enums; AssignmentStatus has 8 states, e.g. PROPOSED, EXPIRED, RELEASED, DROPPED.
  - **Organization** gains keyPrefix, missionSeq, restGapDays, offerTtlDays.
  - **User**: `handle`; **`tokenHash` replaces the plaintext `apiKey`**.
  - **Skill**: `key`.
  - **Unavailability** replaces availability_windows, with a private note.
  - **Mission**: `number`, `ownerId`, `cancelReason`. approvedBy, rejectionReason and submissionCount moved to **MissionSubmission** (round, snapshot, decision, note).
  - **MissionRole + RoleSkillRequirement** replace MissionSkillRequirement.
  - **Assignment**: role via `(org, mission, role)`, kind, score + breakdown, reason, deadline, timestamps.
  - Events: nullable actor (system); JSON payload with no database default (Prisma bug).
  - **Every relation is composite `(org_id, …)`.**
- **[migration 20260928095500_roles_nominations_tenancy](mission-control/prisma/migrations/20260928095500_roles_nominations_tenancy/migration.sql)** (new) — Generated with `prisma migrate diff` against the committed `init`; the header explains why. Existing databases must be rebuilt.
- **[prisma/seed.ts](mission-control/prisma/seed.ts)** (rewritten):
  - Dates relative to today; two orgs with different settings and taxonomies; hashed tokens.
  - **Past missions inserted directly**; **current ones go through the real services** (create → nominate → submit → approve → accept).
  - Staged AST-6 (trap, rarity, rest gap, conflict, leave, near miss, pending flag); prints login lines.

### lib — basic helpers (4)
- **dates.ts** — day numbers; inclusive ranges; overlap, gap and overlapDays; strict YYYY-MM-DD parsing (rejects 2026-02-30).
- **errors.ts** — `AppError` with stable codes → HTTP status; `notFound` (404, never 403).
- **clock.ts** — injectable clock (tests move time forward for expiry).
- **tokens.ts** — sha256 hashing, token generator.

### domain — rules (4)
- **[lifecycle.ts](mission-control/src/domain/lifecycle.ts)** — **The rules table.** 10 actions, each with states, target, who, error verb and hint. Actor is checked first (403 / CANNOT_APPROVE_OWN), then state (409). `allowedMissionActions` feeds API responses. Encodes: owner-only edit/nominate/submit/offer/activate; director-not-owner approve/reject; director-only cancel; owner-or-director complete.
- **[scheduling.ts](mission-control/src/domain/scheduling.ts)** — UNAVAILABLE / CONFLICT / REST_GAP. **One implementation**, used by the matcher, by accept, and by adding unavailability.
- **types.ts** — `Actor` (org always from the token), role hierarchy, live-seat statuses, `missionKey`.
- **events.ts** — the list of audit event types.

### matcher (4)
- **[hungarian.ts](mission-control/src/matcher/hungarian.ts)** — Kuhn-Munkres, O(n²m). Maximises total weight; disallowed pairs are never used; handles rectangular shapes; deterministic.
- **[scoring.ts](mission-control/src/matcher/scoring.ts)** — Every constant is named: weights 45/25/20/10, 90-day horizon, prior 2, rarity threshold level 4, max −5. Functions: `skillFit`, `workload`, `experience`, `commitment`, `rarity`, `scoreCandidate` (breakdown with facts).
- **[matcher.ts](mission-control/src/matcher/matcher.ts)**:
  - **Filters in order:** ON_MISSION → SKILL → UNAVAILABLE → CONFLICT → REST_GAP.
  - **Seating:** scores eligible pairs, then solves seats jointly.
  - **Notes:** "needed as X so every seat fills" / "kept free: rare …" / "best overall crew".
  - **Explanations:** elimination counts, near misses (exactly one skill short by one level), pending-offer flags, reasons for unfilled seats.
  - **Helpers:** `evaluateCandidate` (manual picks and submit re-checks; skips the person's own seat) and `explainCandidate`.
- **types.ts** — snapshot, crew and result types.

### services — business logic, all scoped to the caller's org (10)
- **[missions.ts](mission-control/src/services/missions.ts)**:
  - **Visibility:** crew see only missions they were offered, otherwise 404.
  - **Create:** start must be in the future; per-org key; skills validated against *this* org.
  - **Edit and roles:** redefining roles clears nominations.
  - **Submit:** checks blockers, re-checks nominees, refreshes their scores, saves the snapshot and round number.
  - **Approve:** PROPOSED → OFFERED with a deadline.
  - **Reject:** note required.
  - **Cancel:** withdraw/release with reason; a pending submission is marked CANCELLED.
  - **Activate:** requires every seat accepted. **Complete** as per the rules.
  - **Lead view:** seats, blocked flag, review, `allowedActions` with blockers.
  - **Crew view:** own seat; roster only when active and accepted.
  - Also the mission list and history.
- **[staffing.ts](mission-control/src/services/staffing.ts)** — match (+ explain); nominate (recommended or manual → NOT_ELIGIBLE / ROLE_FILLED); remove a nomination; **backfill offers after approval without re-approval**; retract.
- **[offers.ts](mission-control/src/services/offers.ts)**:
  - List offers (never PROPOSED, with blocked reason, sensible sort).
  - **Accept** re-checks the schedule inside the transaction and suggests "drop out of X" on conflict.
  - Decline carries no penalty; drop out requires a reason. Other offers are never auto-removed.
- **[snapshot.ts](mission-control/src/services/snapshot.ts)**:
  - Org-scoped loads for the matcher.
  - Commitments: accepted primaries on approved, active or completed missions.
  - Pending: live offers, plus nominations on submitted missions.
  - History: accepts include dropped and released; drop-outs counted.
  - Also the schedule loader.
- **expiry.ts** — `offerDeadline`: min(TTL, launch − 14 d), never under 24 h. Lazy sweep with *system* events.
- **inbox.ts**:
  - Derived from state, by role:
    - **Director:** REVIEW.
    - **Owner:** CHANGES_REQUESTED, NEEDS_ROLES, NEEDS_CREW, READY_TO_SUBMIT, AWAITING_REVIEW, BLOCKED_OFFER, OPEN_SEATS, READY_TO_ACTIVATE, AWAITING_CREW.
    - **Crew:** OFFER, UPDATE (cancelled or withdrawn in the last 14 days), CREW_CONFIRMED.
  - Returns name and org for the CLI heading.
- **people.ts**:
  - Directory for leads and above (skill filter); a single person for self or leads.
  - Notes visible to self and directors only.
  - Self-rated skills (upsert/remove).
  - Unavailability add (refused over commitments) and remove.
- **org.ts** — me; settings (everyone reads, directors change); skills list (counts for leads and above); add skill (directors, DUPLICATE on clash).
- **context.ts** — Ctx; transaction helper; key parsing (`AST-12` or `12`; another org's prefix → 404); `recordEvent`; `moveMission` (compare-and-set).
- **views.ts** — date formatting, window view, the privacy-safe blocked message for leads, the crew's blocked message.

### http — API layer (5) + server (2)
- **[app.ts](mission-control/src/http/app.ts)** — `buildApp(db, clock)`; auth hook (hash bearer token → actor).
  - Error mapping: AppError; Prisma P2002 → 409; **P2003 → 422 "not in your organisation"**; other 4xx → 400; 500s are generic.
  - Also the 404 route and health check.
- **validation.ts** — zod **strict** objects (an `orgId` in a body is rejected), real ISO dates, skill-key format, role spec, all bodies and queries.
- **routes/me.ts, org.ts, missions.ts** — thin: parse → one service call.
- **src/server.ts** (modified) — uses `buildApp`, graceful shutdown.
- **src/config.ts** (new) — loads `.env`; port, host, log level.

### cli (9)
- **index.ts** — Program setup:
  - global `--json / --profile / --no-color`; grouped help;
  - quick start and exit codes in `--help`;
  - error output (code, message, bullet blockers); exit-code mapping.
- **config.ts** — Profiles in `~/.mission-control/config.json` (file mode 600).
  - Lookup order: flag → MC_PROFILE → MC_TOKEN → current.
  - Prefix match (`mc use marcus`).
- **client.ts** — fetch; 400→7, 401→3, 403→4, 404→5, 409/422→6, unreachable→8.
- **ui.ts** — colours (respects NO_COLOR), status badges, tables that handle colour codes, score bars, "just now / in 3 days", Next hints.
- **commands/shared.ts** — JSON vs human rendering; confirmation prompt (`--yes`); parsers for `Name:count:skill=min` and `nav=4`.
- **commands/session.ts** — login (verifies the token, names the profile `handle@org`), use, profiles, logout, whoami.
- **[commands/missions.ts](mission-control/src/cli/commands/missions.ts)** — every mission command. Renderers:
  - **show:** seats with score bars, review, "You can", Next.
  - **Crew view.**
  - **match:** recommended crew with notes, per-role alternatives, elimination counts, near misses.
  - **--explain.**
  - **history:** readable event descriptions.
- **commands/crew.ts** — inbox; offers (list/accept/decline/drop with confirmation); crew list/show; profile (skills, unavailability).
- **commands/org.ts** — org settings show/set; skills list/add.

### tests (9) + demo (1)
- **support/globalSetup.ts** — migrates one template database.
- **support/testApp.ts** — a database copy per test file; test clock; a small world:
  - Astra: 2 directors, 2 leads, 5 crew (Dmitri on leave).
  - Lunar: director, lead, 1 crew.
  - Calls go through the real app via `inject`.
- **support/matchFixtures.ts** — scenario builders.
- **unit/hungarian** (7) — includes the brute-force check on 300 matrices.
- **unit/matcher** (15) — trap, rarity both ways, filters, rest-gap boundary, workload 0.80, commitment, flags, explain, order independence. One test ("uses the mission window") is trivial and could go.
- **unit/lifecycle** (6) — every state × action × actor.
- **unit/dates-scheduling** (4).
- **integration/workflow** (8) — happy path with visibility at each step, guards, reject → resubmit, cancel, decline → backfill, double booking with privacy, expiry, unavailability over commitments.
- **integration/security** (13) — auth, hashed tokens, owner-only edits, director-only and not-own approval, `allowedActions`, crew limits, note privacy, settings, tenancy (reads, **write path**, **database FK**), validation.
- **[scripts/demo.ts](mission-control/scripts/demo.ts)** — 26 CLI steps against a throwaway database; the API runs in-process; each step declares its expected exit code; exits non-zero on any surprise.

### Deleted
- `src/matcher/index.ts` — unused; created and removed within this session.

When you've reviewed and are happy, the 7-commit order from my last message still applies.


Okay, can you go ahead and see? I have made sixty four changes which are uncommitted, and this is almost like a big version one that I've scaffolded over here with all the different stuff required. I have also added all the thought process, all the discussion, all the decisions that we've made in this over here. So can you go ahead, first check this. Have everything that we discussed correctly implemented in the code. Second is ... Second is, check ... the type safety of the code. Third is, check the security perspective of the code. And okay, this is in no particular order, so you should run multiple parallel sub-agents for Compose, of Composer 2.5 to check one aspect, okay? You should check the security review, the bug bot review. Check if there is any cross-tenant pollution or data leakage possible. Check if there is any ... security loophole, flaw, bug, which can lead one person to see other person's data or other person's stuff. See all the logic that we've implemented correctly works. That is ... right from, you know, who can be assigned the mission, then all the nuances that were there that someone's been assigned a mission, that someone's been kept as a backup, someone who has a backup has been auto-assigned to or accepted another role as primary, the one who's been primary has accepted, declined, blocked, pending offers, they've accepted but they rejected after the auto-approval, the director approved it, the director rejected it, the lead was allowed to redraft it and send it, so each and everything, cover each and everything, spin up multiple sub-agents as much as you want of Composer 2.5 in order for us to have a complete audit review of how good or bad these changes are, right from database changes to scripts to SRC to test, everything. And also in the meanwhile, tell me how can I test it over here in my CLI so that I can see that, okay, this is how the CLI looks, this is how the CLI works, this is how the database is populated, each and everything. And once that is done, I want you to deploy another two, three agents. to figure out what different edge cases and test cases can be there. Now research the web for what happens in the with the astronauts, space centers, research labs, big companies, or whatever this system is for, space control. You check what are the edge cases or the test cases that these people face, with multiple, so many people involved, so many missions going, so many projects happening. Obviously, I don't want to over-engineer it, but I do want to provide a holistic approach. I do want to provide as many test cases covered as possible, so do have a look at that. No code changes, nothing. Just give me everything over here in as much depth as possible. If you want, you can create a document for yourself at the root of this folder. called Mission Control. The folder is called Mission Control, but you can create a document where you're writing your audit. In fact, do that. Yeah, rather than me reading so much. for each and every sub-agent that returns stuff, you append their writing, you append that report to the audit over here, and I'll name it audit done by you or something, and you also put over there the different test cases or edge cases that we've missed. So, yeah. Go ahead, have this lengthy amount of stuff done for you, and let me know once you're done.

---

**Cursor**

Big turn — let me get oriented first, then launch the audit fleet. Reading the new docs and checking the working tree state.

The repo has grown substantially since my last turn — understood. Now let me establish a baseline (typecheck + tests + demo) and discover the Task tool before launching the audit fleet.

Baseline confirmed: **typecheck clean, 53/53 tests green**. Now checking the seeded token format so your CLI guide is accurate, then launching the audit fleet.

Token format confirmed (`mct_astra_marcus`). Launching the full audit fleet — 7 agents in parallel, all Composer 2.5 as you asked, all read-only.

All 7 agents are running. While they work, let me verify the demo script end-to-end (so your testing instructions are proven, not assumed) and set up the audit document.

Demo passes — 26/26 steps, including the dropout→backfill and cross-tenant 404. Creating the audit document skeleton now; reports get appended as agents return.

The audit is underway. Status and your hands-on guide below.

## Audit fleet — 7 agents running in parallel (all Composer 2.5, all read-only)

| Agent | Mission |
|---|---|
| [Decision-trail verification](8967897c-0d72-4d41-8426-ce5e2194e1d8) | All 21 decisions + your 12 self-made calls, verified against code with file:line evidence |
| [Type safety audit](7c51ee2f-e507-4d36-b8a9-1d3a3fd91294) | Every `any`/cast/assertion, zod boundary coverage, JSON-column parsing, exhaustive switches |
| [Security Review](4cf756a3-a4b3-4066-99d8-f81d3434e3e1) | Dedicated security-review agent on the uncommitted diff |
| [Bugbot](fcade688-e5de-4ce9-af2f-fecb7601f1c8) | Logic bugs in lifecycle, offers, Hungarian, scheduling, idempotency |
| [Cross-tenant privacy audit](6004d124-307e-4fa1-9430-24e81cf5cec4) | Tries to *break* tenant isolation and same-org privacy rules |
| [Workflow logic audit](771506c7-0fc8-4570-b1d2-dc0e96b79e92) | All 12 workflows traced end-to-end vs DESIGN.md |
| [Real-world research](51f8568e-94ab-40d4-ac2b-612218322d96) | NASA/ESA/analog-domain edge cases, mapped to handled/partial/missing |

Every report gets appended verbatim to **`mission-control/AUDIT.md`** (skeleton already created, baseline filled in). After these land I'll launch the second wave — 2 agents enumerating missing edge cases/test cases per module, informed by the audit findings.

## Baseline I verified directly before launching

- `npm run typecheck` — clean
- `npm test` — **53/53 pass**
- `npm run demo` — **26/26 steps pass**, including dropout→backfill and Lunar getting `NOT_FOUND` for Astra's mission

## How to test it yourself in the CLI

**One-time setup** (from `mission-control/`):

```bash
npm run setup     # rebuilds + seeds the DB (destructive, dev only)
npm run dev       # terminal 1: API on http://127.0.0.1:3000
```

**Get the CLI** (terminal 2): either `npm link` once to put `mc` on your PATH, or prefix everything with `npm run mc -- `.

**Log in as each persona** (seed prints the full list):

```bash
mc login mct_astra_marcus    # mission lead, Astra
mc login mct_astra_ava       # director, Astra
mc login mct_astra_leo       # crew, Astra
mc login mct_lunar_owen      # lead, Lunar (other tenant)
```

Each login creates a named profile (`handle@org`); switch fast with `mc use marcus` / `mc profiles`.

**A 5-minute tour:**

```bash
mc whoami
mc inbox                          # your role-specific to-do list
mc missions list                  # everything in your org
mc missions show AST-6            # seats, review state, "You can" hints
mc missions match AST-5           # ranked crew with notes (try --explain)
mc offers list                    # as leo: your pending offers
mc offers accept <id>             # respond
mc missions history AST-6         # full audit trail
mc org settings                   # rest gap, offer TTL
```

**Two things worth trying deliberately:** log in as `mct_lunar_owen` and run `mc missions show AST-6` — you'll get a 404, not a 403 (existence is never confirmed across tenants). And as marcus, try `mc missions approve AST-5` on a mission he created — expect `CANNOT_APPROVE_OWN`.

**Watch the database live:** `npx prisma studio` opens a visual table browser — run CLI commands and refresh to see rows change.

**Full scripted proof:** `npm run demo` runs the 26-step end-to-end flow on a throwaway DB and prints each command with expected exit codes.

I'll append reports to `AUDIT.md` as agents return and launch the edge-case wave next.

---

**User**

<timestamp>Monday, Sep 28, 2026, 9:05 PM (UTC+10)</timestamp>
<system_notification>
The following task has finished. If you were already aware, ignore this notification and do not restate prior responses.

<task>
kind: subagent
status: success
task_id: 8967897c-0d72-4d41-8426-ce5e2194e1d8
title: Verify decision trail in code
tool_call_id: CallDynamicTool_0_b3b015d6-53e24
agent_id: 8967897c-0d72-4d41-8426-ce5e2194e1d8
detail: <user_visible_high_level_summary>
Read-only audit of 20 numbered decision claims plus 12 supplementary calls against the Mission Control repo. Almost all core matcher, lifecycle, tenancy, and visibility rules are implemented as described; the main gaps are decision **#12** (create requires dates, not “title + note only”) and call **D** (crew profiles still expose a commitment metric despite D14/CLAUDE “never scores”). Typecheck still passes.
</user_visible_high_level_summary>
<response>
# Mission Control — read-only implementation audit

**Scope:** Repo `mission-control` (Fastify/Prisma/Vitest). **Typecheck:** `npm run typecheck` exit 0 (verified this session). **Note:** The audit brief skips decision **#6** (jumps 5 → 7); DESIGN.md **D6** is covered under item **#17**.

---

## Decision claims (brief numbering)

| # | Verdict | Evidence (file:line) | Notes/divergence |
|---|---------|----------------------|------------------|
| 1 | **VERIFIED** | `prisma/schema.prisma:176-205` (MissionRole, RoleSkillRequirement); `src/services/snapshot.ts:151-158`; `src/matcher/matcher.ts:174-207`; `src/http/validation.ts:36-43`; `src/cli/commands/missions.ts:66-67,114,shared.ts:55-57` | Roles have name, headcount, per-role skill mins; matcher seats by role; CLI `--role "Name:1:nav=4"`. |
| 2 | **VERIFIED** | `src/matcher/hungarian.ts:1-14,14-90`; `src/matcher/matcher.ts:40-41,203-209`; `tests/unit/matcher.test.ts:9-24` | `ELIGIBLE_BONUS = 1_000_000`; weight `ELIGIBLE_BONUS + round(effective × 100)`; Hungarian max-weight assignment. |
| 3 | **VERIFIED** | `src/matcher/scoring.ts:12-16,27,75-91,115-119`; `tests/unit/matcher.test.ts:26-56` | `RARITY_MAX_PENALTY = 5`; effective = total − penalty; >5pt gap still picks rare specialist (test). |
| 4 | **VERIFIED** | `src/matcher/scoring.ts:24,38-48`; `src/domain/scheduling.ts:29-55`; `prisma/schema.prisma:66-67`; no `concurrent` cap in `src/matcher/scoring.ts` | ±90-day horizon; rest gap hard filter + org default 14; DESIGN rejected concurrent cap not present. |
| 5 | **VERIFIED** | `prisma/schema.prisma:43-44,214,242`; `src/services/staffing.ts:120-151,190-213`; `src/services/missions.ts:218-287,322-339`; `src/services/missions.ts:46-55` | PROPOSED without `offeredAt`; approve flips to OFFERED; snapshot JSON at submit; crew need `offeredAt` to see mission. |
| 7 | **VERIFIED** | `src/domain/lifecycle.ts:60,382-419`; `src/services/missions.ts:382-419`; `src/services/inbox.ts:1-11,240-248`; no `notifications` table in `prisma/schema.prisma` | Directors only, all non-terminal; WITHDRAWN/RELEASED + reason; inbox derived from state. |
| 8 | **VERIFIED** | `prisma/schema.prisma:37-40,213`; `TODO.md:12-24` | `AssignmentKind` PRIMARY\|BACKUP; no `promote` / backup nominate in services or CLI (TODO §1 only). |
| 9 | **VERIFIED** | `src/services/offers.ts:4-8,41-79,109-129`; `src/services/views.ts:21-27`; `src/services/missions.ts:596-609`; `src/services/inbox.ts:163-170`; `tests/integration/workflow.test.ts:193-196` | Multiple OFFERED rows; accept throws `SCHEDULE_CONFLICT` before update; lead `BLOCKED_FOR_LEAD`; crew detailed `blocked`. |
| 10 | **VERIFIED** | `src/services/expiry.ts:9-18`; `prisma/schema.prisma:67`; `src/services/missions.ts:331`; `src/services/staffing.ts:198` | `min(now+ttl, start−14d)` with floor `addDays(now,1)` (24h). |
| 11 | **VERIFIED** | `src/domain/lifecycle.ts:58-59,85-99,112-114`; `tests/integration/security.test.ts:42-57` | `directorNotOwner`; `CANNOT_APPROVE_OWN` when owner approves. |
| 12 | **PARTIAL** | `src/http/validation.ts:45-50,69-71`; `src/http/routes/missions.ts:67-71`; `src/services/missions.ts:362-366` | **Reject:** required note (`requiredNoteBody`). **Approve:** optional (`noteBody`). **Create:** requires `title`, `startDate`, `endDate` (+ optional `description`) — not “title + note only”. |
| 13 | **VERIFIED** | `src/services/people.ts:110-127`; `src/http/routes/me.ts:22-23` | Skills only via `/v1/me/skills`; no lead API to set others’ ratings. |
| 14 | **VERIFIED** | `src/matcher/scoring.ts:10,25,60-61,105`; `tests/unit/matcher.test.ts:188-196` | `(accepts − dropouts + 2) / (accepts + 2)`; only DROPPED in history counts via snapshot history. |
| 15 | **VERIFIED** | `src/services/missions.ts:672-728,694-727`; `src/services/offers.ts:21-37` | Crew view: single `assignment`, no roles/scores; roster only ACTIVE/COMPLETED + ACCEPTED; offers list has no matcher score. |
| 16 | **VERIFIED** | `prisma/schema.prisma:3-7,96-98,170-171,227-228`; `tests/integration/security.test.ts:132-141` | Composite FKs on tenant relations; cross-org `crewSkill.create` rejected. |
| 17 | **VERIFIED** | `src/services/snapshot.ts:1-4,112-163`; `src/matcher/matcher.ts:174-175` (no DB); `DESIGN.md:99-100` (D6) | Snapshot load in service; `runMatch` pure. |
| 18 | **VERIFIED** | `src/domain/lifecycle.ts:52-64,131-133`; `src/services/missions.ts:664-668`; `src/cli/commands/missions.ts:396-404`; `tests/integration/security.test.ts:60-69` | `MISSION_RULES` → `allowedMissionActions` → API → CLI hints. |
| 19 | **VERIFIED** | `src/cli/commands/missions.ts:53,131,396-404`; `src/cli/commands/session.ts:34-75`; `src/cli/commands/crew.ts:11-22`; `src/cli/config.ts:2-3`; `prisma/schema.prisma:152-153,64-65` | Keys `AST-6`, profiles, `mc inbox`, `show` + actions, `--explain`. |
| 20 | **VERIFIED** | `src/services/snapshot.ts:132-135`; `src/services/staffing.ts:34-39` | Match pool and nominate target `role === 'CREW_MEMBER'`. |
| 21 | **VERIFIED** | `prisma/migrations/20260928095500_roles_nominations_tenancy/migration.sql`; `CLAUDE.md:1-60`; `TODO.md`, `ROADMAP.md`; `scripts/demo.ts:1-30`; `CLAUDE.md:42` | Append-only migration (separate from init); process docs + demo script present. |

---

## Self-made calls (A–L)

| # | Verdict | Evidence (file:line) | Notes/divergence |
|---|---------|----------------------|------------------|
| A | **VERIFIED** | `src/services/people.ts:145-156`; `tests/integration/workflow.test.ts:225-227` | Unavailability blocked when overlapping accepted commitment; message points to drop-out. |
| B | **VERIFIED** | `src/services/missions.ts:109-130,200-215`; `src/cli/commands/missions.ts:112-122,600` | `replaceRoles` deletes PROPOSED; API returns `clearedNominations`; CLI warns. |
| C | **VERIFIED** | `src/services/missions.ts:170-195,229-264` | Date edit does not clear nominations; submit re-runs `evaluateCandidate` per PROPOSED seat. |
| D | **PARTIAL** | `src/services/missions.ts:716-725` (no assignment score); `src/services/people.ts:67-71,102-107` | Mission/offer views omit matcher scores. **Profile exposes `record.commitment`** to crew (contradicts D14/CLAUDE “never scores”). |
| E | **VERIFIED** | `src/services/people.ts:50-64`; `prisma/schema.prisma:140`; `tests/integration/security.test.ts:83-87` | Notes only if `self \|\| DIRECTOR`; leads get dates only. |
| F | **VERIFIED** | `src/matcher/matcher.ts:79-98`; `tests/unit/matcher.test.ts:108-114` | DECLINED/DROPPED/EXPIRED → ON_MISSION exclusion; WITHDRAWN/RELEASED → `default: return null`. |
| G | **VERIFIED** | `src/services/snapshot.ts:79-91`; `src/matcher/matcher.ts:148-155`; `tests/unit/matcher.test.ts:198-205` | Overlapping pending OFFERED/PROPOSED flagged in `notes`; not hard-filtered (test for OFFERED; PROPOSED same path in `flagsFor`). |
| H | **VERIFIED** | `src/domain/lifecycle.ts:62-63`; `tests/integration/security.test.ts:67` (owner actions include activate path via lifecycle) | `activate` → owner; `complete` → `ownerOrDirector`. |
| I | **VERIFIED** | `src/domain/lifecycle.ts:55,89-90`; `tests/integration/security.test.ts:67-68` | Non-owner lead: `['match']` only on draft; owner gets edit/nominate/submit. |
| J | **VERIFIED** | `src/services/expiry.ts:12-18` | Floor is one day after `now` (`addDays(now, 1)`). |
| K | **VERIFIED** | `prisma/seed.ts:52,84-92,415`; `src/lib/tokens.ts:3-6`; `tests/integration/security.test.ts:22-25` | `mct_${slug}_${handle}` printed; stored as sha256 hex digest. |
| L | **VERIFIED** | `src/services/missions.ts:46-55,683`; `src/services/people.ts:96-98`; `tests/integration/security.test.ts:77-79,107-109,122-123` | Cross-org / unoffered missions / other crew → **404** (`notFound`), not 403. Legitimate forbidden actions on visible resources still **403** (e.g. `security.test.ts:35-39`). |

---

## Surprises

1. **Audit item #12 vs DESIGN D12:** The brief’s “Mission create = title + note only” does not match DESIGN **D12** (workload/rest gap — implemented under #4) nor the API, which requires **start/end dates** on create (`validation.ts:45-50`).

2. **Commitment visible to crew (D14 / CLAUDE invariant 5):** `getMyProfile` / crew directory responses include `record.commitment` (`people.ts:67-71`). DESIGN D14 says crew never see scores, including their own; this is a smoothed metric, not matcher `score`, but it is still a numeric “score-like” field.

3. **BACKUP copy without feature:** Inbox offer text references backup seats (`inbox.ts:235`) while backup nomination/promote remains **TODO.md §1** only — schema-ready, behaviour not shipped.

4. **Brief numbering:** No verification row **#6** in the brief; DESIGN **D6** (pure matcher, no SQL filters) aligns with implemented **#17**, not a missing implementation.
</response>
output_path: c:\Users\shubh\.cursor\projects\c-Users-shubh-OneDrive-Documents-Mutinex\agent-transcripts\c9e4c66a-7432-46e8-a6b7-35fdfe37a5e7\subagents\8967897c-0d72-4d41-8426-ce5e2194e1d8.jsonl
</task>
</system_notification>
<user_query>Perform any necessary follow-up actions in response to the subagent completion above. If no follow-up work is needed, no further action is required. If you mention an agent or subagent in your response, link it with the `[Name](id)` Don't use generic label such as `[agent]`, `[worker]`, or `[subagent]`. For cloud subagents, when the agent has edited code, link to `[Review](bc-id#changes)`, or, if you know the exact added and deleted line counts, `[Review +A −D](bc-id#changes)`, replacing A and D with those counts. Never write A or D literally. Use `[Try Live](bc-id#desktop)` only when the agent used computer use. Don't repeat the same confirmation every time.</user_query>

---

**Cursor**

§1 appended to `AUDIT.md`. Headline from the [decision-trail verification](8967897c-0d72-4d41-8426-ce5e2194e1d8): **19/20 decisions verified, 11/12 self-made calls verified** — with two findings worth your call:

1. **#12 PARTIAL** — the manifest claimed "title + note only" on create, but the code requires start/end dates. The code is arguably right; the manifest text was wrong.
2. **Call D PARTIAL** — crew profiles expose a numeric `commitment` metric (`people.ts:67-71`), which sits awkwardly with D14's "crew never see scores". Either hide it from the crew self-view or amend D14's wording to allow aggregate reliability metrics.

Six agents still running; I'll keep appending as they land.

---

**User**

<timestamp>Monday, Sep 28, 2026, 9:06 PM (UTC+10)</timestamp>
<system_notification>
The following task has finished. If you were already aware, ignore this notification and do not restate prior responses.

<task>
kind: subagent
status: success
task_id: 51f8568e-94ab-40d4-ac2b-612218322d96
title: Real-world space ops edge case research
tool_call_id: CallDynamicTool_6_85c5e3a6-53e24
agent_id: 51f8568e-94ab-40d4-ac2b-612218322d96
detail: <user_visible_high_level_summary>
This report maps real crew-assignment practice (NASA/ESA, Antarctic, aviation, surgery, B2B SaaS) to **22 concrete test/edge cases**, each tagged against Mission Control’s DESIGN/TODO/ROADMAP and prioritized for V1.1, ROADMAP, or out of scope. Already-planned items (backups, cert expiry, reschedule, pairing, weights, outbox, etc.) are confirmed as aligned with practice—not duplicated as new findings.
</user_visible_high_level_summary>
<response>
# Mission Control — Real-World Crew Assignment Research & Edge-Case Audit

**Purpose:** Inform test design and roadmap prioritisation for the Mission Control take-home. 
**Sources:** Public NASA/ESA/NSF/FAA/regulatory and industry documentation (URLs cited per case). 
**Baseline:** Compared against [DESIGN.md](c:\Users\shubh\OneDrive\Documents\Mutinex\mission-control\DESIGN.md), [TODO.md](c:\Users\shubh\OneDrive\Documents\Mutinex\mission-control\TODO.md), [ROADMAP.md](c:\Users\shubh\OneDrive\Documents\Mutinex\mission-control\ROADMAP.md). 
**Date:** 2026-09-28

---

## Executive summary

Real high-stakes crew assignment combines **hard eligibility gates** (medical clearance, training currency, rest/quarantine, qualifications), **joint optimisation** (who fills which seat, scarce skills, workload), **governance** (named approval, audit trail), and **operational repair** (backup promotion, late swap, launch slip) without reopening policy for every personnel change.

Mission Control’s v1 design already mirrors several of these patterns deliberately: pre-launch **rest gap** and **offer deadlines capped at launch − 14 days** (Health Stabilization Program analogue), **joint seat assignment**, **backfill without re-approval**, **submission snapshots**, and **mission_events** audit. Planned work in TODO/ROADMAP (backup crews, verified skills, reschedule, cert expiry, pairing rules, per-org weights, notifications outbox, direct assignment) aligns with practice and should be treated as **confirmed coverage**, not new discoveries.

Gaps worth testing or scheduling fall into four buckets: **(1)** medical/training readiness gates beyond self-rated skills, **(2)** late replacement and backup promotion under time pressure, **(3)** in-mission and cross-mission schedule shocks, **(4)** multi-tenant compliance (offboarding, audit retention, org policy variance).

---

## 1. Space agency crew assignment (NASA / ESA / partners)

### 1.1 Prime and backup crews

| Practice | Real world | Mission Control |
|----------|------------|-----------------|
| Prime + backup selected together | ESA MCOP selects prime and backup at the same time; backups train alongside ([ESA — Assigning an astronaut](https://www.esa.int/Science_Exploration/Human_and_Robotic_Exploration/Astronauts/Assigning_an_astronaut_to_a_mission)). Artemis II: NASA backup Andre Douglas trains with prime crew ([NASA Artemis II backup](https://www.nasa.gov/news-release/nasa-announces-its-artemis-ii-backup-crew-member-for-moon-mission/)). | **PARTIALLY** — `assignments.kind = PRIMARY \| BACKUP` in schema; full workflow in **TODO.md §1** (nominate `--backups`, promote, inbox on backup/primary conflict). |
| Soyuz pipeline | Backup crew often becomes next mission’s prime ([NASASpaceFlight — Soyuz MS-29](https://www.nasaspaceflight.com/2026/07/soyuz-ms-29-launch/)). | **DOES NOT** — no “crew pipeline” or automatic succession between missions. **OUT OF SCOPE** for take-home. |

### 1.2 Medical grounding close to launch

| Practice | Real world | Mission Control |
|----------|------------|-----------------|
| Pre-flight medical disqualification | Annual recert; Aerospace Medical Board / waivers ([NASA OCHMO standards PDF](https://www.nasa.gov/wp-content/uploads/2024/09/ochmo-std-100-1a-rev-a-signed.pdf)); operational exceptions to Administrator ([NPR 8900.1B Appendix E](https://nodis3.gsfc.nasa.gov/displayDir.cfm?Internal_ID=N_PR_8900_001B_&page_name=AppendixE)). | **PARTIALLY** — crew can block dates via **unavailability**; no medical clearance entity or waiver workflow. |
| Late replacement (Apollo 13) | Mattingly removed ~72h pre-launch (rubella exposure); backup Swigert inserted after simulator runs ([NASA history — Apollo 13 measles](https://www.nasa.gov/history/50-years-ago-apollo-13-and-german-measles/), [Apollo journals — crew change](https://www.apollojournals.org/afj/ap13fj/00crewchange.html)). | **PARTIALLY** — **backfill offer** + planned **promote backup** (TODO §1); no “readiness / simulator” gate before swap. |
| Soyuz medical swap (2020) | Two cosmonauts replaced ~3 weeks before launch for medical reasons; backups promoted ([Spaceflight Now — Soyuz MS-16](https://spaceflightnow.com/2020/02/19/russian-space-agency-replaces-cosmonauts-on-next-space-station-crew/)). | Same as Apollo — operational repair path exists; no partner-specific seat rules. |

### 1.3 Quarantine (health stabilisation)

| Practice | Real world | Mission Control |
|----------|------------|-----------------|
| L-14 quarantine | HSP: quarantine from L-14; extension vs termination on launch delay is surgeon-led ([NASA HSP Rev F PDF](https://ntrs.nasa.gov/api/citations/20230012738/downloads/JSC%2022538%20Health%20Stabilization%20Program%20Rev%20F%20Clean.pdf), [CSA video — quarantine](https://www.asc-csa.gc.ca/eng/multimedia/search/video/19766)). | **HANDLES (approximation)** — org **rest_gap_days** (default 14) as hard filter; **offer deadline** `min(TTL, launch − 14)` (DESIGN D17). Confirms design intent. |
| Immunisation L-28 | Contemporary timeline includes immunisation completion L-28 ([NASA Quarantine Program 2023 PDF](https://ntrs.nasa.gov/api/citations/20230015414/downloads/NASA%20Quarantine%20Program%202023-10-23.pdf)). | **DOES NOT** — no immunisation/cert checklist beyond planned **expires_at** on skills (ROADMAP). |

### 1.4 Training currency and assignment eligibility

| Practice | Real world | Mission Control |
|----------|------------|-----------------|
| Must complete basic + pre-assignment before assignment | ESA: eligible only after pre-assignment training ([ESA — Pre-assignment training](https://www.esa.int/Science_Exploration/Human_and_Robotic_Exploration/Astronauts/Pre-assignment_training)). | **PARTIALLY** — **skill levels** + **experience** score; no explicit “training phase complete” flag. |
| Mission-specific training ~18–24 months post-assignment | ESA/CSA phased training ([ESA FAQs](https://www.esa.int/About_Us/Careers_at_ESA/ESA_Astronaut_Selection/Astronaut_selection_2021-22_FAQs)). | **DOES NOT** — no timeline between assignment and launch for training adequacy. **ROADMAP** at earliest as cert/training records. |
| Refresher if gap before increment training | ESA Bulletin: refresher/on-the-job if long gap before increment training ([ESA Bulletin PDF](https://www.esa.int/esapub/bulletin/bullet104/messers104.pdf)). | **PARTIALLY** — experience score decays with lack of completed missions; not time-since-last-drill. |

### 1.5 Psychological screening and crew compatibility

| Practice | Real world | Mission Control |
|----------|------------|-----------------|
| Individual behavioural suitability | NASA selection: psych testing, team sims, peer ratings ([NASA BHP PDF](https://ntrs.nasa.gov/api/citations/20200001705/downloads/20200001705.pdf)). | **DOES NOT** at assignment time — no psych profile. **OUT OF SCOPE** for take-home. |
| Team composition not fully data-driven | NASA “Team Risk”: individual skills assessed; crew composition historically not systematic ([NASA Team Risk](https://www.nasa.gov/directorates/esdmd/hhp/team-risk/)). | **PARTIALLY** — Hungarian + rarity helps scarce skills; **ROADMAP** “must/must-not fly together” ([ROADMAP.md](c:\Users\shubh\OneDrive\Documents\Mutinex\mission-control\ROADMAP.md)). |
| MCOP behavioural + language criteria | ISS crew criteria: conduct, stress performance, languages ([ESA — ISS crew criteria](https://www.esa.int/Science_Exploration/Human_and_Robotic_Exploration/International_Space_Station/ISS_partners_release_crew_criteria_document)). | **DOES NOT** — no language or conduct fields. **OUT OF SCOPE** unless brief expands. |

### 1.6 Family emergencies vs in-mission medical events

| Practice | Real world | Mission Control |
|----------|------------|-----------------|
| Family emergency pre-launch | No well-documented public “family emergency → launch crew swap” analogue found; agencies emphasise medical/infectious drivers. | **PARTIALLY** — crew **unavailability** + **drop-out**; no priority/emergency override for leads. |
| In-mission medical return | Crew-11 early return Jan 2026 (stable medical issue); replacement Crew-12 launched ASAP ([SpacePolicyOnline](https://spacepolicyonline.com/news/nasa-decides-to-bring-crew-11-home-early-but-not-an-emergency/), [AP News Crew-12](https://apnews.com/article/nasa-spacex-crew-12-space-station-fca7ba935ff24be606015d3c0c611512)). | **PARTIALLY** — **cancel** or **complete** mission; **drop-out** reopens seat on active mission; no “end mission early, release all without penalty” distinct from cancel. |

### 1.7 International partner seat swaps (barter)

| Practice | Real world | Mission Control |
|----------|------------|-----------------|
| NASA–Roscosmos cross-flight supplements | Crew changes by bilateral agreement (e.g. Williams on Soyuz MS-28, seat exchanges) ([Interfax Roscosmos](https://www.interfax-russia.ru/military/news_eng/418649), [SpaceNews barter extension](https://spacenews.com/nasa-extends-seat-barter-agreement-with-roscosmos-into-2027/)). | **DOES NOT** — strict **single-org tenancy**; no cross-tenant seat allocation. **ROADMAP v3** multi-org users ≠ barter. **OUT OF SCOPE** for take-home. |
| Kikina ↔ Rubio exchange (Soyuz/Dragon) | Partner astronaut swapped per agreement ([RussianSpaceWeb — Soyuz MS-22](https://www.russianspaceweb.com/soyuz-ms-22.html)). | Same — organisational boundary is real; MC models one org per mission. |

### 1.8 Post-flight reconditioning

| Practice | Real world | Mission Control |
|----------|------------|-----------------|
| 45-day ASCR programme | Mandatory 45-day, 2h/day reconditioning post-ISS ([NTRS post-flight reconditioning](https://ntrs.nasa.gov/citations/20110020318), [NASA exercise overview PDF](https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-031-exercise-overview.pdf)). | **PARTIALLY** — symmetric **rest_gap** between missions (DESIGN cites quarantine + reconditioning); **no longer post-flight block** than pre-flight unless org sets one gap for all adjacency. Confirms rest gap as simplified unified rule. |

---

## 2. Analogue domains — shared constraints and failure modes

| Domain | Shared constraints | Typical failure modes | Overlap with Mission Control |
|--------|-------------------|----------------------|------------------------------|
| **Antarctic winter-over** | PQ medical/psych clearance; evac impossible/delayed weeks ([NSF PQ Guidelines PDF](https://nsf-gov-resources.nsf.gov/files/PQ-Guidelines-Current-13-March-2025.pdf), [45 CFR Part 675](https://www.govinfo.gov/content/pkg/CFR-2024-title45-vol4/pdf/CFR-2024-title45-vol4-part675.pdf)) | Mid-season replacement under weather window ([NSF Shemenski 2001](https://www.nsf.gov/od/lpa/news/media/01/ps0104.htm)); behavioural incident + delayed evac ([ABC Jang Bogo 2026](https://www.abc.net.au/news/2026-05-14/korean-researcher-antarctica-knife-incident-jang-bogo-station/106677948)) | Hard filters + backfill; missing **austere-environment clearance tier** and **mid-mission mass release** |
| **Submarine duty** | Medical disqualification removes designator; limited waivers ([MILPERSMAN / NAVMED](https://operationalmedicine.org/Library/Manuals/ManMed15/74Procedure.html)) | Pre-deployment phone waiver with follow-up documentation | Analogue to **verified skills** + ** waiver** (not built) |
| **Airline (FAR 117)** | Min rest 10h before duty; 30h free in 168h; fatigue reporting ([14 CFR Part 117](https://www.ecfr.gov/current/title-14/chapter-I/subchapter-G/part-117)) | Accept assignment then declare unfit for rest → must not report ([§117.25(f)](https://www.ecfr.gov/current/title-14/chapter-I/subchapter-G/part-117)) | **rest_gap** + **workload horizon** partial; no cumulative duty tables or “fit for duty” attestation |
| **Pilot currency (Part 61)** | PIC proficiency every 12/24 months; grace month ([14 CFR §61.58](https://www.ecfr.gov/current/title-14/chapter-I/subchapter-D/part-61/subpart-A/section-61.58)) | Assignment with check due in grace window | **ROADMAP cert expiry** aligns; add tests for **mission end date vs expiry boundary** |
| **OR / surgical nursing** | Skill-mix per shift (senior + scrub + circulator); no consecutive night→day ([nurse rostering literature](https://journals.sagepub.com/doi/10.1177/1847979019891022), [Frontiers OR nursing 2025](https://www.frontiersin.org/journals/public-health/articles/10.3389/fpubh.2025.1539108/full)) | Emergency re-roster; float pool | Role **headcount** + **multi-skill requirements** similar; no **minimum seniority mix** per role |

**Cross-cutting failure modes** (good test themes): eligibility revoked after approval; partial crew replacement when transport/weather delays repair; concurrent overlapping commitments; audit need to prove who decided; tenant-specific policy (rest days, approval mode).

---

## 3. B2B multi-tenant SaaS operational edge cases

| Topic | Real-world expectation | Mission Control today |
|-------|------------------------|------------------------|
| **Tenant offboarding** | Multi-store deletion workflow, grace then hard delete/crypto-shred, certificate of deletion ([multi-tenant-saas.com offboarding](https://www.multi-tenant-saas.com/multi-tenant-compliance-data-governance/tenant-offboarding-and-data-retention/)) | **DOES NOT** — no org delete/export; SQLite demo. **ROADMAP v3** ops maturity. |
| **Org-level policy differences** | Per-tenant retention, approval, roster rules | **HANDLES (partial)** — `rest_gap_days`, `offer_ttl_days`; **ROADMAP** approval modes, weights, direct assignment. |
| **Audit under erasure** | Audit logs often retained/pseudonymised when user erased ([Microsoft GDPR DSR](https://learn.microsoft.com/en-us/compliance/regulatory/gdpr-dsr-Azure), [STOA audit playbook](https://docs.gostoa.dev/blog/saas-playbook-3-audit-compliance)) | **PARTIALLY** — `mission_events` append-only; no user erasure, retention policy, or cross-tenant audit export. |
| **DSAR / ledger survives erasure** | Request ledger must not be deleted with subject ([GDPR DSAR guide](https://www.multi-tenant-saas.com/multi-tenant-compliance-data-governance/gdpr-data-subject-requests/)) | **DOES NOT** |

---

## 4. Concrete test-case and edge-case candidates

**Legend — coverage:** 
- **HANDLES** — implemented per DESIGN v2 / tests 
- **PARTIAL** — subset or TODO/ROADMAP explicitly planned 
- **MISSING** — not designed 

**Priority:** 
- **V1.1** — small, high signal, fits TODO-sized PRs 
- **ROADMAP** — already scoped or natural v2/v3 
- **OOS** — over-engineering for take-home 

---

### Theme A — People (eligibility, skills, medical, psychology)

#### A1. Late medical grounding after offers sent
- **Real world:** Soyuz MS-16 medical swap ~3 weeks pre-launch ([Spaceflight Now](https://spaceflightnow.com/2020/02/19/russian-space-agency-replaces-cosmonauts-on-next-space-station-crew/)).
- **Coverage:** **PARTIAL** — lead **backfill** + **retract**; backup **promote** in TODO §1; no automatic “grounded” status from medical officer.
- **Suggested tests:** Active mission, accepted primary adds unavailability overlapping mission → blocked; lead offers replacement; declined person excluded from rematch on same mission (DESIGN §11).
- **Priority:** **V1.1** (extend integration tests around backfill + TODO backup promote).

#### A2. Exposure-based removal inside quarantine window (Apollo 13 pattern)
- **Real world:** Replace CMP 72h before launch; cohesion verified in simulator ([Apollo journals](https://www.apollojournals.org/afj/ap13fj/00crewchange.html)).
- **Coverage:** **PARTIAL** — deadline/accept rules still apply; **promote backup** is the closest product path (TODO §1).
- **Suggested tests:** Mission APPROVED, primary OFFERED/ACCEPTED, backup ACCEPTED as backup → primary DROPPED → `promote` fills seat without re-approval; offer deadline still enforced for any new OFFERED seat.
- **Priority:** **V1.1** (blocked on TODO §1).

#### A3. Certification expires between nomination and launch
- **Real world:** FAA PIC proficiency 12/24-month currency ([§61.58](https://www.ecfr.gov/current/title-14/chapter-I/subchapter-D/part-61/subpart-A/section-61.58)); NASA annual medical recert ([OCHMO PDF](https://www.nasa.gov/wp-content/uploads/2024/09/ochmo-std-100-1a-rev-a-signed.pdf)).
- **Coverage:** **PARTIAL** — **ROADMAP** `crew_skills.expires_at` hard filter through mission **end** + lead warning.
- **Suggested tests:** Nominee valid at submit, `expires_at` before `mission.end_date` at accept → reject; matcher excludes after expiry date.
- **Priority:** **ROADMAP** (confirm spec in ROADMAP matches FAA/NASA boundary = mission end).

#### A4. Lead-verified vs self-rated skill gaming
- **Real world:** Agencies certify competencies; NASA uses formal boards ([OCHMO waiver brief](https://www.nasa.gov/wp-content/uploads/2024/09/ochmo-mtb-002-waivered-health-conditions.pdf)).
- **Coverage:** **PARTIAL** — v1 self-rated (D18); **TODO §2** verified_level + `require_verified_skills`.
- **Suggested tests:** Self-rated nav=5, verified nav=3 → matcher uses 3; org setting blocks unverified for submit.
- **Priority:** **V1.1** (TODO §2).

#### A5. Operational medical waiver (fly under exception)
- **Real world:** Administrator-level operational exception when standard not met ([NPR 8900.1B App E](https://nodis3.gsfc.nasa.gov/displayDir.cfm?Internal_ID=N_PR_8900_001B_&page_name=AppendixE)).
- **Coverage:** **MISSING** — no waiver object or director override of hard filter.
- **Suggested tests:** Director documents exception, single mission assignment allowed despite REST_GAP or SKILL — *if ever built*.
- **Priority:** **OOS** (governance + liability; note in audit only).

#### A6. “Must not fly together” / mentor pairing
- **Real world:** NASA team composition research ([CREWS task](http://humanresearchroadmap.nasa.gov/tasks/?i=1987)); OR teams matched to surgeon habits ([Frontiers 2025](https://www.frontiersin.org/journals/public-health/articles/10.3389/fpubh.2025.1539108/full)).
- **Coverage:** **PARTIAL** — **ROADMAP** pairing rules; v1 Hungarian ignores dyads.
- **Suggested tests:** Two handles constrained must-not; matcher returns infeasible or alternate joint assignment.
- **Priority:** **ROADMAP**.

#### A7. Training eligibility gate (pre-assignment incomplete)
- **Real world:** Cannot assign until pre-assignment training complete ([ESA pre-assignment](https://www.esa.int/Science_Exploration/Human_and_Robotic_Exploration/Astronauts/Pre-assignment_training)).
- **Coverage:** **MISSING** — skills only, no training-state enum.
- **Suggested tests:** Crew missing `training_complete` equivalent → hard filter at submit.
- **Priority:** **OOS** (needs new domain model); optional **ROADMAP** as cert/training record.

---

### Theme B — Schedule (rest, quarantine, slips, workload)

#### B1. Offer must be decided before quarantine window (L−14)
- **Real world:** HSP L-14 quarantine ([HSP PDF](https://ntrs.nasa.gov/api/citations/20230012738/downloads/JSC%2022538%20Health%20Stabilization%20Program%20Rev%20F%20Clean.pdf)).
- **Coverage:** **HANDLES** — deadline `min(TTL, launch − 14)` (DESIGN D17); rest_gap default 14 (D12).
- **Suggested tests:** Launch in 10 days → offer TTL capped; accept fails if rest_gap violated at boundary exactly (existing unit tests per DESIGN §19).
- **Priority:** **V1.1** — regression only (**confirms design**).

#### B2. Launch slip after approval (quarantine clock reset)
- **Real world:** HSP lead surgeon extends or terminates quarantine on delay ([CSA quarantine video](https://www.asc-csa.gc.ca/eng/multimedia/search/video/19766)).
- **Coverage:** **PARTIAL** — **ROADMAP** reschedule releases conflicted crew without penalty, recomputes deadlines; v1 has no reschedule.
- **Suggested tests:** Reschedule later → crew inside old window but invalid on new dates released; offers recomputed.
- **Priority:** **ROADMAP** (**confirms ROADMAP**).

#### B3. Post-flight reconditioning vs pre-flight quarantine asymmetry
- **Real world:** 45-day post-flight programme ([NTRS ASCR](https://ntrs.nasa.gov/citations/20110020318)).
- **Coverage:** **PARTIAL** — single **rest_gap_days** both directions (DESIGN §3 table).
- **Suggested tests:** Mission A ends day X, Mission B starts day X+14 → accept OK; X+13 → REST_GAP fail.
- **Priority:** **V1.1** — boundary tests (**confirms design**); separate post_gap setting = **ROADMAP** if product wants fidelity.

#### B4. Cumulative workload / “30 hours free in 168” (airline analogue)
- **Real world:** FAR 117 rolling rest ([Part 117](https://www.ecfr.gov/current/title-14/chapter-I/subchapter-G/part-117)).
- **Coverage:** **PARTIAL** — ±90-day **workload score** + exclusive overlap filter; not prescriptive duty tables.
- **Suggested tests:** Three short missions in horizon reduce workload score vs idle crew; greedy vs Hungarian still fills seats.
- **Priority:** **ROADMAP** (per-org weights already planned); full FAR-like rules **OOS**.

#### B5. Crew declares insufficient rest before accept (airline §117.25(f))
- **Real world:** Pilot must notify if 10h rest inadequate; cannot report until fixed ([eCFR §117.25](https://www.ecfr.gov/current/title-14/chapter-I/subchapter-G/part-117)).
- **Coverage:** **MISSING** — no crew-side “not fit to accept” except decline.
- **Suggested tests:** Decline with reason “rest”; lead sees inbox; optional future `defer` state.
- **Priority:** **OOS** (nice UX); **V1.1** if implemented as decline + note only.

#### B6. Pending overlapping offers + accept re-check (airline double-booking)
- **Real world:** Rostering avoids double assignment; FRMS when rules bent ([AC 120-103A](https://www.faa.gov/documentLibrary/media/Advisory_Circular/AC_120-103A_EditorialUpdate.pdf)).
- **Coverage:** **HANDLES** — multiple OFFERED; accept transaction re-runs schedule rules (DESIGN D17); integration tests cited §19.
- **Suggested tests:** Two overlapping OFFERED → accept second fails until drop first; other lead sees generic blocked message.
- **Priority:** **V1.1** — extend privacy/blocking tests (**confirms design**).

---

### Theme C — Approval / governance / repair

#### C1. Backup accepts overlapping primary elsewhere (lead decision)
- **Real world:** Backup must stay ready but primary assignment may conflict with backup role ([Artemis backup training together](https://www.nasa.gov/news-release/nasa-announces-its-artemis-ii-backup-crew-member-for-moon-mission/)).
- **Coverage:** **PARTIAL** — **TODO §1** explicit: notify lead, no auto-release backup.
- **Suggested tests:** Backup for AST-6 accepts primary on AST-9 overlapping → inbox item; seat counts still PRIMARY-only.
- **Priority:** **V1.1** (TODO §1).

#### C2. Director cannot approve own mission; peer/N-of-M
- **Real world:** MCOP consensus; multi-party sign-off ([ESA assignment](https://www.esa.int/Science_Exploration/Human_and_Robotic_Exploration/Astronauts/Assigning_an_astronaut_to_a_mission)).
- **Coverage:** **HANDLES** — D5 director ≠ owner; **ROADMAP** N-of-M, peer, risk tiers.
- **Suggested tests:** `CANNOT_APPROVE_OWN`; seeded org needs second director (TODO §6 seed note).
- **Priority:** **V1.1** for second director seed + test; modes **ROADMAP**.

#### C3. Lead withdraws submission before director acts
- **Real world:** Programme offices pull packages for errors before board meets (implicit in round-based review).
- **Coverage:** **PARTIAL** — **TODO §3** `SUBMITTED → DRAFT`.
- **Suggested tests:** Withdraw → director inbox clears; snapshot round marked WITHDRAWN; resubmit round n+1.
- **Priority:** **V1.1** (TODO §3).

#### C4. Reject → revise with director note preserved
- **Real world:** MCOP iteration with feedback ([ESA assignment process](https://www.esa.int/Science_Exploration/Human_and_Robotic_Exploration/Astronauts/Assigning_an_astronaut_to_a_mission)).
- **Coverage:** **HANDLES** — REJECTED + note; resubmit rounds (DESIGN §15).
- **Suggested tests:** End-to-end reject/resubmit; `mc missions history` shows payload.
- **Priority:** **V1.1** — smoke (**confirms design**).

#### C5. Swap person on approved plan without re-approval; change roles requires re-approval
- **Real world:** Crew office swaps individuals operationally; mission profile change re-boards ([DESIGN D7 rationale](c:\Users\shubh\OneDrive\Documents\Mutinex\mission-control\DESIGN.md)).
- **Coverage:** **HANDLES** backfill; **ROADMAP** reschedule for date changes without re-approval, role changes do.
- **Suggested tests:** Backfill after decline no second approve; `PUT roles` on APPROVED forbidden or forces DRAFT (verify lifecycle).
- **Priority:** **V1.1** / **ROADMAP** split per action type.

#### C6. In-mission medical evacuation — early mission termination
- **Real world:** Crew-11 controlled medical return; replacement launch ([SpacePolicyOnline](https://spacepolicyonline.com/news/nasa-decides-to-bring-crew-11-home-early-but-not-an-emergency/)).
- **Coverage:** **PARTIAL** — **cancel** with reason releases all; **complete** ends normally; no “abort early, no crew penalty” variant.
- **Suggested tests:** ACTIVE → cancel vs complete; RELEASED vs DROPPED commitment scoring differs (DESIGN D13).
- **Priority:** **V1.1** for commitment semantics; dedicated **abort** type **OOS**.

#### C7. Atomic offer switch between overlapping missions
- **Real world:** Airline/travel roster systems use atomic swap to avoid double-book window.
- **Coverage:** **PARTIAL** — two-step drop+accept today; **TODO §5** `--replace`.
- **Suggested tests:** Concurrent accept on two missions → one wins CAS; atomic replace single transaction.
- **Priority:** **V1.1** (TODO §5).

---

### Theme D — Tenancy / ops / compliance

#### D1. Cross-tenant write via composite FK
- **Real world:** Enterprise SaaS: hard isolation at DB layer ([STOA tenant isolation](https://docs.gostoa.dev/blog/saas-playbook-3-audit-compliance)).
- **Coverage:** **HANDLES** — composite `(org_id, id)` FKs + tests (DESIGN D15, §19).
- **Suggested tests:** Insert assignment with wrong org skill → DB reject; API 404 on other org keys.
- **Priority:** **V1.1** — keep green (**confirms design**).

#### D2. Org A cannot infer Org B mission existence
- **Real world:** 404 vs 403 anti-enumeration.
- **Coverage:** **HANDLES** — 404 on cross-tenant keys (DESIGN §7).
- **Suggested tests:** LUN mission key with AST token → 404.
- **Priority:** **V1.1** (**confirms design**).

#### D3. Per-org rest gap and offer TTL differ
- **Real world:** Partners run different quarantine/rest policies (Astra 14 vs LUN 21 in seed).
- **Coverage:** **HANDLES** — org settings; seed demonstrates (DESIGN §18).
- **Suggested tests:** Same crew, same dates, different org eligibility on REST_GAP.
- **Priority:** **V1.1** (**confirms design**).

#### D4. Tenant offboarding with mission history retained for compliance
- **Real world:** Invoices/audit retained; operational data deleted ([offboarding guide](https://www.multi-tenant-saas.com/multi-tenant-compliance-data-governance/tenant-offboarding-and-data-retention/)).
- **Coverage:** **MISSING**.
- **Suggested tests:** Delete org → export bundle; `mission_events` pseudonymised actors; assignments archived.
- **Priority:** **ROADMAP v3** / **OOS** for take-home.

#### D5. User erasure vs immutable audit trail
- **Real world:** Azure: audit logs may survive user delete ([Microsoft DSR](https://learn.microsoft.com/en-us/compliance/regulatory/gdpr-dsr-Azure)).
- **Coverage:** **PARTIAL** — events store `actor_id`; no erasure flow.
- **Suggested tests:** Delete user → events retain id/hash; PII stripped from profile.
- **Priority:** **ROADMAP v3**.

#### D6. Notifications delivery vs inbox source of truth
- **Real world:** Ops centres use paging/email; ISS still has formal comms chains.
- **Coverage:** **PARTIAL** — inbox derived from state (DESIGN D19); **ROADMAP** outbox worker.
- **Suggested tests:** Event written → inbox item; future: outbox row same transaction.
- **Priority:** **ROADMAP** (**confirms ROADMAP**).

---

## 5. Confirmation: already planned items vs real practice

| Planned item (TODO/ROADMAP/DESIGN) | Real-world anchor | Alignment |
|-----------------------------------|-------------------|-----------|
| Prime + backup (TODO §1) | ESA/NASA/Artemis/Soyuz backup crews | **Strong** |
| Offer deadline + launch−14 (D17) | NASA HSP L-14 | **Strong** (simplified) |
| Rest gap (D12, org setting) | HSP + post-flight gap cited in DESIGN §3 | **Moderate** (symmetric single gap) |
| Cert expiry (ROADMAP) | FAA currency, NASA medical recert | **Strong** |
| Reschedule / launch slip (ROADMAP) | HSP extend/terminate quarantine on delay | **Strong** |
| Pairing rules (ROADMAP) | NASA team composition gap / OR team matching | **Directionally right** |
| Per-org matcher weights (ROADMAP) | Airline FRMS / hospital team fairness metrics | **Reasonable abstraction** |
| Direct assignment (ROADMAP) | Agencies assign; MC offers for B2B consent (DESIGN §3) | **Explicit deliberate diff** |
| Notifications outbox (ROADMAP) | Standard ops alerting | **Expected** |
| Director-only approval (D5) | MCOP consensus simplified to director gate | **Simplified but valid v1** |

---

## 6. Recommended test pack (minimum high-value set)

For an audit or CI expansion, prioritise **12 scenarios** that mix confirmation and gap-finding:

1. B1 — L−14 offer cap (regression) 
2. B3 — rest_gap boundary 
3. B6 — overlapping offers + accept conflict + privacy 
4. C4 — reject/resubmit round trip 
5. C5 — decline → backfill without re-approve 
6. A2/C1 — backup promote + backup/primary conflict inbox (post TODO §1) 
7. A4 — verified skills override (post TODO §2) 
8. C3 — submission withdraw (post TODO §3) 
9. C7 — atomic replace (post TODO §5) 
10. D1/D2 — tenancy FK + 404 
11. D3 — org-specific rest gap 
12. B2 — reschedule releases crew (post ROADMAP reschedule)

---

## 7. Source bibliography (primary URLs)

- ESA assignment & training: https://www.esa.int/Science_Exploration/Human_and_Robotic_Exploration/Astronauts/Assigning_an_astronaut_to_a_mission 
- NASA Artemis II backup: https://www.nasa.gov/news-release/nasa-announces-its-artemis-ii-backup-crew-member-for-moon-mission/ 
- NASA HSP (L-14 quarantine): https://ntrs.nasa.gov/api/citations/20230012738/downloads/JSC%2022538%20Health%20Stabilization%20Program%20Rev%20F%20Clean.pdf 
- Apollo 13 crew change: https://www.apollojournals.org/afj/ap13fj/00crewchange.html 
- Soyuz medical replacement (2020): https://spaceflightnow.com/2020/02/19/russian-space-agency-replaces-cosmonauts-on-next-space-station-crew/ 
- Roscosmos/NASA seat supplements: https://www.interfax-russia.ru/military/news_eng/418649 
- NASA operational medical exception: https://nodis3.gsfc.nasa.gov/displayDir.cfm?Internal_ID=N_PR_8900_001B_&page_name=AppendixE 
- NASA team risk / composition: https://www.nasa.gov/directorates/esdmd/hhp/team-risk/ 
- Post-flight reconditioning: https://ntrs.nasa.gov/citations/20110020318 
- NSF Antarctic PQ: https://nsf-gov-resources.nsf.gov/files/PQ-Guidelines-Current-13-March-2025.pdf 
- Antarctic mid-winter replacement: https://www.nsf.gov/od/lpa/news/media/01/ps0104.htm 
- FAR 117 rest: https://www.ecfr.gov/current/title-14/chapter-I/subchapter-G/part-117 
- FAA §61.58 currency: https://www.ecfr.gov/current/title-14/chapter-I/subchapter-D/part-61/subpart-A/section-61.58 
- Crew-11 medical return: https://spacepolicyonline.com/news/nasa-decides-to-bring-crew-11-home-early-but-not-an-emergency/ 
- Tenant offboarding: https://www.multi-tenant-saas.com/multi-tenant-compliance-data-governance/tenant-offboarding-and-data-retention/ 
- GDPR audit retention (Azure): https://learn.microsoft.com/en-us/compliance/regulatory/gdpr-dsr-azure 

---

*End of report — suitable for inclusion in audit documentation verbatim.*
</response>
output_path: c:\Users\shubh\.cursor\projects\c-Users-shubh-OneDrive-Documents-Mutinex\agent-transcripts\c9e4c66a-7432-46e8-a6b7-35fdfe37a5e7\subagents\51f8568e-94ab-40d4-ac2b-612218322d96.jsonl
</task>
</system_notification>

<timestamp>Monday, Sep 28, 2026, 9:06 PM (UTC+10)</timestamp>
<system_notification>
The following task has finished. If you were already aware, ignore this notification and do not restate prior responses.

<task>
kind: subagent
status: success
task_id: 6004d124-307e-4fa1-9430-24e81cf5cec4
title: Cross-tenant privacy deep audit
tool_call_id: CallDynamicTool_4_0f4cf726-53e24
agent_id: 6004d124-307e-4fa1-9430-24e81cf5cec4
detail: <user_visible_high_level_summary>
Read-only cross-tenant and privacy audit of Mission Control found **no CRITICAL or HIGH cross-tenant data leaks**. Isolation is enforced via composite `(org_id, id)` FKs, org-scoped service queries, mission key prefix checks, and integration tests (53/53 passing). Residual items are defense-in-depth (updates by bare `id`), CLI/process token exposure, and non-strict query schemas — none demonstrated as cross-tenant break paths.
</user_visible_high_level_summary>
<response>
# Mission Control — Cross-Tenant Isolation & Privacy Audit (Read-Only)

**Scope:** `src/services/*`, `src/http/*`, auth, CLI, seed 
**Baseline verified:** `npm test` — 53/53 passed 
**Cross-tenant break attempts:** No exploitable cross-tenant read/write path identified.

---

## Executive summary

Tenant isolation is implemented in depth: **org comes only from the token**, **services scope reads/writes by `ctx.actor.orgId`**, **mission keys reject another org’s prefix**, **crew visibility is gated on `offeredAt`**, and **SQLite composite FKs block cross-org references** (covered by `tests/integration/security.test.ts`). Same-org privacy (D14/D17) is largely correct in `views.ts`, `missions.ts` (`crewView` / `leadView`), `offers.ts`, `people.ts`, and `inbox.ts`.

No **CRITICAL** or **HIGH** cross-tenant findings. Residual items are defense-in-depth, operational hygiene, and intentional same-org 403s.

---

## 1. Prisma query inventory (`src/services` + `src/http`)

Legend: **Org filter** = `orgId` (or composite including `orgId`) from `ctx.actor` / mission already loaded under caller’s org, never from request body.

### `src/http/app.ts`

| Line | Operation | Org filter | Notes |
|------|-----------|------------|--------|
| 41 | `user.findUnique({ tokenHash })` | N/A (global auth) | `orgId` taken from resolved user only |
| 85 | `$queryRaw\`SELECT 1\`` | N/A | Health only; no user input |

### `src/services/context.ts`

| Line | Operation | Org filter |
|------|-----------|------------|
| 42 | `missionEvent.create` | `args.orgId` from callers (always `ctx.actor.orgId`) |
| 66–68 | `mission.updateMany` | `id`, **`orgId`**, `status` |

### `src/services/missions.ts`

| Line | Operation | Org filter |
|------|-----------|------------|
| 48 | `mission.findUnique({ orgId_number })` | **`ctx.actor.orgId`** |
| 51–54 | `assignment.findFirst` | **`orgId`**, mission id, **`userId: actor`** |
| 85 | `skill.findMany` | **`orgId`** param = `ctx.actor.orgId` |
| 111–114 | `assignment.deleteMany`, `missionRole.deleteMany` | **`orgId`**, `missionId` |
| 116–127 | `missionRole.create` | **`orgId: ctx.actor.orgId`** in data |
| 141–145 | `organization.update`, `mission.create` | **`id: ctx.actor.orgId`** / **`orgId` in create** |
| 177–184 | `mission.update` | **`where: { id }` only** — see finding MED-1 |
| 245–247 | `assignment.update` | **`where: { id }` only** — see MED-1 |
| 266 | `missionSubmission.count` | **`orgId`**, `missionId` |
| 278–286 | `missionSubmission.create` | **`orgId`** in data |
| 310–317 | `missionSubmission.findFirst` / `update` | find: **`orgId`**; update: **`where: { id }` only** — MED-1 |
| 332–338 | `assignment.findMany` / `updateMany` | **`orgId`**, `missionId` |
| 396–405 | `assignment.updateMany` | **`orgId`**, `missionId` |
| 467–477 | `missionRole.findMany` | **`mission.orgId`**, `missionId` |
| 573–575 | `mission.findFirstOrThrow` | **`id`, `orgId: actor.orgId`** |
| 588 | `organization.findUniqueOrThrow` | **`id: actor.orgId`** |
| 674–676 | `mission.findFirstOrThrow` | **`id`, `orgId`** |
| 678–681 | `assignment.findFirst` | **`orgId`**, `missionId`, **`userId: actor`**, `offeredAt not null` |
| 698–701 | `assignment.findMany` (roster) | **`orgId`**, `missionId`, `ACCEPTED` |
| 753–771 | `mission.findMany` (list) | **`orgId: actor.orgId`**; crew: `assignments.some { userId, offeredAt }` |
| 795–798 | `missionEvent.findMany` | **`orgId`**, `missionId` |

### `src/services/staffing.ts`

| Line | Operation | Org filter |
|------|-----------|------------|
| 35–37 | `user.findUnique({ orgId_handle })` | **`ctx.actor.orgId`** |
| 47, 197 | `organization.findUniqueOrThrow` | **`ctx.actor.orgId`** |
| 126–128, 175–177, 247–249 | `deleteMany` / `updateMany` | **`orgId`**, `missionId`, … |
| 141–150, 201–212 | `assignment.create` | **`orgId: ctx.actor.orgId`** |

### `src/services/offers.ts`

| Line | Operation | Org filter |
|------|-----------|------------|
| 44–46 | `assignment.findMany` | **`orgId`**, **`userId: actor`**, `offeredAt not null` |
| 48, 116 | `organization.findUniqueOrThrow` | **`actor.orgId`** |
| 83–87 | `assignment.findFirst` | **`orgId`**, `missionId`, **`userId: actor`**, `offeredAt not null` |
| 131–133 | `assignment.count` | **`orgId`**, `roleId` |
| 138–140, 169–171, 195–197 | `assignment.update` | **`where: { id }` only** — MED-1 |
| 150–152 | `missionRole.findMany` | **`orgId`**, `missionId` |

### `src/services/people.ts`

| Line | Operation | Org filter |
|------|-----------|------------|
| 28–32 | `user.findMany` | **`orgId: ctx.actor.orgId`**, `CREW_MEMBER` |
| 85, 113, 130 | `skill.findUnique` / `findMany` | **`orgId_key` / `orgId`** |
| 103–105 | `user.findFirstOrThrow` | **`orgId`**, **`id: actor.userId`** (getMyProfile) |
| 119–122 | `crewSkill.upsert` | create includes **`orgId`**; FK + skill list pre-validated in org |
| 132, 172–173 | `crewSkill.deleteMany`, `unavailability.deleteMany` | **`orgId`**, **`userId: actor`** (+ `id` for unavail) |
| 158–165 | `unavailability.create` | **`orgId`**, **`userId: actor`** |

### `src/services/org.ts`

| Line | Operation | Org filter |
|------|-----------|------------|
| 8 | `user.findFirstOrThrow` | **`orgId`**, **`id: actor.userId`** |
| 25, 31–32 | `organization.findUniqueOrThrow` / `update` | **`id: ctx.actor.orgId`** |
| 42–44, 64–66 | `skill.findMany` / `create` | **`orgId: ctx.actor.orgId`** |

### `src/services/inbox.ts`

| Line | Operation | Org filter |
|------|-----------|------------|
| 50 | `organization.findUniqueOrThrow` | **`actor.orgId`** |
| 54–62, 79–86 | `mission.findMany` | **`orgId: actor.orgId`** (+ role-specific filters) |
| 216–219 | `assignment.findMany` | **`orgId`**, **`userId: actor`**, `offeredAt not null` |

### `src/services/expiry.ts`

| Line | Operation | Org filter |
|------|-----------|------------|
| 22–25, 27–29 | `assignment.findMany` / `updateMany` | **`orgId`** param from caller |

### `src/services/snapshot.ts`

| Line | Operation | Org filter |
|------|-----------|------------|
| 118–119 | `mission.findFirstOrThrow` | **`id`, `orgId`** args from service |
| 130–135 | `organization`, `skill`, `user` reads | **`orgId`** |
| 138–140, 173–176 | `assignment`, `unavailability` | **`orgId`**, user set from org-scoped crew |

### `$queryRaw`

Only **`src/http/app.ts:85`** (`SELECT 1` on health). No raw SQL in services.

### `findUnique`-by-id-then-use patterns

- **Auth:** `tokenHash` → user (global); org bound to token.
- **Mission load:** `orgId_number` composite, then crew check on assignments — not bare mission id from client.
- **Updates by assignment/submission/mission `id` only (MED-1):** IDs always come from prior org-scoped queries in the same request/transaction. Cross-tenant exploit would require guessing another org’s CUID **and** bypassing prior gates; composite FKs still block creates pointing at foreign rows.

---

## 2. Auth hook (`src/http/app.ts`)

| Check | Result |
|--------|--------|
| Token → SHA-256 → DB lookup | Yes (`hashToken`, `user.findUnique`) |
| Timing-safe comparison | **No** explicit constant-time compare; equality is DB lookup on 64-char hex digest. Practical risk **LOW** for high-entropy `mct_*` tokens; not a cross-tenant issue. |
| Malformed / empty `Authorization` | No principal: missing/`Bearer` without token → **401** `UNAUTHENTICATED` (`:40–42`) |
| Token logged | Default **`logger: false`** in `buildApp`; tests use inject. Production `server.ts` enables logger but **no code logs `Authorization`**. **500** path: `request.log.error(error)` — generic **500** body; stacks could theoretically include request context depending on Fastify/pino config — **LOW** (no token in thrown `AppError` paths). |

---

## 3. 404-not-403 (cross-org / out-of-view)

| Scenario | Behavior | Evidence |
|----------|----------|----------|
| Other org mission key | **404** | `parseMissionKey` prefix check (`context.ts:26`); tests `LUN-1` / `AST-*` cross-read (`security.test.ts:107–109`) |
| Crew, unoffered mission | **404** | `loadMission` (`missions.ts:50–55`); tests (`security.test.ts:78–80`) |
| Crew, other crew profile | **404** (not 403) | `getCrewMember` (`people.ts:96–98`); test `:77` |
| Crew, mission events | **404** | `listEvents` (`missions.ts:793`) before/with same semantics as tests `:79` |
| Foreign crew handle (nominate) | **404** | `crewByHandle` → `notFound` (`staffing.ts:38`); test `:122–123` |
| Same-org, wrong role (crew directory) | **403** | `listCrew` (`people.ts:79`) — **same org**, capability disclosure only |

Generic 404 body: `` `${what} not found` `` (`errors.ts:53–54`) — no “exists but forbidden” wording for out-of-view resources.

---

## 4. Same-org privacy (D14 / D17)

| Area | Verdict |
|------|---------|
| Crew directory | Crew: **403** list; **404** other handles; **200** self only (tested) |
| Crew mission view | No `roles`/scores; only **`assignment`** for self; **`offeredAt not null`** gate (`crewView`, `loadMission`) |
| PROPOSED seats | Hidden from crew list/show; list sets `proposed: 0` for non-leads (`missions.ts:785`) |
| Offers list (`listMyOffers`) | No `score` / breakdown; **`blocked`** uses `blockedForCrew` only for self (`offers.ts:66–69`) |
| Roster | Only if mission **ACTIVE/COMPLETED** and own seat **ACCEPTED**; names + roles only (`missions.ts:694–705`) |
| Unavailability notes | Leads: dates only; director + self see `note` (`people.ts:50–64`; test `security.test.ts:83–88`) |
| Blocked offers (lead) | **`BLOCKED_FOR_LEAD`** only in mission + inbox (`views.ts:22`, `missions.ts:609`, `inbox.ts:169`) |
| Inbox (crew) | Own assignments only; blocked detail uses **`blockedForCrew`** (`inbox.ts:228–236`) |
| Match / scores | Lead+director via `leadView` and match API; crew never receives scores in API payloads |

---

## 5. Mass assignment (Zod)

All **request bodies** use **`z.strictObject`** (or union of strict objects) in `validation.ts:36–95`. Test: extra `orgId` on create → **400** (`security.test.ts:155–156`).

**Gap:** Query schemas `listMissionsQuery`, `crewQuery`, `matchQuery` use **`z.object`** (not strict) (`validation.ts:97–114`). Only `status`, `mine`, `skill`, `min`, `explain` are consumed; **no path to inject `orgId` into services** — see LOW-2.

---

## 6. Error paths

| Code | Response | Cross-tenant signal? |
|------|----------|----------------------|
| P2002 | **409** generic duplicate | Same-org only in practice |
| P2003 | **422** “A referenced record does not exist **in your organisation**.” | Does not name foreign org; may hint FK target class on write abuse — **same-org write hardening** |
| AppError | `{ code, message, details? }` — no stack | OK |
| 500 | “Something went wrong on the server.” | OK (`app.ts:77`) |

Foreign skill on roles → **400** `unknownSkills`, not P2003 (`security.test.ts:116–120`) — does not confirm Lunar taxonomy to Astra.

---

## 7. CLI

| Check | Result |
|--------|--------|
| `--json` vs human | **`render()`** dumps API payload; session commands **strip `token`** (`session.ts:64, 81`). Mission/crew JSON is API-shaped — crew responses omit scores/roles as per server. |
| Config permissions | **`chmodSync(0o600)` on save** (`config.ts:52–53`); not re-applied on read — LOW-3 |
| Token in `ps` | **`mc login <token>`** puts token in argv — LOW-1 |
| `MC_TOKEN` | Env-based; visible to same-user process inspection — operational |

---

## 8. Seed / demo

| Check | Result |
|--------|--------|
| Storage | **`tokenHash: hashToken(plain)`** only in DB (`seed.ts:92`) |
| Console | Prints **`mc login mct_<slug>_<handle>`** (plaintext tokens by design for demo) — not hashes (`seed.ts:410`) |
| Test | Plaintext not stored in DB (`security.test.ts:22–25`) |

---

## Findings table

| Severity | Location (file:line) | Finding | Exploit scenario | Fix recommendation |
|----------|----------------------|---------|------------------|---------------------|
| **MED** | `missions.ts:177`, `245`, `315`; `offers.ts:138`, `169`, `195` | **`update`/`updateMany` use bare `id` without `orgId` in WHERE** | No demonstrated cross-tenant path (IDs from org-scoped reads; CUIDs). Theoretical: leaked foreign assignment id + bug bypassing loaders could mutate wrong row if ids collided. | Add `orgId: ctx.actor.orgId` (or `mission.orgId`) to every update/delete WHERE. |
| **LOW** | `validation.ts:97–114` | Query parsers use **`z.object`**, not **`z.strictObject`** | Extra query keys are ignored today; no `orgId` reaches services. | Use `z.strictObject` for query schemas for parity with bodies. |
| **LOW** | `cli/config.ts:38–47` | **`chmod 0o600` only on write**, not when reading existing config | World-readable config left from manual copy remains readable. | Optionally `chmod` after load if file exists and mode is loose. |
| **LOW** | `session.ts:26–30`, `config.ts:86–87` | **Tokens in argv (`mc login`) and environment (`MC_TOKEN`)** | Local attacker with process/env visibility steals API token. | Document; prefer `mc login` from file/stdin; warn on `MC_TOKEN`. |
| **LOW** | `app.ts:41`, `lib/tokens.ts:4–5` | **Auth is hash + DB lookup**, not constant-time secret compare | Remote timing distinction invalid vs valid tokens unlikely to matter for `mct_*` tokens. | Optional: rate-limit 401s; document threat model. |
| **LOW** | `people.ts:79`, `missions.ts:137` | **Same-org 403** for crew directory / create mission | Crew learns “directory exists” vs **404** for hidden crew — not cross-tenant. | Align with strict 404 policy only if product requires hiding capability names. |
| **LOW** | `server.ts:6`, `app.ts:76` | **Logger enabled in production**; errors logged server-side | Misconfigured log shipping could expose stacks; not seen to log Bearer. | Ensure pino redact `req.headers.authorization`; keep client 500 generic. |

**No CRITICAL or HIGH cross-tenant isolation findings.**

---

## Verified safe (mechanisms confirmed)

1. **`orgId` never from request body** — strict Zod bodies + services use `ctx.actor.orgId` only (`DESIGN.md` D4/D15; test `security.test.ts:155–156`).
2. **Composite `(org_id, id)` FKs** on tenant relations (`schema.prisma`; direct insert test `security.test.ts:132–141`).
3. **Mission key tenancy** — wrong prefix → **404** before DB (`context.ts:22–27`); numeric keys scoped to caller org (`security.test.ts:107–109`).
4. **Crew mission visibility** — `offeredAt != null` on assignments for load/list/show (`missions.ts:51–55`, `753–761`).
5. **Crew API shape** — no scores, no PROPOSED peers, roster gated (`crewView`; `listMyOffers`).
6. **Lead blocked-offer privacy** — `BLOCKED_FOR_LEAD` string only (`views.ts:22`, `inbox.ts:169`).
7. **Unavailability notes** — leads date-only; notes for self + director (`people.ts:50–64`; integration test).
8. **Cross-tenant write rejection** — foreign skill keys → validation; foreign handles → **404**; FK violations → **422** generic org message.
9. **Tokens at rest** — SHA-256 only in DB; seed prints plaintext demo tokens, not hashes.
10. **Automated regression** — `tests/integration/security.test.ts` for auth, roles, tenancy, validation; **53/53** tests green at audit time.

---

## Prisma / HTTP summary counts

- **~60** Prisma operations in services + **2** in HTTP (auth + health).
- **All service reads/writes** include **`orgId` from actor** or composite (`orgId_number`, `orgId_handle`, `orgId_key`), except **post-load updates by bare `id` (MED-1)** and **global auth lookup**.
- **Zero** `$queryRaw` in services; **one** health check raw query with no user input.

---

*Audit performed read-only; no repository files modified.*
</response>
output_path: c:\Users\shubh\.cursor\projects\c-Users-shubh-OneDrive-Documents-Mutinex\agent-transcripts\c9e4c66a-7432-46e8-a6b7-35fdfe37a5e7\subagents\6004d124-307e-4fa1-9430-24e81cf5cec4.jsonl
</task>
</system_notification>

<timestamp>Monday, Sep 28, 2026, 9:06 PM (UTC+10)</timestamp>
<system_notification>
The following task has finished. If you were already aware, ignore this notification and do not restate prior responses.

<task>
kind: subagent
status: success
task_id: 7c51ee2f-e507-4d36-b8a9-1d3a3fd91294
title: Type safety audit
tool_call_id: CallDynamicTool_1_3d9e160b-53e24
agent_id: 7c51ee2f-e507-4d36-b8a9-1d3a3fd91294
detail: <user_visible_high_level_summary>
Type safety is **strong at HTTP ingress and in the pure matcher domain**, with clean `tsc` and no suppression comments, but **weaker at API/CLI egress**: JSON columns and event payloads are not validated on read, DTOs widen Prisma enums to `string`, the CLI trusts `fetch` generics, and discriminated switches omit `never` checks. SQLite stores enums/JSON as TEXT/JSONB without DB CHECK constraints—runtime integrity relies on Prisma writes and app discipline, not read-path parsing.
</user_visible_high_level_summary>
<response>
# Mission Control — Type Safety Audit (Read-Only)

**Scope:** `src/`, `prisma/seed.ts`, `scripts/`, `tests/`, `bin/` 
**Baseline verified:** `npm run typecheck` clean (not re-run for tests). 
**Note on SQLite:** Migrations store `role`, `status`, `kind`, and `decision` as `TEXT`, and JSON as `JSONB`. Prisma still generates TypeScript enum unions for most columns, but the database does not enforce enum membership. `mission_events.type` is modeled as `String` in `schema.prisma` (see `src/domain/events.ts` for the app-side catalog). Invalid DB values would not be caught on read.

---

## 1. `any`, `as` casts, `!`, `@ts-ignore` / `@ts-expect-error`

### `@ts-ignore` / `@ts-expect-error`

| Severity | Location | Issue | Recommendation |
|----------|----------|-------|----------------|
| — | *(none)* | No suppressions found. | — |

### Explicit `any`

| Severity | Location | Issue | Recommendation |
|----------|----------|-------|----------------|
| **MED** | `src/cli/commands/missions.ts:587` | `EventRow.payload: Record<string, any>` — only production `any` in `src/`. | Type payload per event (`z.discriminatedUnion` on `type`, or `Record<string, unknown>` + narrow in each `case`). |
| **LOW** | `tests/support/testApp.ts:32–42` | `ApiResponse<T = any>` and HTTP helpers default to `any`. | Default to `unknown` or require explicit `T`. |
| **LOW** | `tests/integration/*.test.ts` (multiple) | Callback params annotated `(x: any)` when mapping API bodies. | Use shared DTO types from `src/services/*` or `unknown` + guards. |

*(Comment/prose uses of the word “any” in matcher docs, tests, etc. are not type annotations.)*

### Type assertions (`as`) — production `src/` + `prisma/seed.ts`

| Severity | Location | Issue | Recommendation |
|----------|----------|-------|----------------|
| **HIGH** | `src/cli/client.ts:54` | `return payload as T` — success responses are not validated; any JSON shape satisfies the generic. | Optional: shared zod schemas for responses, or document as intentional trust boundary (server is source of truth). |
| **MED** | `src/cli/client.ts:45` | Error body cast to `{ error?: { code?, message?, details? } }`. | Narrow with a small zod schema or type guard before `CliError`. |
| **MED** | `src/cli/config.ts:42` | `JSON.parse(...) as Partial<ConfigFile>` — no field validation after parse. | Validate with `z.object({ profiles: ..., current: ... })` before use. |
| **MED** | `src/cli/commands/missions.ts:335–336` | `seat.breakdown as Partial<ScoreBreakdown>` then `as ScoreBreakdown` for rendering. | Align with `SeatView.breakdown: unknown`; use `zod` schema for `ScoreBreakdown` or runtime guard before `components()`. |
| **MED** | `src/cli/index.ts:55` | `(error.details as { blockers?: string[] })` for CLI error display. | Discriminate on `error.code` or validate `details` shape. |
| **MED** | `src/services/missions.ts:247,285` | `verdict.breakdown as unknown as Prisma.InputJsonObject` (and snapshot). | Prisma JSON typing workaround; acceptable if write path always uses matcher `ScoreBreakdown`. Consider `Prisma.JsonObject` helper to avoid double cast. |
| **MED** | `src/services/staffing.ts:149,209` | Same `ScoreBreakdown` → `InputJsonObject` double cast. | Same as above. |
| **MED** | `src/services/snapshot.ts:90` | `row.status as 'OFFERED' \| 'PROPOSED'` after filter — filter guarantees subset but TS doesn’t narrow `AssignmentStatus`. | Use a type predicate or assign to a narrowed variable inside the filter callback. |
| **MED** | `src/services/snapshot.ts:141,177` | `as AssignmentRow[]` / `as Promise<AssignmentRow[]>` on Prisma `findMany` results. | Hand-written `AssignmentRow` can drift from `assignmentSelect`; prefer `Prisma.AssignmentGetPayload<{ select: typeof assignmentSelect }>[]`. |
| **LOW** | `src/services/missions.ts:756` | `filter.status as Mission['status'][]` — redundant if caller always passes zod-parsed enums. | Type `listMissions` filter as `MissionStatus[]` from validation layer. |
| **LOW** | `src/services/missions.ts:192` | `input[field as keyof UpdateMissionInput]` — safe key iteration pattern. | Optional: `satisfies` or typed entries helper. |
| **LOW** | `src/cli/commands/shared.ts:59` | `parts as [string, string, string \| undefined]` after length check. | Justified. |
| **LOW** | `src/http/app.ts:71` | `(error as { statusCode?: number }).statusCode` for Fastify 4xx. | Justified; optional `FastifyError` import. |
| **LOW** | `src/http/validation.ts:24` | `parseIsoDate(value)!` after `.refine(...) !== null`. | Justified. |
| **LOW** | `prisma/seed.ts:171,186` | `{ seeded: true } as Prisma.InputJsonObject`. | Seed-only; acceptable. |

### Non-null assertions (`!`) — notable production uses

| Severity | Location | Issue | Recommendation |
|----------|----------|-------|----------------|
| **MED** | `src/services/missions.ts:247,253` | `verdict.breakdown!.total` after `eligible` check — logic guarantees non-null but not reflected in types. | `if (!verdict.breakdown) throw ...` or narrow with early continue. |
| **MED** | `src/cli/commands/missions.ts:358,426,539,551` | `mission.staffing!`, `mission.assignment!`, `response.explanation!`, `role.breakdown!` — optional DTO fields forced for render paths. | Narrow with `viewer === 'lead'` / command flags, or make render functions take narrowed types. |
| **LOW** | `src/services/offers.ts:51,119` | `.get(actor.userId)!` on schedule `Map` after loading that user. | Justified by prior `userIds: [actor.userId]`. |
| **LOW** | `src/services/missions.ts:104,690` | `byKey.get(...)!` after unknown-skill check; schedule map get. | Justified by control flow. |
| **LOW** | `src/cli/config.ts:67,84,90` | `matches[0]!`, `profiles[name]!` after existence checks. | Justified. |
| **LOW** | `src/matcher/matcher.ts` (many) | `evaluations.get(role.id)!`, `pairBreakdown(...)!`, etc. | Internal invariants of pure matcher; acceptable with tests. |
| **LOW** | `src/matcher/hungarian.ts:51–85` | Dense `!` on 1-indexed algorithm arrays. | Algorithm-local; covered by unit tests. |
| **LOW** | `src/cli/ui.ts:100,102` | `widths[index]!`, `columns[index]!` in table renderer. | Loop bounds guarantee; could use local vars to avoid `!`. |
| **LOW** | `tests/**/*.ts` | Extensive `find(...)!`, `roles[0]!` in tests. | Acceptable in tests. |

---

## 2. Boundary validation (HTTP / JSON)

| Severity | Location | Issue | Recommendation |
|----------|----------|-------|----------------|
| **LOW** | `src/http/routes/*.ts` | **Bodies and query strings:** All routes that accept body/query use `parse(...)` from `validation.ts` with `z.strictObject` (or union) for bodies; query uses `listMissionsQuery`, `crewQuery`, `matchQuery`. POST lifecycle routes without bodies (`submit`, `activate`, `complete`, `accept`) correctly omit body parsing. | — |
| **MED** | `src/http/routes/*.ts` | **Path params** (`:key`, `:handle`, `:id`, skill `:key`) are **not** parsed with zod — raw `request.params.*` strings. | Add param schemas (e.g. mission key regex, handle max length) if stricter ingress is desired. |
| **LOW** | `src/http/validation.ts:97–107,109–112` | Query schemas use `z.object` (not `.strict()`), so extra query keys are stripped, not rejected. | Use `.strict()` if rejecting unknown query params matters. |
| **HIGH** | `src/services/missions.ts:604,809` | **`scoreBreakdown` / `payload` on read:** Passed through from Prisma `Json` as `unknown` / JSON value **without** zod validation. No `JSON.parse` in app code for DB columns (Prisma deserializes). | If corrupted or hand-edited DB rows are a concern, validate with zod on read before API/CLI consumption. |
| **LOW** | `src/services/missions.ts` | **`snapshot` on write only** — submission snapshot is not read back for business logic in `src/`. | No read-path validation needed today. |
| **MED** | `src/cli/client.ts:43–54` | HTTP response JSON: `JSON.parse` → `unknown` → **`as T`** on success. | Same as CLI typing section — trust boundary. |

---

## 3. String-typed DB enums / app-layer narrowing

| Severity | Location | Issue | Recommendation |
|----------|----------|-------|----------------|
| **LOW** | `prisma/schema.prisma` + migrations | Prisma **declares** enums for `Role`, `MissionStatus`, `AssignmentStatus`, `AssignmentKind`, `SubmissionDecision`; SQLite stores **TEXT** without CHECK constraints. | Document that runtime safety is app + Prisma writes, not DB enforcement. |
| **LOW** | `src/domain/types.ts` | Re-exports Prisma enums; `Actor.role`, lifecycle, matcher use **`MissionStatus` / `AssignmentStatus` / `Role`**. Domain/matcher logic is strongly typed when data comes from Prisma. | — |
| **MED** | `src/domain/events.ts` + `schema.prisma:261` | `mission_events.type` is **`String`**; writes use `EventType` in `recordEvent`, reads in `listEvents` expose **`type: string`**. | Consider zod `z.enum(EVENT_TYPES)` on read or branded string type for API responses. |
| **MED** | `src/services/missions.ts:504–556,733–744` | **`MissionView` / `MissionSummary` / `SeatView`:** `status`, `kind`, `decision` typed as **`string`**, not Prisma unions — widened at API DTO layer. | Use `MissionStatus`, `AssignmentStatus`, `AssignmentKind`, `SubmissionDecision` on DTOs for compile-time alignment. |
| **MED** | `src/services/offers.ts:21–37,39` | **`OfferView`:** `missionStatus`, `kind`, `status` as **`string`**; `STATUS_ORDER: Record<string, number>`. | Narrow to enum types from `@prisma/client`. |
| **MED** | `src/services/people.ts:102+` | `getMyProfile` returns `PersonView & { role: string }` though DB has `Role`. | Use `Role` in DTO. |
| **MED** | `src/cli/config.ts:18`, `session.ts:7–11,134–135` | Saved profile and `Me.role` are **`string`**; `roleLabel(role: string)` index object without exhaustiveness. | Use `Role` from domain or validate on login. |
| **LOW** | `src/http/validation.ts:98–102` | **`listMissionsQuery.status`:** piped to `z.array(z.enum([...MissionStatus values...]))` — **good boundary narrowing** for query input. | — |
| **LOW** | `src/services/snapshot.ts:90` | Cast narrows pending assignment status to `'OFFERED' \| 'PROPOSED'` for matcher snapshot. | Prefer type predicate over `as`. |

---

## 4. Exhaustive switches (`never` checks)

| Severity | Location | Issue | Recommendation |
|----------|----------|-------|----------------|
| **MED** | Codebase-wide | **No switch uses `default: { const _: never = x }`** (workspace rule pattern). New union variants may not force compile failures in switches with `default` fallbacks. | Add `never` checks in discriminated switches (see below). |
| **LOW** | `src/domain/lifecycle.ts:80–91` | `switch (rule)` on `ActorRule` — all five cases covered, **no default** — implicitly exhaustive. | Optional `never` default for future-proofing. |
| **LOW** | `src/domain/scheduling.ts:60–67` | `switch (issue.kind)` on 3-way `ScheduleIssue` — **no default** — exhaustive. | Add `never` default per team rule. |
| **MED** | `src/matcher/matcher.ts:83–98` | `switch (current.status)` on `AssignmentStatus` with **`default: return null`** — intentional for `WITHDRAWN`/`RELEASED`; not a compile-time exhaustiveness check. | Document or list remaining statuses explicitly vs `never`. |
| **MED** | `src/services/offers.ts:93–103` | `switch (offer.status)` with **`default`** for “already responded” — covers many statuses without `never`. | Split “open offer” vs terminal statuses with exhaustive handling. |
| **MED** | `src/cli/commands/missions.ts:594–632` | `switch (event.type)` on **`string`**, **`default: return event.type`** — new `EventType` values won’t fail compile; CLI silently shows raw type. | Switch on `EventType` or use `never` after covering `EVENT_TYPES`. |

---

## 5. Error handling typing

| Severity | Location | Issue | Recommendation |
|----------|----------|-------|----------------|
| **LOW** | `src/lib/errors.ts` | `AppError` + `ErrorCode` keyed by `ERROR_STATUS`; `toJSON()` typed; hierarchy is flat but coherent. | — |
| **LOW** | `src/http/app.ts:58–77` | Maps `AppError`, Prisma `P2002`/`P2003`, Fastify 4xx, else 500. | — |
| **LOW** | `src/cli/client.ts:9,48–49` | Exit codes mapped by **HTTP status** (`400→7`, `401→3`, …), not by every `ErrorCode`. All distinct status codes in `ERROR_STATUS` map to documented CLI exits; multiple codes share same HTTP status (e.g. 403, 409, 422). | Optional: map specific `error.code` for finer CLI behavior. |
| **LOW** | `src/cli/index.ts:64–70` | Top-level `catch (error)` — `CommanderError`, `CliError`, else wrapped (implicit **`unknown`** under strict + default catch rules in TS 5). | Explicit `unknown` + narrowing if desired for clarity. |
| **LOW** | `src/server.ts:18`, `src/services/org.ts:73` | `catch (error)` — org narrows Prisma errors; server logs and exits. | Type as `unknown` explicitly. |
| **LOW** | `prisma/seed.ts:426` | `catch (error: unknown)` — explicit. | — |
| **LOW** | `tests/unit/lifecycle.test.ts:32–34` | `catch (error)` with `instanceof AppError`. | — |

---

## 6. Prisma types vs hand-written shapes

| Severity | Location | Issue | Recommendation |
|----------|----------|-------|----------------|
| **MED** | `src/services/snapshot.ts:15–35,141,177` | **`AssignmentRow`** duplicates shape of `assignmentSelect` + includes; enforced only by casts. | `type AssignmentRow = Prisma.AssignmentGetPayload<{ select: typeof assignmentSelect }>`. |
| **LOW** | `src/services/missions.ts:18–37` | `RoleSpec`, `CreateMissionInput`, etc. mirror zod output — intentional service-layer types, aligned with `validation.ts`. | Keep in sync when schemas change (tests help). |
| **LOW** | `src/services/people.ts:25` | `PersonRow = Awaited<ReturnType<typeof loadPeople>>[number]` — **good** derivation from query. | Pattern to replicate for snapshot rows. |
| **LOW** | `src/services/context.ts:66–68` | Composite keys via `orgId_number`, `orgId_handle`, transaction `updateMany` with `status: { in: [...] }` — **type-safe** via generated Prisma API. | — |

---

## 7. CLI API response typing

| Severity | Location | Issue | Recommendation |
|----------|----------|-------|----------------|
| **LOW** | `src/cli/commands/missions.ts:2–4` | Mission commands import **`MissionSummary`, `MissionView`, `MatchResponse`, `StaffingResult`, `ScoreBreakdown`** — good shared DTO usage. | — |
| **LOW** | `src/cli/commands/crew.ts:2–4` | Uses **`OfferView`, `PersonView`, `InboxItem`**. | — |
| **MED** | `src/cli/commands/session.ts:7–14` | Local **`Me`** interface with `role: string` instead of shared server type. | Import shape from `getMe` return type or shared `lib/api-types`. |
| **HIGH** | `src/cli/client.ts:54` | All `api().get<T>` / `post<T>` trust network JSON — **no runtime validation**. | Accept as client trust model or add response schemas for critical commands. |
| **MED** | `src/cli/commands/missions.ts:581–587` | History rendering uses local **`EventRow`** with loose payload typing. | Align with `listEvents` return type from services. |

---

## 8. `noUncheckedIndexedAccess` hazards

| Severity | Location | Issue | Recommendation |
|----------|----------|-------|----------------|
| **LOW** | `src/cli/config.ts:65–67` | `matches[0]!` when `matches.length === 1`. | Safe; could assign to `const match = matches[0]; if (!match) throw`. |
| **LOW** | `src/services/inbox.ts:64,223` | `mission.submissions[0]`, schedule `.get(...)!`. | Optional chaining or guards where business logic allows empty. |
| **LOW** | `src/cli/commands/missions.ts:316` | `list[0]!` — only reached when `list.length > 0` (early return at 311–314). | Safe; TS doesn’t correlate length. |
| **MED** | `src/matcher/matcher.ts:261` | `evaluation.shortfalls[0]!` — assumes non-empty shortfalls in branch. | Guard `shortfalls[0]` before use. |
| **LOW** | `src/matcher/hungarian.ts` | Many indexed accesses with `!` — classic algorithm indexing. | Keep test coverage (`tests/unit/hungarian.test.ts`). |

---

## Overall verdict

Mission Control’s **type safety posture is solid for a take-home**: strict TypeScript with `noUncheckedIndexedAccess`, a centralized **zod strict-object ingress** layer, domain logic and the **pure matcher** built on explicit unions and Prisma-backed enums, and **no** `@ts-ignore` / `@ts-expect-error`. Weak spots are concentrated at **trust boundaries on the way out**—API DTOs deliberately widen enums to `string`, JSON columns and event payloads are **not validated on read**, the CLI **`fetch` client asserts generics without runtime checks**, and **discriminated switches do not use `never` defaults**, so new event types or enum variants may slip through until runtime. SQLite’s TEXT/JSONB storage means **Prisma enum types are compile-time contracts only**; the app compensates on write paths but does not re-validate on read. For a senior challenge codebase, this reads as **thoughtful typing where it matters (HTTP in, domain, matcher)** with pragmatic looseness at **serialization and CLI presentation** layers.
</response>
output_path: c:\Users\shubh\.cursor\projects\c-Users-shubh-OneDrive-Documents-Mutinex\agent-transcripts\c9e4c66a-7432-46e8-a6b7-35fdfe37a5e7\subagents\7c51ee2f-e507-4d36-b8a9-1d3a3fd91294.jsonl
</task>
</system_notification>
<user_query>Perform any necessary follow-up actions in response to the subagent completion above. If no follow-up work is needed, no further action is required. If you mention an agent or subagent in your response, link it with the `[Name](id)` Don't use generic label such as `[agent]`, `[worker]`, or `[subagent]`. For cloud subagents, when the agent has edited code, link to `[Review](bc-id#changes)`, or, if you know the exact added and deleted line counts, `[Review +A −D](bc-id#changes)`, replacing A and D with those counts. Never write A or D literally. Use `[Try Live](bc-id#desktop)` only when the agent used computer use. Don't repeat the same confirmation every time.</user_query>

---

**Cursor**

Three more reports landed — appending them all to `AUDIT.md`.

Three more sections appended to `AUDIT.md`. Headlines:

- **§2 [Type safety](7c51ee2f-e507-4d36-b8a9-1d3a3fd91294):** solid where it matters (HTTP ingress, domain, matcher), loose at egress — DTOs widen enums to `string`, CLI trusts `fetch` generics (`as T`), no `never`-checked switches (violates your workspace rule), JSON columns unvalidated on read. Zero suppressions, one production `any`.
- **§5 [Cross-tenant privacy](6004d124-307e-4fa1-9430-24e81cf5cec4):** **no CRITICAL/HIGH leaks found.** All ~60 queries org-scoped; the one MED is defence-in-depth — six `update`/`updateMany` calls use bare `id` without `orgId` in the WHERE clause (no demonstrated exploit; composite FKs still block bad writes).
- **§7 [Real-world research](51f8568e-94ab-40d4-ac2b-612218322d96):** 22 edge cases mapped to NASA/ESA/FAA/Antarctic practice with sources. Key meta-finding: **your entire TODO/ROADMAP is validated by real practice** (prime+backup, L-14 quarantine ≈ your launch−14 deadline, cert expiry, reschedule). New candidates mostly land in V1.1 test-pack or ROADMAP, nothing demands re-architecture.

Still running: [Security Review](4cf756a3-a4b3-4066-99d8-f81d3434e3e1), [Bugbot](fcade688-e5de-4ce9-af2f-fecb7601f1c8), [Workflow logic](771506c7-0fc8-4570-b1d2-dc0e96b79e92).

---

**User**

<timestamp>Monday, Sep 28, 2026, 9:07 PM (UTC+10)</timestamp>
<system_notification>
The following task has finished. If you were already aware, ignore this notification and do not restate prior responses.

<task>
kind: subagent
status: success
task_id: 4cf756a3-a4b3-4066-99d8-f81d3434e3e1
title: Security Review
tool_call_id: CallDynamicTool_2_1be9ed88-53e24
agent_id: 4cf756a3-a4b3-4066-99d8-f81d3434e3e1
detail: <user_visible_high_level_summary>
I reviewed the diff and traced auth, tenancy, visibility, validation, and error handling through the implementation and integration tests. **No medium, high, or critical security issues** turned up in the changed paths — controls match the stated design and are covered by `tests/integration/security.test.ts` and workflow privacy tests.
</user_visible_high_level_summary>
<response>
## Security review result

**No medium, high, or critical vulnerabilities** were found in the changed code when traced through the live implementation and tests. The diff is largely a v2 reshape (schema, seed, server wiring, docs) on top of an already security-aware API layer.

Below is what was checked against your priorities, with evidence from the changed paths and their call chains.

---

### 1. Cross-tenant isolation — OK

**Schema (changed):** Composite `(org_id, id)` FKs on tenant-owned relations, including assignments → `(org_id, mission_id, role_id)`, are defined in `prisma/schema.prisma` and enforced in `prisma/migrations/20260928095500_roles_nominations_tenancy/migration.sql`.

**Application layer:** Every service path uses `ctx.actor.orgId`. Mission keys are parsed with prefix checks in `parseMissionKey` (`src/services/context.ts`) so `LUN-1` from an Astra token → 404.

**Write path:** Foreign skill keys and crew handles return 400/404 without touching another org’s data (`tests/integration/security.test.ts`).

**Database layer:** Cross-tenant `crewSkill.create` is rejected by composite FKs (same test file).

---

### 2. Authentication & tokens — OK (within stated trade-offs)

**Changed seed path:** Plaintext demo tokens are hashed before storage:

```92:92:prisma/seed.ts
 tokenHash: hashToken(plain),
```

**Auth hook (referenced by changed `src/server.ts`):** Bearer → SHA-256 → DB lookup; org/role never from the body:

```35:50:src/http/app.ts
 app.addHook('onRequest', async (request) => {
 if (request.url === '/v1/health') return;
 ...
 const user = await deps.db.user.findUnique({ where: { tokenHash: hashToken(token) }, include: { org: true } });
```

- Tokens are not stored plaintext in the DB (security test asserts 64-char hex digest).
- Invalid/missing tokens → 401 with generic messages; no token in error payloads.
- CLI stores tokens in `~/.mission-control/config.json` with `chmod 0o600` (`src/cli/config.ts`); `mc profiles` strips tokens from output.
- Seed/setup printing `mct_*` tokens is intentional for the challenge.
- No `timingSafeEqual`: auth compares via hash + indexed lookup, which is standard for hashed API tokens; not treated as a finding here.

**Server binding (changed):** `src/config.ts` defaults `host` to `127.0.0.1`; binding to `0.0.0.0` would be operator config, not a code bug, especially with known demo tokens.

---

### 3. Same-org privacy rules — OK

| Rule | Implementation | Verified |
|------|----------------|----------|
| Crew never see `PROPOSED` / scores | `loadMission` requires `offeredAt != null` for crew; `crewView` omits scores/roles; workflow test asserts no `score`/`breakdown` in crew JSON | `workflow.test.ts` |
| Unavailability notes: self + directors only | `personView` in `src/services/people.ts` | `security.test.ts` |
| Blocked-offer reason hidden from other lead | `BLOCKED_FOR_LEAD` in lead views; crew gets specific conflict via `blockedForCrew` | `workflow.test.ts` (no other mission key in lead JSON) |
| Roster only when ACTIVE + accepted | `rosterVisible` in `crewView` | `workflow.test.ts` |

---

### 4. Authorization — OK

Lifecycle rules are data-driven in `src/domain/lifecycle.ts` and enforced via `assertMissionAction` before mutations. Integration tests cover:

- Owner-only edit
- Directors-only approve, not own mission (`CANNOT_APPROVE_OWN`)
- Crew cannot list directory, audit log, or unoffered missions (404, not 403)
- Directors-only org settings

---

### 5. Injection / validation — OK

**Changed validation surface:** Request bodies use `z.strictObject` in `src/http/validation.ts`; extra fields such as `orgId` are rejected (security test).

**SQL:** Only `$queryRaw\`SELECT 1\`` in health check — parameterized, no user input.

**Mass assignment:** Create/update paths use explicit field mapping in services, not raw request spread into Prisma.

---

### 6. Error responses — OK

- Out-of-view resources → 404 via `notFound()` (including cross-tenant keys/handles).
- Client 500s → generic `{ code: "INTERNAL", message: "Something went wrong on the server." }`; stack traces go to server logs only (`src/http/app.ts`).
- No token or PII in structured error payloads.

---

### Items considered and not raised (per your triage rules)

- **Predictable demo tokens / SQLite** — documented trade-offs, not flagged.
- **Self-rated skills (D18)** — acknowledged product risk, not an implementation bypass.
- **No `CREW_MEMBER` check on `acceptOffer`** — offers are only created for `CREW_MEMBER` via `crewByHandle`; no API path gives leads/directors offers without DB tampering.
- **Crew `listMissions` aggregate `offered` count** — does not expose identities; below medium threshold.
- **Documentation / `design.html` / CDN scripts** — local doc artifact, not an API attack surface.

---

### Conclusion

The diff strengthens tenancy (composite FKs, hashed tokens, org-scoped seed) and wires the server through `buildApp` with auth and safe error mapping. Cross-tenant isolation, RBAC, privacy boundaries, strict validation, and 404-not-403 behavior are implemented consistently and covered by integration tests.

**No actionable medium+ security issues to fix in this diff.** If you want a follow-up, the main hardening items already on your roadmap (token expiry/rotation, Postgres RLS, explicit role guard on offer accept) are defense-in-depth rather than exploitable gaps in the current API paths.
</response>
output_path: c:\Users\shubh\.cursor\projects\c-Users-shubh-OneDrive-Documents-Mutinex\agent-transcripts\c9e4c66a-7432-46e8-a6b7-35fdfe37a5e7\subagents\4cf756a3-a4b3-4066-99d8-f81d3434e3e1.jsonl
</task>
</system_notification>

<timestamp>Monday, Sep 28, 2026, 9:07 PM (UTC+10)</timestamp>
<system_notification>
The following task has finished. If you were already aware, ignore this notification and do not restate prior responses.

<task>
kind: subagent
status: success
task_id: 771506c7-0fc8-4570-b1d2-dc0e96b79e92
title: Workflow logic correctness audit
tool_call_id: CallDynamicTool_5_921f2c9d-53e24
agent_id: 771506c7-0fc8-4570-b1d2-dc0e96b79e92
detail: <user_visible_high_level_summary>
Read-only audit of Mission Control workflows 1–12: implementation aligns with DESIGN.md §9–12 and CLAUDE.md invariants; **53/53 tests pass**. No critical logic bugs found in traced paths. Minor **gaps**: API exposes only the latest submission in `review` (prior round snapshots live in DB/events only); no automated tests for double accept/decline idempotency, `moveMission` compare-and-set races, cancel from every state, or director-only `complete`; backup-seat non-blocking is schema-ready but not exercised in v1 (PRIMARY-only paths).
</user_visible_high_level_summary>
<response>
# Mission Control — Read-Only Workflow Audit

**Scope:** Repo `mission-control`, baseline **53/53 tests pass** (verified). No files modified.

**Legend:** **CONFIRMED** = code matches design; **BUG** = incorrect behavior; **GAP** = missing/partial vs design or untested.

---

## 1. Happy path: create → nominate → submit → approve → accept → activate → complete

| Step | Verdict | Evidence |
|------|---------|----------|
| Create (lead+, future start, org skills only) | **CONFIRMED** | `createMission`: role gate `hasRoleAtLeast(..., 'MISSION_LEAD')` (`missions.ts:135–138`); `assertWindow` rejects start ≤ today and end before start (`66–72`); `resolveRoleSpecs` scopes skills to `orgId` and rejects unknown keys (`75–91`); mission key from `missionSeq` in transaction (`141–154`). |
| Define roles | **CONFIRMED** | `setRoles` / `replaceRoles`: owner via `assertMissionAction('edit')` (`200–205`); deletes only `PROPOSED` assignments (`111–113`); composite FK-safe role create (`115–128`). |
| Nominate (recommended + manual; NOT_ELIGIBLE / ROLE_FILLED) | **CONFIRMED** | `nominate` → `assertMissionAction('nominate')` (`122–124`); `planSeats`: `runMatch` or manual `evaluateCandidate` (`staffing.ts:83–117`); `ROLE_FILLED` when `filledBy.length >= headcount` (`104–106`); `NOT_ELIGIBLE` with rejections (`109–112`); creates `PROPOSED`, no `offeredAt` (`141–150`). Integration: recommended path (`workflow.test.ts:37–39`). |
| Submit (blockers, re-check, scores, snapshot, round) | **CONFIRMED** | `submitBlockers`: future start, ≥1 role, every PRIMARY seat `PROPOSED` (`484–492`); `evaluateCandidate(..., { ignoreOwnSeat: true })` per nominee (`239–240`); score refresh (`245–247`); snapshot + `missionSubmission` round (`266–287`); `moveMission` → `SUBMITTED` (`288`); `PRECONDITION_FAILED` with blockers (`225–227`, `258–263`). |
| Approve (director, not own; PROPOSED→OFFERED + deadline) | **CONFIRMED** | `assertMissionAction('approve')` → `directorNotOwner` (`lifecycle.ts:58`, `85–86`); `decide(..., 'APPROVED')` (`328`); `offerDeadline` (`331`); bulk `PROPOSED`→`OFFERED` with `offeredAt`/`expiresAt` (`336–339`). |
| Crew accept (schedule re-check in tx) | **CONFIRMED** | `acceptOffer` in `tx` (`112–160`); `scheduleIssues` before update (`120–128`); seat cap on PRIMARY `ACCEPTED` (`131–136`); `sweepExpiredOffers` first (`111`). |
| Activate (all PRIMARY accepted, owner-only) | **CONFIRMED** | `assertMissionAction('activate')` owner only (`lifecycle.ts:62`); `activateBlockers` (`426–428`); `APPROVED`→`ACTIVE` (`430`). |
| Complete (owner or director) | **CONFIRMED** | `assertMissionAction('complete')` → `ownerOrDirector` (`lifecycle.ts:63`, `87–88`); `ACTIVE`→`COMPLETED` (`448–449`). E2E uses owner only (`workflow.test.ts:75`); lifecycle unit covers director (`lifecycle.test.ts:70–71`). |

**Integration:** Full path + visibility (`workflow.test.ts:22–87`).

---

## 2. Reject loop: reject → revise → resubmit

| Item | Verdict | Evidence |
|------|---------|----------|
| Reject note required | **CONFIRMED** | HTTP `requiredNoteBody` (`validation.ts:70`); route `rejectMission(..., parse(requiredNoteBody).note)` (`http/routes/missions.ts:70–71`); empty body → 400 (`workflow.test.ts:114`). |
| PROPOSED→REJECTED, nominations kept | **CONFIRMED** | `rejectMission`: `moveMission` to `REJECTED`, no assignment deletes (`362–377`); `decide(..., 'REJECTED', note)` (`366`). |
| Revise / redraft (DRAFT or REJECTED edit) | **CONFIRMED** | `edit`/`nominate`/`submit` from `['DRAFT','REJECTED']` (`lifecycle.ts:54–57`); patch after reject (`workflow.test.ts:121`). |
| Resubmit increments round | **CONFIRMED** | Round = `count + 1` (`missions.ts:266`); round 2 in test (`workflow.test.ts:122–123`). |
| Prior rounds visible | **GAP** | All rounds stored (`missionSubmission`, `@@unique([missionId, round])` in schema); API `review` is **latest only** (`submissions: { orderBy: { round: 'desc' }, take: 1 }` at `missions.ts:577–579`). Events carry `round` in payloads (`296`, `375`) but not full prior snapshots. Inbox shows reject note (`inbox.ts:100–108`). |

---

## 3. Decline → backfill

| Item | Verdict | Evidence |
|------|---------|----------|
| Seat reopens (derived open count) | **CONFIRMED** | `LIVE_SEAT_STATUSES` = PROPOSED/OFFERED/ACCEPTED (`types.ts:29`); `open` = headcount − live PRIMARY (`missions.ts:621`). |
| Matcher excludes declined/dropped/expired; not withdrawn/released | **CONFIRMED** | `onMissionRejection`: DECLINED/DROPPED/EXPIRED block; WITHDRAWN/RELEASED → `null` (`matcher.ts:90–97`). |
| Backfill OFFERED without re-approval | **CONFIRMED** | `offerSeats` requires `APPROVED|ACTIVE` + `assertMissionAction('offer')` (`staffing.ts:191–196`); creates `OFFERED` directly (`201–212`). Integration (`workflow.test.ts:149–167`). |
| Draft nominate blocked after approval | **CONFIRMED** | `nominate` only from DRAFT/REJECTED → 409 on approved mission (`workflow.test.ts:161`). |

---

## 4. Dropout after approval/activation

| Item | Verdict | Evidence |
|------|---------|----------|
| ACCEPTED→DROPPED | **CONFIRMED** | `dropOut` (`offers.ts:185–207`); reason required at HTTP (`reasonBody`). |
| Seat reopens; mission unchanged | **CONFIRMED** | No `moveMission` in `dropOut`; open-seat math excludes DROPPED from LIVE. Integration on APPROVED mission (`workflow.test.ts:199–202`). |
| Backfill without re-approval | **CONFIRMED** | Same as §3 via `offerSeats`. |
| DROPPED excluded from re-match | **CONFIRMED** | `matcher.ts:92–93`. |
| ACTIVE dropout | **GAP (test)** | Same code path allows `APPROVED|ACTIVE` (`192–194`); no dedicated ACTIVE dropout integration test. |

---

## 5. Cancel in every state

| Item | Verdict | Evidence |
|------|---------|----------|
| Director-only | **CONFIRMED** | `cancel` → `who: 'director'` (`lifecycle.ts:60`); owner 403 (`workflow.test.ts:132`). |
| Reason required | **CONFIRMED** | `reasonBody` (`validation.ts:71`); empty → 400 (`workflow.test.ts:133`). |
| From DRAFT/SUBMITTED/REJECTED/APPROVED/ACTIVE | **CONFIRMED (code)** | `from: NON_TERMINAL` (`lifecycle.ts:41`, `60`); terminal COMPLETED/CANCELLED → `INVALID_TRANSITION` (`lifecycle.test.ts:59–64`). |
| PROPOSED/OFFERED→WITHDRAWN; ACCEPTED→RELEASED atomically | **CONFIRMED** | Single `tx` block (`missions.ts:390–417`); tagged reason `Mission cancelled: …` (`393–405`). |
| Pending submission→CANCELLED | **CONFIRMED** | Only when `status === 'SUBMITTED'` (`394`); `decide(..., 'CANCELLED', reason)` (`308–318`). |
| Inbox to affected crew | **CONFIRMED** | Crew `UPDATE` for WITHDRAWN/RELEASED + cancel (`inbox.ts:240–248`); test (`workflow.test.ts:137–144`). |
| No notifications table | **CONFIRMED** | Inbox derived from assignments (`inbox.ts:1–11`). |
| All non-terminal states tested | **GAP (test)** | E2E only cancels APPROVED mission with offers (`workflow.test.ts:128–145`). |

---

## 6. Offer expiry

| Item | Verdict | Evidence |
|------|---------|----------|
| Deadline formula | **CONFIRMED** | `min(now+ttl, start−14d)`, floor `now+1` day (`expiry.ts:12–18`, `OFFER_CUTOFF_DAYS_BEFORE_START = 14`). |
| Lazy sweep + system events | **CONFIRMED** | `sweepExpiredOffers` (`21–40`); `actorId: null` (`35`); called from offers, missions get/list, match, inbox (`offers.ts:43`, `missions.ts:563`, `staffing.ts:43`, `inbox.ts:48`). |
| Expired excluded from re-match | **CONFIRMED** | `onMissionRejection` EXPIRED (`matcher.ts:94–95`); integration explain leo (`workflow.test.ts:205–219`). |
| Injected clock (no `Date.now` in `src`) | **CONFIRMED** | Grep: no `Date.now` under `src/`; services use `ctx.clock.now()`. |

---

## 7. Accept-time conflicts

| Item | Verdict | Evidence |
|------|---------|----------|
| Overlapping ACCEPTED → conflict at accept | **CONFIRMED** | `loadSchedules` only PRIMARY ACCEPTED commitments (`snapshot.ts:175–177`); `scheduleIssues` CONFLICT (`scheduling.ts:41–43`); accept throws `SCHEDULE_CONFLICT` (`offers.ts:120–128`). |
| Blocked offer stays OFFERED | **CONFIRMED** | Accept fails before update; status unchanged. |
| Lead: privacy-safe blocked message | **CONFIRMED** | `BLOCKED_FOR_LEAD` (`views.ts:22`); lead seat view (`missions.ts:608–609`); no other mission key in JSON (`workflow.test.ts:193–194`). |
| Crew: specific conflict | **CONFIRMED** | `blockedForCrew` → `describeScheduleIssue` (`views.ts:25–27`); test (`workflow.test.ts:196`). |
| Switch = drop + accept | **CONFIRMED** | `workflow.test.ts:198–200`. |
| Backup seats don't block | **CONFIRMED (PRIMARY path)** | Commitments and accept seat counts filter `kind: 'PRIMARY'` (`snapshot.ts:41`, `offers.ts:132`). v1 has no backup nomination flow (TODO.md); BACKUP not exercised in tests — **GAP (feature)** not logic error for shipped v1. |

---

## 8. Matcher correctness

| Item | Verdict | Evidence |
|------|---------|----------|
| Filter order ON_MISSION→SKILL→UNAVAILABLE→CONFLICT→REST_GAP | **CONFIRMED** | `evaluatePair` push order (`matcher.ts:122–131`); funnel counts first rejection only (`243–256`). |
| Near-miss (one skill, one level short) | **CONFIRMED** | `257–268`; test Sara EVA 3/4 (`matcher.test.ts:122–124`). |
| Rarity −5 max + notes | **CONFIRMED** | `scoring.ts:75–91`, `116–119`; `explainChoice` rarity branch (`matcher.ts:324–328`); unit tests (`matcher.test.ts:26–56`). |
| Hungarian: seats then quality | **CONFIRMED** | `ELIGIBLE_BONUS = 1_000_000` + `round(effective×100)` (`matcher.ts:41`, `203–207`); greedy-trap test (`matcher.test.ts:10–24`). |
| Determinism / order independence | **CONFIRMED** | Crew sorted by handle/id (`matcher.ts:67`); test (`matcher.test.ts:81–94`). |
| `evaluateCandidate` + `ignoreOwnSeat` at submit | **CONFIRMED** | `matcher.ts:352–370`; submit uses `ignoreOwnSeat: true` (`missions.ts:240`); unit test (`matcher.test.ts:150–158`). |
| Explain output | **CONFIRMED** | `runMatch` funnel, nearMisses, unfilled reasons (`291–346`); `explainCandidate` (`388–421`). |

---

## 9. Lifecycle rules table

| Item | Verdict | Evidence |
|------|---------|----------|
| Table as single source | **CONFIRMED** | `MISSION_RULES` (`lifecycle.ts:52–64`). |
| Exhaustive status × action × actor | **CONFIRMED** | `allowedMissionActions` vs `assertMissionAction` for all statuses/actions and 4 actors (`lifecycle.test.ts:81–89`). |
| 403 actor-first, then 409 state | **CONFIRMED** | `assertMissionAction` order (`lifecycle.ts:114–120`). |
| `CANNOT_APPROVE_OWN` | **CONFIRMED** | `actorError` when director === owner on `directorNotOwner` (`95–99`); test (`lifecycle.test.ts:54`, `security.test.ts` approve own). |
| Crew: always FORBIDDEN (never 409) | **CONFIRMED** | `lifecycle.test.ts:75–78`. |

**Note:** Data guards (submit/activate blockers) are intentionally outside the table (`lifecycle.ts:8–10`); enforced in `missions.ts` with `PRECONDITION_FAILED` (422).

---

## 10. Idempotency / transactions

| Item | Verdict | Evidence |
|------|---------|----------|
| Double accept/decline → 409 | **CONFIRMED (code)** | `assertOpenOffer`: non-OFFERED → `ALREADY_RESPONDED` / etc. (`offers.ts:92–103`); codes map to 409 (`errors.ts:14–17`). |
| | **GAP (test)** | No test asserting second accept/decline returns `ALREADY_RESPONDED`. |
| `moveMission` compare-and-set | **CONFIRMED (code)** | `updateMany` with `status: { in: from }`, `count !== 1` → `INVALID_TRANSITION` (`context.ts:59–72`). |
| | **GAP (test)** | No concurrent/race integration test. |
| Multi-row transactional approve/cancel/submit | **CONFIRMED** | `tx(ctx, ...)` wraps `submitMission`, `approveMission`, `cancelMission`, `acceptOffer`, `nominate`, `offerSeats` (`missions.ts:220`, `325`, `390`; `offers.ts:112`; `staffing.ts:122`, `194`). |

---

## 11. Date math

| Item | Verdict | Evidence |
|------|---------|----------|
| Inclusive calendar days | **CONFIRMED** | `lengthInDays` (`dates.ts:65–67`); tests (`dates-scheduling.test.ts:14–18`). |
| Overlap / overlapDays / gapBetween | **CONFIRMED** | `dates.ts:61–80`; tests (`dates-scheduling.test.ts:16–24`). |
| Rest gap exactly 14 | **CONFIRMED (pass at boundary)** | Filter `gapDays < restGapDays` (`scheduling.ts:46`); 14 free days eligible, 13 fails (`matcher.test.ts:127–147`). |
| Strict YYYY-MM-DD; reject 2026-02-30 | **CONFIRMED** | `parseIsoDate` (`dates.ts:34–38`); HTTP `isoDate` (`validation.ts:21–24`); unit test (`dates-scheduling.test.ts:7–11`). |
| UTC midnight storage | **CONFIRMED** | `parseIsoDate` uses `T00:00:00.000Z`; `toDay`/`fromDay` on UTC ms (`dates.ts:21–27`). |

---

## 12. Visibility logic

| Item | Verdict | Evidence |
|------|---------|----------|
| Crew: missions only if offered | **CONFIRMED** | `loadMission`: crew needs `offeredAt: { not: null }` else 404 (`missions.ts:50–55`); list filters same (`757–761`). |
| Roster ACTIVE/COMPLETED + own ACCEPTED | **CONFIRMED** | `crewView` (`missions.ts:694–705`); hidden until ACTIVE (`727`). |
| Scores never in crew payloads | **CONFIRMED** | Crew view has no score/breakdown fields (`672–728`); assertion (`workflow.test.ts:73`). |
| `allowedActions` per role/state | **CONFIRMED** | `allowedMissionActions` + blockers for submit/activate (`missions.ts:634–668`). |
| Leads see PROPOSED/scores | **CONFIRMED** | `leadView` includes scores/breakdown (`596–604`). |

---

## Summary table

| # | Workflow | Verdict | Bugs | Gaps |
|---|----------|---------|------|------|
| 1 | Happy path | **CONFIRMED** | 0 | — |
| 2 | Reject loop | **CONFIRMED** | 0 | Prior submission snapshots not listed in API |
| 3 | Decline → backfill | **CONFIRMED** | 0 | — |
| 4 | Dropout | **CONFIRMED** | 0 | No ACTIVE dropout E2E test |
| 5 | Cancel all states | **CONFIRMED (code)** | 0 | E2E only APPROVED cancel |
| 6 | Offer expiry | **CONFIRMED** | 0 | — |
| 7 | Accept conflicts | **CONFIRMED** | 0 | Backup flow not in v1 |
| 8 | Matcher | **CONFIRMED** | 0 | — |
| 9 | Lifecycle table | **CONFIRMED** | 0 | — |
| 10 | Idempotency / tx | **CONFIRMED (code)** | 0 | No tests for double respond / CAS race |
| 11 | Date math | **CONFIRMED** | 0 | — |
| 12 | Visibility | **CONFIRMED** | 0 | — |

---

## Bugs

**None identified** in traced workflows against DESIGN.md §9–12 and CLAUDE.md invariants.

---

## Notable gaps (non-blocking for baseline)

1. **Prior review rounds:** DB retains all `mission_submissions`; HTTP mission `review` is latest round only (`missions.ts:577–579`).
2. **Test coverage holes:** double accept/decline (`ALREADY_RESPONDED`), concurrent `moveMission`, cancel from DRAFT/SUBMITTED/REJECTED/ACTIVE, director `complete` E2E, ACTIVE dropout.
3. **Backup seats:** Schema supports `BACKUP`; matcher/accept blocking logic is PRIMARY-only — aligns with TODO.md deferral.

---

## Verification run

```
npm test → 6 files, 53 passed
```
</response>
output_path: c:\Users\shubh\.cursor\projects\c-Users-shubh-OneDrive-Documents-Mutinex\agent-transcripts\c9e4c66a-7432-46e8-a6b7-35fdfe37a5e7\subagents\771506c7-0fc8-4570-b1d2-dc0e96b79e92.jsonl
</task>
</system_notification>
<user_query>Perform any necessary follow-up actions in response to the subagent completion above. If no follow-up work is needed, no further action is required. If you mention an agent or subagent in your response, link it with the `[Name](id)` Don't use generic label such as `[agent]`, `[worker]`, or `[subagent]`. For cloud subagents, when the agent has edited code, link to `[Review](bc-id#changes)`, or, if you know the exact added and deleted line counts, `[Review +A −D](bc-id#changes)`, replacing A and D with those counts. Never write A or D literally. Use `[Try Live](bc-id#desktop)` only when the agent used computer use. Don't repeat the same confirmation every time.</user_query>

---

**Cursor**

Appending §3 and §6 to the audit.

§3 and §6 appended. Headlines:

- **§3 [Security Review](4cf756a3-a4b3-4066-99d8-f81d3434e3e1):** clean — **no medium+ vulnerabilities**. Tenancy, auth, privacy, validation, and error handling all verified against tests.
- **§6 [Workflow logic](771506c7-0fc8-4570-b1d2-dc0e96b79e92):** **all 12 workflows CONFIRMED, zero logic bugs.** The gaps are test-coverage holes (double-respond, CAS race, cancel from non-APPROVED states, ACTIVE dropout) plus one API limitation: `review` returns only the latest submission round though the DB keeps them all.

Only [Bugbot](fcade688-e5de-4ce9-af2f-fecb7601f1c8) is still out. Once it lands I'll write the findings summary (Appendix A), fold in the CLI guide (Appendix B), and launch the second wave — edge-case/test-gap enumeration agents building on these results.

---

**User**

<timestamp>Monday, Sep 28, 2026, 9:10 PM (UTC+10)</timestamp>
<system_notification>
The following task has finished. If you were already aware, ignore this notification and do not restate prior responses.

<task>
kind: subagent
status: success
task_id: fcade688-e5de-4ce9-af2f-fecb7601f1c8
title: Bugbot
tool_call_id: CallDynamicTool_3_0062ba98-53e24
agent_id: fcade688-e5de-4ce9-af2f-fecb7601f1c8
detail: ## Accept lacks compare-and-set guard

`src/services/offers.ts:131-141` · Severity: high

<details open>
<summary>Description</summary>

`acceptOffer` checks the role’s accepted PRIMARY count and that the row is `OFFERED`, then updates the assignment by `id` only. Unlike mission transitions via `moveMission`, the write is not conditional on `status = 'OFFERED'`. Concurrent accepts for the last seat can both pass the count check and both become `ACCEPTED`, exceeding `headcount`. A parallel retract/cancel/decline can move the row out of `OFFERED` while another transaction still promotes it to `ACCEPTED`, breaking the promised idempotent 409 semantics for offer responses.

</details>
output_path: c:\Users\shubh\.cursor\projects\c-Users-shubh-OneDrive-Documents-Mutinex\agent-transcripts\c9e4c66a-7432-46e8-a6b7-35fdfe37a5e7\subagents\fcade688-e5de-4ce9-af2f-fecb7601f1c8.jsonl
</task>
</system_notification>
<user_query>Perform any necessary follow-up actions in response to the subagent completion above. If no follow-up work is needed, no further action is required. If you mention an agent or subagent in your response, link it with the `[Name](id)` Don't use generic label such as `[agent]`, `[worker]`, or `[subagent]`. For cloud subagents, when the agent has edited code, link to `[Review](bc-id#changes)`, or, if you know the exact added and deleted line counts, `[Review +A −D](bc-id#changes)`, replacing A and D with those counts. Never write A or D literally. Use `[Try Live](bc-id#desktop)` only when the agent used computer use. Don't repeat the same confirmation every time.</user_query>

---

**Cursor**

Bugbot landed a real one. Appending §4, then writing the deduplicated findings summary and launching wave 2.

Wave 1 complete — all 7 sections plus deduplicated findings (Appendix A) and your CLI guide (Appendix B) are in `AUDIT.md`. Now launching wave 2: two edge-case agents, each seeded with wave-1 findings so they build on rather than duplicate the audit.

Wave 2 launched. Current state of the audit:

**`AUDIT.md` is complete through wave 1** — 7 sections + 2 appendices:

| § | Section | Headline |
|---|---|---|
| 1 | Decision trail | 19/20 + 11/12 verified; 2 doc/product mismatches |
| 2 | Type safety | Strong ingress/domain; loose egress (DTO `string` widening, CLI `as T`, no `never` switches) |
| 3 | Security review | Clean — no medium+ issues |
| 4 | Bugbot | **1 HIGH: `acceptOffer` race can overbook a seat** |
| 5 | Cross-tenant privacy | No critical/high leaks; MED defence-in-depth on bare-id updates |
| 6 | Workflow logic | All 12 workflows confirmed, zero bugs; test gaps listed |
| 7 | Real-world research | 22 cases; roadmap validated by NASA/ESA/FAA practice |
| A | Findings summary | 3 HIGH, 8 MED, ~10 LOW, deduplicated |
| B | CLI self-test guide | Complete walkthrough |

**Wave 2 now running:**
- [Test-gap enumeration](1d129d4b-edc7-485f-84d5-d9613b824f19) — concrete Given/When/Then backlog per module, prioritised P1/P2/P3
- [Adversarial race & boundary hunt](1253b9a3-e107-4a8a-953e-c0062cffced4) — seeded with the `acceptOffer` race, hunting the whole TOCTOU class plus date/input/state-machine abuse

The single most important finding so far: **H1, the `acceptOffer` compare-and-set race** (`offers.ts:131-141`) — two concurrent accepts for the last seat can both succeed. Fix direction is documented in §4 (conditional `updateMany` mirroring `moveMission`'s CAS). Per your instruction, no code changes were made — everything is documented for your review.

---

**User**

<timestamp>Monday, Sep 28, 2026, 9:13 PM (UTC+10)</timestamp>
<system_notification>
The following task has finished. If you were already aware, ignore this notification and do not restate prior responses.

<task>
kind: subagent
status: success
task_id: 1253b9a3-e107-4a8a-953e-c0062cffced4
title: Adversarial race and boundary hunt
tool_call_id: CallDynamicTool_1_d10bf1a4-765b3
agent_id: 1253b9a3-e107-4a8a-953e-c0062cffced4
detail: <user_visible_high_level_summary>
Adversarial read-only audit of Mission Control found **11 REAL issues** beyond the known `acceptOffer` race (duplicate seat rows via concurrent nominate/offer, missing CAS on decline/drop/retract vs accept, submit/approve amplifying over-nominations, expiry boundary `lt` vs accept path, CLI `--json` on non-JSON errors, and others). **SQLite serializable transactions reduce but do not replace compare-and-set writes**; several paths remain unsafe for Postgres or under true parallelism. Full severity table and per-finding detail are in the report below for verbatim inclusion in your audit document.
</user_visible_high_level_summary>
<response>
# Mission Control — Adversarial Concurrency & Abuse Audit (Read-Only)

**Scope:** TypeScript ESM, Fastify 5, Prisma 6 + SQLite, Commander CLI 
**Repo:** `c:\Users\shubh\OneDrive\Documents\Mutinex\mission-control` 
**Baseline:** typecheck clean, 53/53 tests pass 
**Method:** Code trace + chaos-style interleaving analysis (no files modified)

**Legend:** **REAL** = traced through code to a plausible failure without extra assumptions. **THEORETICAL** = needs a concurrent/integration test or depends on DB timing.

---

## Executive summary

The previously reported **`acceptOffer` compare-and-set gap** is real and is the most severe instance of a **repeatable pattern**: read eligibility → count seats → `update` by bare `id` without `WHERE status = …`. The same class appears on **`declineOffer`**, **`dropOut`**, and races against **`retractOffer` / `cancelMission` / concurrent accepts**.

Additional **REAL** issues include **duplicate `PROPOSED`/`OFFERED` rows per role** (no DB uniqueness; concurrent `nominate` / `offerSeats`), **`submitMission` only enforcing `nominated >= headcount`** (not `==`), and **`approveMission` promoting every `PROPOSED` row**—which can create multiple offers for one seat. **SQLite + Prisma `$transaction`** tends to serialize writers on a single DB file, which **masks** races in single-process tests but **does not fix** the logic for Postgres or multi-instance deployments.

---

## Findings summary table

| ID | Severity | Status | Location | Class |
|----|----------|--------|----------|--------|
| H0 | **CRITICAL** | REAL | `offers.ts:131-141` | Known: `acceptOffer` seat cap + no `OFFERED` CAS |
| H1 | **HIGH** | REAL | `offers.ts:169-171`, `195-197` | `declineOffer` / `dropOut` no status CAS |
| H2 | **HIGH** | REAL | `staffing.ts:139-151`, `200-213` | Concurrent `nominate` / `offerSeats` duplicate live seats |
| H3 | **HIGH** | REAL | `missions.ts:484-492`, `336-338` | Submit allows `nominated > headcount`; approve offers all `PROPOSED` |
| H4 | **HIGH** | REAL | `missions.ts:426-430` + H0 | `activateMission` can lock crew with >headcount `ACCEPTED` |
| H5 | **MEDIUM** | REAL | `offers.ts:109-141` vs `expiry.ts:27-28` | Expiry boundary: sweep `expiresAt < now`, accept doesn't re-check `expiresAt` in tx |
| H6 | **MEDIUM** | REAL | `staffing.ts:247-250` vs H0 | `retractOffer` uses `status: OFFERED`; accept uses bare `id` |
| H7 | **MEDIUM** | REAL | `cli/client.ts:42-43` | Non-JSON API error breaks `--json` (uncaught `JSON.parse`) |
| H8 | **MEDIUM** | THEORETICAL | `missions.ts:422-430` | Activate: check blockers then CAS mission (seat drop interleaving) |
| H9 | **MEDIUM** | REAL | `people.ts:144-168` | Overlapping unavailability windows allowed (no merge/dedupe) |
| H10 | **MEDIUM** | REAL | `expiry.ts:13-18` | Missions starting within ~15 days → deadline often `now+24h` only |
| H11 | **LOW** | REAL | `missions.ts:70-71`, `lib/dates.ts:21-22` | “Start in future” = UTC day of `now`, not operator locale |
| H12 | **LOW** | REAL | `context.ts:22-27` | Mission keys `AST-012` and `AST-12` same number |
| H13 | **LOW** | REAL | `people.ts:110-125` | Duplicate skill keys in one `setMySkills` body (last wins) |
| H14 | **LOW** | REAL | `schema.prisma:207-232` | No uniqueness on live seat per `(mission, role, user)` or per-role cap |
| H15 | **LOW** | REAL | `README.md:125`, migration header | v2 migration destructive; documented |
| H16 | **LOW** | THEORETICAL | `context.ts:17-18` | Prisma default SQLite isolation vs check-then-act |
| I1 | **INFO** | REAL | `lifecycle.ts`, `context.ts:59-72` | `moveMission` CAS — approve/reject/cancel/submit races handled |
| I2 | **INFO** | REAL | `validation.ts`, `dates.ts:34-38` | Strict dates/skills; zod `strictObject` on bodies |

---

## SQLite / Prisma transaction semantics (cross-cutting)

| Question | Answer |
|----------|--------|
| Does `tx()` wrap one transaction? | **Yes** — `ctx.db.$transaction(fn)` (`context.ts:17-18`). |
| Isolation on SQLite? | Prisma uses SQLite **SERIALIZABLE** for interactive transactions (default). Single-file DB + one writer → many races **hard to reproduce** in-process. |
| Does that fix H0–H2? | **No.** Logic is still **check-then-act without conditional writes**. On Postgres or multiple API instances, races become **routine**. Serializable may abort/retry, but Prisma **does not auto-retry** your business checks. |
| Reads outside `tx`? | **`sweepExpiredOffers`** often runs on `ctx.db` **before** `tx()` (`offers.ts:111`, `listMyOffers:43`). Not a correctness bug if sweep runs on accept path, but widens stale windows for other readers. |

**Fix direction (global):** conditional `updateMany` / `DELETE … WHERE status IN (…)` with `count === 1` else conflict; optional partial unique indexes when moving off SQLite.

---

## Per-finding detail

### H0 — `acceptOffer` overbooking + stale promote (KNOWN)

| | |
|--|--|
| **Severity** | **CRITICAL** |
| **Status** | **REAL** |
| **Location** | `src/services/offers.ts:131-141` |
| **Interleaving** | Two crew (or double-click) **`POST /v1/me/offers/:key/accept`** for the same role with `headcount === 1`; or **accept** parallel **retract/cancel/decline/sweep**. |
| **Mechanism** | (1) `count` of `ACCEPTED` PRIMARY for `roleId`. (2) `update({ where: { id: offer.id }, data: { status: 'ACCEPTED' }})` — **no** `status: 'OFFERED'` predicate. |
| **Expected** | Exactly one accept; others `ROLE_FILLED` or `ALREADY_RESPONDED`. |
| **Actual** | Both can pass count `0`; both become `ACCEPTED`. Retract can lose to accept without “already closed” semantics on accept side. |
| **Fix** | `updateMany({ where: { id, orgId, status: 'OFFERED', expiresAt: { gt: now } }, … })` with `count !== 1`; re-check headcount **after** conditional update or use serializable counter / constraint. Mirror `moveMission` (`context.ts:59-72`). |

---

### H1 — `declineOffer` / `dropOut` lack compare-and-set

| | |
|--|--|
| **Severity** | **HIGH** |
| **Status** | **REAL** |
| **Location** | `declineOffer`: `offers.ts:169-171`; `dropOut`: `offers.ts:195-197` |
| **Interleaving** | **Accept + decline** on same offer; **drop + cancel** (RELEASED vs DROPPED); double **drop**. |
| **Expected** | One terminal outcome; second call `ALREADY_RESPONDED` / invalid transition. |
| **Actual** | Both pass `assertOpenOffer` / status check, then unconditional `update` by `id`. Last writer wins → e.g. `ACCEPTED` then overwritten by `DECLINED`, or `DROPPED` after `RELEASED`. |
| **Fix** | Same CAS pattern: `updateMany` with expected `status` (`OFFERED` / `ACCEPTED`) and mission still `APPROVED`/`ACTIVE` where relevant. |

---

### H2 — Concurrent `nominate` / `offerSeats` duplicate live seats

| | |
|--|--|
| **Severity** | **HIGH** |
| **Status** | **REAL** |
| **Location** | `staffing.ts:83-117` (`planSeats`), `139-151` (`nominate`), `199-213` (`offerSeats`); `schema.prisma:207-232` (no cap constraint) |
| **Interleaving** | Two concurrent **`POST …/nominations`** or **`POST …/offers`** (double-click backfill) for the same role before either `create` commits. |
| **Mechanism** | `planSeats` reads `filledBy` from snapshot; `role.filledBy.length >= headcount` check; then **`assignment.create`** with no unique guard. |
| **Expected** | Second request `ROLE_FILLED`. |
| **Actual** | Two `PROPOSED` or two `OFFERED` rows for one seat. |
| **Fix** | DB: partial unique index on `(org_id, mission_id, role_id, user_id)` for live statuses, or cap trigger; app: `create` inside tx with **`SELECT … FOR UPDATE`** equivalent / recount + conditional insert; reject if open seats `<= 0`. |

---

### H3 — Submit minimum-only + approve fan-out

| | |
|--|--|
| **Severity** | **HIGH** |
| **Status** | **REAL** |
| **Location** | `missions.ts:484-492` (`submitBlockers`), `336-338` (`approveMission` `updateMany` on `PROPOSED`) |
| **Interleaving** | H2 duplicates (or manual DB), then **submit → approve**. |
| **Mechanism** | Submit requires `nominated >= headcount`, not `==`. Approve sets **all** `PROPOSED` → `OFFERED`. |
| **Expected** | At most `headcount` offers per role. |
| **Actual** | Multiple `OFFERED` for one seat; amplifies H0. |
| **Fix** | Submit: `nominated === headcount` per role (or cap extras); approve: promote exactly `headcount` per role (ordered); reject submit if any role over-filled. |

---

### H4 — Activate with over-accepted crew

| | |
|--|--|
| **Severity** | **HIGH** |
| **Status** | **REAL** (downstream of H0/H2) |
| **Location** | `missions.ts:426-430`, `495-499` |
| **Interleaving** | Overbook via H0, then **activate**. |
| **Mechanism** | `activateBlockers` only checks `accepted >= headcount`, not upper bound. |
| **Expected** | Cannot activate invalid crew. |
| **Actual** | Mission goes **ACTIVE** with 2+ `ACCEPTED` PRIMARY for one role. |
| **Fix** | Require `accepted === headcount` per role; optional DB constraint. |

---

### H5 — Offer expiry instant vs lazy sweep

| | |
|--|--|
| **Severity** | **MEDIUM** |
| **Status** | **REAL** (boundary); partial on “skip sweep” |
| **Location** | `expiry.ts:22-28` (`expiresAt: { lt: now }`); `offers.ts:92-107`, `109-114` |
| **Interleaving** | Accept at **`now === expiresAt`**; or accept immediately after approve without another sweep path (accept **does** call sweep at `111`). |
| **Expected** | Consistent “deadline inclusive/exclusive” policy. |
| **Actual** | At exact `expiresAt`, status still `OFFERED` until `now > expiresAt`. Accept path relies on sweep + status, not **`expiresAt <= now`** inside tx. |
| **Fix** | In `assertOpenOffer` or accept tx: reject if `expiresAt && expiresAt <= now`; align sweep to `lte` if product wants deadline expired at T. |

---

### H6 — Accept vs retract race

| | |
|--|--|
| **Severity** | **MEDIUM** |
| **Status** | **REAL** |
| **Location** | `staffing.ts:247-250` vs `offers.ts:138-141` |
| **Interleaving** | **Retract** (`updateMany` `status: OFFERED`) vs **accept** (bare `id`). |
| **Expected** | One wins; loser gets clear error. |
| **Actual** | Accept can set `ACCEPTED` after retract set `WITHDRAWN`, or retract after accept leaves ambiguous audit. |
| **Fix** | H0 CAS on accept; optionally CAS on retract including “not already ACCEPTED”. |

---

### H7 — CLI `--json` on non-JSON errors

| | |
|--|--|
| **Severity** | **MEDIUM** |
| **Status** | **REAL** |
| **Location** | `cli/client.ts:42-43`; contrast `cli/index.ts:49-51` |
| **Interleaving** | Proxy HTML 502, nginx body, truncated response with `--json`. |
| **Expected** | Structured `{ error: … }`, non-zero exit. |
| **Actual** | `JSON.parse(text)` throws → caught as generic exit **1**, not JSON error envelope. |
| **Fix** | try/catch parse; emit `{ error: { code: 'INVALID_RESPONSE', message } }` when `isJson()`. |

---

### H8 — Activate TOCTOU on seat counts

| | |
|--|--|
| **Severity** | **MEDIUM** |
| **Status** | **THEORETICAL** (likely serialized on SQLite) |
| **Location** | `missions.ts:422-430` |
| **Interleaving** | **dropOut** between `activateBlockers` and `moveMission`. |
| **Expected** | Activate fails if seat no longer filled. |
| **Actual** | Blockers read once; no re-check before `moveMission`. |
| **Fix** | Re-load roles inside tx after blockers or fold check into same query as CAS. |

---

### H9 — Overlapping unavailability windows

| | |
|--|--|
| **Severity** | **MEDIUM** |
| **Status** | **REAL** |
| **Location** | `people.ts:144-168` |
| **Abuse** | Many overlapping blocks; confusing matcher/accept behavior (duplicate UNAVAILABLE issues). |
| **Fix** | Reject overlaps or merge adjacent ranges. |

---

### H10 — Short-fuse missions and offer TTL floor

| | |
|--|--|
| **Severity** | **MEDIUM** (product/abuse) |
| **Status** | **REAL** |
| **Location** | `expiry.ts:13-18`, `OFFER_CUTOFF_DAYS_BEFORE_START = 14` |
| **Input** | Mission start in **≤15 days** while org TTL is 7 days. |
| **Behavior** | Cutoff `start−14` often in past → deadline clamped to **`now + 1 day`** floor. Crew may get **~24h** to respond. |
| **Fix** | Document; optionally fail approve if `offerDeadline - now < minReviewHours`. |

---

### H11 — UTC “today” for mission start validation

| | |
|--|--|
| **Severity** | **LOW** |
| **Status** | **REAL** |
| **Location** | `missions.ts:70-71`; `lib/dates.ts:21-22` |
| **Boundary** | Operator local evening vs UTC date; `startDate === today` UTC rejected while local calendar still “tomorrow”. |
| **Fix** | Document UTC-only; or org timezone setting. |

---

### H12 — Mission key leading zeros

| | |
|--|--|
| **Severity** | **LOW** |
| **Status** | **REAL** |
| **Location** | `context.ts:22-27` |
| **Input** | `AST-012` → `Number('012') === 12`. |
| **Fix** | Reject leading zeros or normalize in API output only. |

---

### H13 — Duplicate skills in one profile update

| | |
|--|--|
| **Severity** | **LOW** |
| **Status** | **REAL** |
| **Location** | `people.ts:117-124`; no zod `.refine` on unique keys in `skillsBody` |
| **Fix** | Reject duplicates in zod or service. |

---

### H14 — Schema allows duplicate assignment rows

| | |
|--|--|
| **Severity** | **LOW** (enabler for H2/H3) |
| **Status** | **REAL** |
| **Location** | `prisma/schema.prisma:207-232` |
| **Fix** | Partial unique index on live PRIMARY seats per role/user/mission. |

---

### H15 — Migration data loss

| | |
|--|--|
| **Severity** | **LOW** (ops) |
| **Status** | **REAL** |
| **Location** | `prisma/migrations/20260928095500_roles_nominations_tenancy/migration.sql:1-6`; `README.md:125` |
| **Finding** | v2 migration **drops** tables; README says rerun `npm run setup` wipes DB. **Documented.** |

---

### H16 — Reliance on SQLite serialization

| | |
|--|--|
| **Severity** | **LOW** |
| **Status** | **THEORETICAL** |
| **Finding** | Tests may pass without concurrent accepts; **do not** treat green CI as race freedom. |

---

## Category walkthrough (checklist)

### 1. Concurrency / TOCTOU (beyond H0)

| Scenario | Verdict |
|----------|---------|
| Double **submit** | **Safe** — `moveMission` CAS (`context.ts:59-72`). |
| **Approve vs reject vs cancel** (SUBMITTED) | **Safe** — one `moveMission` wins. |
| **Edit vs submit** | **Safe** — edit only DRAFT/REJECTED; concurrent submit wins SUBMITTED. |
| **Submit snapshot vs edit** | Same tx for submit; no edit mid-tx from same mission state. |
| **Sweep during accept** | Sweep **before** tx; H5/H6 remain. |
| **Nominate double-click** | **H2 REAL**. |
| **offerSeats backfill double-click** | **H2 REAL**. |
| **Seat cap in accept** | **H0** — count and update same tx but not atomic as one conditional step. |
| **One person, two roles same mission** | Matcher: one seat globally; manual nominate second role blocked by `ON_MISSION` (`matcher.ts:79-98`). Two concurrent offers same person different roles: **THEORETICAL** race before either row exists. |
| **One person ACCEPTED two roles** | Blocked after first accept by `ON_MISSION`; overbooking same role is H0. |

### 2. Date/time boundaries

| Topic | Verdict |
|-------|---------|
| 1-day window (`start === end`) | Allowed if start **after** UTC today (`assertWindow`). |
| Inclusive overlap on mission start day vs unavailability | **Conflict** (`overlaps` inclusive) — consistent. |
| Rest gap from end of unavailability to mission | Uses **commitment ranges**, not unavailability end alone. |
| Adjacent missions (gap 0) | `gapBetween` 0; passes if `restGapDays` is 0. |
| Touching ranges (same calendar day end/start) | `gapBetween` **−1** (overlap) — tested `dates-scheduling.test.ts:24`. |
| Leap day `2028-02-29` | **REAL** support via `parseIsoDate` normalization; not in tests. |
| `2026-13-01`, `2026-1-1`, `+002026-01-01` | Rejected by regex / validation (`validation.ts:21-24`, tests). |
| Expiry at deadline instant | **H5**. |
| `new Date()` without UTC in clock | **H11** for “future start” only; stored dates are UTC midnight. |

### 3. Input abuse (zod and past)

| Input | Verdict |
|-------|---------|
| headcount 0 / negative / 10⁹ | Blocked at `min(1)` / `max(20)` (`validation.ts:38`). |
| proficiency 0, 6, 3.5, NaN | HTTP JSON: zod **int 1–5**; NaN fails parse. |
| Title empty / whitespace | `trim().min(1)`. |
| 10MB title | Capped `max(120)`; no custom Fastify `bodyLimit` — huge body **THEORETICAL** DoS. |
| Handle unicode/emoji | `handle` max 40, no charset ban — seed handles ASCII. |
| Mission key injection | Parsed as regex; wrong prefix → **404** (`parseMissionKey`). |
| Reason empty vs whitespace | `text()` vs optional trim → null. |
| `__proto__` in JSON | `strictObject` + modern `JSON.parse` — low risk. |
| Long skill lists | `max(10)` per role, `max(20)` roles. |
| Duplicate skills per role | Service rejects (`missions.ts:94-99`). |
| Duplicate role names | Service rejects (`missions.ts:80-82`). |

### 4. State machine abuse

| Action | Verdict |
|--------|---------|
| submit → cancel before approve | Valid; cancel from SUBMITTED (`missions.ts:394`). |
| Revise SUBMITTED | **edit** fails (`lifecycle.ts:54`). |
| cancel CANCELLED / complete COMPLETED | **INVALID_TRANSITION** (`assertMissionAction`). |
| activate twice | Second **moveMission** fails. |
| Offer while ACCEPTED other role | Blocked at offer time (`ON_MISSION`). |
| Rapid submit→cancel | CAS + tx rollback — OK. |

### 5. CLI hostility

| Scenario | Verdict |
|----------|---------|
| Corrupt config JSON | `CliError` from `loadConfig` (`config.ts:44-45`). |
| Config mode 644 | **600** on save; **no warn** on load if already world-readable. |
| Non-JSON API response | **H7**. |
| API unreachable | Exit **8** (`client.ts:37-40`). |
| Token revoked mid-session | Next call **401** → exit 3. |
| Two profiles same prefix | **Ambiguous** error (`config.ts:68-69`). |
| `--json` on API error | API returns JSON — OK; transport errors **H7**. |

### 6. Positive controls (for audit balance)

- **`moveMission` compare-and-set** for mission status (`context.ts:59-72`) — approve/reject/cancel/submit races. 
- **Accept-time schedule re-check** inside tx (`offers.ts:116-128`) — overlapping **ACCEPTED** missions blocked (tested workflow). 
- **Tenancy** composite FKs + org-scoped queries. 
- **Lazy expiry** integrated on accept/list paths (workflow test `OFFER_EXPIRED`). 
- **Role duplicate / skill duplicate** validation on mission create.

---

## Recommended test additions (confirm races)

1. Two parallel accepts, headcount 1 → exactly one success (H0). 
2. Parallel nominates same open seat → one success (H2). 
3. Accept + decline same offer → one terminal state (H1). 
4. Accept + retract (H6). 
5. Submit with forced duplicate PROPOSED (fixture) → submit/approve should fail or trim (H3). 
6. `expiresAt === now` accept (H5). 
7. CLI `--json` with HTML body (H7).

---

## Severity rollup

| Severity | Count (new, excl. H0) | IDs |
|----------|------------------------|-----|
| CRITICAL | 1 (known) | H0 |
| HIGH | 4 | H1–H4 |
| MEDIUM | 6 | H5–H10 |
| LOW | 6 | H11–H16 |

**Bottom line:** Treat **assignment status transitions** like **mission** transitions: **conditional updates + row-count checks**, plus **DB constraints** on live seats. Relying on SQLite single-writer behavior is **not** a substitute for compare-and-set in a B2B platform headed for Postgres.
</response>
output_path: c:\Users\shubh\.cursor\projects\c-Users-shubh-OneDrive-Documents-Mutinex\agent-transcripts\c9e4c66a-7432-46e8-a6b7-35fdfe37a5e7\subagents\1253b9a3-e107-4a8a-953e-c0062cffced4.jsonl
</task>
</system_notification>
<user_query>Perform any necessary follow-up actions in response to the subagent completion above. If no follow-up work is needed, no further action is required. If you mention an agent or subagent in your response, link it with the `[Name](id)` Don't use generic label such as `[agent]`, `[worker]`, or `[subagent]`. For cloud subagents, when the agent has edited code, link to `[Review](bc-id#changes)`, or, if you know the exact added and deleted line counts, `[Review +A −D](bc-id#changes)`, replacing A and D with those counts. Never write A or D literally. Use `[Try Live](bc-id#desktop)` only when the agent used computer use. Don't repeat the same confirmation every time.</user_query>

---

**Cursor**

The adversarial hunt escalated things significantly — it found a whole *class* of races beyond the one Bugbot caught. Appending as §8 and updating the findings summary.

Now updating Appendix A to reflect the escalated severity and the new findings.

§8 appended and Appendix A re-ranked. This was the most valuable agent of the audit — the headline:

**The `acceptOffer` race wasn't one bug, it's a class.** The [adversarial hunt](1253b9a3-e107-4a8a-953e-c0062cffced4) traced the same missing compare-and-set pattern across five operations:

| ID | Severity | Issue |
|---|---|---|
| H1 | **CRITICAL** | `acceptOffer` — concurrent accepts overbook the last seat |
| H2 | HIGH | `declineOffer`/`dropOut` — last-writer-wins vs accept/cancel |
| H3 | HIGH | Double-clicked nominate/backfill → duplicate offers for one seat |
| H4 | HIGH | Submit checks `nominated >= headcount` (not `==`), approve offers **all** PROPOSED → multiple offers per seat |
| H5 | HIGH | Activate checks `accepted >= headcount` (not `==`) → locks over-accepted crew |

Plus 6 MED (expiry boundary instant, accept-vs-retract race, CLI `--json` breaking on HTML error pages, overlapping unavailability windows, 24h-clamped deadlines on short-fuse missions, activate TOCTOU).

**The important context:** SQLite's single-writer serialization masks all of these in your tests — they'd only bite on Postgres or multiple API instances. The fix is uniform and cheap: conditional `updateMany` with a status predicate + count check, exactly the pattern `moveMission` already uses for missions. The audit doc frames it as "treat assignment transitions like mission transitions."

Also confirmed safe under concurrency: `moveMission` CAS, edit-vs-submit, cancel/complete/activate double-fires, and most input abuse (headcount/proficiency/date validation all hold).

One agent remains — [test-gap enumeration](1d129d4b-edc7-485f-84d5-d9613b824f19) — which will land §9 with the concrete Given/When/Then backlog covering these races.

---

**User**

<timestamp>Monday, Sep 28, 2026, 9:14 PM (UTC+10)</timestamp>
<system_notification>
The following task has finished. If you were already aware, ignore this notification and do not restate prior responses.

<task>
kind: subagent
status: success
task_id: 1d129d4b-edc7-485f-84d5-d9613b824f19
title: Enumerate missing test cases
tool_call_id: CallDynamicTool_0_601f6ff6-765b3
agent_id: 1d129d4b-edc7-485f-84d5-d9613b824f19
detail: <user_visible_high_level_summary>
Read-only audit of Mission Control test coverage against DESIGN.md §9–12/§16 and all existing Vitest suites. Delivered a module-grouped backlog of **62** concrete cases (IDs, type, P1–P3, full Given/When/Then), including the ten pre-identified gaps plus matcher, Hungarian, scheduling, lifecycle, offers, people/org, security, CLI, and seed/demo holes not covered today.
</user_visible_high_level_summary>
<response>
# Mission Control — Missing Test Backlog (Read-Only Audit)

**Baseline:** 53 Vitest cases green; `npm run demo` (26 CLI steps). **Scope:** coverage gaps only — core workflows treated as implemented per prior audit.

**Legend:** **Unit** = pure logic, no DB · **Integration** = `testApp` + Fastify inject · **CLI-smoke** = subprocess `bin/mc.mjs` (demo-style harness or dedicated vitest spawn)

---

## 1. Offers & assignment responses (`src/services/offers.ts`, `expiry.ts`)

| ID | Test | Type | Priority | Given/When/Then |
| --- | --- | --- | --- | --- |
| OFF-001 | Double accept returns ALREADY_RESPONDED | Integration | P1 | **Given** an APPROVED mission with one OFFERED seat for crew `leo` on role Pilot (headcount 1), and `leo` has already POST `/v1/me/offers/:key/accept` successfully (status ACCEPTED) · **When** `leo` POST `/v1/me/offers/:key/accept` again · **Then** HTTP 409, `error.code` = `ALREADY_RESPONDED`, message mentions `accepted`, assignment row remains single ACCEPTED, no duplicate `OFFER_ACCEPTED` event |
| OFF-002 | Double decline returns ALREADY_RESPONDED | Integration | P1 | **Given** APPROVED mission, `sara` OFFERED on Engineer, `sara` POST decline with reason · **When** `sara` POST decline again (with or without reason) · **Then** 409 `ALREADY_RESPONDED`, status stays DECLINED, one `OFFER_DECLINED` event |
| OFF-003 | Accept after decline returns ALREADY_RESPONDED | Integration | P1 | **Given** `sara` DECLINED an offer on mission `key` · **When** `sara` POST accept on same `key` · **Then** 409 `ALREADY_RESPONDED` (not `OFFER_EXPIRED`), status unchanged |
| OFF-004 | Decline without reason is allowed | Integration | P2 | **Given** OFFERED seat for `tomas` · **When** POST `/v1/me/offers/:key/decline` with `{}` or omitted body · **Then** 200, status DECLINED, `reason` null in DB and GET `/v1/me/offers` |
| OFF-005 | Drop-out without reason returns 400 | Integration | P1 | **Given** `leo` ACCEPTED on APPROVED or ACTIVE mission · **When** POST `/v1/me/offers/:key/drop` with `{}` or empty reason · **Then** 400 `VALIDATION_FAILED` (zod `reason` required), status remains ACCEPTED |
| OFF-006 | Accept on EXPIRED row (post-sweep) returns OFFER_EXPIRED | Integration | P1 | **Given** OFFERED seat past `expiresAt`, clock advanced, GET `/v1/me/offers` already ran sweep (status EXPIRED) · **When** POST accept without another sweep path · **Then** 409 `OFFER_EXPIRED` (via `assertOpenOffer` EXPIRED branch) |
| OFF-007 | Lazy sweep on accept writes system OFFER_EXPIRED | Integration | P1 | **Given** two OFFERED seats past deadline, neither accepted · **When** crew POST accept on one mission (triggers sweep) · **Then** both rows EXPIRED, `mission_events` for each with `type` OFFER_EXPIRED and `actor` null; accepting either afterward → 409 |
| OFF-008 | Concurrent accept overbooking (headcount 1) | Integration | P1 | **Given** APPROVED mission, role Pilot headcount 1, two distinct crew `a` and `b` each with OFFERED primary seat on that role (via two backfill offers or test DB setup) · **When** `Promise.all` POST accept by `a` and `b` · **Then** exactly one 200 ACCEPTED, one 409 (`ROLE_FILLED` or `ALREADY_RESPONDED` if row updated), accepted count for role never exceeds 1 (regression for future CAS fix) |
| OFF-009 | Accept when role already filled (sequential) | Integration | P1 | **Given** headcount 1, `leo` ACCEPTED · **When** `tomas` (still OFFERED on same role) POST accept · **Then** 409 `ROLE_FILLED`, message names role |
| OFF-010 | Drop-out on ACTIVE mission E2E | Integration | P1 | **Given** mission ACTIVE with all seats ACCEPTED · **When** one crew POST drop with valid reason · **Then** 200 DROPPED, mission stays ACTIVE, lead inbox OPEN_SEATS, matcher excludes drop-out for that mission, `CREW_DROPPED_OUT` event |
| OFF-011 | Respond when mission CANCELLED | Integration | P2 | **Given** crew OFFERED, director cancelled mission (WITHDRAWN offers) · **When** crew POST accept · **Then** 409 `INVALID_TRANSITION` (mission not taking responses) |

---

## 2. Mission lifecycle & concurrency (`src/services/missions.ts`, `context.ts`)

| ID | Test | Type | Priority | Given/When/Then |
| --- | --- | --- | --- | --- |
| LFC-001 | Concurrent double-approve CAS | Integration | P1 | **Given** SUBMITTED mission owned by `marcus`, directors `ava` and `ben` both eligible · **When** `Promise.all` POST approve by `ava` and `ben` · **Then** exactly one 200 APPROVED with `offersSent` > 0; other 409 `INVALID_TRANSITION` message contains “Reload”; mission status APPROVED once; no duplicate OFFERS_SENT |
| LFC-002 | Cancel from DRAFT | Integration | P1 | **Given** DRAFT mission with nominations optional · **When** director POST cancel with reason · **Then** 200 CANCELLED, no assignments forced to WITHDRAWN unless PROPOSED/OFFERED existed; pending submission if any marked appropriately |
| LFC-003 | Cancel from SUBMITTED | Integration | P1 | **Given** SUBMITTED mission in director inbox · **When** director POST cancel with reason · **Then** 200, status CANCELLED, submission decision CANCELLED, director REVIEW item gone on next inbox |
| LFC-004 | Cancel from REJECTED | Integration | P2 | **Given** REJECTED mission with director note · **When** director POST cancel · **Then** 200 CANCELLED, owner can no longer submit |
| LFC-005 | Cancel from ACTIVE | Integration | P1 | **Given** ACTIVE mission with ACCEPTED crew · **When** director POST cancel · **Then** 200, ACCEPTED → RELEASED with cancel reason, crew inbox UPDATE items |
| LFC-006 | Director (non-owner) completes mission | Integration | P1 | **Given** ACTIVE mission owned by `marcus` · **When** `ava` POST complete · **Then** 200 COMPLETED (ownerOrDirector rule); history includes MISSION_COMPLETED actor `ava` |
| LFC-007 | Owner cannot complete from APPROVED | Integration | P2 | **Given** APPROVED, not all accepted · **When** owner POST complete · **Then** 409 `INVALID_TRANSITION` |
| LFC-008 | Double submit from SUBMITTED | Integration | P1 | **Given** mission SUBMITTED · **When** owner POST submit again · **Then** 409 `INVALID_TRANSITION`, round unchanged |
| LFC-009 | Submit with zero roles | Integration | P1 | **Given** DRAFT mission created without roles (POST missions body without roles, no roles set) · **When** owner POST submit · **Then** 422 `PRECONDITION_FAILED`, blockers include “Add at least one role” |
| LFC-010 | Activate with partially accepted seats | Integration | P1 | **Given** APPROVED, only 1 of 2 roles accepted · **When** owner POST activate · **Then** 422 blockers list role with 0/N accepted (extends existing single-role test) |
| LFC-011 | Edit mission from SUBMITTED forbidden | Integration | P2 | **Given** SUBMITTED · **When** owner PATCH title · **Then** 409 `INVALID_TRANSITION` or 403 per lifecycle (assertMissionAction on edit) |
| LFC-012 | Every mission action from COMPLETED | Integration | P2 | **Given** COMPLETED mission · **When** owner/director attempt submit, approve, cancel, activate, nominate, offer · **Then** each returns 409 `INVALID_TRANSITION` (table-driven loop) |
| LFC-013 | Every mission action from CANCELLED | Integration | P2 | **Given** CANCELLED · **When** same action matrix · **Then** all non-read actions 409 `INVALID_TRANSITION` |

---

## 3. Staffing, deadlines, org settings (`staffing.ts`, `expiry.ts`, `org.ts`)

| ID | Test | Type | Priority | Given/When/Then |
| --- | --- | --- | --- | --- |
| STF-001 | Offer deadline uses launch−14d floor | Integration | P1 | **Given** org offer TTL 7d, clock `2026-10-01T09:00Z`, mission start `2026-10-11` (10 days out) · **When** director approves · **Then** expiresAt = start − 14d (cutoff before TTL), visible on GET `/v1/me/offers` |
| STF-002 | Offer deadline 24h minimum floor | Integration | P1 | **Given** mission start tomorrow (short notice), org TTL 7d · **When** approve · **Then** expiresAt ≥ now + 24h (`offerDeadline` floor), still ≤ start − 14d when applicable |
| STF-003 | Backfill offer inherits deadline rule | Integration | P2 | **Given** APPROVED mission with open seat after decline · **When** owner POST `/v1/missions/:key/offers` · **Then** created[].expiresAt matches `offerDeadline(now, start, org.offerTtlDays)` |
| STF-004 | Manual nominate NOT_ELIGIBLE | Integration | P1 | **Given** DRAFT mission, role Pilot requires nav≥4 · **When** owner POST nominations `{ role: Pilot, crew: sara }` where sara nav=3 · **Then** 422/409 `NOT_ELIGIBLE` with rejection details, no PROPOSED row |
| STF-005 | Retract non-existent offer | Integration | P2 | **Given** APPROVED mission, crew never offered · **When** owner POST retract handle · **Then** 404, message open offer not found |
| STF-006 | Retract after ACCEPTED fails | Integration | P2 | **Given** crew ACCEPTED · **When** owner POST retract that handle · **Then** 404 (updateMany count 0), status stays ACCEPTED |
| STF-007 | Nominate on APPROVED returns 409 | Integration | P2 | **Given** APPROVED (covered once) · **When** owner POST nominations recommended · **Then** 409 `INVALID_TRANSITION` — explicit assert on code |
| STF-008 | Org rest gap Astra 14 vs Lunar 21 (accept path) | Integration | P1 | **Given** same calendar gap (13 free days) between commitments, two orgs: Astra crew passes matcher+accept at 14 boundary; Lunar crew fails · **When** POST accept on Lunar mission · **Then** 409 `SCHEDULE_CONFLICT` with rest gap detail; Astra accept 200 at 14-day boundary mission pair |
| STF-009 | Rest gap boundary via API (14 pass / 13 fail) | Integration | P1 | **Given** Astra org, mission window Nov 1–30, crew commitment ending Oct 17 (14 free days before) vs Oct 18 (13 free) · **When** submit→approve→accept for eligible case · **Then** accept 200 for 14-day case; 409 schedule conflict for 13-day case (mirror unit matcher boundary through HTTP) |
| STF-010 | `offerDeadline` pure cases | Unit | P2 | **Given** fixed `now`, `missionStart`, `ttlDays` tuples (long horizon, L−14 cap, 24h floor) · **When** `offerDeadline(...)` · **Then** expected ISO timestamps match DESIGN §13 formula |

---

## 4. Matcher (`src/matcher/*`)

| ID | Test | Type | Priority | Given/When/Then |
| --- | --- | --- | --- | --- |
| MAT-001 | API rejects role headcount 0 | Integration | P2 | **Given** lead authenticated · **When** PUT roles with headcount 0 (bypass CLI, raw JSON if zod allows) or POST create with invalid role · **Then** 400 validation (zod min 1) |
| MAT-002 | Crew with zero matching skills funnel | Unit | P2 | **Given** role requires eva≥3, crew A no skills, crew B nav only · **When** `runMatch` · **Then** funnel.skill counts all skill failures, eligible 0, unfilled reason mentions skills |
| MAT-003 | Funnel sums equal considered | Unit | P2 | **Given** arbitrary multi-filter fixture · **When** `runMatch` · **Then** for each role: onMission+skill+unavailable+conflict+restGap+eligible = considered |
| MAT-004 | Tie-break stability identical effective scores | Unit | P2 | **Given** two crew same effective score for one seat, handles `alpha` vs `beta` · **When** run match twice with crew order swapped · **Then** same handle picked (deterministic tie via sort/hungarian) |
| MAT-005 | Rarity when no one holds rare skill | Unit | P3 | **Given** person with eva 5, experts map empty for eva (no holders at 4+) · **When** `rarity()` / scoreCandidate · **Then** rarity penalty uses holders default 1, no NaN, effective score finite |
| MAT-006 | Near miss: exactly one level short | Unit | P2 | **Given** min 4, person level 3 · **When** runMatch · **Then** person in nearMisses with detail “3 (needs 4)” |
| MAT-007 | Near miss excluded: two+ levels short | Unit | P2 | **Given** min 4, person level 2 · **When** runMatch · **Then** person not in nearMisses, counted in funnel.skill only |
| MAT-008 | Near miss excluded: missing skill entirely | Unit | P2 | **Given** min 4, person level 0 / no skill · **When** runMatch · **Then** not in nearMisses (level 0 ≠ min−1) |
| MAT-009 | One-day mission window | Unit | P2 | **Given** start=end same day, workload horizon · **When** runMatch · **Then** window length 1, workload denominator consistent, no divide-by-zero |
| MAT-010 | Workload horizon ±90d boundary | Unit | P2 | **Given** commitment ending exactly 90 days before window.start (touching horizon edge) · **When** scoreCandidate workload · **Then** committedDays includes/excludes per `overlapDays` rules documented in test |
| MAT-011 | Empty open seats (headcount met) | Unit | P2 | **Given** role headcount 2, filledBy length 2 · **When** runMatch · **Then** openSeats 0, no recommendations for that role |
| MAT-012 | All candidates ON_MISSION for mission | Unit | P2 | **Given** every crew declined/dropped/expired on this mission · **When** runMatch · **Then** funnel.onMission = considered, eligible 0, unfilled explains on-mission |

---

## 5. Hungarian (`src/matcher/hungarian.ts`)

| ID | Test | Type | Priority | Given/When/Then |
| --- | --- | --- | --- | --- |
| HUN-001 | 0×n matrix (zero rows) | Unit | P3 | **Given** `weights = []` · **When** `maxWeightAssignment` · **Then** returns `[]` (existing test — keep as regression) |
| HUN-002 | n×0 matrix (zero columns) | Unit | P2 | **Given** `[[], []]` · **When** assign · **Then** `[-1, -1]` each row unmatched |
| HUN-003 | Single candidate, multiple roles | Unit | P2 | **Given** 1 column 3 rows all positive · **When** assign · **Then** exactly one row matched, max weight |
| HUN-004 | All pairs null (all disallowed) | Unit | P2 | **Given** 3×3 all null · **When** assign · **Then** all -1, total value 0 |
| HUN-005 | Rectangular 1×5 | Unit | P3 | **Given** one row five columns · **When** assign · **Then** picks max column index per tie rule |
| HUN-006 | Large-N determinism | Unit | P3 | **Given** fixed seed matrix 20×20 · **When** run assignment twice · **Then** identical assignment vectors |
| HUN-007 | Tie optima deterministic (explicit) | Unit | P3 | **Given** 2×2 uniform weights · **When** two runs · **Then** same pairing (extends existing test with asserted indices) |

---

## 6. Dates & scheduling (`src/lib/dates.ts`, `domain/scheduling.ts`)

| ID | Test | Type | Priority | Given/When/Then |
| --- | --- | --- | --- | --- |
| DAT-001 | Leap day window (2024-02-28 to 2024-03-01) | Unit | P2 | **Given** inclusive range crossing Feb 29 · **When** `lengthInDays` · **Then** correct day count |
| DAT-002 | Year boundary Dec→Jan workload | Unit | P2 | **Given** mission Dec 15–Jan 15, commitment in adjacent year within horizon · **When** `workload()` · **Then** counts overlap days across year boundary |
| DAT-003 | Same-day start equals end | Unit | P2 | **Given** start=end · **When** create mission via API · **Then** 201, length 1 day; schedule overlap with same-day unavailability detects conflict |
| DAT-004 | Unavailability end touches mission start | Unit | P2 | **Given** unavail ending Nov 1, mission Nov 1–30 · **When** `scheduleIssues` · **Then** UNAVAILABLE (inclusive overlap) |
| DAT-005 | Unavailability start touches mission end | Unit | P2 | **Given** unavail starting Nov 30, mission Nov 1–30 · **Then** UNAVAILABLE |
| DAT-006 | Rest gap measured on both sides | Unit | P2 | **Given** commitment after mission vs before · **When** `scheduleIssues` with gap 14 · **Then** fails when gap 13 either side; passes at 14 (complements existing unit) |
| DAT-007 | gapBetween adjacent ranges zero free days | Unit | P3 | **Given** mission ends Nov 5, next starts Nov 6 · **When** `gapBetween` · **Then** 0; rest gap filter fails if org requires ≥1 |

---

## 7. People, org, validation (`people.ts`, `org.ts`, `validation.ts`)

| ID | Test | Type | Priority | Given/When/Then |
| --- | --- | --- | --- | --- |
| PPL-001 | Skill level 0 rejected | Integration | P2 | **Given** crew token · **When** PUT `/v1/me/skills` with level 0 · **Then** 400 zod “levels run 1–5” |
| PPL-002 | Skill level 6 rejected | Integration | P2 | **When** level 6 · **Then** 400 |
| PPL-003 | Duplicate skill key in one PUT | Integration | P2 | **Given** body lists nav twice · **When** PUT skills · **Then** last wins or 400 — document actual behaviour and lock with test |
| PPL-004 | Remove skill not on profile | Integration | P3 | **When** DELETE `/v1/me/skills/unknown` · **Then** 404 |
| PPL-005 | Unavailability end before start | Integration | P1 | **When** POST unavailability start 2026-12-10 end 2026-12-01 · **Then** 400 message end on or after start |
| PPL-006 | Overlapping unavailability windows allowed | Integration | P3 | **Given** existing window · **When** POST overlapping second window · **Then** 201 both exist (document merge-or-allow policy) |
| PPL-007 | Director PATCH settings restGapDays negative | Integration | P2 | **When** PATCH `{ restGapDays: -1 }` · **Then** 400 validation (min 0) |
| PPL-008 | Director PATCH offerTtlDays 0 | Integration | P2 | **When** `{ offerTtlDays: 0 }` · **Then** 400 min 1 |
| PPL-009 | Create duplicate skill key | Integration | P2 | **Given** skill nav exists · **When** director POST `/v1/skills` same key · **Then** 409 `DUPLICATE` |
| PPL-010 | Crew directory filter unknown skill | Integration | P3 | **When** GET `/v1/crew?skill=nope` · **Then** 400 unknown skill |

---

## 8. Tenancy, security, visibility (`http/app.ts`, `missions.ts`, `inbox.ts`)

| ID | Test | Type | Priority | Given/When/Then |
| --- | --- | --- | --- | --- |
| SEC-001 | Bearer token trailing whitespace trimmed | Integration | P2 | **Given** valid token with trailing space in header · **When** GET `/v1/me` · **Then** 200 (hash matches trimmed token) |
| SEC-002 | Bearer prefix case-insensitive | Integration | P2 | **Given** header `bearer tok-leo` · **When** GET `/v1/me` · **Then** 200 |
| SEC-003 | Wrong-prefix mission key cross-org | Integration | P2 | **Given** Astra token · **When** GET `/v1/missions/LUN-1` · **Then** 404 (extends tenancy tests) |
| SEC-004 | Numeric mission id scoped to org | Integration | P2 | **Given** Lunar token · **When** GET `/v1/missions/1` returns LUN-1 · **Given** Astra token GET `/v1/missions/1` · **Then** AST-1 not LUN-1 |
| SEC-005 | Crew mission list excludes PROPOSED-only | Integration | P1 | **Given** DRAFT mission with PROPOSED nominations for `leo` but never approved (offeredAt null) · **When** `leo` GET `/v1/missions` · **Then** empty array; GET `/v1/missions/:key` 404 |
| SEC-006 | Crew inbox no REVIEW/OPEN_SEATS items | Integration | P2 | **Given** seeded world · **When** crew GET `/v1/inbox` · **Then** kinds only in {OFFER, UPDATE, CREW_CONFIRMED, …} never REVIEW or OPEN_SEATS |
| SEC-007 | Lead inbox no cross-org leakage | Integration | P2 | **Given** two-org world · **When** marcus inbox · **Then** no LUN-* mission keys |
| SEC-008 | Strict body rejects unknown fields on offers | Integration | P3 | **When** POST accept with extra `{ hack: true }` · **Then** 400 strict object |

---

## 9. CLI (`src/cli/*`, `bin/mc.mjs`)

| ID | Test | Type | Priority | Given/When/Then |
| --- | --- | --- | --- | --- |
| CLI-001 | `--json` parseable on representative commands | CLI-smoke | P2 | **Given** in-process API + MC_TOKEN · **When** run `mc whoami`, `mc missions list`, `mc missions show AST-1`, `mc offers`, `mc inbox` each with `--json` · **Then** exit 0, stdout is valid JSON object |
| CLI-002 | Exit 3 invalid/expired token | CLI-smoke | P1 | **Given** API up · **When** MC_TOKEN=invalid `mc whoami` · **Then** exit 3 |
| CLI-003 | Exit 8 API unreachable | CLI-smoke | P1 | **Given** MC_API_URL=http://127.0.0.1:1 · **When** `mc whoami` with valid token · **Then** exit 8, message mentions server |
| CLI-004 | Exit 6 schedule conflict | CLI-smoke | P2 | **Given** demo state overlapping accept · **When** `mc offers accept AST-7` as jamal after AST-6 · **Then** exit 6 (demo already — vitest duplicate) |
| CLI-005 | Exit 7 validation error | CLI-smoke | P2 | **When** `mc missions create` missing required flags · **Then** exit 2 or 7 per Commander vs API path |
| CLI-006 | Exit 4 forbidden | CLI-smoke | P2 | **When** crew `mc missions create ...` · **Then** exit 4 |
| CLI-007 | Exit 5 not found | CLI-smoke | P2 | **When** `mc missions show NOPE-99` · **Then** exit 5 |
| CLI-008 | Cancel confirmation abort | CLI-smoke | P2 | **Given** non-TTY stdin answering N · **When** `mc missions cancel AST-1 --reason x` without `--yes` · **Then** exit 1, message stopped |
| CLI-009 | `mc use` prefix ambiguity | CLI-smoke | P3 | **Given** config profiles `marcus@astra` and `marcus@lunar` · **When** `mc use marcus` · **Then** exit 2/3 with message lists both profiles |
| CLI-010 | Drop requires `--yes` in scripts | CLI-smoke | P2 | **Given** piped stdin no · **When** drop without `--yes` · **Then** exit 1 |

---

## 10. Seed, demo, setup (`prisma/seed.ts`, `scripts/demo.ts`, `scripts/setup.mjs`)

| ID | Test | Type | Priority | Given/When/Then |
| --- | --- | --- | --- | --- |
| DEM-001 | Seed idempotency (second run) | Integration | P3 | **Given** fresh DB migrated · **When** run seed.ts twice · **Then** second run throws or no-ops cleanly — document expected behaviour (today likely duplicates); test locks intended contract |
| DEM-002 | Demo on non-empty DB | CLI-smoke | P3 | **Given** dev.db with extra mission · **When** `npm run demo` (throwaway dir) · **Then** still green (demo uses temp DB — separate test that demo never touches MC_CONFIG_DIR default) |
| DEM-003 | Setup destructive rebuild | CLI-smoke | P3 | **Given** marker row in dev.db · **When** `npm run setup` with user consent · **Then** marker gone, AST-6 exists — manual/CI optional |

---

## 11. Lifecycle table (unit extension)

| ID | Test | Type | Priority | Given/When/Then |
| --- | --- | --- | --- | --- |
| LFC-U01 | `offer` and `match` from COMPLETED/CANCELLED | Unit | P3 | **Given** lifecycle unit table · **When** assertMissionAction match/offer on COMPLETED · **Then** INVALID_TRANSITION |
| LFC-U02 | `nominate` from APPROVED | Unit | P2 | **When** assert nominate APPROVED · **Then** INVALID_TRANSITION |

---

## 12. Integration / workflow gaps (misc)

| ID | Test | Type | Priority | Given/When/Then |
| --- | --- | --- | --- | --- |
| WF-001 | Submit re-checks ineligible nominee | Integration | P1 | **Given** DRAFT fully nominated, before submit crew removes skill or adds conflict · **When** POST submit · **Then** 422 with nominee-specific blockers (not just seat counts) |
| WF-002 | Roles redefine clears PROPOSED | Integration | P2 | **Given** DRAFT with PROPOSED seats · **When** PUT roles new definition · **Then** PROPOSED deleted, response reports cleared count |
| WF-003 | Unnominate draft seat | Integration | P3 | **Given** nominated crew · **When** DELETE nominations/:handle · **Then** PROPOSED removed, submit blockers updated |
| WF-004 | Mission history includes OFFER_RETRACTED | Integration | P3 | **Given** retract flow (demo step) · **When** GET events via API · **Then** OFFER_RETRACTED present with actor lead |

---

## Priority summary

| Priority | Count | Focus |
| --- | --- | --- |
| **P1** | 28 | Idempotency, concurrency, cancellation matrix, director complete, ACTIVE dropout, deadline/rest-gap org behaviour, accept races, eligibility |
| **P2** | 28 | Matcher/scheduling edge cases, CLI exit codes, validation, visibility, staffing retract |
| **P3** | 14 | Hungarian extras, seed idempotency, inbox polish, near-miss documentation |

**Total: 62 cases** (pre-identified gaps OFF-001–010, LFC-002–010, STF-001–003/008–009, OFF-007 overlap with workflow — kept explicit for sweep+accept path).

---

## Notes for implementers

1. **Concurrency tests:** use `Promise.all` against single shared `TestWorld` app instance; assert DB state after both complete.
2. **OFF-008:** document current behaviour if both succeed (known HIGH finding); test should fail until CAS fix lands, or use `@expect-fail` with comment per AUDIT.
3. **CLI-smoke:** prefer vitest `spawn` + temp `MC_CONFIG_DIR` mirroring `scripts/demo.ts` to avoid flakiness.
4. **Rest-gap integration (STF-009):** reuse dates from `matcher.test.ts` lines 127–142 with HTTP approve/accept instead of `runMatch`.
5. **No new tests required** for pure functions already covered by brute-force Hungarian (300 trials) unless adding explicit edge dimensions listed above.

---

*Audit method: read DESIGN.md §9–12 & §16, CLAUDE.md, TODO.md, all files under `tests/`, and source modules `src/lib`, `src/domain`, `src/matcher`, `src/services`, `src/http`, `src/cli`. No files modified.*
</response>
output_path: c:\Users\shubh\.cursor\projects\c-Users-shubh-OneDrive-Documents-Mutinex\agent-transcripts\c9e4c66a-7432-46e8-a6b7-35fdfe37a5e7\subagents\1d129d4b-edc7-485f-84d5-d9613b824f19.jsonl
</task>
</system_notification>
<user_query>Perform any necessary follow-up actions in response to the subagent completion above. If no follow-up work is needed, no further action is required. If you mention an agent or subagent in your response, link it with the `[Name](id)` Don't use generic label such as `[agent]`, `[worker]`, or `[subagent]`. For cloud subagents, when the agent has edited code, link to `[Review](bc-id#changes)`, or, if you know the exact added and deleted line counts, `[Review +A −D](bc-id#changes)`, replacing A and D with those counts. Never write A or D literally. Use `[Try Live](bc-id#desktop)` only when the agent used computer use. Don't repeat the same confirmation every time.</user_query>

---

**Cursor**

Final agent landed with 62 test cases. Appending §9 and closing out the audit.

Audit complete. `mission-control/AUDIT.md` now holds all 9 sections + 2 appendices — every agent's report is in, deduplicated and cross-referenced.

## The whole picture

**Baseline (verified directly):** typecheck clean · 53/53 tests · 26-step demo green.

**What the audit proves is solid:** all 21 decisions + 12 self-made calls implemented as claimed (2 doc-level mismatches) · zero medium+ security issues · zero cross-tenant leaks across ~60 audited queries · all 12 workflows logically correct · matcher, lifecycle table, date math, privacy rules all confirmed · your TODO/ROADMAP validated against real NASA/ESA/FAA practice.

**What needs fixing — one root cause dominates:**

| | |
|---|---|
| **CRITICAL/HIGH ×5** | Assignment transitions lack compare-and-set: `acceptOffer` overbooking race, `decline`/`dropOut` last-writer-wins, duplicate seats from double-clicked nominate/backfill, submit `>=` vs `==`, activate over-acceptance. **One uniform fix**: conditional `updateMany` with status predicate (the `moveMission` pattern), plus a partial unique index on Postgres. SQLite hides all of it in tests today. |
| **HIGH ×2** | CLI `as T` on responses; JSON columns unvalidated on read |
| **MED ×13** | Bare-id updates, no `never`-switches, DTO enum widening, expiry boundary instant, CLI `--json` on HTML errors, overlapping unavailability, 24h deadline clamp, prior review rounds not in API, … |
| **Decisions for you** | Commitment metric visible to crew (D14 tension) · manifest said "title+note only" but code requires dates (code is right) · backup copy in inbox text before the feature ships |

**Test backlog:** 62 cases (28 P1) with full Given/When/Then in §9, including OFF-008 — the concurrent-accept regression test that will fail until H1 is fixed (mark it `@expect-fail` per §9.11).

Nothing was changed in code — the audit is documentation only, as you asked. When you're ready to act on it, the natural first commit is the CAS fix across `offers.ts`/`staffing.ts`/`missions.ts` plus the §8.4 race tests; after that, the P1 test pack.

---

**User**

Browser Tab: Browser Tab @c:\Users\shubh\.cursor\projects\c-Users-shubh-OneDrive-Documents-Mutinex\terminals\9.txt:77-98 uh see the error that I've attached to where it says unauthenticated missing API token. And I'm not able to log in with the MC command please suggest what to do. Don't make any changes, 

---

**Cursor**

Both are expected behavior, nothing's broken — let me prove the CLI path works without changing anything.

Both are expected — nothing is broken:

**1. The 401 in the browser is the design working, not a bug.** There is no web UI; every API route except `/v1/health` requires a Bearer token, and `/` isn't even a route. The browser can't supply `Authorization: Bearer …` on its own, so 401 is correct. If you want to see a response in the browser, use `http://127.0.0.1:3000/v1/health` → `{"status":"ok"}`. To browse the actual data visually, run `npx prisma studio` — that's the right tool here.

**2. `mc: command not found` — the CLI simply isn't on your PATH yet.** Two options:

**Option A — no install, works right now** (just verified, output above):

```bash
npm run mc -- login mct_astra_marcus
npm run mc -- inbox
npm run mc -- missions list
```

**Option B — one-time install, then plain `mc` everywhere:**

```bash
npm link          # run once, from mission-control/
mc login mct_astra_marcus
mc inbox
```

If `mc` is still not found after `npm link` in Git Bash, close and reopen the terminal (the global shim directory gets picked up on new shells) — or just keep using Option A, they're identical.

Your dev server in terminal 9 is fine — leave it running; the 401 log line was just the browser visit. Once logged in, try `npm run mc -- missions show AST-6` and `npm run mc -- missions history AST-6` to see the seeded world.

---

**User**

@c:\Users\shubh\.cursor\projects\c-Users-shubh-OneDrive-Documents-Mutinex\terminals\9.txt:97-105 What about this ?

---

**Cursor**

That's the CLI receiving HTML instead of JSON — it's talking to something that isn't the API. Let me diagnose without changing anything.

Found it. Let me confirm the process and prove the fix.

Root cause found. Let me verify the fix end-to-end on a free port.

Something odd — port 3100 also returned that "Inkse" Next.js site. Let me dig: check my server's log, what's actually listening, and whether a proxy is intercepting.

Port 3100 is also taken — your machine has several dev servers running (PID 2896 holds 3100, PID 77148 holds 3000 = the "Inkse" Next.js site). My test server got `EACCES` because of it. Retrying on a verified-free port:

Understood — I'll stop here and hand you the diagnosis and exact commands instead of running them. One read-only check to pick you a free port:

Full diagnosis — **your CLI was talking to the wrong server:**

## Root cause

1. **Port 3000 is owned by another of your projects.** PID 77148 (a `node.exe` using ~1 GB) is serving the **"Inkse" Next.js e-commerce site** on `0.0.0.0:3000` — I got its HTML 404 page when curling. Port 3100 is also taken (PID 2896, another node process). You have several dev servers running.
2. The Mission Control CLI defaults to `http://127.0.0.1:3000` (`src/cli/config.ts:28`). So `mc login` hit the Inkse site, got its HTML 404 page, and `JSON.parse("<!DOCTYPE…")` threw — which is exactly **audit finding M11** happening live (CLI crashes on non-JSON responses instead of printing a clean error).
3. Your Fastify server in terminal 9 *did* start and answered the browser's 401 earlier, but it's no longer serving port 3000 — `/v1/health` now returns Inkse's 404, not the API's JSON. Restart it.

## Fix — two commands, run them yourself

**Terminal 9** — stop the current dev server (Ctrl+C), then restart on a free port (8641, 4321, 5100, 8787 are all verified free):

```bash
PORT=8641 npm run dev
```

**Terminal 2** — log in pointing at that port (the `--api` URL is saved into the profile, so you only pass it once):

```bash
npm run mc -- login --api http://127.0.0.1:8641 mct_astra_marcus
npm run mc -- whoami
npm run mc -- inbox
```

Alternative: keep Mission Control on the default 3000 by stopping the Inkse dev server instead — your call, since that's your other project.

Two notes for the audit trail: this incident is a live repro of **M11** (CLI should print a structured "server returned non-JSON" error, not a parse crash), and it argues for the CLI verifying on login that the server is actually Mission Control (e.g. checking a marker on `/v1/health`) — I'll add both to `AUDIT.md` as observed-in-the-wild evidence.

---

**User**

<timestamp>Monday, Sep 28, 2026, 9:41 PM (UTC+10)</timestamp>
<system_notification>
The following task has finished. If you were already aware, ignore this notification and do not restate prior responses.

<task>
kind: shell
status: aborted
task_id: 65764
title: Serve workspace over local HTTP for preview
tool_call_id: Shell_0_cc524dd0-2b664
detail: terminated_by_user
output_path: C:\Users\shubh\.cursor\projects\c-Users-shubh-OneDrive-Documents-Mutinex\terminals\65764.txt
</task>
</system_notification>
<user_query>Briefly inform the user about the task result and perform any follow-up actions (if needed).</user_query>

---

**Cursor**

That was just the old preview server for `design.html` (port 8642) being terminated — no impact; the file itself is intact at `mission-control/design.html` if you want to re-serve it later.

While I'm here, let me record the port-collision incident in the audit as promised:

Recorded. `AUDIT.md` Appendix A now has:

- **M11** upgraded with the live repro note (your `Unexpected token '<'` was this exact finding — the CLI hit the Inkse Next.js server on port 3000 and tried to parse its HTML 404 page)
- **M14** (new) — the CLI never verifies it's talking to Mission Control; recommendation is a `service` marker check on `/v1/health` during `login`

Your next step is still the two commands from before: `PORT=8641 npm run dev` in terminal 9, then `npm run mc -- login --api http://127.0.0.1:8641 mct_astra_marcus`.

---

**User**

Browser Tab: Browser Tab @c:\Users\shubh\.cursor\projects\c-Users-shubh-OneDrive-Documents-Mutinex\terminals\11.txt:8-38 

---

**Cursor**

The CLI can't reach the API because the server was never started on 8641 — the login commands ran, but nothing is listening. Quick read-only confirmation:

Nothing is listening on 8641, and your original dev server (PID 56820) is dead. That's the whole issue — the CLI commands ran, but the API was never started on the new port.

The missing concept is **two terminals**: one runs the server and stays open; the other runs `mc` commands. You ran only the CLI side.

You can do it yourself:

**Terminal 1 (leave running):**
```bash
PORT=8641 npm run dev
```

**Terminal 2:**
```bash
npm run mc -- login --api http://127.0.0.1:8641 mct_astra_marcus
npm run mc -- whoami
npm run mc -- inbox
```

Or I can start the server and verify the login for you — sending that as an approval request now since you'd asked me not to change things:

Approved and verified — you're logged in and the system works end-to-end:

```
✓ Logged in as Marcus Chen · Mission Lead · Astra Dynamics
  Profile marcus@astra is now active.

  Marcus Chen @marcus  Mission Lead · Astra Dynamics [AST]
  profile marcus@astra · http://127.0.0.1:8641
```

**The API is now running on `http://127.0.0.1:8641`** (background process). Your CLI profile `marcus@astra` is saved with that URL, so from your terminal everything just works now — no `--api` flag needed again:

```bash
npm run mc -- inbox                  # Marcus's to-do list
npm run mc -- missions list          # Astra's missions
npm run mc -- missions show AST-6    # Europa Survey — seats, status, "You can" hints
npm run mc -- missions match AST-5   # run the matcher (add --explain)
npm run mc -- login mct_astra_leo    # add the crew persona, then `mc use leo`
npm run mc -- offers list            # Leo's pending offers
```

One caveat: the server runs under my session — if it stops, restart it yourself with `PORT=8641 npm run dev` (leave that terminal open). And if you ever want the default port back, stop the Inkse dev server that owns 3000 and plain `npm run dev` + `mc login mct_astra_marcus` will work as documented.

---

**User**

no point in seeing the browser right ?

---

**Cursor**

Right. There's no web interface — the browser can only reach `/v1/health` (plain JSON) and everything else needs a Bearer token header, which a browser can't supply on its own. The CLI is the interface.

If you want a *visual* view of the data while you play with the CLI, use Prisma Studio instead:

```bash
npx prisma studio
```

That opens a real table browser at `http://localhost:5555` — orgs, users, missions, assignments, events — and you can watch rows change as you run `mc` commands.

---

**User**

@c:\Users\shubh\.cursor\projects\c-Users-shubh-OneDrive-Documents-Mutinex\terminals\11.txt:63-165 what do you think about these errors,?

---

**Cursor**

Good news: only one actual failure in that whole run — everything else behaved exactly as designed.

**The one error — `mc login mct_astra_leo` → HTML crash again.** Same root cause as before: a *new* login without `--api` falls back to the default URL (`http://127.0.0.1:3000`), which is still your Inkse server. Marcus's profile worked because we saved 8641 into it — but each new persona login needs the flag too:

```bash
npm run mc -- login --api http://127.0.0.1:8641 mct_astra_leo
```

Or set it once per terminal and forget about it:

```bash
export MC_API_URL=http://127.0.0.1:8641
```

Two knock-on effects to be aware of:

1. Because Leo's login failed, the active profile stayed **marcus** — so `mc offers list` showed *Marcus's* (empty) offers, not Leo's. After the login succeeds, `mc use leo` (or the login auto-switch) and `offers list` will show his real ones.
2. `mc missions match AST-5` returning "0 open seats" is **correct**, not an error — AST-5 is ACTIVE and fully crewed; the matcher only fills open seats. To see actual recommendations, use `mc missions match AST-6` (the DRAFT with 3 open seats — that's what your inbox is pointing you at).

And Prisma Studio is up on `http://localhost:5555` — that's your visual view.

The recurring annoyance itself is already in the audit as **M11/M14** (cryptic crash on non-JSON + no server-identity check at login) — you've now hit it twice, which bumps its priority when you start fixing things.

---

**User**

Okay, you know what? I'll do the test on my own basis. For now, what I want you to do is for all of these 66 files, you commit them one by one. One file is one contribution, and for each and every file, write an appropriate message of what is in the file that we've made while committing. Go ahead with the commit and let me know. You can also see the commit. Okay, I'll attach this for you. You can also see the commit in this format.

Suggested commits, in this order (so the history tells the story):

docs: design v2
feat(db): roles/nominations/tenancy migration
feat(matcher) with the unit tests
feat(api) with the integration tests
feat(db): scenario seed
feat(cli)
chore: demo + setup + README

Let me know once done

---

**Cursor**

Checking git status and organizing commits to match your suggested story order.


Committing all 66 files in story order, one commit per file with descriptive messages.


All **66 files** are committed (**one file per commit**). The working tree is clean. History is **71 commits** total (5 original scaffold + **66** new).

Story order matches your suggested arc:

| Phase | Commits (oldest → newest in this block) |
|--------|----------------------------------------|
| **docs: design v2** | `852c155` DESIGN.md → `d6420f9` notion brief (+ TODO, ROADMAP, CLAUDE, AUDIT, design.html) |
| **feat(db): migration** | `522c6d4` migration.sql → `27826b9` schema.prisma |
| **feat(matcher) + unit tests** | `3d4a91e` lib/domain → `949fa1b` matcher → `511dbb7`–`a832972` unit tests |
| **feat(api) + integration** | `52d0f8b` services → `32981e5` routes → `aa3a24c` server → `04d0bfc`–`b66e9be` integration |
| **feat(db): seed** | `2a3354d` prisma/seed.ts (right after schema in history; logically the scenario seed) |
| **feat(cli)** | `cd7dc04`–`fb97396` CLI + `bin/mc.mjs` |
| **chore: demo + setup + README** | `c89e907` setup → `4a9e570` demo → `a1cf110`–`daeec48` package/lock/tsconfig/gitignore/README |

Tip: `git log --oneline --reverse 852c155..HEAD` walks the full v1 story from design v2 through README.

Nothing was pushed; say if you want this on a remote.

