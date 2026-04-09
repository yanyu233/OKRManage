# Route C Prisma MySQL Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the new Route C NestJS backend from stub persistence to a real `Prisma + MySQL` production foundation for auth, sessions, organization config, review groups, and audit logs.

**Architecture:** Keep controllers thin, services rule-oriented, and repositories as the only layer that talks to Prisma. Introduce Prisma and MySQL in one controlled slice: login/session/organization/review-group configuration, while leaving the MVP and the later OKR domain migration untouched.

**Tech Stack:** Node.js LTS, npm, TypeScript, NestJS, Prisma, MySQL, Jest e2e tests, PowerShell smoke scripts, bcryptjs.

---

## File Structure

### Existing files to modify

- Modify: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/package.json`
- Modify: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/.env.example`
- Modify: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/app.module.ts`
- Modify: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/modules/config/runtime-config.service.ts`
- Modify: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/modules/health/health.controller.ts`
- Modify: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/modules/auth/auth.service.ts`
- Modify: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/modules/auth/auth.module.ts`
- Modify: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/modules/session/session.service.ts`
- Modify: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/modules/session/session.module.ts`
- Modify: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/modules/users/users.module.ts`
- Modify: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/modules/users/users.service.ts`
- Modify: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/modules/users/users.repository.ts`
- Modify: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/test/health.e2e-spec.ts`
- Modify: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/test/manual-login.e2e-spec.ts`
- Modify: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/scripts/smoke.ps1`

### New files and folders

- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/prisma/schema.prisma`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/prisma/seed.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/infrastructure/database/prisma.module.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/infrastructure/database/prisma.service.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/infrastructure/database/prisma-health.service.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/infrastructure/repositories/users/prisma-users.repository.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/infrastructure/repositories/sessions/sessions.repository.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/infrastructure/repositories/sessions/prisma-sessions.repository.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/infrastructure/repositories/org/org.repository.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/infrastructure/repositories/org/prisma-org.repository.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/infrastructure/repositories/review-groups/review-groups.repository.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/infrastructure/repositories/review-groups/prisma-review-groups.repository.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/infrastructure/repositories/audit/audit.repository.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/infrastructure/repositories/audit/prisma-audit.repository.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/modules/admin-config/admin-config.module.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/modules/admin-config/admin-config.controller.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/modules/admin-config/admin-config.service.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/modules/admin-config/dto/create-review-group.dto.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/modules/admin-config/dto/update-review-group.dto.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/modules/admin-config/dto/update-review-group-quotas.dto.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/modules/audit/audit.module.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/modules/audit/audit.service.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/shared/constants/review-grade-codes.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/shared/errors/domain-validation.error.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/test/review-groups.e2e-spec.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/test/admin-bootstrap.e2e-spec.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/test/support/test-app.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/test/support/test-db.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/scripts/db-reset.ps1`

---

## Execution Order

### Task 1: Add Prisma Tooling And Runtime Database Config

**Files:**
- Modify: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/package.json`
- Modify: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/.env.example`
- Modify: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/modules/config/runtime-config.service.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/prisma/schema.prisma`

- [ ] **Step 1: Write the failing Prisma validation command**

Run:

```powershell
$env:Path = 'C:\Program Files\nodejs;' + $env:Path
& 'C:\Program Files\nodejs\npm.cmd' run prisma:validate
```

Expected:
- FAIL because Prisma is not installed and `schema.prisma` does not exist yet

- [ ] **Step 2: Add Prisma and MySQL dependencies**

Update `package.json` scripts to include:

```json
{
  "scripts": {
    "build": "nest build",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:prod": "node dist/src/main.js",
    "test": "jest --runInBand",
    "test:e2e": "jest --config ./test/jest-e2e.json --runInBand",
    "prisma:generate": "prisma generate",
    "prisma:validate": "prisma validate",
    "prisma:format": "prisma format",
    "prisma:migrate:dev": "prisma migrate dev",
    "prisma:seed": "tsx prisma/seed.ts"
  }
}
```

Add dependencies:

```json
{
  "dependencies": {
    "@prisma/client": "^6.6.0",
    "bcryptjs": "^2.4.3"
  },
  "devDependencies": {
    "prisma": "^6.6.0",
    "tsx": "^4.19.3"
  }
}
```

- [ ] **Step 3: Extend `.env.example`**

Append:

