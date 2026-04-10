# Route C C1 React Shell Design

**Date**

2026-04-10

**Goal**

Create the first production-style frontend shell for Route C with `React + Vite + Ant Design`, connected to the new `NestJS + Prisma + MySQL` backend. C1 closes the loop for:

- authenticated app shell
- role-aware routing
- full system-admin configuration workflow
- leader and employee placeholder routes inside the new shell

## Scope

### Included in C1

- new frontend app at `apps/web`
- login page
- unauthorized page
- persistent app shell with left navigation and top user bar
- role-based routing
- full system-admin configuration page
  - departments
  - sections
  - users
  - local fallback accounts
  - role assignments
  - section leader bindings
  - group leader bindings
  - review groups with fixed seat counts
- API client layer for Route C backend
- leader placeholder pages
- employee placeholder pages
- backend atomic admin bootstrap save contract

### Not included in C1

- production WeCom callback wiring
- leader scoring workflow migration
- leader ranking workflow migration
- employee OKR list and detail migration
- production file storage migration

## Frontend Architecture

### Stack

- React
- Vite
- TypeScript
- Ant Design
- React Router
- TanStack Query
- Zustand

### Frontend Responsibilities

- restore current session from backend
- redirect unauthenticated users to `/login`
- block unauthorized users from protected routes
- render role-aware navigation
- edit and save one full admin organization snapshot

### Directory Structure

- `apps/web/src/app`
  - providers
  - router
  - root styles
- `apps/web/src/shared/api`
  - `http.ts`
  - `auth.ts`
  - `admin.ts`
- `apps/web/src/shared/store`
  - session UI store
- `apps/web/src/shared/types`
  - session types
  - admin config snapshot types
- `apps/web/src/modules/auth`
  - login page
  - unauthorized page
- `apps/web/src/modules/layout`
  - shell
  - role routing
  - navigation helpers
- `apps/web/src/modules/admin`
  - system-admin page
  - section editors
  - snapshot helper functions
- `apps/web/src/modules/leader`
  - placeholder routes
- `apps/web/src/modules/employee`
  - placeholder routes

## Backend Contract

### Existing endpoints used by C1

- `GET /api/health`
- `POST /api/auth/manual-login`
- `POST /api/logout`
- `GET /api/me`
- `GET /api/admin/org/bootstrap`

### New endpoint finalized in C1

- `PUT /api/admin/org/bootstrap`

This endpoint accepts one full snapshot payload and performs:

- validation
- transactional persistence
- audit log write
- fresh bootstrap reload

## Role Routing Model

### Default routes

- `system-admin` -> `/admin/org`
- `section-leader` -> `/leader/workbench`
- `group-leader` -> `/leader/workbench`
- `employee` -> `/employee/okr`

### C1 route set

- `/login`
- `/unauthorized`
- `/admin/org`
- `/leader/workbench`
- `/leader/ranking`
- `/employee/okr`
- `/employee/goal/:goalId`

## Admin Snapshot Editing Model

The frontend holds one local draft snapshot in memory and saves it atomically.

### Why snapshot save in C1

- keeps the first migrated admin page simple
- avoids mixing old MVP patch semantics with new Route C persistence
- gives one stable contract for later UI refinement
- makes validation and audit easier in the backend

### Validation ownership

- frontend: lightweight editing assistance and visible seat overflow hints
- backend: authoritative validation and save rejection

## Verification Expectations

C1 is complete only when all of the following are true:

- `apps/web` test passes
- `apps/web` build passes
- `apps/server` build passes
- `apps/server` e2e passes
- `apps/server/scripts/smoke.ps1` passes
- manual sign-in works
- `/api/me` restores session
- `/api/admin/org/bootstrap` loads for system-admin
- `/api/admin/org/bootstrap` saves a modified snapshot successfully
- leader and employee routes render through the new shell
