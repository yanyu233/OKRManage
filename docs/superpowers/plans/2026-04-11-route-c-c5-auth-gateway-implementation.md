# Route C C5 Auth Gateway Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a unified authentication gateway to Route C so local debug login keeps working now while the app is structurally ready for WeCom-first entry later.

**Architecture:** Keep the existing Route C session model and local fallback accounts, add auth-mode-aware entry endpoints on the NestJS backend, and move the React shell to an `/auth/entry` bootstrap route instead of treating `/login` as the default app entry. The backend remains the source of truth for which entry path should be used in the current environment.

**Tech Stack:** NestJS, Prisma, MySQL, React, Vite, TypeScript, Ant Design, TanStack Query, Zustand, Jest e2e, Vitest

---

## File map

### Backend

- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\modules\config\runtime-config.service.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\modules\auth\auth.controller.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\modules\auth\auth.service.ts`
- Create: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\modules\auth\dto\auth-start-response.dto.ts`
- Create: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\modules\auth\dto\wecom-callback-query.dto.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\modules\users\users.repository.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\infrastructure\repositories\users\prisma-users.repository.ts`
- Create: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\test\auth-start.e2e-spec.ts`
- Create: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\test\wecom-fallback.e2e-spec.ts`

### Frontend

- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\shared\api\auth.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\app\router.tsx`
- Create: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\modules\auth\AuthEntryPage.tsx`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\modules\auth\LoginPage.tsx`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\modules\layout\AppShell.tsx`
- Create: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\test\auth-entry.test.tsx`

### Docs

- Create: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\docs\superpowers\plans\2026-04-11-route-c-c5-auth-gateway-implementation.md`

## Task 1: Backend auth-mode config and unified auth start endpoint

**Files:**
- Test: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\test\auth-start.e2e-spec.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\modules\config\runtime-config.service.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\modules\auth\auth.controller.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\modules\auth\auth.service.ts`
- Create: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\modules\auth\dto\auth-start-response.dto.ts`

- [ ] **Step 1: Write the failing e2e coverage for auth start**

Add assertions for:
- unauthenticated `local-debug` -> `{ action: 'manual-login' }`
- authenticated session -> `{ action: 'session' }`
- unauthenticated `wecom-preferred` -> `{ action: 'wecom' }`

- [ ] **Step 2: Run the targeted e2e test to verify it fails**

Run: `npm run test:e2e -- auth-start.e2e-spec.ts`  
Expected: FAIL because `/api/auth/start` does not exist yet.

- [ ] **Step 3: Implement minimal auth-mode config support**

Add runtime config getters for:
- `AUTH_MODE`
- `WEB_BASE_URL`
- `APP_BASE_URL`
- `WECOM_CORP_ID`
- `WECOM_AGENT_ID`
- `WECOM_SECRET`
- `WECOM_REDIRECT_URI`

Expose a helper that can answer:
- current auth mode
- whether WeCom config is complete enough for `wecom-preferred`

- [ ] **Step 4: Implement `GET /api/auth/start`**

Rules:
- if current request already has valid session, return `action=session`
- if no session and mode is `local-debug`, return `action=manual-login`
- if no session and mode is `wecom-preferred`, return `action=wecom`

- [ ] **Step 5: Re-run the targeted e2e test**

Run: `npm run test:e2e -- auth-start.e2e-spec.ts`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/modules/config/runtime-config.service.ts apps/server/src/modules/auth/auth.controller.ts apps/server/src/modules/auth/auth.service.ts apps/server/src/modules/auth/dto/auth-start-response.dto.ts apps/server/test/auth-start.e2e-spec.ts
git commit -m "feat: add route c auth start endpoint"
```

## Task 2: Backend WeCom start/callback skeleton and fallback redirect

**Files:**
- Test: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\test\wecom-fallback.e2e-spec.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\modules\auth\auth.controller.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\modules\auth\auth.service.ts`
- Create: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\modules\auth\dto\wecom-callback-query.dto.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\modules\users\users.repository.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\infrastructure\repositories\users\prisma-users.repository.ts`

- [ ] **Step 1: Write the failing e2e coverage for WeCom fallback**

Cover:
- `/api/auth/wecom/start` rejects missing WeCom config in `wecom-preferred`
- `/api/auth/wecom/callback` redirects to `/login?reason=unmapped` for an unmapped mock identity

- [ ] **Step 2: Run the targeted e2e test to verify it fails**

Run: `npm run test:e2e -- wecom-fallback.e2e-spec.ts`  
Expected: FAIL because the WeCom routes do not exist yet.

- [ ] **Step 3: Implement minimal WeCom route skeleton**

