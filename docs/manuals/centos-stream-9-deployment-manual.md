# OKR 系统 CentOS Stream 9 部署手册

更新时间：2026-04-21  
适用范围：`CentOS Stream 9`，以及兼容的 `Rocky Linux 9 / AlmaLinux 9`

## 1. 说明

这份手册是给 `CentOS Stream 9` 单独准备的部署版。  
和 Ubuntu / Debian 不同，这里重点处理的是：

- `dnf / yum` 安装链路
- `mysql-community-server` 与 `mysqld` 服务名
- `LibreOffice` 在 EL9 环境下的安装方式
- `firewalld / SELinux` 额外检查

补充说明：
- 2026-04-21 这次版本只修正了“知识库手动上传 ZIP 文件预览会直接下载”的问题。
- 这次改动不新增任何 CentOS 系统依赖，也不新增端口、环境变量、数据库迁移或额外服务。
- 现有 `scripts/linux/install-all-deps-centos.sh`、`scripts/linux/start-all.sh`、`deploy/systemd/okr-stack-centos.service.example` 无需因为这次改动而调整。
- 如果服务器已经跑着旧版本，这次升级只需要重新构建前后端并重启现有服务。

如果你只想看通用资源规格、Nginx 和 systemd 思路，也可以配合查看：

- [Linux 服务器部署手册](C:/Users/yanxi/Documents/OKRManage/docs/manuals/linux-server-deployment-manual.md)

## 2. 推荐结论

当前项目如果部署到 CentOS 系，推荐这样落地：

- 操作系统：`CentOS Stream 9`
- 架构：`x86_64`
- 部署目录：`/srv/okr`
- 数据库：`MySQL Community Server`
- MySQL 初始 root 密码默认：`Moutai123.`
- 预览链路：
  - `kkFileView` 负责 Excel 等在线预览
  - `LibreOffice` 负责 Linux 下 Office 转 PDF 回退
- 进程托管：
  - 验收阶段先用项目脚本启动
  - 稳定后切到 `Nginx + systemd`

不建议继续使用：

- `CentOS 7`

## 3. 当前仓库里怎么用

这次已经补了一个 CentOS 专用安装脚本：

- [`install-all-deps-centos.sh`](C:/Users/yanxi/Documents/OKRManage/scripts/linux/install-all-deps-centos.sh)

同时补了跨发行版的 MySQL 服务名兼容：

- [`start-all.sh`](C:/Users/yanxi/Documents/OKRManage/scripts/linux/start-all.sh)
- [`install-all-deps.sh`](C:/Users/yanxi/Documents/OKRManage/scripts/linux/install-all-deps.sh)

另外补了 CentOS 专用的 `systemd` 示例文件：

- [`okr-stack-centos.service.example`](C:/Users/yanxi/Documents/OKRManage/deploy/systemd/okr-stack-centos.service.example)
- [`okr-stack-centos.sysconfig.example`](C:/Users/yanxi/Documents/OKRManage/deploy/systemd/okr-stack-centos.sysconfig.example)

也就是说，CentOS 上推荐这样分工：

1. 用 `install-all-deps-centos.sh` 安装依赖
2. 用 `start-all.sh` 启动应用
3. 后续继续沿用现有的 `Nginx + systemd` 示例

## 4. 部署前检查

### 4.1 服务器要求

建议至少满足：

- `4 vCPU / 8 GB / 100 GB SSD` 作为试运行环境
- 正式环境建议 `8 vCPU / 16 GB / 200 GB SSD`

### 4.2 需要放行的端口

- `80/443`
- `3000`
- `4173`
- `8012`
- `3306` 仅在需要远程访问数据库时开放

### 4.3 需要的外网访问

服务器至少需要能访问：

- `rpm.nodesource.com`
- `registry.npmjs.org`
- `dev.mysql.com`
- `repo.mysql.com`
- `download.documentfoundation.org`

## 5. 第一步：准备代码目录

```bash
sudo mkdir -p /srv/okr
sudo chown -R $USER:$USER /srv/okr
cd /srv/okr
```

拉取代码：

```bash
git clone <你的仓库地址> /srv/okr
cd /srv/okr
```

或者上传压缩包后解压：

```bash
cd /srv/okr
unzip OKRManage.zip
cd OKRManage
```

