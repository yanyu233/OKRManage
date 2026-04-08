# Phase 2 Role Permission And MySQL Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the system from single-role demo assumptions to a production-ready permission model, while introducing a repository abstraction layer that prepares the backend for MySQL migration without changing business behavior.

**Architecture:** Keep business pages and route shapes stable, but insert two new foundations: a formal permission layer and a storage abstraction layer. Request handling should stop reading JSON structures directly in business code; instead, backend handlers use permission helpers and repository methods, with JSON remaining the temporary implementation until MySQL is introduced in a later phase.

**Tech Stack:** PowerShell `HttpListener`, native HTML/CSS/JS, JSON persistence during transition, planned MySQL target schema, PowerShell regression scripts, lightweight JS unit tests.

---

## Scope

This plan covers the second major refactor phase after WeCom login and session isolation are completed:

- multi-role user model
- active-role selection for users who hold multiple business roles
- backend permission centralization
- frontend role-aware navigation cleanup
- repository abstraction over users/goals/krs/proofs/review config/admin config
- MySQL schema, migration scripts, and data mapping preparation

This plan does **not** yet switch production reads and writes to MySQL. It prepares the code so that Phase 3 can change storage implementation with low business risk.

## File Structure

### Existing files to modify

- Modify: `C:/Users/yanxi/Documents/OKRManage/mvp/server.ps1`
  - Extract authorization helpers, active-role resolution, and repository dispatch.
- Modify: `C:/Users/yanxi/Documents/OKRManage/mvp/public/role-app.js`
  - Support active-role display and switching for users with multiple roles.
- Modify: `C:/Users/yanxi/Documents/OKRManage/mvp/public/leader-role-overrides.js`
  - Stop assuming a single immutable role per user session.
- Modify: `C:/Users/yanxi/Documents/OKRManage/mvp/public/review-grade-overrides.js`
  - Read the current active role and scope from session-backed bootstrap data.
- Modify: `C:/Users/yanxi/Documents/OKRManage/mvp/public/system-admin-overrides.js`
  - Manage multi-role assignments and new organization bindings.
- Modify: `C:/Users/yanxi/Documents/OKRManage/mvp/data/seed.json`
  - Add role assignment structures and organization ownership fixtures.

### New backend/support files

- Create: `C:/Users/yanxi/Documents/OKRManage/mvp/lib/permissions.ps1`
  - Central permission matrix and route-level authorization helpers.
- Create: `C:/Users/yanxi/Documents/OKRManage/mvp/lib/repositories/json-repository.ps1`
  - JSON-backed repository implementation matching the new abstraction.
- Create: `C:/Users/yanxi/Documents/OKRManage/mvp/lib/repositories/repository-contract.ps1`
  - Repository function surface used by handlers.
- Create: `C:/Users/yanxi/Documents/OKRManage/mvp/db/mysql/001_init_schema.sql`
  - First MySQL schema draft.
- Create: `C:/Users/yanxi/Documents/OKRManage/mvp/db/mysql/002_seed_mapping_notes.md`
  - Seed-to-MySQL field mapping and migration notes.
- Create: `C:/Users/yanxi/Documents/OKRManage/mvp/tests/role-assignment.ps1`
  - Role assignment and active-role regression tests.
- Create: `C:/Users/yanxi/Documents/OKRManage/mvp/tests/permission-matrix.ps1`
  - Route permission regression tests.
- Create: `C:/Users/yanxi/Documents/OKRManage/mvp/tests/repository-contract.ps1`
  - Repository behavior tests using the JSON implementation.

## Target Data Model For This Phase

The current single `role` field evolves into:

- `users`
  - base identity and organization ownership
- `user_roles`
  - `id`
  - `userId`
  - `roleCode`
  - `scopeType`
  - `scopeId`
  - `isPrimary`
  - `isActive`
- `sections`
  - remain bound to `departments`
- `review_groups`
  - configurable group definitions
- `review_grade_rules`
  - fixed-seat grade allocation by group

During this phase, JSON should mirror this target structure so later MySQL migration is mechanical rather than conceptual.

## Execution Order

### Task 1: Freeze A Formal Permission Vocabulary

**Files:**
- Create: `C:/Users/yanxi/Documents/OKRManage/mvp/lib/permissions.ps1`
- Create: `C:/Users/yanxi/Documents/OKRManage/mvp/tests/permission-matrix.ps1`
- Modify: `C:/Users/yanxi/Documents/OKRManage/mvp/server.ps1`

