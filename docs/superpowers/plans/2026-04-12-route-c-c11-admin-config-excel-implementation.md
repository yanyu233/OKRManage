# Route C C11 系统配置 Excel 导入导出 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Route C 系统配置页增加一个总 Excel 工作簿导入导出能力，支持多 sheet 导出和局部 sheet 导入。

**Architecture:** 后端使用服务层生成和解析工作簿，再把局部导入结果合并到当前 bootstrap 并复用现有保存链路。前端只负责下载文件、上传 `.xlsx`、展示导入结果和刷新页面。

**Tech Stack:** NestJS, Prisma, MySQL, React, Vite, Ant Design, Vitest, Jest, ExcelJS

---

### Task 1: 加入 Excel 工作簿能力并定义模块边界

**Files:**
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\package.json`
- Create: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\modules\admin-config\admin-config-excel.service.ts`
- Test: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\test\admin-config-excel.e2e-spec.ts`

- [ ] 写失败测试，先钉住“导出会返回包含核心 sheet 的工作簿”
- [ ] 跑测试确认失败
- [ ] 安装并接入 `exceljs`
- [ ] 实现最小导出 service
- [ ] 跑测试确认通过

### Task 2: 实现导出接口

**Files:**
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\modules\admin-config\admin-config.controller.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\modules\admin-config\admin-config.service.ts`
- Test: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\test\admin-config-excel.e2e-spec.ts`

- [ ] 写失败测试，校验 `GET /api/admin/org/bootstrap/excel` 返回 xlsx 二进制和 sheet 名
- [ ] 跑测试确认失败
- [ ] 实现导出接口、响应头和文件名
- [ ] 跑测试确认通过

### Task 3: 实现局部导入解析与合并

**Files:**
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\modules\admin-config\admin-config-excel.service.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\modules\admin-config\admin-config.service.ts`
- Test: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\test\admin-config-excel.e2e-spec.ts`

- [ ] 写失败测试，钉住“只导入评价组名额 sheet 时只更新该模块”
- [ ] 写失败测试，钉住“只导入模板目标 sheet 时只更新模板模块”
- [ ] 跑测试确认失败
- [ ] 实现工作簿解析、按 sheet 合并到当前 bootstrap、返回 `importedSections`
- [ ] 跑测试确认通过

### Task 4: 接入上传接口与失败事务语义

**Files:**
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\modules\admin-config\admin-config.controller.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\src\modules\admin-config\admin-config.service.ts`
- Test: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\test\admin-config-excel.e2e-spec.ts`

- [ ] 写失败测试，钉住“名额超上限时整次导入失败”
- [ ] 写失败测试，钉住“模板关键结果非法时整次导入失败”
- [ ] 跑测试确认失败
- [ ] 实现 `POST /api/admin/org/bootstrap/excel`
- [ ] 跑测试确认通过

### Task 5: 前端接入导出

**Files:**
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\shared\api\admin.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\modules\admin\AdminOrgPage.tsx`
- Create: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\modules\admin\admin-excel.ts`
- Test: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\test\admin-excel.test.ts`

- [ ] 写失败测试，钉住导出按钮文案和导出文件名 helper
- [ ] 跑测试确认失败
- [ ] 实现前端导出 API 和下载 helper
- [ ] 跑测试确认通过

### Task 6: 前端接入导入

**Files:**
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\shared\api\admin.ts`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\modules\admin\AdminOrgPage.tsx`
- Modify: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\src\modules\admin\admin-excel.ts`
- Test: `C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\web\test\admin-excel.test.ts`

- [ ] 写失败测试，钉住导入只接受 `.xlsx` 且能格式化导入模块提示
- [ ] 跑测试确认失败
- [ ] 实现上传入口、成功提示、失败提示和 bootstrap 刷新
- [ ] 跑测试确认通过

### Task 7: 全量验证

**Files:**
- Verify only

- [ ] 运行 `apps/server` 的 e2e 测试
- [ ] 运行 `apps/server` 构建
- [ ] 运行 `apps/web` 的 Vitest
- [ ] 运行 `apps/web` 构建
- [ ] 手工验证导出、局部导入评价组、局部导入模板目标、错误导入回滚