赋执行权限：

```bash
chmod +x scripts/linux/install-all-deps-centos.sh
chmod +x scripts/linux/start-all.sh
chmod +x scripts/linux/stop-all.sh
chmod +x scripts/linux/start-stack.sh
chmod +x scripts/linux/start-kkfileview.sh
chmod +x scripts/linux/stop-stack.sh
chmod +x scripts/linux/stop-kkfileview.sh
```

## 6. 第二步：配置环境变量

服务端环境文件：

```bash
cp apps/server/.env.example apps/server/.env.local
vim apps/server/.env.local
```

建议的最小示例：

```env
PORT=3000
NODE_ENV=production
AUTH_MODE=wecom-preferred
SESSION_COOKIE_NAME=okr_sid
SESSION_TTL_MINUTES=480
FRONTEND_ORIGINS=http://你的域名
DATABASE_URL="mysql://okr_user:StrongPassword@127.0.0.1:3306/okr_prod"
APP_BASE_URL=http://你的域名
WEB_BASE_URL=http://你的域名
PROOF_STORAGE_DIR=storage/proofs
KKFILEVIEW_PUBLIC_BASE_URL=http://你的域名/preview
KKFILEVIEW_SOURCE_BASE_URL=http://127.0.0.1:3000
KKFILEVIEW_PREVIEW_TOKEN=请替换为复杂随机字符串
DEBUG_SYSADMIN_LOGIN=sysadmin.local
DEBUG_SYSADMIN_PASSWORD=请替换为复杂密码
DEBUG_SYSADMIN_NAME=系统管理员
LIBREOFFICE_EXECUTABLE_PATH=/usr/bin/soffice
```

如果企业微信认证已准备好，再补：

```env
WECOM_CORP_ID=xxx
WECOM_AGENT_ID=xxx
WECOM_SECRET=xxx
WECOM_REDIRECT_URI=http://你的域名/api/auth/wecom/callback
```

## 7. 第三步：数据库初始化策略

CentOS 上如果你使用 `mysql-community-server`，通常会遇到一个和 Ubuntu 不同的点：

- 首次安装后，`root` 会生成临时密码
- 服务名通常是 `mysqld`

这次已经把自动处理逻辑补进脚本里了，默认行为是：

- 自动识别 `/var/log/mysqld.log` 里的临时 root 密码
- 自动把 root 重置为 `Moutai123.`
- 然后继续执行建库、建账号和 Prisma 迁移

所以数据库这块现在有两种走法：

1. 直接让脚本全自动处理
2. 你先手工初始化，再让脚本继续后半段

### 7.1 推荐做法：先手工建库建账号

安装完 MySQL 后，先查看临时 root 密码：

```bash
sudo grep 'temporary password' /var/log/mysqld.log
```

然后登录：

```bash
mysql -uroot -p --connect-expired-password
```

进入 MySQL 后建议先改 root 密码：

```sql
ALTER USER 'root'@'localhost' IDENTIFIED BY 'RootPassword123!';
```

然后创建业务数据库和账号：

```sql
CREATE DATABASE IF NOT EXISTS okr_prod CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'okr_user'@'localhost' IDENTIFIED BY 'StrongPassword';
CREATE USER IF NOT EXISTS 'okr_user'@'127.0.0.1' IDENTIFIED BY 'StrongPassword';
GRANT ALL PRIVILEGES ON okr_prod.* TO 'okr_user'@'localhost';
GRANT ALL PRIVILEGES ON okr_prod.* TO 'okr_user'@'127.0.0.1';
FLUSH PRIVILEGES;
EXIT;
```

然后把 `.env.local` 里的 `DATABASE_URL` 改成：

```env
DATABASE_URL="mysql://okr_user:StrongPassword@127.0.0.1:3306/okr_prod"
```

### 7.2 如果你希望安装脚本代建数据库

CentOS 脚本现在默认就会先尝试把 root 初始化成 `Moutai123.`，然后再代建数据库。  
如果你要改成别的 root 密码，可以在执行前覆盖：

```bash
export OKR_MYSQL_ROOT_PASSWORD='YourRootPassword'
```

如果 MySQL 已经不是首次安装，且 root 当前密码不是 `Moutai123.`，则可以显式提供当前管理员凭据，例如：

