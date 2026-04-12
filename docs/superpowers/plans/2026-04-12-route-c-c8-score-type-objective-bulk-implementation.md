# Route C C8 评分类型与客观项批量评分 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Route C 打通 KR 评分类型、员工自建目标默认客观项、模板 KR 评分类型配置、负责人客观项批量评分。

**Architecture:** 在 Prisma 模型中新增统一 `scoreType` 字段，后端沿模板配置、模板导入、员工新建、负责人批量评分四条链路贯通；前端在系统管理员、员工、负责人三端同步暴露评分类型，并将批量评分聚焦到客观评分项。

**Tech Stack:** NestJS, Prisma, MySQL, React, Vite, Ant Design, Vitest, Testing Library

---

### Task 1: 扩展 Prisma 数据模型与种子

**Files:**
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\prisma\schema.prisma`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\prisma\seed.ts`
- Create: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\prisma\migrations\<timestamp>_add_score_type\migration.sql`
- Test: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\test\employee-goal-template-import.e2e-spec.ts`

- [ ] 写失败测试，断言模板导入后的 KR 会带上评分类型
- [ ] 运行该测试确认因缺少 `scoreType` 失败
- [ ] 在 Prisma 中新增 `ScoreType` 枚举，并给模板 KR / 员工 KR 增加默认值
- [ ] 更新 seed 数据，显式给模板 KR 和示例 KR 赋值
- [ ] 运行迁移和目标测试确认通过

### Task 2: 打通系统管理员模板 KR 评分类型

**Files:**
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\infrastructure\repositories\org\org.repository.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\infrastructure\repositories\org\prisma-org.repository.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\modules\admin-config\dto\save-org-bootstrap.dto.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\shared\types\admin-config.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\modules\admin\admin-org-form.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\modules\admin\AdminGoalTemplateSection.tsx`
- Test: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\test\admin-config.e2e-spec.ts`

- [ ] 写失败测试，断言 bootstrap/save 往返会保留模板 KR `scoreType`
- [ ] 运行测试确认失败
- [ ] 扩展后端 DTO 和 repository 映射
- [ ] 在前端模板 KR 卡片中增加评分类型下拉
- [ ] 运行后端 e2e 与前端测试确认通过

### Task 3: 员工新建目标与主观项确认

**Files:**
- Create: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\modules\employee\dto\create-goal.dto.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\modules\employee\employee.controller.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\modules\employee\employee.service.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\infrastructure\repositories\employee\employee.repository.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\infrastructure\repositories\employee\prisma-employee.repository.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\shared\types\employee.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\shared\api\employee.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\modules\employee\EmployeeOkrPage.tsx`
- Create: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\modules\employee\EmployeeCreateGoalDialog.tsx`
- Test: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\test\employee-create-goal.e2e-spec.ts`
- Test: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\test\employee-create-goal-dialog.test.tsx`

- [ ] 写失败测试，断言员工可新建目标且 KR 默认 `objective`
- [ ] 写前端失败测试，断言切换到 `subjective` 时弹确认提示
- [ ] 运行两组测试确认失败
- [ ] 实现 `POST /api/employee/goals`
- [ ] 为“我的 OKR”增加新建目标入口和弹窗
- [ ] 实现“改成主观项”确认框
- [ ] 运行后端 e2e 与前端测试确认通过

### Task 4: 负责人客观项批量评分

**Files:**
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\infrastructure\repositories\leader\leader.repository.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\infrastructure\repositories\leader\prisma-leader.repository.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\modules\leader\leader.service.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\modules\leader\dto\bulk-score.dto.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\shared\types\leader.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\shared\api\leader.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\modules\leader\LeaderWorkbenchPage.tsx`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\modules\leader\leader-workbench.helpers.ts`
- Test: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\test\leader-bulk-score.e2e-spec.ts`
- Test: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\test\leader-workbench-batch.test.tsx`

- [ ] 写失败测试，断言批量评分只更新 `objective` KR，`subjective` 返回 `subjective-only`
- [ ] 写前端失败测试，断言批量评分入口明确为客观项导向
- [ ] 运行测试确认失败
- [ ] 扩展后端批量评分逻辑与 skip reason
- [ ] 更新前端批量评分文案和 KR 标签显示
- [ ] 运行后端 e2e、前端测试确认通过

### Task 5: 全量验证与文档回填

**Files:**
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\docs\superpowers\specs\2026-04-11-route-c-production-progress-check.md`

- [ ] 运行 `apps/server` 构建和全量 e2e
- [ ] 运行 `apps/web` 单测和 build
- [ ] 运行 `apps/server\scripts\smoke.ps1`
- [ ] 更新生产进度文档，标注本切片完成情况
- [ ] 提交变更
