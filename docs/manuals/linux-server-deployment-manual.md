# OKR 系统 Linux 服务器部署手册

更新时间：2026-04-21  
适用范围：当前 `OKRManage` 仓库，Ubuntu / Debian `apt` 系 Linux 服务器

## 1. 说明

这份手册按当前仓库里的现成脚本整理，目标是让我们按 Linux 服务器真实部署顺序直接操作。  
需要说明的是：我这边还没有在你的真实 Linux 服务器上逐条执行 `apt / mysql / libreoffice / kkFileView` 全流程，这份文档是基于当前仓库脚本、配置项和启动链路整理出来的实操版手册，适合你们后续上服务器时直接照着执行。

当前项目已经内置了 Linux 部署脚本：

- `scripts/linux/install-all-deps.sh`
- `scripts/linux/install-all-deps-centos.sh`
- `scripts/linux/start-all.sh`
- `scripts/linux/stop-all.sh`
- `scripts/linux/start-stack.sh`
- `scripts/linux/start-kkfileview.sh`

同时也提供了可选的部署示例：

- `deploy/nginx/okr-preview.conf.example`
- `deploy/systemd/okr-stack.service.example`
- `deploy/systemd/okr-stack-centos.service.example`
- `deploy/systemd/okr-stack-centos.sysconfig.example`

补充说明：
- 2026-04-21 这次版本只修正了“知识库手动上传 ZIP 文件预览会直接下载”的问题。
- 这次改动不新增任何 Linux 系统依赖，也不新增端口、环境变量、数据库表或额外服务。
- 现有部署脚本 `install-all-deps.sh`、`install-all-deps-centos.sh`、`start-all.sh`、`start-stack.sh` 都可以继续沿用。
- 如果服务器上已经部署过旧版本，这次升级只需要重新发布代码、重新构建前后端并重启服务即可。

如果部署目标是 `CentOS Stream 9`，建议直接配合这份单独手册使用：

- [CentOS Stream 9 部署手册](C:/Users/yanxi/Documents/OKRManage/docs/manuals/centos-stream-9-deployment-manual.md)

## 2. 部署目标与端口规划

推荐按下面这套端口规划部署：

- Web 前端预览服务：`4173`
- Node 后端：`3000`
- kkFileView：`8012`
- MySQL：`3306`
- Nginx：`80` 或 `443`

推荐部署目录：

```bash
/srv/okr
```

推荐运行形态分两步：

1. 先用项目自带脚本把服务跑起来，完成首轮验收。
2. 验收通过后，再切到 `nginx + systemd` 托管。

### 2.1 服务器与资源需求

当前项目在 Linux 上的主要资源消耗来自这几部分：

- `Node.js` 后端服务
- `MySQL` 数据库
- `kkFileView` Java 进程
- `LibreOffice/soffice` 的 Office 转 PDF 转换
- 上传文件、预览缓存、数据库数据

其中最容易拉高资源占用的场景是：

- 多人同时预览 `docx / pptx / xlsx`
- 大体积 Excel 或 PPT 文件预览
- 上传材料较多，长期累积文件与缓存

建议按下面三档来准备服务器：

| 场景 | CPU | 内存 | 系统盘 / 数据盘 | 适用说明 |
| --- | --- | --- | --- | --- |
| 本地测试 / 演示 | 2 vCPU | 4 GB | 60 GB SSD | 仅少量账号验证功能，可跑通系统，但 Office 预览并发能力较弱 |
| 部门试运行 | 4 vCPU | 8 GB | 100 GB SSD | 适合几十人规模、日常使用不高峰的单机部署 |
| 正式生产推荐 | 8 vCPU | 16 GB | 200 GB SSD | 更适合长期使用、多人同时上传与预览材料的场景 |

如果你们后面预计会出现下面任一情况，建议直接按更高一档准备：

- 同时在线人数较多
- 单个季度材料很多，且文件体积偏大
- Excel 预览和 Office 转 PDF 使用频率较高
- 数据库、上传文件、预览缓存都放在同一台机器

