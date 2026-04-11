# OKR 系统生产化重构进度核对

- 日期：2026-04-11
- 对照文档：[2026-04-08-production-refactor-roadmap-design.md](C:/Users/yanxi/Documents/OKRManage/docs/superpowers/specs/2026-04-08-production-refactor-roadmap-design.md)
- 当前重构分支：`codex/route-c-foundation`
- 当前重构工作区：`C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation`

## 结论

如果按“新架构上的核心业务能力是否已经迁移”来看，Route C 已经接近基本完成。

如果按“是否已经达到公司服务器正式生产可上线标准”来看，目前还没有完成。

当前可以给出两个判断：

1. 应用层重构进度：约 60% 到 70%
2. 生产化配套进度：约 40% 到 50%

换句话说，业务系统主体已经迁到了新的技术栈上，但企业微信真实接入、正式部署、备份恢复、监控告警、并发控制等生产能力还没有闭环。

## 已完成

### 1. 新技术栈底座已建立

- 后端已经从 MVP 的 `PowerShell + JSON` 迁移到 `NestJS + Prisma + MySQL`
- 前端已经从旧的原生页面迁移到 `React + Vite + Ant Design`

关键位置：

- 后端数据模型：[schema.prisma](C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/prisma/schema.prisma)
- 后端启动入口：[main.ts](C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/main.ts)
- 前端应用入口：[main.tsx](C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/web/src/main.tsx)

### 2. 三类角色的主业务页面已经迁移

- 系统管理员端：组织、账号、评价组、档位名额、负责人绑定
- 科室领导/小组负责人端：评分工作台、评分排名
- 员工端：OKR 列表、目标详情、关键结果完成确认、证明材料上传下载

关键位置：

- 系统管理员页：[AdminOrgPage.tsx](C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/web/src/modules/admin/AdminOrgPage.tsx)
- 负责人评分工作台：[LeaderWorkbenchPage.tsx](C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/web/src/modules/leader/LeaderWorkbenchPage.tsx)
- 负责人评分排名：[LeaderRankingPage.tsx](C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/web/src/modules/leader/LeaderRankingPage.tsx)
- 员工 OKR 列表：[EmployeeOkrPage.tsx](C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/web/src/modules/employee/EmployeeOkrPage.tsx)
- 员工目标详情：[EmployeeGoalPage.tsx](C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/web/src/modules/employee/EmployeeGoalPage.tsx)

### 3. 多角色模型已经建立

- 同一用户可以拥有多个角色
- 左侧菜单已经按角色分组显示
- 点击某个角色下的功能菜单时，会自动切换当前激活角色

关键位置：

- 布局主壳：[AppShell.tsx](C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/web/src/modules/layout/AppShell.tsx)
- 路由角色守卫：[RoleRoute.tsx](C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/web/src/modules/layout/RoleRoute.tsx)
- 路由与菜单配置：[routing.tsx](C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/web/src/modules/layout/routing.tsx)

### 4. 会话机制已经从全局当前用户迁移到独立 session

- 不再依赖旧系统里的全局 `currentUserId`
- 现在使用 cookie session
- 支持 `roles + activeRole`
- 支持退出登录和切换当前激活角色

关键位置：

- 认证服务：[auth.service.ts](C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/modules/auth/auth.service.ts)
- session 仓储：[prisma-sessions.repository.ts](C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/infrastructure/repositories/sessions/prisma-sessions.repository.ts)
- session 服务：[session.service.ts](C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/modules/session/session.service.ts)

### 5. 配置外置和认证模式切换已经有基础能力

- 已经通过环境变量管理运行时配置
- 已支持 `AUTH_MODE=local-debug`
- 已支持 `AUTH_MODE=wecom-preferred`
- 本地调试模式可以直接登录，方便当前开发和联调

关键位置：

- 运行时配置：[runtime-config.service.ts](C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/modules/config/runtime-config.service.ts)
- 本地配置样例：[.env.example](C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/.env.example)

### 6. 审计日志和健康检查已有基础实现

- 认证相关审计已落库
- 健康检查接口已可用

关键位置：

- 健康检查：[health.controller.ts](C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/modules/health/health.controller.ts)
- 审计服务：[audit.service.ts](C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/modules/audit/audit.service.ts)

## 部分完成

### 1. 企业微信登录

目前已经完成：

- 统一认证入口
- 企业微信优先登录网关
- 企业微信未映射用户回落到本地登录页
- `wecomUserId` 映射能力

但还没有完成：

- 用真实企业微信 `code` 换取真实 `userid`
- 真实 `corpId / agentId / secret / redirectUri` 的联调

直接证据：

- [auth.service.ts:311](C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/modules/auth/auth.service.ts#L311) 当前 `resolveWecomUserId()` 仍只支持 `mock:` 前缀

### 2. 文件存储改造

目前已经完成：

- 文件存储逻辑已经从业务代码中抽出来
- 上传和读取走统一服务

但还没有完成：

- 迁移到正式的 NAS、共享盘或对象存储
- 存储备份、清理和运维策略

直接证据：

- [local-proof-storage.service.ts](C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/infrastructure/storage/local-proof-storage.service.ts) 当前仍然是本地磁盘实现

### 3. 权限细化

目前已经完成：

- 员工、负责人、系统管理员三类主角色
- 多角色菜单和激活角色控制

但还没有完成：

- 更细粒度的正式生产权限矩阵
- 更严格的服务端统一资源级授权策略梳理

### 4. 环境配置外置

目前已经完成：

- 关键运行参数已经外置到环境变量
- 前后端都能按本地开发模式运行

但还没有完成：

- 分环境配置约定
- 生产环境密钥管理
- 配置校验和部署文档的最终版本

## 未完成

### 1. HTTPS 与反向代理

总方案中要求的正式部署形态还没有落地：

- 没有接 IIS / Nginx / Apache 反向代理
- 没有实际启用 HTTPS
- 没有正式域名接入

### 2. 服务托管

当前仍然主要是开发态启动方式：

- 还没有 Windows Service、PM2、IIS 托管或容器托管方案的落地实现

### 3. 备份与恢复

目前没有看到正式备份恢复闭环：

- 没有数据库备份脚本
- 没有文件备份脚本
- 没有恢复演练脚本

### 4. 错误监控与告警

目前没有看到生产级监控方案落地：

- 没有错误收集平台接入
- 没有告警链路
- 没有统一异常监控面板

### 5. 并发控制

目前没有看到明确的乐观锁或版本冲突处理机制：

- 还没有基于版本号或更新时间的并发写保护
- 多人同时改同一配置或同一业务对象时，生产行为还没有正式收口

### 6. Route C 仍未替换主线运行环境

- 当前新架构仍位于独立 worktree 和分支
- 还没有正式并入主线运行环境

## 当前最值钱的下一步

如果目标是尽快接近公司生产可上线状态，建议下一优先级按这个顺序执行：

1. 真实企业微信登录接入
2. HTTPS、反向代理和正式部署托管
3. 备份与恢复
4. 错误监控与健康告警
5. 并发控制
6. 正式文件存储迁移

## 当前判断

Route C 已经不再只是底座验证，而是一套可以本地调试、可以演示核心业务流程的新系统。

但它目前仍然更接近“生产化重构中的高完成度开发版本”，还不是“已经可以直接挂到公司正式服务器上的最终生产版本”。

下一阶段不应该再优先堆新的业务页面，而应该优先把企业微信真实接入、部署托管、备份、监控和并发控制补齐。
