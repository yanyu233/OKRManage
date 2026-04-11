# Route C C6 Shell Period and Goal Template Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the Route C shell header alignment, restore MVP-style year/quarter/search toolbars, and add department-bound goal templates that employees can import into the current OKR quarter.

**Architecture:** Extend the existing Route C NestJS + Prisma domain with goal-template tables and import endpoints, then wire the React admin and employee pages to the new APIs while keeping leader/employee toolbars on shared helper-driven controls. Use TDD per slice so layout fixes, template persistence, import rules, and UI flows are each protected by focused tests before implementation.

**Tech Stack:** NestJS, Prisma, MySQL, React, Vite, Ant Design, TanStack Query, Vitest, Jest e2e

---

### Task 1: Lock Header Alignment Behavior

**Files:**
- Modify: `apps/web/src/modules/layout/AppShell.tsx`
- Modify: `apps/web/src/app/styles.css`
- Test: `apps/web/test/app-shell-layout.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/app-shell-layout.test.tsx` with a rendering test that verifies the header identity block uses the alignment class we intend to style:

```tsx
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { App as AntApp } from 'antd';
import { vi } from 'vitest';
import { AppShell } from '../src/modules/layout/AppShell';

vi.mock('../src/shared/api/auth', () => ({
  getCurrentSession: async () => ({
    authenticated: true,
    user: {
      id: 'user-1',
      name: '张晨',
      loginName: 'zhang.chen',
      activeRole: 'employee',
      roles: ['employee']
    }
  }),
  logout: vi.fn(),
  switchActiveRole: vi.fn()
}));

vi.mock('../src/modules/layout/routing', () => ({
  canAccessRoute: () => true,
  menuItemsForUser: () => [{ key: '/employee/okr', label: '我的 OKR' }],
  resolveTargetRoleForPath: () => 'employee',
  selectedMenuKeyForPath: () => '/employee/okr'
}));

test('renders centered identity block wrapper in shell header', async () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AntApp>
        <MemoryRouter initialEntries={['/employee/okr']}>
          <AppShell />
        </MemoryRouter>
      </AntApp>
    </QueryClientProvider>
  );

  expect(await screen.findByText('张晨')).toBeInTheDocument();
  expect(document.querySelector('.app-shell__identity')).not.toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
$env:Path='C:\Program Files\nodejs;'+$env:Path
& 'C:\Program Files\nodejs\npm.cmd' run test -- app-shell-layout
```

Expected: FAIL because `.app-shell__identity` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Update `apps/web/src/modules/layout/AppShell.tsx` so the left header content becomes:

```tsx
<Space align="center" size={16}>
  <Button
    type="text"
    size="large"
    icon={siderCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
    onClick={toggleSider}
  />
  <div className="app-shell__identity">
    <Typography.Title level={4} style={{ margin: 0 }}>
      {currentUser.name}
    </Typography.Title>
    <Typography.Text type="secondary">
      当前角色：{getRoleLabel(currentUser.activeRole)}
    </Typography.Text>
  </div>
</Space>
```

Update `apps/web/src/app/styles.css`:

```css
.app-shell__identity {
  min-height: 56px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
}

.app-shell__identity .ant-typography {
  line-height: 1.2;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run the same command:

```powershell
$env:Path='C:\Program Files\nodejs;'+$env:Path
& 'C:\Program Files\nodejs\npm.cmd' run test -- app-shell-layout
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
& 'C:\Program Files\Git\cmd\git.exe' -C 'C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation' add apps/web/src/modules/layout/AppShell.tsx apps/web/src/app/styles.css apps/web/test/app-shell-layout.test.tsx
& 'C:\Program Files\Git\cmd\git.exe' -C 'C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation' commit -m "fix: align route c shell identity block"
```

### Task 2: Add Goal Template Schema and Repository Contract

**Files:**
- Modify: `apps/server/prisma/schema.prisma`
- Create: `apps/server/prisma/migrations/<timestamp>_add_goal_templates/migration.sql`
- Modify: `apps/server/src/infrastructure/repositories/org/org.repository.ts`
- Modify: `apps/server/src/infrastructure/repositories/org/prisma-org.repository.ts`
- Test: `apps/server/test/admin-goal-templates.e2e-spec.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/server/test/admin-goal-templates.e2e-spec.ts`:

```ts
import { INestApplication } from '@nestjs/common';
import { closeTestDatabase, resetTestDatabase } from './support/test-db';
import { createTestApp, loginAsSysadmin } from './support/test-app';