### 2.2 单机部署的资源拆分建议

如果采用当前这套“单机部署”模式，建议至少按下面的思路预留资源：

- `Node.js` 后端：常驻约 `300 MB - 800 MB`
- `MySQL`：常驻约 `500 MB - 1.5 GB`
- `kkFileView` Java 进程：常驻约 `700 MB - 1.5 GB`
- `LibreOffice` 转换进程：单次转换高峰约 `300 MB - 1 GB`
- `Nginx`：通常较轻，预留 `100 MB - 200 MB`

所以在实际生产里，如果总内存只有 `4 GB`，系统虽然不一定完全起不来，但一旦出现：

- 文件上传
- 文档转 PDF
- kkFileView 预览
- 数据库查询

这些操作叠加，就容易出现卡顿、预览失败或进程被系统回收。  
也因此，正式环境我更建议至少 `8 GB` 起步，最好 `16 GB`。

### 2.3 磁盘空间建议

磁盘不要只按程序本体估算，真正持续增长的是业务文件。

建议把磁盘分成三类去理解：

- 系统与基础依赖
  - Ubuntu / Debian 基础系统
  - Node.js / Java / Maven / MySQL / LibreOffice / Nginx
- 项目运行目录
  - 仓库代码
  - `node_modules`
  - 前后端构建产物
  - `kkFileView` 编译产物
- 业务数据目录
  - MySQL 数据库
  - 上传的证明材料
  - 预览缓存
  - 日志文件

按经验建议这样预留：

- 系统和依赖：预留 `20 GB - 30 GB`
- 项目与构建产物：预留 `10 GB - 20 GB`
- 业务数据：至少预留 `30 GB - 150 GB`

如果你们希望服务器先上一个比较稳妥、不容易很快打满的容量，建议：

- 测试环境：`60 GB SSD`
- 试运行环境：`100 GB SSD`
- 正式环境：`200 GB SSD` 起步

另外建议把下面两个目录纳入重点关注：

- `apps/server/storage/proofs`
- `apps/server/storage/kkfileview-cache`

这两个目录通常会随着使用时间不断增长。

### 2.4 网络与带宽建议

如果系统主要在公司内网访问，带宽压力通常不会像公网那样明显，但仍建议：

- 测试 / 演示：`10 Mbps` 以上即可
- 正常部门使用：`50 Mbps` 以上更稳妥
- 如果文件预览很多，尤其是大 Excel、大 PPT，建议服务器与用户网络链路稳定优先于单纯带宽数字

### 2.5 更稳妥的正式环境建议

如果你们准备正式上线，而不是只做验证，建议按这个口径申请资源：

- 应用服务器：`8 vCPU / 16 GB / 200 GB SSD`
- 数据库先可与应用同机，但后续数据增长后建议独立
- 上传文件和预览缓存建议定期清理或迁移到独立数据盘
- 至少保留数据库备份与上传目录备份

如果后面人员规模再扩大，建议优先考虑这两个方向：

1. 把数据库从应用机拆出去
2. 把上传文件与预览缓存迁到单独存储

## 3. 服务器前置条件

建议先确认下面几点：

- 服务器系统为 Ubuntu 22.04 / Debian 12 或其他兼容 `apt-get` 的发行版
- 当前账号具备 `sudo` 权限
- 服务器可访问外网，至少能访问：
  - NodeSource
  - npm registry
  - Ubuntu / Debian apt 源
- 如果要编译 `kkFileView`，仓库里已经具备以下之一：
  - `vendor/kkfileview/source/kkFileView` 源码目录
  - 根目录下的 `kkFileView-4.4.0.zip`
  - 根目录下的 `kkFileView-main.zip`
- 放行端口：
  - `80/443`
  - `3000`
  - `4173`
  - `8012`
  - `3306` 仅在需要远程数据库连接时开放

### 3.1 如果部署目标改为 CentOS，方案和流程有什么变化

