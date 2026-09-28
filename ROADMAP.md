# Roadmap — what we would build with more time

The slice we shipped is described in [DESIGN.md](./DESIGN.md); the immediate next steps are in [TODO.md](./TODO.md). This document covers what comes after: **v2** (the next product increment) and **v3** (platform scale). Each item names the design hook that already exists, so none of it needs a rewrite.

---

## v2 — product depth

### Approval modes (per organisation)

v1 ships **one** policy, chosen deliberately (DESIGN.md D5):
- a submitted mission goes to a director;
- the director **approves**, **rejects with a note** (the lead edits and resubmits), or **cancels**;
- nobody reviews a mission they created.

Organisations really do differ here (the brief says so), so v2 makes the policy configurable. Modes considered:

| Mode | How it works | Good for | Risk / safeguard |
| --- | --- | --- | --- |
| **Director review** *(v1)* | Any director other than the creator decides. | Small and medium organisations. | Directors become a bottleneck; add delegation. |
| **Peer review** | A director **or** a mission lead other than the creator. | Fast-moving teams with many leads. | "Syndicate" risk — leads approving each other's missions. Safeguards: no reciprocal approvals within N days, director countersign above a risk threshold, audit report of approver pairs. |
| **N-of-M** | e.g. 2 of the directors must approve; any rejection rejects. | High-stakes missions, agencies. | Slower; needs a deadline and escalation. |
| **Risk tiers** | Rules choose the policy: e.g. > 4 crew or > 30 days → 2 directors; ≤ 2 crew and ≤ 7 days → lead peer review. | Mixed portfolios. | Rules must be visible to leads before they submit. |
| **Sequential chain** | Named approver roles in order: safety officer → flight surgeon → director. | Agencies with specialist sign-offs. | Needs new roles or approver groups. |
| **Auto-approve templates** | Missions created from an approved template, unchanged, skip review. | Routine resupply or rotation missions. | Only for templates; any change needs review. |
| **Delegation** | A director names a stand-in while away (time-boxed). | All modes. | Logged; the stand-in cannot approve their own missions. |

**Design hooks already in place:**
- **Review rounds.** `mission_submissions` is already a per-round record with a snapshot, decision, decider and note.
- **Data model.** Add `approval_policies (org_id, mode, rules jsonb)` and `mission_approvals (submission_id, approver_id, decision, note)`.
- **Rules as data.** The `approve` rule in `MISSION_RULES` gains a policy evaluator instead of the fixed `directorNotOwner`.
- **Rejections and rounds.** Any rejection ends the round; approvals reset when a mission is resubmitted.
- **UI.** The CLI shows the progress, e.g. *"1 of 2 approvals · waiting on: Nora"*.

### Rescheduling after approval (launch slips)

Launch dates slip constantly in real life. The flow:
- `mc missions reschedule <key> --start … --end …` re-runs the schedule rules for every accepted crew member against the new window.
- Anyone who now conflicts or hits the rest gap is released **without penalty**, and their seat reopens (D7).
- **Changing dates alone does not need re-approval; changing roles does.**
- Offer deadlines are recomputed.

This replaces v1's removed "amend" flow.

### Notifications outbox

- Every inbox-worthy event writes an `outbox` row in the same transaction.
- A worker delivers it by email, webhook or Slack, with retries and idempotency keys.
- The CLI inbox stays the source of truth; delivery is best-effort on top.

### Certifications that expire

`crew_skills.expires_at` becomes a hard filter: the qualification must be valid through the mission's **end** date. Medical and EVA qualifications expire in reality. Leads get a warning when a nominee's certification lapses between nomination and launch.

### Per-organisation matching policy

- **Weights:** skill / workload / experience / commitment move from constants to org settings.
- **Thresholds:** the rarity cap and the workload horizon become org settings too.
- **Validation:** weights must sum to 1.
- **Explanations** quote the org's own weights.
- **Preview:** `mc org settings set --weights …` shows how the current drafts would change before saving.

### Crew compatibility and pairing rules

- Constraints: "must fly with" (mentor + first-flight crew) and "must not fly together".
- They add hard constraints to the assignment problem. The Hungarian step becomes a small integer program or a constrained search; mission sizes keep it cheap.

### Direct-assignment mode

For agencies that assign rather than offer (DESIGN.md §3): an org setting under which approval creates `ACCEPTED` seats directly, with an acknowledgement step instead of accept/decline.

### Leads and directors who also fly

Promoted to TODO.md §6 after review: a "flies" flag independent of role, with conflict-of-interest rules (no self-nomination, no reviewing a mission you crew).

---

## v3 — platform scale

- **Portfolio optimisation.** Match several upcoming missions together, so scarce people go where they matter most. The rarity penalty is v1's stand-in for this. Approach: a min-cost flow across missions, or a rolling horizon.
- **Resource and equipment constraints.** `resources` and `mission_resource_requirements` tables (vehicles, suits, simulator slots). The matcher gains a feasibility pre-check, and the scheduler gains resource calendars.
- **Postgres + GCP.** Cloud SQL with row-level security as a second tenancy wall, exclusion constraints for double booking (TODO.md §7), Cloud Run for the API, Secret Manager for signing keys.
- **Identity.** Multi-org users (`memberships(user_id, org_id, role)` — the auth context is already a (user, org, role) tuple), SSO/OIDC per org, scoped and expiring tokens with rotation.
- **Operational maturity.** Request IDs and structured logs to a central sink; metrics (time-to-staff, decline rate, override rate); rate limiting; cursor pagination everywhere.
- **Fairness and utilisation analytics.** Who carries the load, how often the matcher's pick is overridden and why, rest-gap violations prevented, crew burnout risk.
- **Mission templates and recurring missions.** Clone roles and requirements; combined with auto-approve templates (above).
- **Web interface.** The API already returns `allowedActions` and explanations, which is exactly what a UI needs.