- [ ] **Step 1: Write the failing permission-matrix test**

Define failing expectations for at least these combinations:

- employee cannot open admin config APIs
- section leader can score only in managed section scope
- group leader can see ranking only in managed review group scope
- system admin can manage organization config

- [ ] **Step 2: Run the test and confirm it fails**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Users\yanxi\Documents\OKRManage\mvp\tests\permission-matrix.ps1"
```

Expected:
- FAIL because permissions are still distributed inline across handlers

- [ ] **Step 3: Implement centralized permission helpers**

Add helpers such as:

```powershell
function Test-CanViewGoal { ... }
function Test-CanEditGoal { ... }
function Test-CanScoreKr { ... }
function Test-CanManageAdminConfig { ... }
function Assert-Permission { ... }
```

- [ ] **Step 4: Replace ad-hoc checks in `server.ps1` with helper calls**

Expected:
- all route permission decisions are routed through the permission library

- [ ] **Step 5: Re-run the permission test**

Expected:
- PASS

- [ ] **Step 6: Commit**

```bash
git add mvp/lib/permissions.ps1 mvp/tests/permission-matrix.ps1 mvp/server.ps1
git commit -m "refactor: centralize permission matrix"
```

### Task 2: Introduce Multi-Role Assignments And Active Role

**Files:**
- Modify: `C:/Users/yanxi/Documents/OKRManage/mvp/data/seed.json`
- Modify: `C:/Users/yanxi/Documents/OKRManage/mvp/server.ps1`
- Create: `C:/Users/yanxi/Documents/OKRManage/mvp/tests/role-assignment.ps1`

- [ ] **Step 1: Write a failing role-assignment test**

Scenarios:
- one user has both `employee` and `group-leader`
- session defaults to primary role
- user can switch active role only to a role assigned to themselves
- bootstrap reflects the active role and all available roles

- [ ] **Step 2: Run it to confirm failure**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Users\yanxi\Documents\OKRManage\mvp\tests\role-assignment.ps1"
```

Expected:
- FAIL

- [ ] **Step 3: Add `userRoles` structure to seed/store shape**

Represent assignments in JSON like:

```json
{
  "id": "ur-1",
  "userId": "u-emp1",
  "roleCode": "group-leader",
  "scopeType": "review-group",
  "scopeId": "信息化组",
  "isPrimary": false,
  "isActive": true
}
```

- [ ] **Step 4: Add active-role session support**

Session data should carry:

```powershell
activeRoleCode = "employee"
activeRoleAssignmentId = "ur-employee-1"
```

- [ ] **Step 5: Add backend route to switch active role**

Recommended:

```powershell
POST /api/session/active-role
```

with validation that the requested assignment belongs to the current user.

- [ ] **Step 6: Re-run the role-assignment test**

Expected:
- PASS

- [ ] **Step 7: Commit**

```bash
git add mvp/data/seed.json mvp/server.ps1 mvp/tests/role-assignment.ps1
git commit -m "feat: add multi-role assignments and active role switching"
```

### Task 3: Make Frontend Navigation Role-Aware

**Files:**
- Modify: `C:/Users/yanxi/Documents/OKRManage/mvp/public/index.html`
- Modify: `C:/Users/yanxi/Documents/OKRManage/mvp/public/role-app.js`
- Modify: `C:/Users/yanxi/Documents/OKRManage/mvp/public/leader-role-overrides.js`
- Modify: `C:/Users/yanxi/Documents/OKRManage/mvp/public/review-grade-overrides.js`
- Modify: `C:/Users/yanxi/Documents/OKRManage/mvp/public/system-admin-overrides.js`

- [ ] **Step 1: Add a failing frontend role bootstrap expectation**

Create a minimal JS test or smoke assertion that requires:
- `bootstrap.currentUser`
- `bootstrap.availableRoles`
- `bootstrap.activeRole`

Expected:
- FAIL before implementation

- [ ] **Step 2: Add role-switcher UI only when a user has multiple active assignments**

Rules:
- one role: no switcher
- two or more roles: show a compact role switch menu
- active role drives visible nav and page modules

- [ ] **Step 3: Remove code paths that hard-bind the whole UI to `currentUser.role`**

Replace with:

```javascript
const activeRole = state.activeRole?.roleCode || state.currentUser?.role || "employee";
```