有变化，但不是整套推倒重来，而是：

- 总体部署架构不变
  - 仍然是 `Node.js + MySQL + kkFileView + LibreOffice + Nginx + systemd`
  - 仍然使用同一套 `.env.local`
  - 仍然执行 `npm ci`、`prisma generate`、`prisma migrate deploy`、前后端 build、再启动服务
- 主要变化集中在“系统依赖安装方式”
  - `apt-get` 改为 `dnf` 或 `yum`
  - Node.js 改走 RPM 仓库
  - MySQL 改走 MySQL Yum Repository
  - LibreOffice 在 RHEL / CentOS 9 系上更建议用官方 RPM 包，而不是直接照搬 Ubuntu 的安装方式
- 现有仓库脚本里真正不兼容 CentOS 的，主要是：
  - `scripts/linux/install-all-deps.sh`
  - 它现在是按 `apt-get` 写死的，不能直接在 CentOS 上原样执行
- 现有仓库脚本里基本仍可继续复用的，主要是：
  - `scripts/linux/start-all.sh`
  - `scripts/linux/start-stack.sh`
  - `scripts/linux/start-kkfileview.sh`
  - `scripts/linux/stop-all.sh`
  - `deploy/nginx/okr-preview.conf.example`
  - `deploy/systemd/okr-stack.service.example`

### 3.2 CentOS 建议版本

更建议：

- `CentOS Stream 9`
- 或者同类的 `Rocky Linux 9 / AlmaLinux 9`

不建议再上：

- `CentOS 7`

原因很直接：

- 当前项目用的是 `Node.js 20`
- `NodeSource` 当前对 RPM 发行版给出的 `Node.js 20` 支持范围是 `RedHat 8 / 9`
- `CentOS 7` 在这条链路上会更容易遇到依赖版本和仓库兼容性问题

### 3.3 CentOS 上哪些步骤不变

下面这些基本不变：

1. 准备代码目录，例如 `/srv/okr`
2. 准备 `apps/server/.env.local`
3. 配置 `DATABASE_URL`、`APP_BASE_URL`、`WEB_BASE_URL`
4. 编译并落地 `kkFileView`
5. 执行：
   - `npm ci`
   - `npx prisma generate`
   - `npx prisma migrate deploy`
   - `npm run build`
6. 启动：
   - Node 后端
   - kkFileView
   - Web 静态服务或 Nginx
7. 接入 `systemd` 和 `nginx`

### 3.4 CentOS 上哪些步骤要改

主要改这几类：

#### 3.4.1 包管理器

Ubuntu / Debian：

```bash
apt-get install ...
```

CentOS / RHEL：

```bash
dnf install ...
```

如果是较老环境，也可能仍然使用：

```bash
yum install ...
```

#### 3.4.2 Node.js 20 安装方式

Ubuntu 版脚本现在走的是 `deb.nodesource.com` 的 `deb` 安装链路。  
CentOS 上应改成 RPM 安装链路。

#### 3.4.3 MySQL 安装方式

Ubuntu 上可直接 `apt install mysql-server`。  
CentOS 上更稳妥的方式是先接入官方 `MySQL Yum Repository`，再安装 `mysql-community-server`。

#### 3.4.4 LibreOffice 安装方式

Ubuntu 上可以直接从系统仓库装 `libreoffice`。  
而在 RHEL 9 系文档里，`LibreOffice` 的 RPM 包已经被标记为弃用，官方建议改用 The Document Foundation 提供的官方包来源。

对我们这个项目来说，因为当前 Linux 下的 Office 转 PDF 回退依赖 `soffice` 命令，所以：

- 不建议走 Flatpak
- 更建议直接安装 LibreOffice 官方 RPM 包

#### 3.4.5 SELinux / 防火墙

CentOS 默认更常见的问题是：

- `firewalld` 未放行端口
- `SELinux` 限制 Nginx 或本地反向代理访问后端端口

所以比 Ubuntu 额外多一层排查点。

### 3.5 CentOS 推荐部署顺序