```env
DATABASE_URL="mysql://root:root@127.0.0.1:3306/okr_route_c_dev"
DEBUG_SYSADMIN_LOGIN=sysadmin.local
DEBUG_SYSADMIN_PASSWORD=Admin123!
DEBUG_SYSADMIN_NAME=严主任
```

- [ ] **Step 4: Create the first Prisma schema**

The schema must include these models with `createdAt/updatedAt` where mutable:
- `User`
- `LocalAccount`
- `Session`
- `Department`
- `Section`
- `ReviewGroup`
- `ReviewGradeQuota`
- `UserRoleAssignment`
- `SectionLeaderBinding`
- `GroupLeaderBinding`
- `AuditLog`

Critical constraints:

```prisma
@@unique([departmentId, name])
@@unique([reviewGroupId, gradeCode])
@@unique([userId, roleCode, scopeType, scopeId])
```

- [ ] **Step 5: Extend runtime config service**

Add getters:

```ts
get databaseUrl(): string {
  return this.configService.get<string>('DATABASE_URL') ?? '';
}

get debugSysadminLogin(): string {
  return this.configService.get<string>('DEBUG_SYSADMIN_LOGIN') ?? 'sysadmin.local';
}

get debugSysadminPassword(): string {
  return this.configService.get<string>('DEBUG_SYSADMIN_PASSWORD') ?? 'Admin123!';
}

get debugSysadminName(): string {
  return this.configService.get<string>('DEBUG_SYSADMIN_NAME') ?? '严主任';
}
```

- [ ] **Step 6: Install dependencies**

Run:

```powershell
$env:Path = 'C:\Program Files\nodejs;' + $env:Path
& 'C:\Program Files\nodejs\npm.cmd' install
```

Expected:
- PASS

- [ ] **Step 7: Run Prisma validation**

Run:

```powershell
$env:Path = 'C:\Program Files\nodejs;' + $env:Path
& 'C:\Program Files\nodejs\npm.cmd' run prisma:validate
```

Expected:
- PASS

- [ ] **Step 8: Commit**

```bash
git add apps/server/package.json apps/server/package-lock.json apps/server/.env.example apps/server/prisma/schema.prisma apps/server/src/modules/config/runtime-config.service.ts
git commit -m "feat: add prisma mysql runtime foundation"
```

### Task 2: Add Prisma Database Module And Health Integration

**Files:**
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/infrastructure/database/prisma.module.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/infrastructure/database/prisma.service.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/infrastructure/database/prisma-health.service.ts`
- Modify: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/modules/health/health.controller.ts`
- Modify: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/app.module.ts`
- Modify: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/test/health.e2e-spec.ts`

- [ ] **Step 1: Write the failing database-health expectation**

Change the health test assertion to:

```ts
expect(response.body.database).toEqual(
  expect.objectContaining({
    ok: expect.any(Boolean)
  })
);
```

- [ ] **Step 2: Run the health test to confirm red**

Run:

```powershell
$env:Path = 'C:\Program Files\nodejs;' + $env:Path
& 'C:\Program Files\nodejs\npm.cmd' run test:e2e -- health.e2e-spec.ts
```

Expected:
- FAIL because `database` is missing

- [ ] **Step 3: Implement Prisma module and service**

Create `prisma.service.ts` with:

```ts
import { INestApplication, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async enableShutdownHooks(app: INestApplication) {
    process.on('beforeExit', async () => {
      await app.close();
    });
  }
}
```

Create `prisma-health.service.ts` with:

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaHealthService {
  constructor(private readonly prisma: PrismaService) {}

  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'unknown database error'
      };
    }
  }
}
```

Create `prisma.module.ts` with:

```ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { PrismaHealthService } from './prisma-health.service';

@Global()
@Module({
  providers: [PrismaService, PrismaHealthService],
  exports: [PrismaService, PrismaHealthService]
})
export class PrismaModule {}
```

- [ ] **Step 4: Update health controller and app module**

Health controller should return:

```ts
return {
  ok: true,
  service: this.config.serviceName,
  authMode: this.config.authMode,
  database: await this.prismaHealth.check()
};
```

`app.module.ts` must import `PrismaModule`.

- [ ] **Step 5: Re-run the health test**

Run:

```powershell
$env:Path = 'C:\Program Files\nodejs;' + $env:Path
& 'C:\Program Files\nodejs\npm.cmd' run test:e2e -- health.e2e-spec.ts
```

Expected:
- PASS

- [ ] **Step 6: Run build**

Run:

```powershell
$env:Path = 'C:\Program Files\nodejs;' + $env:Path
& 'C:\Program Files\nodejs\npm.cmd' run build
```

Expected:
- PASS

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/infrastructure/database apps/server/src/modules/health/health.controller.ts apps/server/src/app.module.ts apps/server/test/health.e2e-spec.ts
git commit -m "feat: add prisma database module and health check"
```

