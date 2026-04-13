# Route C C10 Goal Status Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the `draft -> confirmed -> pending-review -> completed` goal workflow with admin control, employee submission, and leader scoring gates.

**Architecture:** Extend existing employee, leader, and admin-config modules rather than creating a new domain slice. Keep proof-upload behavior unchanged while tightening goal edit and scoring transitions around status checks.

**Tech Stack:** NestJS, Prisma, MySQL, React, Vite, TanStack Query, Ant Design, Jest/Supertest, Vitest

---

### Task 1: Backend failing tests for status workflow

**Files:**
- Create: `apps/server/test/employee-goal-status.e2e-spec.ts`
- Create: `apps/server/test/admin-goal-status-control.e2e-spec.ts`
- Modify: `apps/server/test/leader-score-update.e2e-spec.ts`

- [ ] Write failing e2e tests for employee draft/edit/submit and leader score gating.
- [ ] Run targeted e2e tests to verify expected failures.

### Task 2: Employee repository/service/controller support

**Files:**
- Modify: `apps/server/src/infrastructure/repositories/employee/employee.repository.ts`
- Modify: `apps/server/src/infrastructure/repositories/employee/prisma-employee.repository.ts`
- Modify: `apps/server/src/modules/employee/employee.service.ts`
- Modify: `apps/server/src/modules/employee/employee.controller.ts`
- Create: `apps/server/src/modules/employee/dto/update-goal.dto.ts`

- [ ] Add repository methods for goal update and submit-for-review.
- [ ] Implement `draft`-only goal edits.
- [ ] Implement `confirmed -> pending-review` submit flow.
- [ ] Re-run employee status tests and make them pass.

### Task 3: Leader scoring status gate and completion transition

**Files:**
- Modify: `apps/server/src/infrastructure/repositories/leader/prisma-leader.repository.ts`
- Modify: `apps/server/test/leader-score-update.e2e-spec.ts`
- Modify: `apps/server/test/leader-bulk-score.e2e-spec.ts`

- [ ] Add pending-review-only scoring checks.
- [ ] Auto-transition goals to `completed` after all KR scores exist.
- [ ] Re-run leader tests and make them pass.

### Task 4: Admin goal status control API

**Files:**
- Modify: `apps/server/src/modules/admin-config/admin-config.controller.ts`
- Modify: `apps/server/src/modules/admin-config/admin-config.service.ts`
- Modify: `apps/server/src/infrastructure/repositories/org/org.repository.ts`
- Modify: `apps/server/src/infrastructure/repositories/org/prisma-org.repository.ts`
- Create: `apps/server/src/modules/admin-config/dto/goal-status-control.dto.ts`

- [ ] Add quarter-based status query and transition endpoints.
- [ ] Support all-employee and single-employee operations.
- [ ] Re-run admin goal-status tests and make them pass.

### Task 5: Employee frontend status UX

**Files:**
- Modify: `apps/web/src/shared/api/employee.ts`
- Modify: `apps/web/src/modules/employee/EmployeeOkrPage.tsx`
- Modify: `apps/web/src/modules/employee/EmployeeGoalPage.tsx`
- Modify: `apps/web/src/modules/employee/EmployeeCreateGoalDialog.tsx`
- Modify: `apps/web/src/shared/i18n/labels.ts`
- Create: `apps/web/test/employee-goal-status.test.tsx`

- [ ] Add client calls for update-goal and submit-for-review.
- [ ] Hide `draft` display on employee pages.
- [ ] Show edit only in `draft`.
- [ ] Show submit button only in `confirmed`.
- [ ] Keep upload visible in confirmed/pending-review/completed.
- [ ] Run failing frontend test first, then implement until green.

### Task 6: Leader frontend status gating

**Files:**
- Modify: `apps/web/src/modules/leader/LeaderWorkbenchPage.tsx`
- Modify: `apps/web/src/modules/leader/leader-workbench.helpers.ts`
- Create: `apps/web/test/leader-workbench-status.test.tsx`

- [ ] Add pending-review-only scoring UI state.
- [ ] Preserve readonly view for non-pending-review goals.
- [ ] Run tests and make them pass.

### Task 7: Admin frontend goal status control section

**Files:**
- Modify: `apps/web/src/shared/types/admin-config.ts`
- Modify: `apps/web/src/shared/api/admin.ts`
- Modify: `apps/web/src/modules/admin/AdminOrgPage.tsx`
- Create: `apps/web/src/modules/admin/AdminGoalStatusControlSection.tsx`
- Modify: `apps/web/src/modules/admin/AdminOrgSections.tsx`
- Create: `apps/web/test/admin-goal-status-control.test.tsx`

- [ ] Add system-config section for quarter/employee-based status transitions.
- [ ] Wire section to backend endpoints.
- [ ] Run failing test first, then implement until green.

### Task 8: Verification

**Files:**
- No new files required unless fixes emerge

- [ ] Run `apps/server` targeted e2e tests for employee, leader, admin status flows.
- [ ] Run `apps/server` full `npm run test:e2e`.
- [ ] Run `apps/server` `npm run build`.
- [ ] Run `apps/web` targeted tests and full `npm run test`.
- [ ] Run `apps/web` `npm run build`.
- [ ] Smoke the local app manually for employee, leader, and sysadmin flows.