如果你现在的目标服务器是 `CentOS Stream 9`，建议按下面的顺序操作：

1. 安装基础工具
   - `dnf install -y curl unzip git gcc gcc-c++ make lsof fontconfig`
2. 安装 Node.js 20
   - 使用 NodeSource 的 RPM 仓库方式
3. 安装 Java 17 和 Maven
   - `dnf install -y java-17-openjdk java-17-openjdk-devel maven`
4. 安装 MySQL
   - 接入 MySQL 官方 Yum 仓库
   - 安装 `mysql-community-server`
5. 安装 LibreOffice
   - 优先使用 LibreOffice 官方 RPM 包
6. 配置环境变量
   - `apps/server/.env.local`
7. 安装前后端依赖
   - `npm ci`
8. 执行数据库初始化
   - `npx prisma generate`
   - `npx prisma migrate deploy`
9. 编译项目
   - 前端 build
   - 后端 build
   - `kkFileView` 编译和落地
10. 先用脚本启动服务完成首轮验收
11. 再接入 `Nginx + systemd`

### 3.6 对当前仓库脚本的影响

如果你只是问“部署方案和流程是否有变化”，结论是：

- 有变化
- 但变化主要集中在“依赖安装脚本”和“系统服务配置”
- 应用本身的启动链路和运行结构不需要重做

如果下一步你要真正落地到 CentOS，我建议直接做两件事：

1. 单独补一份 `CentOS Stream 9` 的部署手册
2. 新增一个 `scripts/linux/install-all-deps-centos.sh`

这两项现在都已经补上了，后续直接优先使用：

- `docs/manuals/centos-stream-9-deployment-manual.md`
- `scripts/linux/install-all-deps-centos.sh`

其中 CentOS 安装脚本默认会尝试把 MySQL root 初始化为：

- `Moutai123.`

## 4. 第一步：准备目录与代码

### 4.1 创建目录

```bash
sudo mkdir -p /srv/okr
sudo chown -R $USER:$USER /srv/okr
cd /srv/okr
```

### 4.2 上传或拉取代码

如果服务器能直接访问 Git：

```bash
git clone <你的仓库地址> /srv/okr
cd /srv/okr
```

如果是本地打包上传：

```bash
cd /srv/okr
unzip OKRManage.zip
cd OKRManage
```

### 4.3 赋执行权限

```bash
cd /srv/okr
chmod +x scripts/linux/install-all-deps.sh
chmod +x scripts/linux/start-all.sh
chmod +x scripts/linux/stop-all.sh
chmod +x scripts/linux/start-stack.sh
chmod +x scripts/linux/start-kkfileview.sh
chmod +x scripts/linux/stop-stack.sh
chmod +x scripts/linux/stop-kkfileview.sh
```

## 5. 第二步：配置服务环境变量

服务端环境文件位置：

```bash
apps/server/.env.local
```

如果还没有环境文件，可先复制模板：

```bash
cp apps/server/.env.example apps/server/.env.local
```

推荐先编辑：

```bash
vim apps/server/.env.local
```

Linux 服务器最小可用示例：

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

如果企业微信认证已经准备好，再补齐：

```env
WECOM_CORP_ID=xxx
WECOM_AGENT_ID=xxx
WECOM_SECRET=xxx
WECOM_REDIRECT_URI=http://你的域名/api/auth/wecom/callback
```

说明：

- `AUTH_MODE=wecom-preferred` 表示优先企业微信认证，但本地账号兜底登录仍可保留
- `LIBREOFFICE_EXECUTABLE_PATH` 在 Linux 上建议明确写成 `/usr/bin/soffice`
- `KKFILEVIEW_PUBLIC_BASE_URL` 建议走 Nginx 的 `/preview`
- `KKFILEVIEW_SOURCE_BASE_URL` 通常保持后端本地地址 `http://127.0.0.1:3000`

## 6. 第三步：安装系统依赖

项目已经提供一键脚本，脚本会完成这些事情：