### Task 3: Create Development Seed And Database Reset Flow

**Files:**
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/prisma/seed.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/scripts/db-reset.ps1`
- Modify: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/prisma/schema.prisma`

- [ ] **Step 1: Write the failing seed command**

Run:

```powershell
$env:Path = 'C:\Program Files\nodejs;' + $env:Path
& 'C:\Program Files\nodejs\npm.cmd' run prisma:seed
```

Expected:
- FAIL because `prisma/seed.ts` does not exist

- [ ] **Step 2: Create the seed script**

The seed must upsert:
- department `工业互联网中心`
- section `平台产品科`
- review group `信息化组`
- debug system admin user
- enabled local account for `sysadmin.local`
- one primary `system-admin` role assignment
- fixed-seat quota rows for `A+ / A / B+ / B / C`

Use this core pattern:

```ts
const passwordHash = await bcrypt.hash(process.env.DEBUG_SYSADMIN_PASSWORD ?? 'Admin123!', 10);

await prisma.localAccount.upsert({
  where: { userId: user.id },
  update: {
    loginName: process.env.DEBUG_SYSADMIN_LOGIN ?? 'sysadmin.local',
    passwordHash,
    localLoginEnabled: true
  },
  create: {
    userId: user.id,
    loginName: process.env.DEBUG_SYSADMIN_LOGIN ?? 'sysadmin.local',
    passwordHash,
    localLoginEnabled: true
  }
});
```

- [ ] **Step 3: Add the unique role-assignment key**

Update `schema.prisma` to include:

```prisma
@@unique([userId, roleCode, scopeType, scopeId])
```

- [ ] **Step 4: Create `db-reset.ps1`**

Use:

```powershell
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$env:Path = 'C:\Program Files\nodejs;' + $env:Path

& 'C:\Program Files\nodejs\npm.cmd' run prisma:generate
& 'C:\Program Files\nodejs\npm.cmd' run prisma:migrate:dev -- --name init_foundation
& 'C:\Program Files\nodejs\npm.cmd' run prisma:seed

Write-Host '[db-reset] PASS'
```

- [ ] **Step 5: Run Prisma format and validate**

Run:

```powershell
$env:Path = 'C:\Program Files\nodejs;' + $env:Path
& 'C:\Program Files\nodejs\npm.cmd' run prisma:format
& 'C:\Program Files\nodejs\npm.cmd' run prisma:validate
```

Expected:
- PASS

- [ ] **Step 6: Commit**

```bash
git add apps/server/prisma/schema.prisma apps/server/prisma/seed.ts apps/server/scripts/db-reset.ps1
git commit -m "feat: add prisma seed and db reset flow"
```

### Task 4: Replace Stub User And Session Persistence With Prisma Repositories

**Files:**
- Modify: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/modules/users/users.repository.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/infrastructure/repositories/users/prisma-users.repository.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/infrastructure/repositories/sessions/sessions.repository.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/infrastructure/repositories/sessions/prisma-sessions.repository.ts`
- Modify: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/modules/users/users.service.ts`
- Modify: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/modules/users/users.module.ts`
- Modify: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/modules/session/session.service.ts`
- Modify: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/modules/session/session.module.ts`
- Modify: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/modules/auth/auth.service.ts`
- Modify: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/test/manual-login.e2e-spec.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/test/support/test-db.ts`

- [ ] **Step 1: Write the failing MySQL-backed manual login expectation**

Add to `manual-login.e2e-spec.ts`:

```ts
import { resetTestDatabase } from './support/test-db';

beforeAll(async () => {
  await resetTestDatabase();
  ...
});
```

and assert:

```ts
expect(me.body.user.loginName).toBe('sysadmin.local');
expect(me.body.user.role).toBe('system-admin');
```

- [ ] **Step 2: Run the manual-login test to confirm red**

Run:

```powershell
$env:Path = 'C:\Program Files\nodejs;' + $env:Path
& 'C:\Program Files\nodejs\npm.cmd' run test:e2e -- manual-login.e2e-spec.ts
```

Expected:
- FAIL because current login still uses in-memory storage

- [ ] **Step 3: Convert `users.repository.ts` into a contract**

The contract must define:

```ts
export const USERS_REPOSITORY = Symbol('USERS_REPOSITORY');

