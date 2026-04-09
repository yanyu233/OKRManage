# Route C Node Prisma MySQL Foundation Design

**Date:** 2026-04-09

**Status:** Approved-for-planning draft

## 1. Goal

Build the next production foundation for Route C on top of the new `Node.js + TypeScript + NestJS` backend by introducing:

- `Prisma + MySQL` as the first real persistence layer
- a repository boundary above Prisma
- a production-ready organization and permission base
- a path to replace local-debug stubs without disturbing the existing MVP

This phase is intentionally not the full OKR rewrite. It creates the durable backend spine that later phases will use for enterprise WeCom login, OKR entities, scoring, proofs, audit, and admin configuration.

## 2. Why This Phase Exists

The current Route C foundation already has:

- a runnable NestJS backend
- externalized runtime config
- a health endpoint
- a local debug login skeleton
- smoke and e2e verification

It still lacks:

- persistent users and sessions
- organization storage in MySQL
- role assignment persistence
- a formal repository abstraction
- a database-backed admin configuration surface

Without this layer, later work such as WeCom login, role switching, audit logging, and OKR persistence would either remain stubbed or be implemented directly against the ORM with weak boundaries.

## 3. Recommended Approach

Adopt `Prisma + MySQL + repository + Nest service` as the permanent backend pattern.

### 3.1 Layers

- `Controller`
  - request/response mapping only
- `Service`
  - business rules, orchestration, validation, permission decisions
- `Repository`
  - aggregate-oriented data access interface
- `Prisma`
  - schema, migrations, transaction boundary, low-level persistence

### 3.2 Why This Is The Recommended Pattern

Compared with directly calling Prisma from every service, this structure keeps:

- permission checks centralized
- audit hook points clear
- future storage changes contained
- business code readable
- test seams stable

This is especially important because the OKR system has multiple domains that will keep growing:

- auth
- users and roles
- departments and sections
- review groups and grade quotas
- goals, KRs, proofs, scores
- audit logs

## 4. Scope Of This Phase

### In scope

- add Prisma tooling and MySQL connection
- add database module and `PrismaService`
- create first production schema for auth, organization, roles, review groups, leader bindings, sessions, and audit logs
- move local debug login from in-memory storage to MySQL
- create repository contracts for users, org, sessions, review groups, and audit logs
- expose system-admin APIs for review group CRUD against MySQL
- preserve local debug login for development
- keep current MVP untouched

### Not in scope

- migrating all OKR business entities to MySQL
- replacing the MVP UI runtime
- real WeCom auth integration
- file storage migration
- proof upload rewrite
- final production deployment scripts

## 5. Directory Structure

The new backend should evolve from the current structure into this:

```text
apps/server/
  prisma/
    schema.prisma
    migrations/
  src/
    app.module.ts
    main.ts
    infrastructure/
      database/
        prisma.module.ts
        prisma.service.ts
        prisma-health.service.ts
      repositories/
        users/
          users.repository.ts
          prisma-users.repository.ts
        org/
          org.repository.ts
          prisma-org.repository.ts
        sessions/
          sessions.repository.ts
          prisma-sessions.repository.ts
        review-groups/
          review-groups.repository.ts
          prisma-review-groups.repository.ts
        audit/
          audit.repository.ts
          prisma-audit.repository.ts
    modules/
      auth/
      users/
      org/
      admin-config/
      audit/
      health/
      config/
    shared/
      types/
      constants/
      guards/
      errors/
  test/
```

## 6. First Prisma Schema Slice

This phase should only model the production base needed for login, roles, org, and admin configuration.

### 6.1 Tables / Models

#### `users`

Purpose:
- core identity shared by all login methods and all roles

Key fields:
- `id`
- `employeeNo`
- `name`
- `email`
- `mobile`
- `wecomUserId`
- `departmentId`
- `sectionId`
- `reviewGroupId`
- `isActive`
- `createdAt`
- `updatedAt`

#### `local_accounts`

Purpose:
- rare manual-login fallback accounts maintained by system admin

Key fields:
- `id`
- `userId`
- `loginName`
- `passwordHash`
- `localLoginEnabled`
- `lastLoginAt`
- `createdAt`
- `updatedAt`

#### `sessions`

Purpose:
- cookie-backed app session state

Key fields:
- `id`
- `userId`
- `activeRoleAssignmentId`
- `authMethod`
- `ip`
- `userAgent`
- `expiresAt`
- `lastSeenAt`
- `createdAt`

#### `departments`

Purpose:
- top-level organization node

Key fields:
- `id`
- `name`
- `isActive`
- `createdAt`
- `updatedAt`

#### `sections`

Purpose:
- second-level organization node under a department

Key fields:
- `id`
- `departmentId`
- `name`
- `isActive`
- `createdAt`
- `updatedAt`

#### `review_groups`

Purpose:
- evaluation groups like 信息化组 / 运营组 / 综合组

Key fields:
- `id`
- `name`
- `isActive`
- `createdAt`
- `updatedAt`

#### `review_grade_quotas`

Purpose:
- fixed seat counts per review group, not percentages

Key fields:
- `id`
- `reviewGroupId`
- `gradeCode`
- `seatCount`
- `createdAt`
- `updatedAt`

Validation rule:
- sum of seat counts in one review group must not exceed the current active member count of that group

#### `user_role_assignments`

Purpose:
- support one user holding multiple roles and scopes

Key fields:
- `id`
- `userId`
- `roleCode`
- `scopeType`
- `scopeId`
- `isPrimary`
- `isEnabled`
- `createdAt`
- `updatedAt`