- 安装基础工具：`curl`、`git`、`unzip`、`fontconfig`、`build-essential`
- 安装 Node.js 20.x
- 安装 MySQL
- 安装 Java 17
- 安装 Maven
- 安装 LibreOffice
- 安装中文字体 `fonts-noto-cjk`
- 安装前后端 npm 依赖
- 生成 Prisma Client
- 执行 Prisma 数据库迁移
- 在本地 MySQL 场景下尝试创建数据库
- 编译并落地 `kkFileView`

直接执行：

```bash
cd /srv/okr
./scripts/linux/install-all-deps.sh
```

### 6.1 如果你想手工先建库建账号

推荐先执行一次：

```bash
sudo mysql
```

然后执行：

```sql
CREATE DATABASE IF NOT EXISTS okr_prod CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'okr_user'@'localhost' IDENTIFIED BY 'StrongPassword';
CREATE USER IF NOT EXISTS 'okr_user'@'127.0.0.1' IDENTIFIED BY 'StrongPassword';
GRANT ALL PRIVILEGES ON okr_prod.* TO 'okr_user'@'localhost';
GRANT ALL PRIVILEGES ON okr_prod.* TO 'okr_user'@'127.0.0.1';
FLUSH PRIVILEGES;
EXIT;
```

然后把 `DATABASE_URL` 改成：

```env
DATABASE_URL="mysql://okr_user:StrongPassword@127.0.0.1:3306/okr_prod"
```

这样会比直接使用 root 账号更稳妥。

### 6.2 kkFileView 源码准备规则

`install-all-deps.sh` 会按下面顺序寻找 `kkFileView`：

1. 如果 `vendor/kkfileview/current/kkFileView.jar` 已存在，则直接复用
2. 如果 `vendor/kkfileview/source/kkFileView` 存在源码，则直接编译
3. 否则尝试解压仓库根目录下的：
   - `kkFileView-4.4.0.zip`
   - `kkFileView-main.zip`

编译成功后，运行时文件会被放到：

```bash
vendor/kkfileview/current
```

## 7. 第四步：检查依赖是否安装成功

安装完成后，建议逐项验收：

```bash
node -v
npm -v
java -version
mvn -v
mysql --version
soffice --version
```

还可以检查 `kkFileView` 是否已经落地：

```bash
ls -la vendor/kkfileview/current
ls -la vendor/kkfileview/current/config
ls -la vendor/kkfileview/current/bin
```

正常情况下应至少看到：

- `vendor/kkfileview/current/kkFileView.jar`
- `vendor/kkfileview/current/config/application.properties`

## 8. 第五步：首次启动项目

首次启动直接使用仓库脚本：

```bash
cd /srv/okr
./scripts/linux/start-all.sh
```

这个脚本会自动做几件事：

- 尽力启动 MySQL
- 再次执行 `prisma generate`
- 再次执行 `prisma migrate deploy`
- 构建后端
- 构建前端
- 启动后端
- 启动 kkFileView
- 启动前端预览服务

默认启动后可以访问：

- 后端：`http://127.0.0.1:3000`
- 前端：`http://127.0.0.1:4173`
- kkFileView 代理入口：`http://127.0.0.1:3000/preview`

停止命令：

```bash
cd /srv/okr
./scripts/linux/stop-all.sh
```

## 9. 第六步：首次启动后的健康检查

如果你是从旧版本升级上来的，建议在执行本节检查前先完成一次标准升级发布：

```bash
cd /srv/okr
git pull
cd apps/server && npm ci && npx prisma generate && npx prisma migrate deploy && npm run build
cd /srv/okr/apps/web && npm ci && npm run build
cd /srv/okr && ./scripts/linux/stop-all.sh && ./scripts/linux/start-all.sh
```

如果你已经切到 `Nginx + systemd` 托管，则把最后一步改成：

```bash
sudo systemctl restart okr-stack
sudo systemctl reload nginx
```

### 9.1 后端健康检查

