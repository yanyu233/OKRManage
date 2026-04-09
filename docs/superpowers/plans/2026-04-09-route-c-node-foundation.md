# Route C Node Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Start the Route C production rewrite with a runnable Node.js/TypeScript foundation that can grow into the new OKR production backend without disturbing the existing MVP.

**Architecture:** Build a fresh `apps/server` backend in TypeScript using NestJS as the standard web framework, with environment-driven configuration, health checks, modular boundaries, and a local-debug authentication skeleton. Keep the current MVP untouched and treat this new app as the long-term production base that will later absorb MySQL, file storage, WeCom auth, and the modular OKR domain.

**Tech Stack:** Node.js LTS, npm, TypeScript, NestJS, class-validator, dotenv/config service, Jest, PowerShell smoke scripts.

---

## File Structure

### New files and folders

- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/package.json`
  - Node backend package manifest.
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/tsconfig.json`
  - TypeScript compiler configuration.
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/nest-cli.json`
  - NestJS workspace config for the backend app.
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/main.ts`
  - App bootstrap and HTTP startup.
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/app.module.ts`
  - Root Nest module.
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/modules/health/health.module.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/modules/health/health.controller.ts`
  - `/api/health` endpoint.
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/modules/config/runtime-config.module.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/modules/config/runtime-config.service.ts`
  - Externalized runtime config loader.
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/modules/auth/auth.module.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/modules/auth/auth.controller.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/modules/auth/auth.service.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/modules/auth/dto/manual-login.dto.ts`
  - Local-debug login skeleton and future WeCom auth entry points.
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/modules/session/session.module.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/modules/session/session.service.ts`
  - In-memory session abstraction for the first cut.
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/modules/users/users.module.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/modules/users/users.service.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/modules/users/users.repository.ts`
  - Stub user provider for local debug and future persistence swap.
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/shared/types/auth-user.ts`
  - Shared auth user contract.
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/.env.example`
  - Externalized config example.
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/test/health.e2e-spec.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/test/manual-login.e2e-spec.ts`
  - E2E tests for health and debug login.
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/scripts/smoke.ps1`
  - Local smoke script for startup and endpoints.

### Existing files to modify

- Modify: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/.gitignore`
  - Ignore Node artifacts and local env files.
- Modify: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/docs/superpowers/specs/2026-04-08-production-refactor-roadmap-design.md`
  - Add a short implementation note that Route C foundation is bootstrapping with Node.js/NestJS in this branch.

---

## Execution Order

### Task 1: Provision Node.js Toolchain

**Files:**
- Modify: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/.gitignore`

- [ ] **Step 1: Verify Node is currently unavailable**

Run:

```powershell
node --version
```

Expected:
- command not found

- [ ] **Step 2: Install Node.js LTS**

Run:

```powershell
winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
```

- [ ] **Step 3: Verify toolchain**

Run:

```powershell
node --version
npm --version
```

Expected:
- both commands succeed

- [ ] **Step 4: Extend ignore rules for Node artifacts**

Add to `.gitignore`:

```gitignore
node_modules/
dist/
.env
.env.local
coverage/
```

- [ ] **Step 5: Commit**

```bash
git add .gitignore
git commit -m "chore: prepare node foundation workspace"
```

### Task 2: Scaffold NestJS Backend Skeleton

**Files:**
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/package.json`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/tsconfig.json`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/nest-cli.json`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/main.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/app.module.ts`

- [ ] **Step 1: Write the failing build smoke**

Run:

```powershell
cd C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server
npm run build
```

Expected:
- fails because package and source files do not exist yet

- [ ] **Step 2: Create package manifest**

Create `apps/server/package.json` with:

```json
{
  "name": "@okr/server",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build": "nest build",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:prod": "node dist/main.js",
    "test": "jest --runInBand",
    "test:e2e": "jest --config ./test/jest-e2e.json --runInBand"
  },
  "dependencies": {
    "@nestjs/common": "^11.0.0",
    "@nestjs/core": "^11.0.0",
    "@nestjs/platform-express": "^11.0.0",
    "@nestjs/config": "^4.0.0",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.1",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1"
  },
  "devDependencies": {
    "@nestjs/cli": "^11.0.0",
    "@nestjs/schematics": "^11.0.0",
    "@nestjs/testing": "^11.0.0",
    "@types/express": "^5.0.0",
    "@types/jest": "^29.5.14",
    "@types/node": "^22.10.2",
    "jest": "^29.7.0",
    "source-map-support": "^0.5.21",
    "supertest": "^7.0.0",
    "ts-jest": "^29.2.5",
    "ts-loader": "^9.5.1",
    "ts-node": "^10.9.2",
    "typescript": "^5.7.2"
  }
}
```

- [ ] **Step 3: Create TypeScript and Nest configs**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "es2021",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "strict": true,
    "moduleResolution": "node",
    "types": ["node", "jest"]
  },
  "include": ["src/**/*", "test/**/*"]
}
```

Create `nest-cli.json`:

```json
{
  "collection": "@nestjs/schematics",
  "sourceRoot": "src"
}
```

- [ ] **Step 4: Create minimal Nest app**

Create `src/main.ts`:

```ts
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(process.env.PORT ? Number(process.env.PORT) : 3000);
}

bootstrap();
```