export interface UsersRepository {
  findByLocalLogin(loginName: string): Promise<(AuthUser & { passwordHash: string; localLoginEnabled: boolean; isActive: boolean }) | null>;
  findById(id: string): Promise<AuthUser | null>;
  touchLocalLoginSuccess(userId: string): Promise<void>;
}
```

- [ ] **Step 4: Add session repository contract**

Create `sessions.repository.ts`:

```ts
export const SESSIONS_REPOSITORY = Symbol('SESSIONS_REPOSITORY');

export interface SessionsRepository {
  create(user: AuthUser, authMethod: string, ttlMinutes: number): Promise<{ id: string; user: AuthUser }>;
  get(sessionId: string | null): Promise<{ id: string; user: AuthUser } | null>;
  delete(sessionId: string | null): Promise<void>;
}
```

- [ ] **Step 5: Implement Prisma-backed repositories**

`prisma-users.repository.ts` must:
- join `User`, `LocalAccount`, and the primary enabled role assignment
- map to the existing `AuthUser` shape
- update `lastLoginAt`

`prisma-sessions.repository.ts` must:
- persist session rows
- read session + linked user + active role
- delete by session id

- [ ] **Step 6: Switch services to repository injection**

`UsersService` should validate password with:

```ts
const account = await this.usersRepository.findByLocalLogin(loginName);
if (!account || !account.localLoginEnabled || !account.isActive) {
  return null;
}

const matches = await bcrypt.compare(password, account.passwordHash);
if (!matches) {
  return null;
}
```

`SessionService` must stop using `Map`.

- [ ] **Step 7: Re-run manual-login e2e**

Run:

```powershell
$env:Path = 'C:\Program Files\nodejs;' + $env:Path
& 'C:\Program Files\nodejs\npm.cmd' run test:e2e -- manual-login.e2e-spec.ts
```

Expected:
- PASS

- [ ] **Step 8: Run build**

Run:

```powershell
$env:Path = 'C:\Program Files\nodejs;' + $env:Path
& 'C:\Program Files\nodejs\npm.cmd' run build
```

Expected:
- PASS

- [ ] **Step 9: Commit**

```bash
git add apps/server/src/modules/users apps/server/src/modules/session apps/server/src/modules/auth/auth.service.ts apps/server/src/infrastructure/repositories/users apps/server/src/infrastructure/repositories/sessions apps/server/test/manual-login.e2e-spec.ts apps/server/test/support/test-db.ts
git commit -m "feat: back debug auth and sessions with mysql"
```

### Task 5: Add Audit Repository And Manual Login Audit Trail

**Files:**
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/infrastructure/repositories/audit/audit.repository.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/infrastructure/repositories/audit/prisma-audit.repository.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/modules/audit/audit.module.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/modules/audit/audit.service.ts`
- Modify: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/modules/auth/auth.service.ts`

- [ ] **Step 1: Write the failing audit expectation**

Extend `manual-login.e2e-spec.ts` with:

```ts
const auditRows = await readAuditRows('auth.manual-login.success');
expect(auditRows.length).toBeGreaterThan(0);
```

- [ ] **Step 2: Run the manual-login test to confirm red**

Run:

```powershell
$env:Path = 'C:\Program Files\nodejs;' + $env:Path
& 'C:\Program Files\nodejs\npm.cmd' run test:e2e -- manual-login.e2e-spec.ts
```

Expected:
- FAIL because audit rows are not written yet

- [ ] **Step 3: Implement audit contract**

Use:

```ts
export const AUDIT_REPOSITORY = Symbol('AUDIT_REPOSITORY');

export interface AuditRepository {
  write(entry: {
    actorUserId?: string | null;
    actorRoleCode?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    beforeJson?: unknown;
    afterJson?: unknown;
    ip?: string | null;
    userAgent?: string | null;
  }): Promise<void>;
}
```

- [ ] **Step 4: Add auth audit writes**

`AuthService` must write:
- `auth.manual-login.success`
- `auth.manual-login.failure`
- `auth.logout`

- [ ] **Step 5: Re-run manual-login e2e**

Run:

```powershell
$env:Path = 'C:\Program Files\nodejs;' + $env:Path
& 'C:\Program Files\nodejs\npm.cmd' run test:e2e -- manual-login.e2e-spec.ts
```

Expected:
- PASS

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/infrastructure/repositories/audit apps/server/src/modules/audit apps/server/src/modules/auth/auth.service.ts apps/server/test/manual-login.e2e-spec.ts apps/server/test/support/test-db.ts
git commit -m "feat: add audit logging for auth flows"
```

