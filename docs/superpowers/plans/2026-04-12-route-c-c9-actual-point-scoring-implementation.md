# Route C C9 Actual Point Scoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Switch Route C scoring from percentage-based KR review scores to actual-point scoring, including migration, batch full-score behavior, UI limits, and Chinese scoring copy.

**Architecture:** Keep the existing `reviewScore` field name but change its runtime meaning to actual earned points. Update shared aggregate helpers and repository write paths first, then adjust leader UI and tests so every layer speaks the same scoring unit.

**Tech Stack:** NestJS, Prisma, MySQL, React, Vite, Ant Design, Vitest, Jest e2e.

---

### Task 1: Lock the backend behavior with failing tests

**Files:**
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\test\leader-bulk-score.e2e-spec.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\test\leader-score-update.e2e-spec.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\test\leader-ranking.e2e-spec.ts`

- [ ] **Step 1: Write failing assertions for actual-point scoring**

Add assertions that:
- single KR score update stores a value inside the KR point range
- batch full-score stores each KR's `points` value instead of `100`
- quarter/ranking totals are sums of actual earned points

- [ ] **Step 2: Run targeted server tests to verify failure**

Run:

```powershell
$env:Path='C:\Program Files\nodejs;C:\Program Files\Git\cmd;'+$env:Path
& 'C:\Program Files\nodejs\npm.cmd' run test:e2e -- leader-score-update.e2e-spec.ts
& 'C:\Program Files\nodejs\npm.cmd' run test:e2e -- leader-bulk-score.e2e-spec.ts
& 'C:\Program Files\nodejs\npm.cmd' run test:e2e -- leader-ranking.e2e-spec.ts
```

Expected: at least one assertion fails because the current code still treats `reviewScore` as percentage.

### Task 2: Change backend aggregation and write semantics

**Files:**
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\infrastructure\repositories\leader\prisma-leader.repository.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\infrastructure\repositories\employee\prisma-employee.repository.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\modules\leader\dto\bulk-score.dto.ts`

- [ ] **Step 3: Implement actual-point aggregate helpers**

Update both repository `scoreFromKeyResults` helpers to sum `reviewScore` directly, with one-decimal rounding.

- [ ] **Step 4: Update single-score validation and batch full-score writes**

Change leader scoring behavior so:
- single KR updates reject values outside `0..keyResult.points`
- bulk score ignores incoming generic full-score percentage semantics and writes each KR's own `points`

- [ ] **Step 5: Run targeted server tests to verify pass**

Run the same targeted e2e commands from Task 1.

Expected: PASS.

### Task 3: Migrate existing database values and seed data

**Files:**
- Create: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\prisma\migrations\20260412xxxxxx_actual_point_scoring\migration.sql`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\prisma\seed.ts`

- [ ] **Step 6: Write migration to convert old percentage values to actual points**

Migration formula:

```sql
reviewScore = ROUND(points * reviewScore / 100, 1)
```

Apply only where `reviewScore IS NOT NULL`.

- [ ] **Step 7: Rewrite seed scores into actual points**

Change seeded `reviewScore` examples from percentage values to actual earned points matching each KR's `points`.

- [ ] **Step 8: Run Prisma validation and e2e reset flow**

Run:

```powershell
$env:Path='C:\Program Files\nodejs;C:\Program Files\Git\cmd;'+$env:Path
& 'C:\Program Files\nodejs\npm.cmd' run prisma:validate
& 'C:\Program Files\nodejs\npm.cmd' run test:e2e -- health.e2e-spec.ts
```

Expected: PASS, including migration/seed reset.

### Task 4: Lock the front-end behavior with failing tests

**Files:**
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\test\leader-workbench-batch.test.tsx`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\test\leader-workbench.helpers.test.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\test\leader-ranking.helpers.test.ts`

- [ ] **Step 9: Add failing assertions for actual-point copy and ranges**

Cover:
- batch modal success copy refers to KR points full score
- no English `Cancel` remains in batch modal flow
- preview shows current earned points

- [ ] **Step 10: Run focused web tests to verify failure**

Run:

```powershell
$env:Path='C:\Program Files\nodejs;C:\Program Files\Git\cmd;'+$env:Path
& 'C:\Program Files\nodejs\npm.cmd' run test -- leader-workbench-batch.test.tsx
```

Expected: FAIL before UI code changes.

### Task 5: Update leader UI to actual-point scoring

**Files:**
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\modules\leader\LeaderWorkbenchPage.tsx`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\modules\leader\leader-workbench.helpers.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\shared\api\leader.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\shared\i18n\labels.ts`

- [ ] **Step 11: Update input range and batch submission semantics**

Implement:
- single KR `InputNumber.max = keyResult.points`
- batch full-score request writes a semantic payload compatible with backend actual-point behavior
- preview/alerts say "按关键结果分值赋满分"
- modal cancel copy is explicitly Chinese

- [ ] **Step 12: Run focused web tests to verify pass**

Run:

```powershell
$env:Path='C:\Program Files\nodejs;C:\Program Files\Git\cmd;'+$env:Path
& 'C:\Program Files\nodejs\npm.cmd' run test -- leader-workbench-batch.test.tsx
```

Expected: PASS.

### Task 6: Full verification and local runtime refresh

**Files:**
- Modify if needed: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\.gitignore`

- [ ] **Step 13: Run full verification**

Run:

```powershell
$env:Path='C:\Program Files\nodejs;C:\Program Files\Git\cmd;'+$env:Path
& 'C:\Program Files\nodejs\npm.cmd' run test
& 'C:\Program Files\nodejs\npm.cmd' run build
```

in `apps/web`, and

```powershell
$env:Path='C:\Program Files\nodejs;C:\Program Files\Git\cmd;'+$env:Path
& 'C:\Program Files\nodejs\npm.cmd' run build
& 'C:\Program Files\nodejs\npm.cmd' run prisma:validate
& 'C:\Program Files\nodejs\npm.cmd' run test:e2e
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\smoke.ps1
```

in `apps/server`.

- [ ] **Step 14: Restart local debug services**

Verify:
- `http://127.0.0.1:3000/api/health`
- `http://127.0.0.1:3000/api/auth/start`
- `http://127.0.0.1:5173`

- [ ] **Step 15: Commit**

```bash
git add docs/superpowers/specs/2026-04-12-route-c-c9-actual-point-scoring-design.md docs/superpowers/plans/2026-04-12-route-c-c9-actual-point-scoring-implementation.md apps/server apps/web .gitignore
git commit -m "refactor: switch route c scoring to actual points"
```