```bash
curl http://127.0.0.1:3000/health
```

预期至少返回：

- `ok: true`
- 数据库检查结果

### 9.2 预览能力检查

```bash
curl http://127.0.0.1:3000/health/preview
```

重点看以下字段：

- `preferredEngine`
- `officeToPdfAvailable`
- `libreOffice.available`

在 Linux 环境下，正常预期是：

- `preferredEngine = libreoffice`
- `officeToPdfAvailable = true`
- `libreOffice.available = true`

### 9.3 端口检查

```bash
ss -lntp | grep -E '3000|4173|8012|3306'
```

### 9.4 日志检查

```bash
tail -n 100 apps/server/.runtime-server.log
tail -n 100 apps/server/.runtime-server.err.log
tail -n 100 apps/web/.runtime-web.log
tail -n 100 apps/web/.runtime-web.err.log
tail -n 100 vendor/kkfileview/current/log/kkFileView.log
```

### 9.5 页面验收

浏览器中依次检查：

1. 登录页是否能打开
2. 系统配置页是否能正常读写数据
3. 文件上传是否正常
4. `pdf / docx / pptx / xlsx` 是否都能进入预览
5. Excel 预览是否正常走 `kkFileView`
6. 非 Excel Office 文件是否能走 PDF 回退预览
7. 知识库里手动上传的 `zip` 文件，点击“预览”后应进入压缩包清单页，而不是直接下载原文件
8. 压缩包清单页里的文件名和“预览”按钮都应继续可用

## 10. 第七步：切到 Nginx 反向代理

如果只用于临时验收，`start-all.sh` 就够用。  
如果要长期部署，建议加上 Nginx。

### 10.1 安装 Nginx

```bash
sudo apt-get update
sudo apt-get install -y nginx
```

### 10.2 发布前端静态文件

如果你准备用 Nginx 直接托管前端静态资源，先把构建结果放到固定目录：

```bash
sudo mkdir -p /srv/okr/web
sudo cp -R apps/web/dist/. /srv/okr/web/
```

### 10.3 写入 Nginx 配置

可直接参考仓库里的：

```bash
deploy/nginx/okr-preview.conf.example
```

推荐落地到：

```bash
sudo cp deploy/nginx/okr-preview.conf.example /etc/nginx/sites-available/okr.conf
sudo ln -sf /etc/nginx/sites-available/okr.conf /etc/nginx/sites-enabled/okr.conf
sudo nginx -t
sudo systemctl reload nginx
```

如果你已经启用了 Nginx 托管静态前端，后续可以不再暴露 `4173` 给外部，只保留：

- `80/443` 给用户访问
- `3000` 和 `8012` 仅本机回环访问

## 11. 第八步：切到 systemd 托管

项目已经提供了服务模板：

```bash
deploy/systemd/okr-stack.service.example
```

### 11.1 安装服务文件

```bash
sudo cp deploy/systemd/okr-stack.service.example /etc/systemd/system/okr-stack.service
sudo systemctl daemon-reload
sudo systemctl enable okr-stack
sudo systemctl start okr-stack
```

### 11.2 查看服务状态

```bash
sudo systemctl status okr-stack
journalctl -u okr-stack -n 100 --no-pager
```

说明：

- 这个 `systemd` 示例托管的是后端和 `kkFileView`
- 前端建议由 Nginx 托管静态文件
- 如果你仍想保留 `4173` 的预览方式，可以继续使用 `start-all.sh`，但长期运行更推荐 `Nginx + systemd`

## 12. 推荐上线顺序

建议正式环境按下面顺序上线：

1. 上传代码到 `/srv/okr`
2. 配好 `apps/server/.env.local`
3. 执行 `./scripts/linux/install-all-deps.sh`
4. 执行 `./scripts/linux/start-all.sh`
5. 用 `curl` 和浏览器完成一轮完整验收
6. 将前端 `dist` 发布到 `/srv/okr/web`
7. 接入 Nginx
8. 接入 `systemd`
9. 关闭临时暴露的 `4173`
10. 再做一轮对外域名验收