Backend should:
- build OAuth redirect URL when config is complete
- fail clearly when config is missing
- support a local mock callback path for current development
- lookup local user by `wecomUserId`
- create normal Route C session if mapped
- redirect to `/login?reason=unmapped` if not mapped

- [ ] **Step 4: Preserve audit behavior**

Add audit events for:
- `auth.wecom.login.success`
- `auth.wecom.login.unmapped`
- `auth.wecom.login.failure`

- [ ] **Step 5: Re-run the targeted e2e test**

Run: `npm run test:e2e -- wecom-fallback.e2e-spec.ts`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/modules/auth/auth.controller.ts apps/server/src/modules/auth/auth.service.ts apps/server/src/modules/auth/dto/wecom-callback-query.dto.ts apps/server/src/modules/users/users.repository.ts apps/server/src/infrastructure/repositories/users/prisma-users.repository.ts apps/server/test/wecom-fallback.e2e-spec.ts
git commit -m "feat: add route c wecom auth skeleton"
```

## Task 3: Frontend auth entry page and startup flow

**Files:**
- Test: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\test\auth-entry.test.tsx`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\shared\api\auth.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\app\router.tsx`
- Create: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\modules\auth\AuthEntryPage.tsx`

- [ ] **Step 1: Write the failing frontend tests for auth entry**

Cover:
- auth entry redirects to `/login` for `manual-login`
- auth entry navigates to returned app path for `session`
- auth entry causes browser navigation for `wecom`

- [ ] **Step 2: Run the targeted Vitest file and verify it fails**

Run: `npm run test -- auth-entry.test.tsx`  
Expected: FAIL because no auth entry page or auth start API exists.

- [ ] **Step 3: Implement `authStart()` frontend API helper and new `/auth/entry` page**

Frontend should:
- call `/api/auth/start`
- show a lightweight transition state
- navigate based on returned action

- [ ] **Step 4: Move default unauthenticated redirects to `/auth/entry`**

Update router and shell so:
- missing session routes to `/auth/entry`
- existing session still lands on the correct home route

- [ ] **Step 5: Re-run the targeted Vitest file**

Run: `npm run test -- auth-entry.test.tsx`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/shared/api/auth.ts apps/web/src/app/router.tsx apps/web/src/modules/auth/AuthEntryPage.tsx apps/web/test/auth-entry.test.tsx
git commit -m "feat: add route c auth entry page"
```

## Task 4: Manual login page fallback semantics

**Files:**
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\modules\auth\LoginPage.tsx`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\modules\layout\AppShell.tsx`

- [ ] **Step 1: Write or extend a failing test for login-page fallback messaging**

Cover:
- `reason=unmapped` renders fallback explanation
- normal `local-debug` entry renders debug wording without implying it is the default production login

- [ ] **Step 2: Run the targeted frontend tests and verify failure**

Run: `npm run test -- auth-entry.test.tsx labels.test.ts`  
Expected: one or more assertions fail until wording and routing are updated.

- [ ] **Step 3: Implement the minimal login-page adjustments**

Keep the page focused on:
- local debug
- unmapped-user fallback

Do not expose it as the default entry of the application.

- [ ] **Step 4: Re-run the targeted frontend tests**

Run: `npm run test -- auth-entry.test.tsx labels.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/modules/auth/LoginPage.tsx apps/web/src/modules/layout/AppShell.tsx apps/web/test/auth-entry.test.tsx apps/web/test/labels.test.ts
git commit -m "refactor: align route c login fallback flow"
```

## Task 5: Full verification

**Files:**
- No new code expected

- [ ] **Step 1: Run frontend tests**

Run: `npm run test` in `apps/web`  
Expected: PASS

- [ ] **Step 2: Run frontend build**

Run: `npm run build` in `apps/web`  
Expected: PASS

- [ ] **Step 3: Run backend build**

Run: `npm run build` in `apps/server`  
Expected: PASS

- [ ] **Step 4: Run backend e2e**

Run: `npm run test:e2e` in `apps/server`  
Expected: PASS

- [ ] **Step 5: Run backend smoke**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File .\\scripts\\smoke.ps1` in `apps/server`  
Expected: PASS

- [ ] **Step 6: Manual verification checklist**

Verify:
- unauthenticated app open lands on `/auth/entry`
- `local-debug` eventually lands on `/login`
- successful local login returns to requested route
- `/logout` clears session
- mapped session skips login on refresh
- unmapped WeCom callback redirects to fallback login reason

- [ ] **Step 7: Commit final C5 implementation**

```bash
git add .
git commit -m "feat: add route c auth gateway flow"
```
