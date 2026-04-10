# Route C C2 Leader Workbench And Ranking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the Route C leader workbench and ranking experience with real MySQL-backed data, KR-by-KR scoring, proof visibility, and fixed-seat grade ranking.

**Architecture:** Extend the current NestJS + Prisma backend with explicit OKR domain models, a dedicated leader module, and query-focused repository helpers. Replace the React leader placeholders with real pages that consume leader APIs through TanStack Query while keeping employee and admin shells unchanged.

**Tech Stack:** NestJS, Prisma, MySQL, React, Vite, TypeScript, Ant Design, TanStack Query, Zustand, Vitest, Jest e2e, PowerShell smoke scripts

---

## File map

### Backend

- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\prisma\schema.prisma`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\prisma\seed.ts`
- Create: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\modules\leader\leader.module.ts`
- Create: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\modules\leader\leader.controller.ts`
- Create: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\modules\leader\leader.service.ts`
- Create: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\modules\leader\dto\update-kr-score.dto.ts`
- Create: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\infrastructure\repositories\leader\leader.repository.ts`
- Create: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\infrastructure\repositories\leader\prisma-leader.repository.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\app.module.ts`
- Create: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\test\leader-workbench.e2e-spec.ts`
- Create: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\test\leader-score-update.e2e-spec.ts`
- Create: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\test\leader-ranking.e2e-spec.ts`

### Frontend

- Create: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\shared\types\leader.ts`
- Create: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\shared\api\leader.ts`
- Create: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\modules\leader\LeaderWorkbenchPage.tsx`
- Create: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\modules\leader\LeaderRankingPage.tsx`
- Create: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\modules\leader\leader-workbench.helpers.ts`
- Create: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\modules\leader\leader-ranking.helpers.ts`
- Create: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\modules\leader\leader.css`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\app\router.tsx`
- Create: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\test\leader-workbench.helpers.test.ts`
- Create: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\test\leader-ranking.helpers.test.ts`

## Delivery checklist

- [ ] Add Prisma models and migration for goals, key results, and proofs
- [ ] Seed leader, employees, goals, key results, proofs, and quota-backed review groups
- [ ] Add leader repository and service
- [ ] Expose leader workbench, KR score update, and ranking APIs
- [ ] Write backend e2e coverage for scope, scoring, and ranking
- [ ] Replace leader placeholder pages with real React pages
- [ ] Add frontend helper tests for ranking and workbench selection logic
- [ ] Run backend build, e2e, and smoke verification
- [ ] Run frontend tests and build verification

## Implementation order

### Task 1. Backend domain foundation

- [ ] Extend Prisma schema with `Goal`, `KeyResult`, and `Proof`
- [ ] Add review fields on `KeyResult` for leader score, note, reviewer, and timestamp
- [ ] Generate and review the Prisma migration
- [ ] Expand seed data with one section leader, one group leader, multiple employees, two goals per employee, multiple KRs, and proof records

### Task 2. Leader backend APIs

- [ ] Add leader repository contract and Prisma implementation
- [ ] Add `LeaderModule`, `LeaderService`, and `LeaderController`
- [ ] Add `GET /api/leader/workbench`
- [ ] Add `PUT /api/leader/key-results/:krId/score`
- [ ] Add `GET /api/leader/ranking`
- [ ] Write audit records for KR score changes

### Task 3. Backend verification

- [ ] Add workbench e2e test for scoped employee visibility
- [ ] Add KR score update e2e test for save-and-edit behavior
- [ ] Add ranking e2e test for fixed-seat grade assignment
- [ ] Run `npm run build`
- [ ] Run `npm run test:e2e`
- [ ] Run `powershell -NoProfile -ExecutionPolicy Bypass -File .\\scripts\\smoke.ps1`

### Task 4. Frontend leader data layer

- [ ] Add leader DTO types
- [ ] Add leader API client helpers
- [ ] Add pure helper functions for employee and goal selection
- [ ] Add pure helper functions for ranking sorting and grade display
- [ ] Write helper tests first

### Task 5. React workbench page

- [ ] Replace workbench placeholder with real leader workbench page
- [ ] Add employee rail, goal tabs, selected goal summary, KR cards, and proof list
- [ ] Add immediate score save with mutation and optimistic refresh
- [ ] Keep layout stable for multiple goals and multiple employees

### Task 6. React ranking page

- [ ] Replace ranking placeholder with real leader ranking page
- [ ] Add review-group selector
- [ ] Add left-side ranking cards
- [ ] Add right-side selected employee breakdown
- [ ] Show fixed-seat occupation summary

### Task 7. Frontend verification

- [ ] Run `npm run test`
- [ ] Run `npm run build`
- [ ] Manually verify login as section leader
- [ ] Manually verify login as group leader
- [ ] Manually verify score edits persist after refresh
- [ ] Manually verify ranking changes after score edits

## Validation mechanism

### Backend automated

- `npm run build`
- `npm run test:e2e`
- `powershell -NoProfile -ExecutionPolicy Bypass -File .\\scripts\\smoke.ps1`

### Frontend automated

- `npm run test`
- `npm run build`

### Manual validation

- Login as the seeded section leader and confirm the workbench only shows assigned section employees
- Login as the seeded group leader and confirm the workbench only shows assigned review-group employees
- Change a KR score, refresh the page, and confirm the score persists
- Edit the same KR score again and confirm later edits are allowed
- Open ranking, verify partially scored users still appear, and verify grade seats follow configured fixed counts

## Exit criteria

C2 is ready to commit when:

- Prisma migration and seed run without errors
- leaders can view scoped employees and goals
- KR score updates auto-save and remain editable
- ranking reflects fixed-seat grades from admin configuration
- frontend and backend automated checks are green