```bash
export OKR_DB_ADMIN_USER=root
export OKR_DB_ADMIN_PASSWORD='RootPassword123!'
./scripts/linux/install-all-deps-centos.sh
```

如果 root 密码仍处于临时过期状态，再加：

```bash
export OKR_DB_ADMIN_CONNECT_EXPIRED_PASSWORD=1
```

## 8. 第四步：一键安装依赖

推荐直接执行：

```bash
cd /srv/okr
./scripts/linux/install-all-deps-centos.sh
```

如果你接受默认 root 密码 `Moutai123.`，这里不需要额外加参数。  
如果你想自定义 root 密码，再执行前设置：

```bash
export OKR_MYSQL_ROOT_PASSWORD='YourRootPassword'
./scripts/linux/install-all-deps-centos.sh
```

这个脚本会处理：

- 基础工具安装
- Node.js 20
- Java 17
- Maven
- MySQL 社区版
- LibreOffice
- 前后端 `npm ci`
- Prisma 生成与迁移
- `kkFileView` 编译和落地

## 9. LibreOffice 安装说明

CentOS 脚本支持三种模式：

### 9.1 自动模式

默认就是自动模式：

```bash
export OKR_LIBREOFFICE_INSTALL_MODE=auto
```

行为是：

1. 优先尝试你提供的 LibreOffice 官方 RPM 压缩包
2. 如果没提供，再回退尝试系统仓库安装

### 9.2 官方 RPM 包模式

如果你已经有 LibreOffice 官方 RPM 压缩包下载地址，可以显式指定：

```bash
export OKR_LIBREOFFICE_INSTALL_MODE=official-only
export OKR_LIBREOFFICE_RPM_ARCHIVE_URL='https://download.documentfoundation.org/libreoffice/stable/<版本>/rpm/x86_64/LibreOffice_<版本>_Linux_x86-64_rpm.tar.gz'
./scripts/linux/install-all-deps-centos.sh
```

如果是你已经把压缩包放到了服务器本地，则可以这样：

```bash
export OKR_LIBREOFFICE_INSTALL_MODE=official-only
export OKR_LIBREOFFICE_RPM_ARCHIVE_PATH='/srv/okr/packages/LibreOffice_xxx_Linux_x86-64_rpm.tar.gz'
./scripts/linux/install-all-deps-centos.sh
```

### 9.3 仓库模式

如果你想简单一点，也可以强制走系统仓库：

```bash
export OKR_LIBREOFFICE_INSTALL_MODE=repo-only
./scripts/linux/install-all-deps-centos.sh
```

## 10. 第五步：启动项目

依赖安装完成后，直接启动：

```bash
cd /srv/okr
./scripts/linux/start-all.sh
```

默认访问：

- 后端：`http://127.0.0.1:3000`
- 前端：`http://127.0.0.1:4173`
- 预览代理：`http://127.0.0.1:3000/preview`

停止：

```bash
cd /srv/okr
./scripts/linux/stop-all.sh
```

## 11. 第六步：健康检查

如果你是从旧版本升级到当前版本，建议先按下面的顺序完成一次升级发布，再执行本节检查：

```bash
cd /srv/okr
git pull
cd apps/server && npm ci && npx prisma generate && npx prisma migrate deploy && npm run build
cd /srv/okr/apps/web && npm ci && npm run build
cd /srv/okr && ./scripts/linux/stop-all.sh && ./scripts/linux/start-all.sh
```

如果已经改成 `systemd + Nginx` 托管，则最后一步改成：

```bash
sudo systemctl restart okr-stack
sudo systemctl reload nginx
```

后端健康检查：

```bash
curl http://127.0.0.1:3000/health
```

预览能力健康检查：

```bash
curl http://127.0.0.1:3000/health/preview
```

在 CentOS 上，重点看：

- `preferredEngine`
- `officeToPdfAvailable`
- `libreOffice.available`

正常预期：

- `preferredEngine = libreoffice`
- `officeToPdfAvailable = true`
- `libreOffice.available = true`
- 知识库手动上传的 `zip` 文件点击“预览”后进入压缩包清单页，而不是直接下载
- 压缩包清单页里的文件名点击后仍可继续预览或下载

## 12. 第七步：CentOS 额外检查项

### 12.1 firewalld

