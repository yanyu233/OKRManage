# Route C C7 负责人全量查看、范围评分与批量评分 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 补齐负责人全量查看、范围评分、批量评分和模板目标排序，保证多角色菜单与展示逻辑一致。

**Architecture:** 先通过后端与前端测试补红，锁定查看/评分权限边界和模板排序规则；再分别实现后端 repository/service 和 React 工作台/菜单更新；最后跑全量验证并刷新本地调试服务。

**Tech Stack:** NestJS, Prisma, MySQL, React, Vite, Ant Design, Vitest, Jest e2e

---

### Task 1: 补红测试

**Files:**
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\test\leader-workbench.e2e-spec.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\test\leader-ranking.e2e-spec.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\test\employee-goal-template-import.e2e-spec.ts`
- Create: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\test\leader-bulk-score.e2e-spec.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\test\multi-role-routing.test.ts`

- [ ] 写失败测试，覆盖新权限、批量评分和模板排序规则
- [ ] 分别运行对应测试，确认先红

### Task 2: 后端实现

**Files:**
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\infrastructure\repositories\leader\leader.repository.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\infrastructure\repositories\leader\prisma-leader.repository.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\modules\leader\leader.service.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\modules\leader\leader.controller.ts`
- Create: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\modules\leader\dto\bulk-score.dto.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\infrastructure\repositories\employee\prisma-employee.repository.ts`

- [ ] 先让后端测试通过：拆分可见范围/可评分范围
- [ ] 新增批量评分接口与跳过统计
- [ ] 导入模板后重排季度目标编码
- [ ] 跑 server e2e，确认转绿

### Task 3: 前端实现

**Files:**
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\shared\i18n\labels.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\modules\layout\routing.tsx`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\modules\layout\AppShell.tsx`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\shared\types\leader.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\shared\api\leader.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\modules\leader\LeaderWorkbenchPage.tsx`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\modules\leader\leader-workbench.helpers.ts`

- [ ] 补齐多角色展示与菜单聚合
- [ ] 在负责人工作台接上只读/可评分态
- [ ] 增加批量评分弹窗与筛选/全选逻辑
- [ ] 跑 web test/build，确认转绿

### Task 4: 总体验证

**Files:**
- Update if needed: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\docs\superpowers\specs\2026-04-11-route-c-production-progress-check.md`

- [ ] 运行 `apps/server npm run build`
- [ ] 运行 `apps/server npm run test:e2e`
- [ ] 运行 `apps/server scripts/smoke.ps1`
- [ ] 运行 `apps/web npm run test`
- [ ] 运行 `apps/web npm run build`
- [ ] 重启本地调试服务并做手工冒烟