- [ ] **Step 4: Run JS syntax and role view regressions**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Users\yanxi\Documents\OKRManage\mvp\tests\role-view-utils.test.js"
```

and syntax validation for changed JS files.

- [ ] **Step 5: Commit**

```bash
git add mvp/public/index.html mvp/public/role-app.js mvp/public/leader-role-overrides.js mvp/public/review-grade-overrides.js mvp/public/system-admin-overrides.js
git commit -m "refactor: make frontend navigation active-role aware"
```

### Task 4: Insert Repository Contract Between Handlers And Storage

**Files:**
- Create: `C:/Users/yanxi/Documents/OKRManage/mvp/lib/repositories/repository-contract.ps1`
- Create: `C:/Users/yanxi/Documents/OKRManage/mvp/lib/repositories/json-repository.ps1`
- Modify: `C:/Users/yanxi/Documents/OKRManage/mvp/server.ps1`
- Create: `C:/Users/yanxi/Documents/OKRManage/mvp/tests/repository-contract.ps1`

- [ ] **Step 1: Write the failing repository-contract test**

Contract coverage should include:
- get user by id / by WeCom id
- list goals in current scope
- save goal / save KR / save proof
- list review group rules
- save admin config fragments

- [ ] **Step 2: Run test to confirm failure**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Users\yanxi\Documents\OKRManage\mvp\tests\repository-contract.ps1"
```

Expected:
- FAIL

- [ ] **Step 3: Define repository function surface**

Examples:

```powershell
function Get-Repository { ... }
function Repo-GetUserById { ... }
function Repo-GetUserByWecomId { ... }
function Repo-ListGoals { ... }
function Repo-SaveGoal { ... }
function Repo-SaveKr { ... }
function Repo-SaveProof { ... }
function Repo-ListReviewGradeRules { ... }
function Repo-SaveReviewGradeRules { ... }
```

- [ ] **Step 4: Implement JSON-backed repository**

Move direct store traversal out of route handlers into repository functions.

- [ ] **Step 5: Update route handlers to call the repository**

Goal:
- route handlers orchestrate auth + validation + repository calls
- they do not directly crawl JSON object graphs

- [ ] **Step 6: Re-run repository and business regressions**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Users\yanxi\Documents\OKRManage\mvp\tests\repository-contract.ps1"
powershell -ExecutionPolicy Bypass -File "C:\Users\yanxi\Documents\OKRManage\mvp\tests\leader-kr-scoring.ps1"
powershell -ExecutionPolicy Bypass -File "C:\Users\yanxi\Documents\OKRManage\mvp\tests\locked-goal-materials.ps1"
powershell -ExecutionPolicy Bypass -File "C:\Users\yanxi\Documents\OKRManage\mvp\tests\review-grade-config.ps1"
```

Expected:
- PASS

- [ ] **Step 7: Commit**

```bash
git add mvp/lib/repositories/repository-contract.ps1 mvp/lib/repositories/json-repository.ps1 mvp/server.ps1 mvp/tests/repository-contract.ps1
git commit -m "refactor: introduce repository abstraction over json storage"
```

### Task 5: Draft The MySQL Schema And Migration Mapping

**Files:**
- Create: `C:/Users/yanxi/Documents/OKRManage/mvp/db/mysql/001_init_schema.sql`
- Create: `C:/Users/yanxi/Documents/OKRManage/mvp/db/mysql/002_seed_mapping_notes.md`

- [ ] **Step 1: Write the schema draft**

Include tables for:
- `users`
- `user_roles`
- `departments`
- `sections`
- `goals`
- `krs`
- `proofs`
- `review_groups`
- `review_grade_rules`
- `goal_reviews`
- `kr_reviews`
- `audit_logs`
- `sessions`

- [ ] **Step 2: Write migration mapping notes**

Document how current JSON fields map to MySQL columns, especially:
- current review group configuration
- goal and KR status fields
- proof file metadata
- role assignment scopes

- [ ] **Step 3: Validate schema for plan completeness**

Checklist:
- every active JSON aggregate has a target table
- every mutable record has `created_at` and `updated_at`
- every permission-driving relationship has a foreign key

- [ ] **Step 4: Commit**

```bash
git add mvp/db/mysql/001_init_schema.sql mvp/db/mysql/002_seed_mapping_notes.md
git commit -m "docs: add mysql schema draft and migration mapping"
```

### Task 6: Phase-2 Gate Verification

**Files:**
- Test: `C:/Users/yanxi/Documents/OKRManage/mvp/tests/permission-matrix.ps1`
- Test: `C:/Users/yanxi/Documents/OKRManage/mvp/tests/role-assignment.ps1`
- Test: `C:/Users/yanxi/Documents/OKRManage/mvp/tests/repository-contract.ps1`
- Test: `C:/Users/yanxi/Documents/OKRManage/mvp/tests/leader-kr-scoring.ps1`
- Test: `C:/Users/yanxi/Documents/OKRManage/mvp/tests/locked-goal-materials.ps1`
- Test: `C:/Users/yanxi/Documents/OKRManage/mvp/tests/review-grade-config.ps1`
- Test: `C:/Users/yanxi/Documents/OKRManage/mvp/tests/validate-kr-weight.ps1`

- [ ] **Step 1: Run the full Phase-2 suite**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Users\yanxi\Documents\OKRManage\mvp\tests\permission-matrix.ps1"
powershell -ExecutionPolicy Bypass -File "C:\Users\yanxi\Documents\OKRManage\mvp\tests\role-assignment.ps1"
powershell -ExecutionPolicy Bypass -File "C:\Users\yanxi\Documents\OKRManage\mvp\tests\repository-contract.ps1"
powershell -ExecutionPolicy Bypass -File "C:\Users\yanxi\Documents\OKRManage\mvp\tests\leader-kr-scoring.ps1"
powershell -ExecutionPolicy Bypass -File "C:\Users\yanxi\Documents\OKRManage\mvp\tests\locked-goal-materials.ps1"
powershell -ExecutionPolicy Bypass -File "C:\Users\yanxi\Documents\OKRManage\mvp\tests\review-grade-config.ps1"
powershell -ExecutionPolicy Bypass -File "C:\Users\yanxi\Documents\OKRManage\mvp\tests\validate-kr-weight.ps1"
```

