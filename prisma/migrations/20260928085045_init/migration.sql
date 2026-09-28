-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "settings" TEXT NOT NULL DEFAULT '{}',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "api_key" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "users_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "skills" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    CONSTRAINT "skills_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "crew_skills" (
    "user_id" TEXT NOT NULL,
    "skill_id" TEXT NOT NULL,
    "proficiency" INTEGER NOT NULL,

    PRIMARY KEY ("user_id", "skill_id"),
    CONSTRAINT "crew_skills_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "crew_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "availability_windows" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "start_date" DATETIME NOT NULL,
    "end_date" DATETIME NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'UNAVAILABLE',
    "note" TEXT,
    CONSTRAINT "availability_windows_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "missions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "org_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "start_date" DATETIME NOT NULL,
    "end_date" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "created_by" TEXT NOT NULL,
    "approved_by" TEXT,
    "rejection_reason" TEXT,
    "submission_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "missions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "missions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "missions_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "mission_skill_requirements" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mission_id" TEXT NOT NULL,
    "skill_id" TEXT NOT NULL,
    "min_proficiency" INTEGER NOT NULL,
    "headcount" INTEGER NOT NULL,
    CONSTRAINT "mission_skill_requirements_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "missions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "mission_skill_requirements_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "assignments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mission_id" TEXT NOT NULL,
    "requirement_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OFFERED',
    "match_score" REAL NOT NULL,
    "score_breakdown" TEXT NOT NULL,
    "decline_reason" TEXT,
    "offered_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" DATETIME,
    CONSTRAINT "assignments_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "missions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "assignments_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "mission_skill_requirements" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "mission_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "org_id" TEXT NOT NULL,
    "mission_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT,
    "payload" TEXT NOT NULL DEFAULT '{}',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mission_events_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "mission_events_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "missions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "mission_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_api_key_key" ON "users"("api_key");

-- CreateIndex
CREATE INDEX "users_org_id_idx" ON "users"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "skills_org_id_name_key" ON "skills"("org_id", "name");

-- CreateIndex
CREATE INDEX "crew_skills_skill_id_proficiency_idx" ON "crew_skills"("skill_id", "proficiency");

-- CreateIndex
CREATE INDEX "availability_windows_user_id_start_date_end_date_idx" ON "availability_windows"("user_id", "start_date", "end_date");

-- CreateIndex
CREATE INDEX "missions_org_id_status_idx" ON "missions"("org_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "mission_skill_requirements_mission_id_skill_id_key" ON "mission_skill_requirements"("mission_id", "skill_id");

-- CreateIndex
CREATE INDEX "assignments_mission_id_status_idx" ON "assignments"("mission_id", "status");

-- CreateIndex
CREATE INDEX "assignments_user_id_status_idx" ON "assignments"("user_id", "status");

-- CreateIndex
CREATE INDEX "mission_events_mission_id_idx" ON "mission_events"("mission_id");

-- CreateIndex
CREATE INDEX "mission_events_org_id_idx" ON "mission_events"("org_id");