如果启用了 `firewalld`，记得放行端口：

```bash
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

如果要临时开放调试端口，也可以：

```bash
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --permanent --add-port=4173/tcp
sudo firewall-cmd --permanent --add-port=8012/tcp
sudo firewall-cmd --reload
```

正式环境更建议只对外开放 `80/443`。

### 12.2 SELinux

如果 Nginx 已经起来，但访问 `/api/` 或 `/preview/` 出现代理异常，优先检查：

```bash
getenforce
```

如果是 `Enforcing`，而且你确认是反向代理被 SELinux 拦住，可以先临时验证：

```bash
sudo setsebool -P httpd_can_network_connect 1
```

## 13. 第八步：接入 Nginx 和 systemd

Nginx 配置仍然复用现有仓库示例：

- [okr-preview.conf.example](C:/Users/yanxi/Documents/OKRManage/deploy/nginx/okr-preview.conf.example)

CentOS 的 `systemd` 建议直接用这次新增的示例：

- [okr-stack-centos.service.example](C:/Users/yanxi/Documents/OKRManage/deploy/systemd/okr-stack-centos.service.example)
- [okr-stack-centos.sysconfig.example](C:/Users/yanxi/Documents/OKRManage/deploy/systemd/okr-stack-centos.sysconfig.example)

这套示例默认是：

- `systemd` 直接调用 `start-all.sh`
- 自动带上 MySQL 启动、Prisma 迁移和构建
- 通过 `OKR_START_WEB=0` 关闭内置 Web 预览，交给 Nginx 托管前端

建议顺序：

1. 先用 `start-all.sh` 跑通
2. 完成业务验收
3. 再切到 `Nginx + systemd`

### 13.1 Nginx 安装与配置

```bash
sudo dnf install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
sudo cp deploy/nginx/okr-preview.conf.example /etc/nginx/conf.d/okr.conf
sudo nginx -t
sudo systemctl reload nginx
```

如果你准备由 Nginx 托管前端静态文件，记得先发布：

```bash
sudo mkdir -p /srv/okr/web
sudo cp -R apps/web/dist/. /srv/okr/web/
```

### 13.2 systemd 安装与配置

```bash
sudo cp deploy/systemd/okr-stack-centos.service.example /etc/systemd/system/okr-stack.service
sudo cp deploy/systemd/okr-stack-centos.sysconfig.example /etc/sysconfig/okr-stack
sudo systemctl daemon-reload
sudo systemctl enable okr-stack
sudo systemctl start okr-stack
```

查看状态：

```bash
sudo systemctl status okr-stack
journalctl -u okr-stack -n 100 --no-pager
```

## 14. 常见问题

### 14.1 `mysqld` 已安装但脚本没有启动数据库

这次已经在启动脚本里补了 `mysql / mysqld / mariadb` 自动识别。  
如果仍然没启动，先手工检查：

```bash
sudo systemctl status mysqld
```

### 14.2 `prisma migrate deploy` 失败

优先看：

- 数据库是否真的已创建
- `okr_user` 是否已授权
- `.env.local` 中的 `DATABASE_URL` 是否正确

### 14.3 `soffice` 找不到

先检查：

```bash
which soffice
soffice --version
```

如果命令存在，但程序仍报错，建议在 `.env.local` 里显式写：

```env
LIBREOFFICE_EXECUTABLE_PATH=/usr/bin/soffice
```

### 14.4 预览打不开

按这个顺序检查：

1. `curl http://127.0.0.1:3000/health/preview`
2. `tail -n 100 vendor/kkfileview/current/log/kkFileView.log`
3. `KKFILEVIEW_PUBLIC_BASE_URL`
4. `KKFILEVIEW_SOURCE_BASE_URL`
5. `KKFILEVIEW_PREVIEW_TOKEN`

## 15. 最终建议

如果你接下来就是要上 CentOS 服务器，最稳的做法是：

1. 先按这份手册准备 `CentOS Stream 9`
2. 直接用默认 root 密码 `Moutai123.` 跑安装脚本，或按需覆盖 `OKR_MYSQL_ROOT_PASSWORD`
3. 再跑 `install-all-deps-centos.sh`
4. 用 `start-all.sh` 做首轮验收
5. 验收通过后再切 `Nginx + systemd`