Create `src/app.module.ts`:

```ts
import { Module } from '@nestjs/common';

@Module({})
export class AppModule {}
```

- [ ] **Step 5: Install dependencies**

Run:

```powershell
cd C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server
npm install
```

- [ ] **Step 6: Run build to verify green**

Run:

```powershell
npm run build
```

Expected:
- build succeeds

- [ ] **Step 7: Commit**

```bash
git add apps/server/package.json apps/server/tsconfig.json apps/server/nest-cli.json apps/server/src/main.ts apps/server/src/app.module.ts
git commit -m "feat: scaffold node server foundation"
```

### Task 3: Add Externalized Config And Health Endpoint

**Files:**
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/modules/config/runtime-config.module.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/modules/config/runtime-config.service.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/modules/health/health.module.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/modules/health/health.controller.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/.env.example`
- Modify: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/app.module.ts`

- [ ] **Step 1: Write failing e2e health test**

Create `test/health.e2e-spec.ts`:

```ts
import request from 'supertest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';

describe('Health endpoint', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns service health', async () => {
    const response = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.service).toBe('okr-node-foundation');
  });
});
```

- [ ] **Step 2: Run test to confirm red**

Run:

```powershell
cd C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server
npm run test:e2e
```

Expected:
- fails because health module is missing

- [ ] **Step 3: Implement config and health modules**

Create `runtime-config.service.ts`, `runtime-config.module.ts`, `health.controller.ts`, `health.module.ts`, and update `app.module.ts` to import them. The health response should include:

```json
{
  "ok": true,
  "service": "okr-node-foundation",
  "authMode": "local-debug"
}
```

- [ ] **Step 4: Add `.env.example`**

Add:

```env
PORT=3000
NODE_ENV=development
AUTH_MODE=local-debug
SESSION_COOKIE_NAME=okr_sid
SESSION_TTL_MINUTES=480
```

- [ ] **Step 5: Re-run e2e test**

Run:

```powershell
npm run test:e2e
```

Expected:
- health test passes

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/modules/config apps/server/src/modules/health apps/server/src/app.module.ts apps/server/.env.example apps/server/test/health.e2e-spec.ts
git commit -m "feat: add node runtime config and health endpoint"
```

### Task 4: Add Local Debug Auth Skeleton

**Files:**
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/modules/auth/auth.module.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/modules/auth/auth.controller.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/modules/auth/auth.service.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/modules/auth/dto/manual-login.dto.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/modules/session/session.module.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/modules/session/session.service.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/modules/users/users.module.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/modules/users/users.service.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/modules/users/users.repository.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/shared/types/auth-user.ts`
- Create: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/test/manual-login.e2e-spec.ts`
- Modify: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/apps/server/src/app.module.ts`

- [ ] **Step 1: Write failing manual-login e2e test**

Create `test/manual-login.e2e-spec.ts`:

```ts
import request from 'supertest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';

describe('Manual debug login', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates a session for allowed local-debug users', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/manual-login')
      .send({ loginName: 'sysadmin.local', password: 'Admin123!' })
      .expect(200);

    expect(response.body.ok).toBe(true);
    expect(response.body.user.id).toBeDefined();
  });
});
```

- [ ] **Step 2: Run e2e tests to confirm red**

Run:

```powershell
cd C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server
npm run test:e2e
```

Expected:
- manual login test fails

- [ ] **Step 3: Implement local debug auth skeleton**

Implement:
- in-memory users repository with one seeded system-admin user
- auth service that accepts a seeded local account
- in-memory session store
- `POST /api/auth/manual-login`
- `POST /api/logout`
- `GET /api/me`

Keep the contracts intentionally small and modular so later WeCom/MySQL can replace the storage.

- [ ] **Step 4: Re-run e2e tests**

Run:

```powershell
npm run test:e2e
```

Expected:
- health and manual login tests pass

- [ ] **Step 5: Add smoke script**

Create `scripts/smoke.ps1` to:
- start the server
- call `/api/health`
- call `/api/auth/manual-login`
- print pass/fail summary

- [ ] **Step 6: Run smoke script**

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server\scripts\smoke.ps1
```

Expected:
- all checks pass

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/modules/auth apps/server/src/modules/session apps/server/src/modules/users apps/server/src/shared/types apps/server/test/manual-login.e2e-spec.ts apps/server/scripts/smoke.ps1 apps/server/src/app.module.ts
git commit -m "feat: add node debug auth skeleton"
```

### Task 5: Document Route C Foundation Start

**Files:**
- Modify: `C:/Users/yanxi/Documents/OKRManage/.worktrees/route-c-foundation/docs/superpowers/specs/2026-04-08-production-refactor-roadmap-design.md`

- [ ] **Step 1: Add a short implementation note**

Add a note near the Route C section that the foundation branch starts with:
- Node.js
- TypeScript
- NestJS
- config-first backend shell
- local debug auth only for now

- [ ] **Step 2: Verify note exists**

Run:

```powershell
Select-String -Path "C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\docs\superpowers\specs\2026-04-08-production-refactor-roadmap-design.md" -Pattern "NestJS|local debug auth"
```

Expected:
- both strings found

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-04-08-production-refactor-roadmap-design.md
git commit -m "docs: note node foundation start for route c"
```