describe('Admin goal templates', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await resetTestDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await closeTestDatabase();
  });

  it('creates and persists department-bound goal templates', async () => {
    const agent = await loginAsSysadmin(app);
    const bootstrap = await agent.get('/api/admin/org/bootstrap').expect(200);
    const departmentId = bootstrap.body.departments[0].id as string;

    const response = await agent
      .post('/api/admin/goal-templates')
      .send({
        departmentId,
        name: '平台科标准交付目标',
        description: '季度标准模板',
        isActive: true,
        keyResults: [
          { code: 'KR1', name: '完成季度版本交付', description: '交付版本', points: 30 },
          { code: 'KR2', name: '沉淀知识库内容', description: '补齐常见案例', points: 20 }
        ]
      })
      .expect(201);

    expect(response.body.name).toBe('平台科标准交付目标');
    expect(response.body.keyResults).toHaveLength(2);

    const refreshed = await agent.get('/api/admin/org/bootstrap').expect(200);
    expect(refreshed.body.goalTemplates.some((entry: { name: string }) => entry.name === '平台科标准交付目标')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
$env:Path='C:\Program Files\nodejs;'+$env:Path
& 'C:\Program Files\nodejs\npm.cmd' run test:e2e -- admin-goal-templates.e2e-spec.ts
```

Expected: FAIL because route/model does not exist.

- [ ] **Step 3: Write minimal implementation**

Add Prisma models in `apps/server/prisma/schema.prisma`:

```prisma
model GoalTemplate {
  id           String                 @id @default(cuid())
  departmentId String
  name         String
  description  String?
  isActive     Boolean                @default(true)
  createdAt    DateTime               @default(now())
  updatedAt    DateTime               @updatedAt
  department   Department             @relation(fields: [departmentId], references: [id], onDelete: Cascade)
  keyResults   GoalTemplateKeyResult[]
  imports      ImportedGoalTemplate[]

  @@unique([departmentId, name])
}

model GoalTemplateKeyResult {
  id             String       @id @default(cuid())
  goalTemplateId String
  code           String
  name           String
  description    String?
  points         Int
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  goalTemplate   GoalTemplate @relation(fields: [goalTemplateId], references: [id], onDelete: Cascade)

  @@unique([goalTemplateId, code])
}

model ImportedGoalTemplate {
  id             String       @id @default(cuid())
  goalTemplateId String
  goalId         String
  ownerUserId    String
  year           Int
  quarter        Int
  createdAt      DateTime     @default(now())
  goalTemplate   GoalTemplate @relation(fields: [goalTemplateId], references: [id], onDelete: Cascade)
  goal           Goal         @relation(fields: [goalId], references: [id], onDelete: Cascade)
  owner          User         @relation(fields: [ownerUserId], references: [id], onDelete: Cascade)

  @@unique([goalTemplateId, ownerUserId, year, quarter])
}
```

Extend `Department`, `User`, and `Goal` relations:

```prisma
goalTemplates GoalTemplate[]
importedGoalTemplates ImportedGoalTemplate[]
importSources ImportedGoalTemplate[]
```

Extend admin bootstrap contracts in `org.repository.ts` with:

```ts
export type AdminGoalTemplateKeyResultRecord = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  points: number;
};

export type AdminGoalTemplateRecord = {
  id: string;
  departmentId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  keyResults: AdminGoalTemplateKeyResultRecord[];
};
```

and include `goalTemplates` in `AdminOrgBootstrap` and `AdminOrgBootstrapInput`.

Update `prisma-org.repository.ts` to read/write `goalTemplates`.

Create a migration by running Prisma after schema update.

- [ ] **Step 4: Run test to verify it passes**

Run:

```powershell
$env:Path='C:\Program Files\nodejs;'+$env:Path
& 'C:\Program Files\nodejs\npm.cmd' run test:e2e -- admin-goal-templates.e2e-spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
& 'C:\Program Files\Git\cmd\git.exe' -C 'C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation' add apps/server/prisma/schema.prisma apps/server/prisma/migrations apps/server/src/infrastructure/repositories/org/org.repository.ts apps/server/src/infrastructure/repositories/org/prisma-org.repository.ts apps/server/test/admin-goal-templates.e2e-spec.ts
& 'C:\Program Files\Git\cmd\git.exe' -C 'C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation' commit -m "feat: add goal template persistence"
```

### Task 3: Add Admin Goal Template API and Validation

**Files:**
- Modify: `apps/server/src/modules/admin-config/admin-config.controller.ts`
- Modify: `apps/server/src/modules/admin-config/admin-config.service.ts`
- Modify: `apps/server/src/infrastructure/repositories/org/org.repository.ts`
- Modify: `apps/server/src/infrastructure/repositories/org/prisma-org.repository.ts`
- Test: `apps/server/test/admin-goal-templates-validation.e2e-spec.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/server/test/admin-goal-templates-validation.e2e-spec.ts`:

```ts
import { INestApplication } from '@nestjs/common';
import { closeTestDatabase, resetTestDatabase } from './support/test-db';
import { createTestApp, loginAsSysadmin } from './support/test-app';

describe('Admin goal template validation', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await resetTestDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await closeTestDatabase();
  });

  it('rejects duplicate key result codes inside one template', async () => {
    const agent = await loginAsSysadmin(app);
    const bootstrap = await agent.get('/api/admin/org/bootstrap').expect(200);
    const departmentId = bootstrap.body.departments[0].id as string;

    await agent
      .post('/api/admin/goal-templates')
      .send({
        departmentId,
        name: '重复编码模板',
        description: null,
        isActive: true,
        keyResults: [
          { code: 'KR1', name: '目标一', description: null, points: 30 },
          { code: 'KR1', name: '目标二', description: null, points: 20 }
        ]
      })
      .expect(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
$env:Path='C:\Program Files\nodejs;'+$env:Path
& 'C:\Program Files\nodejs\npm.cmd' run test:e2e -- admin-goal-templates-validation.e2e-spec.ts
```

Expected: FAIL because validation is missing.

- [ ] **Step 3: Write minimal implementation**

Add admin controller routes:

```ts
@Post('goal-templates')
createGoalTemplate(...)

@Patch('goal-templates/:id')
updateGoalTemplate(...)

@Delete('goal-templates/:id')
deleteGoalTemplate(...)
```

In `admin-config.service.ts`, validate:

```ts
if (!template.name.trim()) {
  throw new DomainValidationError('goal template name is required');
}

if (!template.departmentId.trim()) {
  throw new DomainValidationError('goal template department is required');
}

if (template.keyResults.length === 0) {
  throw new DomainValidationError('goal template requires at least one key result');
}

const codes = template.keyResults.map((entry) => entry.code.trim());
if (new Set(codes).size !== codes.length) {
  throw new DomainValidationError('goal template key result codes must be unique');
}
```

Also validate points are integers `>= 0`.

- [ ] **Step 4: Run test to verify it passes**

Run the same command.

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
& 'C:\Program Files\Git\cmd\git.exe' -C 'C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation' add apps/server/src/modules/admin-config/admin-config.controller.ts apps/server/src/modules/admin-config/admin-config.service.ts apps/server/src/infrastructure/repositories/org/org.repository.ts apps/server/src/infrastructure/repositories/org/prisma-org.repository.ts apps/server/test/admin-goal-templates-validation.e2e-spec.ts
& 'C:\Program Files\Git\cmd\git.exe' -C 'C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation' commit -m "feat: add admin goal template endpoints"
```

### Task 4: Add Employee Template Query and Import

**Files:**
- Modify: `apps/server/src/infrastructure/repositories/employee/employee.repository.ts`
- Modify: `apps/server/src/infrastructure/repositories/employee/prisma-employee.repository.ts`
- Modify: `apps/server/src/modules/employee/employee.controller.ts`
- Modify: `apps/server/src/modules/employee/employee.service.ts`
- Test: `apps/server/test/employee-goal-template-import.e2e-spec.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/server/test/employee-goal-template-import.e2e-spec.ts`:

```ts
import { INestApplication } from '@nestjs/common';
import { closeTestDatabase, resetTestDatabase } from './support/test-db';
import { createTestApp, loginAsEmployee, loginAsSysadmin } from './support/test-app';

describe('Employee goal template import', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await resetTestDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await closeTestDatabase();
  });

  it('imports selected department templates once per quarter', async () => {
    const admin = await loginAsSysadmin(app);
    const adminBootstrap = await admin.get('/api/admin/org/bootstrap').expect(200);
    const departmentId = adminBootstrap.body.departments[0].id as string;

    const template = await admin
      .post('/api/admin/goal-templates')
      .send({
        departmentId,
        name: '新员工标准模板',
        description: '季度通用模板',
        isActive: true,
        keyResults: [
          { code: 'KR1', name: '完成模板任务', description: null, points: 20 }
        ]
      })
      .expect(201);

    const employee = await loginAsEmployee(app);

    const templates = await employee.get('/api/employee/goal-templates?year=2026&quarter=1').expect(200);
    expect(templates.body.templates.some((entry: { id: string }) => entry.id === template.body.id)).toBe(true);

    await employee
      .post('/api/employee/goal-templates/import')
      .send({
        year: 2026,
        quarter: 1,
        templateIds: [template.body.id]
      })
      .expect(201);

    await employee
      .post('/api/employee/goal-templates/import')
      .send({
        year: 2026,
        quarter: 1,
        templateIds: [template.body.id]
      })
      .expect(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
$env:Path='C:\Program Files\nodejs;'+$env:Path
& 'C:\Program Files\nodejs\npm.cmd' run test:e2e -- employee-goal-template-import.e2e-spec.ts
```

Expected: FAIL because endpoints do not exist.

- [ ] **Step 3: Write minimal implementation**

Add repository contracts:

```ts
export type EmployeeGoalTemplateSummaryRecord = {
  id: string;
  departmentId: string;
  name: string;
  description: string | null;
  totalPoints: number;
  keyResultCount: number;
  alreadyImported: boolean;
};
```

Add employee routes:

```ts
@Get('goal-templates')
getGoalTemplates(...)

@Post('goal-templates/import')
importGoalTemplates(...)
```

In `employee.service.ts`, validate quarter and deduplicate template ids:

```ts
const uniqueTemplateIds = [...new Set(input.templateIds.map((entry) => entry.trim()).filter(Boolean))];
if (!uniqueTemplateIds.length) {
  throw new DomainValidationError('at least one template must be selected');
}
```

In the Prisma employee repository:

- query templates by actor department
- mark `alreadyImported`
- on import:
  - load template + key results
  - create goal with generated code
  - clone key results
  - create `ImportedGoalTemplate`
  - reject if duplicate import exists for same employee/year/quarter/template

Use sequential goal code generation like:

```ts
const nextIndex = existingGoals.length + 1;
const code = `OT${String(nextIndex).padStart(2, '0')}`;
```

- [ ] **Step 4: Run test to verify it passes**

Run the same command.

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
& 'C:\Program Files\Git\cmd\git.exe' -C 'C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation' add apps/server/src/infrastructure/repositories/employee/employee.repository.ts apps/server/src/infrastructure/repositories/employee/prisma-employee.repository.ts apps/server/src/modules/employee/employee.controller.ts apps/server/src/modules/employee/employee.service.ts apps/server/test/employee-goal-template-import.e2e-spec.ts
& 'C:\Program Files\Git\cmd\git.exe' -C 'C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation' commit -m "feat: add employee goal template import"
```

### Task 5: Extend Frontend Types, APIs, and Toolbar Coverage

**Files:**
- Modify: `apps/web/src/shared/types/admin-config.ts`
- Modify: `apps/web/src/shared/types/employee.ts`
- Modify: `apps/web/src/shared/api/admin.ts`
- Modify: `apps/web/src/shared/api/employee.ts`
- Modify: `apps/web/src/modules/leader/LeaderWorkbenchPage.tsx`
- Modify: `apps/web/src/modules/leader/LeaderRankingPage.tsx`
- Modify: `apps/web/src/modules/employee/EmployeeOkrPage.tsx`
- Test: `apps/web/test/toolbar-options.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/toolbar-options.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildQuarterOptions, buildToolbarYearOptions } from '../src/shared/ui/toolbar-options';

describe('toolbar options', () => {
  it('builds explicit year and quarter options', () => {
    expect(buildQuarterOptions()).toEqual([
      { label: '一季度', value: 1 },
      { label: '二季度', value: 2 },
      { label: '三季度', value: 3 },
      { label: '四季度', value: 4 }
    ]);

    expect(buildToolbarYearOptions(2026, 2)).toEqual([
      { label: '2026年', value: 2026 },
      { label: '2027年', value: 2027 }
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
$env:Path='C:\Program Files\nodejs;'+$env:Path
& 'C:\Program Files\nodejs\npm.cmd' run test -- toolbar-options
```

Expected: FAIL if labels/coverage do not yet match final behavior.

- [ ] **Step 3: Write minimal implementation**

Update shared types and APIs to include:

```ts
export type GoalTemplateRecord = {
  id: string;
  departmentId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  totalPoints: number;
  keyResultCount: number;
  keyResults: GoalTemplateKeyResultRecord[];
};
```

Add API helpers:

```ts
export function createGoalTemplate(...)
export function updateGoalTemplate(...)
export function deleteGoalTemplate(...)
export function getEmployeeGoalTemplates(...)
export function importEmployeeGoalTemplates(...)
```

Ensure all three pages visibly use the shared toolbar controls:

- year select
- quarter select
- search input
- refresh button

If a page already has these, only align final labels and layout.

- [ ] **Step 4: Run test to verify it passes**

Run the same command.

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
& 'C:\Program Files\Git\cmd\git.exe' -C 'C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation' add apps/web/src/shared/types/admin-config.ts apps/web/src/shared/types/employee.ts apps/web/src/shared/api/admin.ts apps/web/src/shared/api/employee.ts apps/web/src/modules/leader/LeaderWorkbenchPage.tsx apps/web/src/modules/leader/LeaderRankingPage.tsx apps/web/src/modules/employee/EmployeeOkrPage.tsx apps/web/test/toolbar-options.test.ts
& 'C:\Program Files\Git\cmd\git.exe' -C 'C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation' commit -m "feat: align route c toolbar contracts"
```

### Task 6: Add System Admin Goal Template UI

**Files:**
- Modify: `apps/web/src/modules/admin/AdminOrgPage.tsx`
- Create: `apps/web/src/modules/admin/AdminGoalTemplateSection.tsx`
- Modify: `apps/web/src/modules/admin/AdminOrgSections.tsx`
- Modify: `apps/web/src/modules/admin/admin-org-form.ts`
- Test: `apps/web/test/admin-goal-template-section.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/admin-goal-template-section.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { AdminGoalTemplateSection } from '../src/modules/admin/AdminGoalTemplateSection';

test('renders template list and department binding controls', () => {
  render(
    <AdminGoalTemplateSection
      departments={[{ id: 'dept-1', name: '工业互联网中心', isActive: true }]}
      goalTemplates={[]}
      onCreate={() => undefined}
      onSelect={() => undefined}
      onChange={() => undefined}
      onDelete={() => undefined}
    />
  );

  expect(screen.getByText('模板目标')).toBeInTheDocument();
  expect(screen.getByText('新增模板')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
$env:Path='C:\Program Files\nodejs;'+$env:Path
& 'C:\Program Files\nodejs\npm.cmd' run test -- admin-goal-template-section
```

Expected: FAIL because component does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `AdminGoalTemplateSection.tsx` with:

- department filter/select
- template list
- selected template editor form
- key result table or editable cards
- create/delete actions

Wire it into `AdminOrgPage.tsx` as a new tab:

```tsx
{ key: 'goal-templates', label: '模板目标', children: <AdminGoalTemplateSection ... /> }
```

Extend `admin-org-form.ts` draft helpers so templates participate in draft creation and save.

- [ ] **Step 4: Run test to verify it passes**

Run the same command.

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
& 'C:\Program Files\Git\cmd\git.exe' -C 'C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation' add apps/web/src/modules/admin/AdminOrgPage.tsx apps/web/src/modules/admin/AdminGoalTemplateSection.tsx apps/web/src/modules/admin/AdminOrgSections.tsx apps/web/src/modules/admin/admin-org-form.ts apps/web/test/admin-goal-template-section.test.tsx
& 'C:\Program Files\Git\cmd\git.exe' -C 'C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation' commit -m "feat: add admin goal template section"
```

### Task 7: Add Employee Import Dialog

**Files:**
- Modify: `apps/web/src/modules/employee/EmployeeOkrPage.tsx`
- Create: `apps/web/src/modules/employee/EmployeeTemplateImportDialog.tsx`
- Modify: `apps/web/src/modules/employee/employee.helpers.ts`
- Test: `apps/web/test/employee-template-import-dialog.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/employee-template-import-dialog.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { EmployeeTemplateImportDialog } from '../src/modules/employee/EmployeeTemplateImportDialog';

test('renders available templates and disables already imported entries', () => {
  render(
    <EmployeeTemplateImportDialog
      open
      loading={false}
      templates={[
        {
          id: 'tpl-1',
          departmentId: 'dept-1',
          name: '平台科模板',
          description: '通用模板',
          isActive: true,
          totalPoints: 50,
          keyResultCount: 2,
          alreadyImported: true,
          keyResults: []
        }
      ]}
      onCancel={() => undefined}
      onConfirm={() => undefined}
    />
  );

  expect(screen.getByText('导入模板目标')).toBeInTheDocument();
  expect(screen.getByText('已导入')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
$env:Path='C:\Program Files\nodejs;'+$env:Path
& 'C:\Program Files\nodejs\npm.cmd' run test -- employee-template-import-dialog
```

Expected: FAIL because dialog component does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `EmployeeTemplateImportDialog.tsx` with:

- modal
- template checklist cards
- disabled state for `alreadyImported`
- confirm button

Wire `EmployeeOkrPage.tsx`:

- add `导入模板目标` button
- load templates query using current year/quarter
- open modal
- confirm selected template ids with mutation
- on success invalidate `['employee-okr']`

Use helper for selected-state summary if needed.

- [ ] **Step 4: Run test to verify it passes**

Run the same command.

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
& 'C:\Program Files\Git\cmd\git.exe' -C 'C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation' add apps/web/src/modules/employee/EmployeeOkrPage.tsx apps/web/src/modules/employee/EmployeeTemplateImportDialog.tsx apps/web/src/modules/employee/employee.helpers.ts apps/web/test/employee-template-import-dialog.test.tsx
& 'C:\Program Files\Git\cmd\git.exe' -C 'C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation' commit -m "feat: add employee goal template import dialog"
```

### Task 8: Full Verification and Runtime Check

**Files:**
- Modify: `.gitignore` only if new runtime artifacts appear
- Verify: `apps/web`
- Verify: `apps/server`

- [ ] **Step 1: Run frontend tests**

```powershell
$env:Path='C:\Program Files\nodejs;'+$env:Path
& 'C:\Program Files\nodejs\npm.cmd' run test
```

Expected: PASS.

- [ ] **Step 2: Run frontend build**

```powershell
$env:Path='C:\Program Files\nodejs;'+$env:Path
& 'C:\Program Files\nodejs\npm.cmd' run build
```

Expected: PASS. Chunk warning is acceptable if unchanged from baseline.

- [ ] **Step 3: Run backend build**

```powershell
$env:Path='C:\Program Files\nodejs;'+$env:Path
& 'C:\Program Files\nodejs\npm.cmd' run build
```

Expected: PASS.

- [ ] **Step 4: Run backend e2e**

```powershell
$env:Path='C:\Program Files\nodejs;'+$env:Path
& 'C:\Program Files\nodejs\npm.cmd' run test:e2e
```

Expected: PASS.

- [ ] **Step 5: Run smoke**

```powershell
$env:Path='C:\Program Files\nodejs;'+$env:Path
powershell -NoProfile -ExecutionPolicy Bypass -File '.\scripts\smoke.ps1'
```

Expected: PASS.

- [ ] **Step 6: Start local-debug runtime and check key routes**

```powershell
Start-Process -FilePath 'C:\Program Files\nodejs\node.exe' -ArgumentList 'dist/src/main.js' -WorkingDirectory 'C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation\apps\server'
```

Then verify:

```powershell
(Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:3000/api/health').Content
(Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:3000/api/auth/start').Content
```

Expected:

- health returns `ok`
- auth start returns `manual-login` in local-debug

- [ ] **Step 7: Commit verification-related ignores if needed**

```powershell
& 'C:\Program Files\Git\cmd\git.exe' -C 'C:\Users\yanxi\Documents\OKRManage\.worktrees\route-c-foundation' status --short
```

Expected: clean working tree or only known runtime logs ignored.
