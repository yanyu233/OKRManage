# Route C C1 React Shell Implementation Plan

**Goal**

Implement the first complete React frontend slice for Route C and connect it end-to-end to the current NestJS + MySQL backend.

## Delivery Checklist

- [x] Add `apps/web` with React + Vite + TypeScript
- [x] Add Ant Design, React Router, TanStack Query, and Zustand
- [x] Add frontend API client for auth and admin bootstrap endpoints
- [x] Add role-aware app shell
- [x] Add login page and unauthorized page
- [x] Add system-admin configuration page
- [x] Add backend `PUT /api/admin/org/bootstrap`
- [x] Add backend e2e for bootstrap save
- [x] Add leader and employee placeholder routes
- [x] Run frontend tests and build
- [x] Run backend build, e2e, and smoke verification

## Implementation Order

### Task 1. Frontend foundation

- scaffold `apps/web`
- install core libraries
- add Vite and Vitest config
- add base app provider layer
- add API base URL example config

### Task 2. Session and shell

- implement `GET /api/me` session restore usage
- create login page
- create unauthorized page
- create layout shell with menu and user dropdown
- add role-based default route helper

### Task 3. Backend admin snapshot save

- define DTO for full admin snapshot save
- extend org repository contract
- implement Prisma transactional snapshot save
- extend service validation and audit
- expose `PUT /api/admin/org/bootstrap`
- add e2e test for save round-trip

### Task 4. System-admin page

- load bootstrap snapshot
- edit departments
- edit sections
- edit users
- edit local accounts
- edit role assignments
- edit section leader bindings
- edit group leader bindings
- edit review groups and fixed seat counts
- save full snapshot
- reset draft from backend

### Task 5. Non-admin placeholders

- add leader workbench placeholder
- add leader ranking placeholder
- add employee OKR placeholder
- add employee goal placeholder

### Task 6. Verification

- run `apps/web` tests
- run `apps/web` build
- run `apps/server` build
- run `apps/server` e2e
- run `apps/server/scripts/smoke.ps1`

## Validation Mechanism

### Frontend

- `npm run test`
- `npm run build`

### Backend

- `npm run build`
- `npm run test:e2e`
- `powershell -NoProfile -ExecutionPolicy Bypass -File .\\scripts\\smoke.ps1`

### Manual checks

- sign in with local debug admin
- confirm shell renders with admin navigation
- open admin console
- change org snapshot data
- save and confirm data reloads
- confirm leader routes are protected
- confirm employee routes are protected

## Exit Criteria

C1 is ready to commit when:

- all automated checks are green
- the new React shell loads and signs in successfully
- system-admin save works against MySQL
- no MVP page code is required for the new admin page
