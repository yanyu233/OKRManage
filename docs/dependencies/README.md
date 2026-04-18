# 项目依赖清单

这份目录用于集中保留当前仓库的依赖清单，包含两类内容：

- 直接依赖：来自 `apps/server/package.json` 与 `apps/web/package.json`
- 传递依赖：来自两个 `package-lock.json`，用于追溯“依赖的依赖”

## 目录说明

- `server-direct-runtime.txt`
  服务端运行时直接依赖，格式为 `包名<TAB>版本范围`
- `server-direct-dev.txt`
  服务端开发期直接依赖，格式为 `包名<TAB>版本范围`
- `server-installed-packages.txt`
  服务端锁定后的唯一安装包清单，格式为 `name@version`
- `server-package-lock-paths.txt`
  服务端完整锁文件包路径清单，格式为 `packagePath<TAB>name<TAB>version<TAB>resolved<TAB>integrity`
- `web-direct-runtime.txt`
  前端运行时直接依赖
- `web-direct-dev.txt`
  前端开发期直接依赖
- `web-installed-packages.txt`
  前端锁定后的唯一安装包清单
- `web-package-lock-paths.txt`
  前端完整锁文件包路径清单
- `summary.json`
  当前生成结果的计数摘要

## 当前技术栈

- 服务端：NestJS 11、Prisma 6、MySQL、Jest
- 前端：React 19、Vite 8、Ant Design 5、React Query 5、Vitest
- 文件预览：kkFileView
- Office 转 PDF 回退：Windows 走 Office COM，Linux 走 `LibreOffice/soffice`

## Linux 服务器系统级依赖

下面这些是当前项目在 Linux 单机部署时建议准备的系统依赖：

- `nodejs` 20.x 与 `npm`
- `mysql-server`
- `openjdk-17-jre-headless`
- `maven`
- `libreoffice`
- `libreoffice-writer`
- `libreoffice-calc`
- `libreoffice-impress`
- `fontconfig`
- `fonts-noto-cjk`
- `curl`
- `unzip`
- `git`
- `build-essential`

补充说明：

- `mysql-server` 是 Prisma `provider = "mysql"` 的运行前提
- `openjdk-17-jre-headless` 用于启动 `kkFileView`
- `maven` 用于从源码编译仓库里的 `kkFileView` 源码包
- `LibreOffice` 不是可选装饰项，当前 Linux 下的 Office 转 PDF 回退能力依赖 `soffice`

## 一键脚本

仓库里新增了两套 Linux 脚本：

- `scripts/linux/install-all-deps.sh`
  一键安装系统依赖、Node 依赖、Prisma Client，并尝试准备本地 MySQL 与 `kkFileView`
- `scripts/linux/start-all.sh`
  一键构建并启动 MySQL（尽力而为）、服务端、前端预览服务、`kkFileView`
- `scripts/linux/stop-all.sh`
  停止 `start-all.sh` 启动的全部进程

## 生成方式

依赖清单不是手写维护的，后续如果锁文件变化，可以重新生成：

```bash
node tools/generate-dependency-manifest.mjs
```

## 推荐部署顺序

```bash
chmod +x scripts/linux/install-all-deps.sh scripts/linux/start-all.sh scripts/linux/stop-all.sh
./scripts/linux/install-all-deps.sh
./scripts/linux/start-all.sh
```

如果后续要切到 `nginx + systemd` 模式，仍可以继续复用已有的：

- `deploy/nginx/okr-preview.conf.example`
- `deploy/systemd/okr-stack.service.example`
- `scripts/linux/start-stack.sh`
- `scripts/linux/stop-stack.sh`
