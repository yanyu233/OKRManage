# Route C C4 Multi-Role Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add true multi-role sessions and grouped role menus to Route C so one user can directly open employee and leader features from the same left navigation.

**Architecture:** Extend the Route C session payload from single-role to multi-role with one `activeRole` and a list of assigned roles. Keep backend authorization scope checks intact, add a role-switch endpoint, and let the React shell switch role implicitly when a menu item from another role group is clicked.

**Tech Stack:** NestJS, Prisma, MySQL, React, Vite, TypeScript, Ant Design, TanStack Query, Zustand, Jest e2e, Vitest

---

## File map

### Backend

- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\shared\types\auth-user.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\modules\users\users.service.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\modules\session\session.service.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\modules\auth\auth.service.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\modules\auth\auth.controller.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\shared\guards\role.guard.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\modules\leader\leader.service.ts`
- Create: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\test\active-role.e2e-spec.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\test\manual-login.e2e-spec.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\test\support\test-app.ts`

### Frontend

- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\shared\types\session.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\shared\api\auth.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\shared\store\session-store.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\modules\layout\routing.tsx`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\modules\layout\AppShell.tsx`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\app\router.tsx`
- Create: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\test\multi-role-routing.test.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\test\labels.test.ts`

### Docs

- Create: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\docs\superpowers\plans\2026-04-11-route-c-c4-multi-role-menu-implementation.md`

## Task 1: Backend multi-role session contract

**Files:**
- Test: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\test\manual-login.e2e-spec.ts`
- Test: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\test\active-role.e2e-spec.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\shared\types\auth-user.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\modules\users\users.service.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\modules\session\session.service.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\modules\auth\auth.service.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\modules\auth\auth.controller.ts`

- [ ] Write failing e2e assertions for:
  - manual login returning `activeRole` and `roles`
  - role switching through `POST /api/auth/active-role`
  - rejecting a role switch to an unassigned role
- [ ] Run the targeted e2e tests and verify they fail for the expected missing fields/route
- [ ] Implement minimal backend changes:
  - hydrate all enabled assigned roles
  - choose initial `activeRole`
  - expose `roles` and `activeRole` in session payload
  - add `POST /api/auth/active-role`
  - audit `auth.active-role.switch`
- [ ] Re-run targeted e2e tests until they pass
- [ ] Commit the backend session contract change

## Task 2: Backend authorization update

**Files:**
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\shared\guards\role.guard.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\modules\leader\leader.service.ts`
- Test: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\test\active-role.e2e-spec.ts`

- [ ] Add failing test coverage proving a multi-role user can reach both employee and leader route families
- [ ] Run the targeted e2e tests and confirm current authorization is too narrow
- [ ] Update route guard and any active-role-sensitive services to check assigned roles for reachability while keeping current `activeRole` for context
- [ ] Re-run targeted e2e tests until they pass
- [ ] Commit the authorization update

## Task 3: Frontend session types and auth API

**Files:**
- Test: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\test\multi-role-routing.test.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\shared\types\session.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\shared\api\auth.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\shared\store\session-store.ts`

- [ ] Write failing frontend tests for grouped menu generation and multi-role session typing
- [ ] Run the targeted Vitest file and verify it fails
- [ ] Implement minimal frontend session updates:
  - `roles`
  - `activeRole`
  - API call for `POST /api/auth/active-role`
  - store support for updating current session user
- [ ] Re-run targeted tests until they pass
- [ ] Commit the frontend session model change

## Task 4: Grouped role menu and shell switching

**Files:**
- Test: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\test\multi-role-routing.test.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\modules\layout\routing.tsx`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\modules\layout\AppShell.tsx`

- [ ] Extend failing tests for:
  - employee-only menu
  - employee + group-leader grouped menu
  - menu click switching role before navigation
- [ ] Run the targeted tests and confirm they fail
- [ ] Implement the grouped role menu builder and shell mutation flow
- [ ] Re-run targeted tests until they pass
- [ ] Commit the shell/menu behavior change

## Task 5: Router and access alignment

**Files:**
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\app\router.tsx`
- Test: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\test\multi-role-routing.test.ts`

- [ ] Add failing tests for route access using assigned roles instead of single-role equality
- [ ] Run the targeted tests and verify they fail
- [ ] Update route guards/utilities so dual-role users can open both route families
- [ ] Re-run targeted tests until they pass
- [ ] Commit the router access alignment

## Task 6: Config-page verification and light adjustments

**Files:**
- Modify if needed: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\modules\admin\AdminOrgAccessSections.tsx`
- Modify if needed: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\modules\admin-config\admin-config.service.ts`

- [ ] Verify one user can currently hold multiple role-assignment rows in the system-admin page
- [ ] Verify backend bootstrap validation allows multiple distinct role rows for one user
- [ ] If any UI hint is unclear, make the smallest copy or validation adjustment needed
- [ ] Commit only if code changed

## Task 7: Full verification

**Files:**
- No new code expected

- [ ] Run `apps/web`: `npm run test`
- [ ] Run `apps/web`: `npm run build`
- [ ] Run `apps/server`: `npm run build`
- [ ] Run `apps/server`: `npm run test:e2e`
- [ ] Run `apps/server`: `powershell -NoProfile -ExecutionPolicy Bypass -File .\\scripts\\smoke.ps1`
- [ ] Manually verify:
  - employee-only login shows one menu group
  - dual-role login shows grouped employee + leader menus
  - clicking cross-role menu updates current role badge
- [ ] Commit the final C4 implementation if verification is green