### Task 6: Add Database-Backed Review Group Admin Config

**Files:**
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/infrastructure/repositories/org/org.repository.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/infrastructure/repositories/org/prisma-org.repository.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/infrastructure/repositories/review-groups/review-groups.repository.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/infrastructure/repositories/review-groups/prisma-review-groups.repository.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/modules/admin-config/admin-config.module.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/modules/admin-config/admin-config.controller.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/modules/admin-config/admin-config.service.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/modules/admin-config/dto/create-review-group.dto.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/modules/admin-config/dto/update-review-group.dto.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/modules/admin-config/dto/update-review-group-quotas.dto.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/shared/constants/review-grade-codes.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/shared/errors/domain-validation.error.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/test/review-groups.e2e-spec.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/test/admin-bootstrap.e2e-spec.ts`
- Modify: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/app.module.ts`

- [ ] **Step 1: Write failing review-group CRUD e2e tests**

Create `review-groups.e2e-spec.ts` covering:
- create group
- rename group
- save quotas
- reject quota totals larger than member count
- delete empty group

Use expectations like:

```ts
expect(response.body.name).toBe('测试组');
expect(response.status).toBe(400);
expect(deleteResponse.body.ok).toBe(true);
```

Create `admin-bootstrap.e2e-spec.ts` asserting:

```ts
expect(response.body.reviewGroups).toEqual(expect.any(Array));
```

- [ ] **Step 2: Run the new tests to confirm red**

Run:

```powershell
$env:Path = 'C:\Program Files\nodejs;' + $env:Path
& 'C:\Program Files\nodejs\npm.cmd' run test:e2e -- review-groups.e2e-spec.ts
& 'C:\Program Files\nodejs\npm.cmd' run test:e2e -- admin-bootstrap.e2e-spec.ts
```

Expected:
- FAIL because module and endpoints do not exist

- [ ] **Step 3: Implement repository contracts**

`review-groups.repository.ts` must expose:

```ts
export type ReviewGroupQuotaInput = {
  gradeCode: string;
  seatCount: number;
};

export interface ReviewGroupsRepository {
  listAll(): Promise<Array<{ id: string; name: string; isActive: boolean; quotas: ReviewGroupQuotaInput[]; memberCount: number }>>;
  create(name: string): Promise<{ id: string; name: string; isActive: boolean }>;
  update(id: string, name: string): Promise<{ id: string; name: string; isActive: boolean }>;
  delete(id: string): Promise<void>;
  saveQuotas(id: string, quotas: ReviewGroupQuotaInput[]): Promise<void>;
}
```

`org.repository.ts` must provide active member counting for a review group.

- [ ] **Step 4: Implement admin-config service and controller**

Rules:
- only `system-admin` role can access
- support create/update/delete review groups
- support quota save for `A+ / A / B+ / B / C`
- reject overflow totals
- reject delete if active users still belong to that group
- write audit rows for mutations

- [ ] **Step 5: Re-run the CRUD tests**

Run:

```powershell
$env:Path = 'C:\Program Files\nodejs;' + $env:Path
& 'C:\Program Files\nodejs\npm.cmd' run test:e2e -- review-groups.e2e-spec.ts
& 'C:\Program Files\nodejs\npm.cmd' run test:e2e -- admin-bootstrap.e2e-spec.ts
```

Expected:
- PASS

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/infrastructure/repositories/org apps/server/src/infrastructure/repositories/review-groups apps/server/src/modules/admin-config apps/server/src/shared/constants apps/server/src/shared/errors apps/server/test/review-groups.e2e-spec.ts apps/server/test/admin-bootstrap.e2e-spec.ts apps/server/src/app.module.ts
git commit -m "feat: add mysql-backed review group admin config"
```

### Task 7: Expand Smoke Verification To Database And Admin Bootstrap

**Files:**
- Modify: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/scripts/smoke.ps1`

- [ ] **Step 1: Update smoke expectations**

After login, add:

```powershell
if (-not $health.database.ok) {
  throw 'database health is not ok'
}
```

and:

```powershell
$bootstrap = Invoke-RestMethod -Method Get -Uri "$baseUrl/admin/org/bootstrap" -WebSession $webSession
if (-not $bootstrap.reviewGroups) {
  throw 'admin bootstrap did not return reviewGroups'
}
```

- [ ] **Step 2: Run smoke to confirm red**

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\scripts\smoke.ps1"
```

Expected:
- FAIL before the endpoint exists or before DB health is complete

- [ ] **Step 3: Re-run smoke after Task 6**

Run the same command.

Expected:
- PASS

- [ ] **Step 4: Commit**

```bash
git add apps/server/scripts/smoke.ps1
git commit -m "test: expand route c smoke coverage"
```

### Task 8: Phase Gate Verification

**Files:**
- Test: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/test/health.e2e-spec.ts`
- Test: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/test/manual-login.e2e-spec.ts`
- Test: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/test/review-groups.e2e-spec.ts`
- Test: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/test/admin-bootstrap.e2e-spec.ts`
- Test: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/scripts/smoke.ps1`

- [ ] **Step 1: Run Prisma validation suite**

Run:

```powershell
$env:Path = 'C:\Program Files\nodejs;' + $env:Path
& 'C:\Program Files\nodejs\npm.cmd' run prisma:format
& 'C:\Program Files\nodejs\npm.cmd' run prisma:validate
```

Expected:
- PASS

- [ ] **Step 2: Run build**

Run:

```powershell
$env:Path = 'C:\Program Files\nodejs;' + $env:Path
& 'C:\Program Files\nodejs\npm.cmd' run build
```

Expected:
- PASS

- [ ] **Step 3: Run the full e2e suite**

Run:

```powershell
$env:Path = 'C:\Program Files\nodejs;' + $env:Path
& 'C:\Program Files\nodejs\npm.cmd' run test:e2e
```

Expected:
- PASS

- [ ] **Step 4: Run smoke**

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\scripts\smoke.ps1"
```

Expected:
- PASS

- [ ] **Step 5: Verify manual checklist**

Checklist:
1. Run `scripts/db-reset.ps1`
2. Start the app
3. Log in with `sysadmin.local / Admin123!`
4. Call `/api/me`
5. Call `/api/admin/org/bootstrap`
6. Create one review group
7. Save legal quotas
8. Verify illegal quotas are rejected
9. Confirm one audit row exists for login and one for review-group change

- [ ] **Step 6: Commit the final verified phase state**

```bash
git add .
git commit -m "chore: verify prisma mysql foundation phase"
```

## Verification Mechanism

This phase uses four gates:

### 1. Red-Green TDD Per Task

Every behavior begins with a failing test or failing command, then the minimal implementation, then a passing verification run.

### 2. Schema Gate

No runtime task is complete until:
- `prisma format`
- `prisma validate`
- migration generation

are all green.

### 3. Persistence Gate

Manual login is not considered migrated until:
- session rows are persisted
- local account rows are read from MySQL
- audit rows are written

### 4. Admin Config Gate

Review group work is not complete until:
- CRUD works
- fixed quota save works
- overflow quota save fails
- delete with assigned members fails
- admin bootstrap returns persisted review groups

## Rollback Mechanism

If this phase becomes unstable:

1. revert to commit `756382f` on `codex/route-c-foundation`
2. keep the Prisma spec and plan docs
3. disable Prisma module imports
4. return local debug login to the in-memory repository while preserving tests for later work

Because this route is isolated in a dedicated worktree and branch, rollback affects only the Route C rewrite and not the current MVP.

## Self-Review

### Spec coverage

This plan covers the approved spec sections for:
- Prisma/MySQL foundation
- repository boundaries
- login/session persistence
- review group admin config
- audit logging
- verification and smoke coverage

### Placeholder scan

No task relies on `TODO`, “similar to above”, or unspecified validation logic. Each task lists concrete files, commands, and expected results.

### Type consistency

The plan consistently uses:
- `PrismaModule`, `PrismaService`, `PrismaHealthService`
- repository tokens such as `USERS_REPOSITORY`, `SESSIONS_REPOSITORY`, `REVIEW_GROUPS_REPOSITORY`, `AUDIT_REPOSITORY`
- `ReviewGroupQuotaInput` for fixed-seat quota writes
- `system-admin` as the initial protected admin role
