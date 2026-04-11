# Route C 中文示例数据与工具栏筛选 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Route C 的英文演示数据改为中文，并为员工端、评分工作台、评分排名补回“搜索 + 年度 + 季度”工具栏。

**Architecture:** 后端只调整 seed 展示数据，不改数据模型和搜索协议。前端通过新增轻量筛选 helper 和共享工具栏布局，在本地状态中管理 `keyword / year / quarter`，时间切换继续请求后端，搜索在当前已加载数据上做本地筛选。

**Tech Stack:** NestJS, Prisma, MySQL, React, Vite, Ant Design, TanStack Query, Vitest, Jest e2e

---

### Task 1: 补文档与失败测试

**Files:**
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\test\employee.helpers.test.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\test\leader-workbench.helpers.test.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\test\leader-ranking.helpers.test.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\test\employee-okr.e2e-spec.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\test\leader-workbench.e2e-spec.ts`

- [ ] 为员工端 helper 测试增加“按关键词筛选目标”和“生成年度选项”的失败用例
- [ ] 为负责人工作台 helper 测试增加“按关键词筛选员工/目标/KR”的失败用例
- [ ] 为评分排名 helper 测试增加“按关键词筛选排名项”的失败用例
- [ ] 为后端 e2e 增加中文 seed 断言，确认接口返回中文目标或中文姓名
- [ ] 运行对应测试，确认在实现前出现预期失败

### Task 2: 提取前端筛选 helper

**Files:**
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\modules\employee\employee.helpers.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\modules\leader\leader-workbench.helpers.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\modules\leader\leader-ranking.helpers.ts`
- Create: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\shared\ui\toolbar-options.ts`

- [ ] 在员工 helper 中新增目标筛选逻辑和年份/季度选项 helper
- [ ] 在工作台 helper 中新增员工、目标、关键结果过滤函数
- [ ] 在评分排名 helper 中新增排名项和目标明细过滤函数
- [ ] 提取共享的年度/季度选项生成函数
- [ ] 重新运行 helper 相关测试，确认转绿

### Task 3: 更新中文标签和页面工具栏

**Files:**
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\shared\i18n\labels.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\modules\employee\EmployeeOkrPage.tsx`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\modules\leader\LeaderWorkbenchPage.tsx`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\modules\leader\LeaderRankingPage.tsx`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\modules\employee\employee.css`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\modules\leader\leader.css`

- [ ] 修正通用中文标签文件中的乱码文案
- [ ] 在我的 OKR 页面接入搜索、年度、季度工具栏
- [ ] 在评分工作台页面接入搜索、年度、季度工具栏
- [ ] 在评分排名页面接入搜索、年度、季度工具栏
- [ ] 调整样式，保证工具栏在桌面端和窄屏下布局稳定

### Task 4: 更新 Route C 中文 seed

**Files:**
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\prisma\seed.ts`

- [ ] 将部门、科室、评价组、用户姓名改为中文演示数据
- [ ] 将目标、关键结果、材料名称与备注改为中文演示数据
- [ ] 保留现有账号登录名与密码不变，避免影响本地调试

### Task 5: 全量验证与本地调试回归

**Files:**
- Verify only

- [ ] 运行 `apps\web` 的测试与构建
- [ ] 运行 `apps\server` 的 e2e、build 和 smoke
- [ ] 重置数据库并重新 seed
- [ ] 启动 Route C 本地调试模式
- [ ] 手工验证员工端、评分工作台、评分排名都出现工具栏且中文正常