Expected:
- PASS

- [ ] **Step 2: Run manual multi-role verification**

Checklist:

1. Login as a user with only employee role.
2. Confirm no role switcher is shown.
3. Login as a user with employee + group leader roles.
4. Confirm role switcher appears.
5. Switch to leader role and confirm score/ranking pages appear.
6. Switch back to employee role and confirm employee pages appear.
7. Verify leader role cannot reach system-admin config.
8. Verify system-admin can maintain organization and review group rules.

- [ ] **Step 3: Capture go/no-go criteria**

Phase 2 completes only if:
- permission checks are centralized
- no business route relies on a single static `user.role`
- repository abstraction is in use for mutable business handlers
- MySQL schema draft covers every current persisted aggregate

## Verification Mechanism

This phase uses four validation layers:

### 1. TDD per task

Every new behavior starts with a failing test or failing smoke assertion.

### 2. Route permission verification

Every protected route must have at least one deny case and one allow case in `permission-matrix.ps1`.

### 3. Repository parity verification

The JSON repository must preserve existing business behavior before MySQL is introduced. Business regressions from employee, leader, admin, proof upload, and KR validation must all stay green.

### 4. Multi-role browser verification

At least one test account must exercise:
- single-role employee
- multi-role employee/group-leader
- system admin

## Rollback Mechanism

If repository abstraction or multi-role support causes route instability:

1. disable active-role switching in runtime config
2. revert route handlers to the previous stable branch
3. keep the new tests and schema docs
4. restart from the last green Phase-1 baseline

Because MySQL is not yet live in this phase, rollback cost is limited to application code only.

## Phase 2 Deliverables

- centralized permission library
- multi-role assignment model
- active-role switch support
- repository abstraction over current JSON persistence
- MySQL schema draft and migration notes
- regression suite for permissions, roles, and repository behavior

## Self-Review

### Spec coverage

This plan covers the next layer after Phase 1: role refinement, permission centralization, and MySQL preparation without prematurely swapping storage engines.

### Placeholder scan

No task intentionally leaves a deferred implementation placeholder. Each task identifies concrete files, target helpers, and validation commands.

### Type consistency

The plan consistently uses:
- `user_roles` for role assignments
- `activeRole` for current in-session role
- repository functions prefixed with `Repo-`
- `scopeType/scopeId` for role visibility boundaries

Plan complete and saved to `docs/superpowers/plans/2026-04-08-phase-2-role-permission-and-mysql-foundation.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
