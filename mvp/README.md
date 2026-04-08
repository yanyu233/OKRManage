# OKR 管理 MVP

这是一个不依赖 Node.js / Python 运行时的本地调试版 MVP。

- 前端：原生 `HTML / CSS / JavaScript`
- 服务：PowerShell `HttpListener`
- 数据：本地 `JSON`
- 附件：本地 `uploads/`

## 目录说明

- `public/`：页面静态资源
- `data/seed.json`：初始演示数据
- `data/store.json`：运行时数据文件
- `uploads/`：员工上传的证明材料
- `server.ps1`：本地 HTTP 服务
- `reset-data.ps1`：重置数据与附件

## 启动方式

在项目根目录执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\start-mvp.ps1
```

默认地址：

```text
http://localhost:5057
```

停止服务：

```powershell
powershell -ExecutionPolicy Bypass -File .\stop-mvp.ps1
```

重置演示数据：

```powershell
powershell -ExecutionPolicy Bypass -File .\mvp\reset-data.ps1
```

## 当前能力

- 普通员工端：提交本人季度 OKR、保存草稿、维护 KR 进展
- 普通员工端：多附件上传证明材料、在线预览、删除本人附件
- 科室领导端：查看本科室员工 OKR、按员工筛选、按考核表拆项评分
- 部门领导端：查看全员情况、按科室汇总、查看季度总览
- 汇总报表：支持按当前视图导出目标明细和汇总 CSV
- 权限控制：后端按角色限制目标、KR、附件和评分操作
- 体验账号：页面内可直接切换员工 / 科室领导 / 部门领导账号

## 评分规则

- 工作态度：`0-20`
- 工作能力：`0-20`
- 工作业绩：`0-60`
- 考核总分：三项相加
- 考核等级：按总分自动落到 `A / B / C / D / E`

## 关键接口

- `GET /api/bootstrap`
- `PUT /api/session`
- `POST /api/goals`
- `PUT /api/goals/{goalId}`
- `POST /api/goals/{goalId}/krs`
- `PUT /api/krs/{krId}`
- `POST /api/goals/{goalId}/proofs`
- `DELETE /api/proofs/{proofId}`
- `POST /api/goals/{goalId}/review`

## 当前边界

- 仍是本地单机演示，不含真实登录
- 权限以当前体验账号为准，不接企业统一认证
- 附件存储为本地文件，不接对象存储
- 报表导出为前端 CSV，不含正式打印模板