## 13. 常见问题排查

### 13.1 `apt-get update` 或安装依赖失败

先看是否是源不可用或锁文件占用：

```bash
sudo lsof /var/lib/dpkg/lock-frontend
sudo lsof /var/lib/apt/lists/lock
```

如果是其他安装进程占用，等它完成后再继续。

### 13.2 MySQL 启动失败

先看服务状态：

```bash
sudo systemctl status mysql
journalctl -u mysql -n 100 --no-pager
```

再确认端口：

```bash
ss -lntp | grep 3306
```

### 13.3 Prisma 迁移失败

常见原因：

- `DATABASE_URL` 写错
- 数据库账号没有权限
- 数据库不存在

建议手工验证：

```bash
cd /srv/okr/apps/server
npx prisma generate
npx prisma migrate deploy
```

### 13.4 `kkFileView` 没有启动

先确认运行文件是否存在：

```bash
ls -la /srv/okr/vendor/kkfileview/current
```

再看日志：

```bash
tail -n 100 /srv/okr/vendor/kkfileview/current/log/kkFileView.log
```

如果没有 `kkFileView.jar`，说明源码编译或解压阶段没有完成，需要重新检查：

- `vendor/kkfileview/source/kkFileView`
- `kkFileView-4.4.0.zip`
- `kkFileView-main.zip`

### 13.5 `officeToPdfAvailable` 为 `false`

先确认：

```bash
which soffice
soffice --version
curl http://127.0.0.1:3000/health/preview
```

如果 `which soffice` 找不到，说明 `LibreOffice` 没装好。  
如果装好了但健康检查仍失败，优先把环境变量显式写死：

```env
LIBREOFFICE_EXECUTABLE_PATH=/usr/bin/soffice
```

### 13.6 前端能开，接口 502 或登录异常

优先检查：

- `FRONTEND_ORIGINS`
- `APP_BASE_URL`
- `WEB_BASE_URL`
- Nginx 的 `/api/` 代理是否指向 `127.0.0.1:3000`

### 13.7 上传正常，但预览打不开

按顺序检查：

1. `curl http://127.0.0.1:3000/health/preview`
2. `kkFileView` 日志
3. `KKFILEVIEW_PUBLIC_BASE_URL` 是否与实际访问域名一致
4. `KKFILEVIEW_SOURCE_BASE_URL` 是否仍指向后端可访问地址
5. `KKFILEVIEW_PREVIEW_TOKEN` 是否与当前环境一致

## 14. Linux 环境里的 LibreOffice 和 kkFileView 各自做什么

这部分容易混淆，这里单独说明：

- `kkFileView`
  - 负责 Excel 等文件的在线预览
  - 也负责当前项目里一部分 Office 文件的在线预览链路
- `LibreOffice`
  - 在 Linux 下主要承担 Office 文档转 PDF 的回退能力
  - 当前后端健康检查 `GET /health/preview` 也会检查 `soffice` 是否可用
  - 非 Excel Office 文件需要走 PDF 回退时，会依赖它

所以在 Linux 部署里，`LibreOffice` 不是可有可无的附加项，而是当前预览链路的重要组成部分。

## 15. 一轮完整验收建议

建议上线前至少做一次完整验收：

1. 管理员登录
2. 查看系统配置与员工数据
3. 员工上传 `pdf / docx / pptx / xlsx`
4. 检查预览是否正常
5. 领导端进入评分工作台
6. 执行评分、批量评分、排名查看
7. 知识库上传、下载、批量下载
8. 知识库手动上传 `zip` 文件后，点击“预览”应进入压缩包清单页，且压缩包内文件仍可继续预览/下载
9. 退出登录，再走本地账号兜底登录

如果你愿意，下一步我可以继续把这份 Linux 部署手册再补成两版：

1. `Ubuntu 单机版逐条命令版`
2. `Nginx + systemd + 域名 + HTTPS 正式环境版`
