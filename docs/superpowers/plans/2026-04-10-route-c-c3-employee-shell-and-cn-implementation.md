# Route C C3 Employee Shell And CN Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver Route C employee OKR list/detail, proof upload, completion toggle, and a Chinese UI pass across the new frontend.

**Architecture:** Add a dedicated employee module in NestJS, backed by current Goal/KeyResult/Proof tables and local proof storage on disk. Replace employee placeholders with real React pages and add a lightweight localization layer that maps stable backend codes to Chinese labels in the frontend.

**Tech Stack:** NestJS, Prisma, MySQL, React, Vite, TypeScript, Ant Design, TanStack Query, Zustand, Vitest, Jest e2e, local file storage, PowerShell smoke scripts

---

## File map

### Backend

- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\modules\config\runtime-config.service.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\.env.example`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\prisma\seed.ts`
- Create: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\modules\employee\employee.module.ts`
- Create: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\modules\employee\employee.controller.ts`
- Create: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\modules\employee\employee.service.ts`
- Create: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\modules\employee\dto\update-kr-completion.dto.ts`
- Create: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\modules\employee\dto\upload-proof.dto.ts`
- Create: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\infrastructure\repositories\employee\employee.repository.ts`
- Create: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\infrastructure\repositories\employee\prisma-employee.repository.ts`
- Create: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\infrastructure\storage\local-proof-storage.service.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\app.module.ts`
- Create: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\test\employee-okr.e2e-spec.ts`
- Create: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\test\employee-goal-detail.e2e-spec.ts`
- Create: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\test\employee-proof-upload.e2e-spec.ts`

### Frontend

- Create: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\shared\types\employee.ts`
- Create: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\shared\api\employee.ts`
- Create: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\shared\i18n\labels.ts`
- Create: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\modules\employee\EmployeeOkrPage.tsx`
- Create: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\modules\employee\EmployeeGoalPage.tsx`
- Create: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\modules\employee\employee.helpers.ts`
- Create: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\modules\employee\employee.css`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\shared\api\http.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\app\router.tsx`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\modules\auth\LoginPage.tsx`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\modules\auth\UnauthorizedPage.tsx`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\modules\layout\AppShell.tsx`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\modules\layout\routing.tsx`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\modules\admin\*.tsx`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\modules\leader\*.tsx`
- Create: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\test\employee.helpers.test.ts`
- Create: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\test\labels.test.ts`

## Delivery checklist

- [ ] Add employee APIs for list, detail, completion toggle, proof upload, and proof download
- [ ] Add local proof storage service and wire it into uploads
- [ ] Seed stable demo display data and sample proof files
- [ ] Replace employee placeholders with real pages
- [ ] Add frontend Chinese label mappings and update existing Route C pages
- [ ] Verify employee, leader, and admin pages still work after localization

## Implementation order

### Task 1. Employee backend tests and storage config

- [ ] Add failing e2e tests for employee list, detail, and proof upload
- [ ] Add optional proof storage directory config and local storage service

### Task 2. Employee backend APIs

- [ ] Add employee repository
- [ ] Add employee service
- [ ] Add employee controller endpoints
- [ ] Add proof download access validation for employee and leader roles

### Task 3. Backend verification

- [ ] Run `npm run build`
- [ ] Run `npm run test:e2e`
- [ ] Update and run `powershell -NoProfile -ExecutionPolicy Bypass -File .\\scripts\\smoke.ps1`

### Task 4. Employee frontend data layer

- [ ] Add employee DTO types and API client
- [ ] Add employee helper tests first
- [ ] Add proof URL helper based on API base URL

### Task 5. Employee pages

- [ ] Replace employee OKR placeholder with real page
- [ ] Replace employee goal placeholder with real page
- [ ] Add completion toggles and upload actions
- [ ] Add proof list rendering

### Task 6. Chinese localization pass

- [ ] Add centralized Chinese label mapping
- [ ] Update shell menu and login pages
- [ ] Update admin page copy
- [ ] Update leader page copy
- [ ] Update employee page copy

### Task 7. Frontend verification

- [ ] Run `npm run test`
- [ ] Run `npm run build`
- [ ] Manually verify employee login, goal detail, upload, and completion toggle
- [ ] Manually verify leader and admin pages still render Chinese labels correctly

## Validation mechanism

### Backend automated

- `npm run build`
- `npm run test:e2e`
- `powershell -NoProfile -ExecutionPolicy Bypass -File .\\scripts\\smoke.ps1`

### Frontend automated

- `npm run test`
- `npm run build`

### Manual validation

- Login as seeded employee and confirm OKR list renders the current quarter
- Open a goal detail page and confirm key results, proof list, and completion state are visible
- Upload a proof file and confirm it appears immediately
- Open the proof file through the backend download route
- Toggle completion state and confirm refresh keeps the new state
- Login as a leader and confirm the same uploaded proof is visible in the leader workbench
- Login as system admin and confirm Chinese labels render correctly

## Exit criteria

C3 is ready to commit when:

- employee APIs and employee pages are fully functional
- proof upload/download works end-to-end
- current Route C visible pages are Chinese
- backend and frontend automated checks are green
