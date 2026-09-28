-- Design v2 reshape (pre-release; no production data exists yet):
--   * requirements move from mission-level skills to mission_roles + role_skill_requirements
--   * every tenant-owned table gains org_id; relations become composite (org_id, id) FKs
--   * assignments gain kind/role/expiry; approvals move to mission_submissions
--   * API tokens are stored hashed; users gain per-org handles; orgs gain settings + key prefix
-- Existing dev databases must be rebuilt: `npm run setup` (reset + migrate + seed).

-- DropIndex
DROP INDEX "availability_windows_user_id_start_date_end_date_idx";

-- DropIndex
DROP INDEX "mission_skill_requirements_mission_id_skill_id_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "availability_windows";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "mission_skill_requirements";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "unavailability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "org_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "start_date" DATETIME NOT NULL,
    "end_date" DATETIME NOT NULL,
    "note" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "unavailability_org_id_user_id_fkey" FOREIGN KEY ("org_id", "user_id") REFERENCES "users" ("org_id", "id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "mission_roles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "org_id" TEXT NOT NULL,
    "mission_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "headcount" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    CONSTRAINT "mission_roles_org_id_mission_id_fkey" FOREIGN KEY ("org_id", "mission_id") REFERENCES "missions" ("org_id", "id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "role_skill_requirements" (
    "org_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "skill_id" TEXT NOT NULL,
    "min_proficiency" INTEGER NOT NULL,

    PRIMARY KEY ("role_id", "skill_id"),
    CONSTRAINT "role_skill_requirements_org_id_role_id_fkey" FOREIGN KEY ("org_id", "role_id") REFERENCES "mission_roles" ("org_id", "id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "role_skill_requirements_org_id_skill_id_fkey" FOREIGN KEY ("org_id", "skill_id") REFERENCES "skills" ("org_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "mission_submissions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "org_id" TEXT NOT NULL,
    "mission_id" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "submitted_by_id" TEXT NOT NULL,
    "submitted_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "snapshot" JSONB NOT NULL,
    "decision" TEXT NOT NULL DEFAULT 'PENDING',
    "decided_by_id" TEXT,
    "decided_at" DATETIME,
    "note" TEXT,
    CONSTRAINT "mission_submissions_org_id_mission_id_fkey" FOREIGN KEY ("org_id", "mission_id") REFERENCES "missions" ("org_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "mission_submissions_org_id_submitted_by_id_fkey" FOREIGN KEY ("org_id", "submitted_by_id") REFERENCES "users" ("org_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "mission_submissions_org_id_decided_by_id_fkey" FOREIGN KEY ("org_id", "decided_by_id") REFERENCES "users" ("org_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_assignments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "org_id" TEXT NOT NULL,
    "mission_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'PRIMARY',
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "score" REAL NOT NULL,
    "score_breakdown" JSONB NOT NULL,
    "reason" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "offered_at" DATETIME,
    "expires_at" DATETIME,
    "responded_at" DATETIME,
    "closed_at" DATETIME,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "assignments_org_id_mission_id_fkey" FOREIGN KEY ("org_id", "mission_id") REFERENCES "missions" ("org_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "assignments_org_id_mission_id_role_id_fkey" FOREIGN KEY ("org_id", "mission_id", "role_id") REFERENCES "mission_roles" ("org_id", "mission_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "assignments_org_id_user_id_fkey" FOREIGN KEY ("org_id", "user_id") REFERENCES "users" ("org_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_assignments" ("id", "mission_id", "offered_at", "responded_at", "score_breakdown", "status", "user_id") SELECT "id", "mission_id", "offered_at", "responded_at", "score_breakdown", "status", "user_id" FROM "assignments";
DROP TABLE "assignments";
ALTER TABLE "new_assignments" RENAME TO "assignments";
CREATE INDEX "assignments_org_id_mission_id_status_idx" ON "assignments"("org_id", "mission_id", "status");
CREATE INDEX "assignments_org_id_user_id_status_idx" ON "assignments"("org_id", "user_id", "status");
CREATE TABLE "new_crew_skills" (
    "org_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "skill_id" TEXT NOT NULL,
    "proficiency" INTEGER NOT NULL,
    "updated_at" DATETIME NOT NULL,

    PRIMARY KEY ("user_id", "skill_id"),
    CONSTRAINT "crew_skills_org_id_user_id_fkey" FOREIGN KEY ("org_id", "user_id") REFERENCES "users" ("org_id", "id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "crew_skills_org_id_skill_id_fkey" FOREIGN KEY ("org_id", "skill_id") REFERENCES "skills" ("org_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_crew_skills" ("proficiency", "skill_id", "user_id") SELECT "proficiency", "skill_id", "user_id" FROM "crew_skills";
DROP TABLE "crew_skills";
ALTER TABLE "new_crew_skills" RENAME TO "crew_skills";
CREATE INDEX "crew_skills_org_id_skill_id_proficiency_idx" ON "crew_skills"("org_id", "skill_id", "proficiency");
CREATE TABLE "new_mission_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "org_id" TEXT NOT NULL,
    "mission_id" TEXT NOT NULL,
    "actor_id" TEXT,
    "type" TEXT NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT,
    "payload" JSONB NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mission_events_org_id_mission_id_fkey" FOREIGN KEY ("org_id", "mission_id") REFERENCES "missions" ("org_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "mission_events_org_id_actor_id_fkey" FOREIGN KEY ("org_id", "actor_id") REFERENCES "users" ("org_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_mission_events" ("actor_id", "created_at", "from_status", "id", "mission_id", "org_id", "payload", "to_status") SELECT "actor_id", "created_at", "from_status", "id", "mission_id", "org_id", "payload", "to_status" FROM "mission_events";
DROP TABLE "mission_events";
ALTER TABLE "new_mission_events" RENAME TO "mission_events";
CREATE INDEX "mission_events_org_id_mission_id_created_at_idx" ON "mission_events"("org_id", "mission_id", "created_at");
CREATE TABLE "new_missions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "org_id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "start_date" DATETIME NOT NULL,
    "end_date" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "owner_id" TEXT NOT NULL,
    "cancel_reason" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "missions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "missions_org_id_owner_id_fkey" FOREIGN KEY ("org_id", "owner_id") REFERENCES "users" ("org_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_missions" ("created_at", "description", "end_date", "id", "org_id", "start_date", "status", "title", "updated_at") SELECT "created_at", "description", "end_date", "id", "org_id", "start_date", "status", "title", "updated_at" FROM "missions";
DROP TABLE "missions";
ALTER TABLE "new_missions" RENAME TO "missions";
CREATE INDEX "missions_org_id_status_idx" ON "missions"("org_id", "status");
CREATE UNIQUE INDEX "missions_org_id_id_key" ON "missions"("org_id", "id");
CREATE UNIQUE INDEX "missions_org_id_number_key" ON "missions"("org_id", "number");
CREATE TABLE "new_organizations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "key_prefix" TEXT NOT NULL,
    "mission_seq" INTEGER NOT NULL DEFAULT 0,
    "rest_gap_days" INTEGER NOT NULL DEFAULT 14,
    "offer_ttl_days" INTEGER NOT NULL DEFAULT 7,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_organizations" ("created_at", "id", "name", "slug") SELECT "created_at", "id", "name", "slug" FROM "organizations";
DROP TABLE "organizations";
ALTER TABLE "new_organizations" RENAME TO "organizations";
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");
CREATE UNIQUE INDEX "organizations_key_prefix_key" ON "organizations"("key_prefix");
CREATE TABLE "new_skills" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "org_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    CONSTRAINT "skills_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_skills" ("description", "id", "name", "org_id") SELECT "description", "id", "name", "org_id" FROM "skills";
DROP TABLE "skills";
ALTER TABLE "new_skills" RENAME TO "skills";
CREATE UNIQUE INDEX "skills_org_id_id_key" ON "skills"("org_id", "id");
CREATE UNIQUE INDEX "skills_org_id_key_key" ON "skills"("org_id", "key");
CREATE UNIQUE INDEX "skills_org_id_name_key" ON "skills"("org_id", "name");
CREATE TABLE "new_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "org_id" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "users_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_users" ("created_at", "email", "id", "name", "org_id", "role") SELECT "created_at", "email", "id", "name", "org_id", "role" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_token_hash_key" ON "users"("token_hash");
CREATE UNIQUE INDEX "users_org_id_id_key" ON "users"("org_id", "id");
CREATE UNIQUE INDEX "users_org_id_handle_key" ON "users"("org_id", "handle");
CREATE UNIQUE INDEX "users_org_id_email_key" ON "users"("org_id", "email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "unavailability_org_id_user_id_start_date_idx" ON "unavailability"("org_id", "user_id", "start_date");

-- CreateIndex
CREATE UNIQUE INDEX "mission_roles_org_id_id_key" ON "mission_roles"("org_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "mission_roles_org_id_mission_id_id_key" ON "mission_roles"("org_id", "mission_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "mission_roles_mission_id_name_key" ON "mission_roles"("mission_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "mission_submissions_mission_id_round_key" ON "mission_submissions"("mission_id", "round");