Scope examples:
- `scopeType = system`
- `scopeType = department`
- `scopeType = section`
- `scopeType = review-group`

#### `section_leader_bindings`

Purpose:
- explicit section leadership scoring scope

Key fields:
- `id`
- `leaderUserId`
- `sectionId`
- `createdAt`
- `updatedAt`

#### `group_leader_bindings`

Purpose:
- explicit review-group leadership scoring scope

Key fields:
- `id`
- `leaderUserId`
- `reviewGroupId`
- `createdAt`
- `updatedAt`

#### `audit_logs`

Purpose:
- structured audit trail for config and auth actions

Key fields:
- `id`
- `actorUserId`
- `actorRoleCode`
- `action`
- `entityType`
- `entityId`
- `beforeJson`
- `afterJson`
- `ip`
- `userAgent`
- `createdAt`

## 7. Repository Boundaries

The first repositories should be:

### `UsersRepository`

Responsibilities:
- find user by id
- find user by `wecomUserId`
- find user by local login name
- update local account settings
- list admin-view users

### `OrgRepository`

Responsibilities:
- list departments
- list sections by department
- list review groups
- create/update/delete department, section, review group
- compute active member count in a review group

### `SessionsRepository`

Responsibilities:
- create session
- get session by cookie id
- update last seen
- delete session

### `ReviewGroupsRepository`

Responsibilities:
- load review group + grade quotas
- save fixed quotas
- validate total quota against group size

### `AuditRepository`

Responsibilities:
- write audit events for:
  - manual login success/failure
  - local account changes
  - review group changes
  - grade quota changes
  - leader binding changes

## 8. First API Slice

These are the first real database-backed endpoints to implement in this phase.

### Auth

- `POST /api/auth/manual-login`
- `POST /api/logout`
- `GET /api/me`

### Health

- `GET /api/health`

Expected response should include:
- app health
- auth mode
- database connectivity state

### System admin bootstrap/config

- `GET /api/admin/org/bootstrap`
- `GET /api/admin/users`
- `POST /api/admin/review-groups`
- `PATCH /api/admin/review-groups/:id`
- `DELETE /api/admin/review-groups/:id`
- `PUT /api/admin/review-groups/:id/quotas`

This is enough to prove:
- database connectivity
- system-admin authorization
- CRUD over core config objects
- fixed-seat quota validation

## 9. Validation And Error Rules

### 9.1 Local login

- only enabled local accounts may log in manually
- passwords are stored as hashes only
- failed login attempts are audited
- disabled users cannot log in even if local account exists

### 9.2 Review group quota save

- a review group cannot be deleted if active users still belong to it
- quota totals greater than current active group size must fail
- failure must happen in both service validation and persisted write path

### 9.3 Role data

- at least one primary role assignment per active user who can log in
- session active role must always reference an assignment that belongs to the logged-in user

## 10. Verification Mechanism

This phase must keep the same evidence-first discipline as earlier work.

### 10.1 E2E tests

Required:
- `health.e2e-spec.ts`
  - now verifies DB health field exists
- `manual-login.e2e-spec.ts`
  - now hits real MySQL-backed local account
- new `review-groups.e2e-spec.ts`
  - create/update/delete review group
  - update fixed quotas
  - reject overflow quota totals

### 10.2 Smoke script

`scripts/smoke.ps1` should grow to verify:
- build succeeds
- app starts
- `/api/health` returns `database.ok = true`
- manual login works
- current user can call one system-admin bootstrap endpoint

### 10.3 Schema verification

Required:
- `prisma validate`
- `prisma format`
- migration generation succeeds

### 10.4 Manual spot verification

Checklist:
- start MySQL locally
- run migrations
- seed one debug system-admin user
- log in with manual login
- open config bootstrap
- add a review group
- save quota values
- confirm invalid quota total is blocked

## 11. Migration Strategy

This phase should not migrate the existing MVP JSON data automatically yet.

Instead:
- create a clean development seed for the Node backend
- keep MVP data isolated
- introduce a dedicated seed path for Node foundation

Suggested order:
1. bring up database module and Prisma
2. create initial schema + migration
3. switch local debug login to MySQL
4. switch review group admin config to MySQL
5. add audit records for these flows
6. only then expand to departments, sections, users, and role bindings

## 12. Risks And Mitigations

### Risk: ORM leaks into all business code

Mitigation:
- require repository interfaces between Prisma and services from the start

### Risk: early schema drift from future OKR domain

Mitigation:
- keep this phase limited to auth/org/admin-config base entities
- defer OKR tables until the OKR module design is ready

### Risk: local debug path becomes production auth by accident

Mitigation:
- auth mode stays explicit in config
- manual login remains a bounded development and fallback feature

### Risk: quota validation duplicated inconsistently

Mitigation:
- centralize it in the review-group service
- verify with e2e tests, not just UI checks

## 13. Acceptance Criteria

This phase is complete only when:

- Nest app runs with `Prisma + MySQL`
- manual debug login uses persisted MySQL data
- health endpoint reports database state
- system-admin review group config is persisted in MySQL
- quota total overflow is rejected
- audit records exist for login and review-group config writes
- repository boundaries exist between services and Prisma
- build, e2e, smoke, and Prisma validation are all green

## 14. Next Phase After This

Once this foundation is green, the next Route C step should be:

- departments / sections / employees / leader bindings on MySQL
- active role assignment persistence
- WeCom login replacing the debug-first path
- then OKR domain tables and proof storage migration
