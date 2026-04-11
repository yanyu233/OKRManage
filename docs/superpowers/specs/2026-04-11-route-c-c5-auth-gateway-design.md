# Route C C5 Auth Gateway Design

**Date**

2026-04-11

**Goal**

Turn Route C authentication into a production-ready entry model with one unified gateway. The system should:

- keep local debug sign-in available for current development
- support a future WeCom-first production entry without redesign
- preserve the approved fallback flow where unmapped WeCom users land on the manual login page
- stop treating `/login` as the default application entry

This stage closes the gap between the current development login flow and the planned company deployment model.

## Scope

### Included in C5

- unified auth entry endpoint and frontend entry route
- explicit auth mode separation:
  - `local-debug`
  - `wecom-preferred`
- backend start route for auth-mode-aware entry handling
- backend WeCom OAuth route skeleton:
  - `GET /api/auth/start`
  - `GET /api/auth/wecom/start`
  - `GET /api/auth/wecom/callback`
- frontend auth bootstrap route
- manual login page remains available only as:
  - local debug entry
  - fallback for unmapped WeCom users
- redirect handling with `returnTo`
- session restore and logout remain aligned with the new gateway
- environment-driven auth configuration contract

### Not included in C5

- real WeCom tenant values
- final production domain binding
- WeCom user provisioning automation
- captcha, MFA, or external SSO beyond WeCom
- backend rate limiting for login attempts
- redesign of current admin-local-account workflow

## Current Problem

Route C now has:

- `POST /api/auth/manual-login`
- `POST /api/logout`
- `GET /api/me`
- multi-role session switching

But the app still behaves like a debug-first system:

- `/login` acts as the visible default entry
- the frontend has no dedicated auth gateway route
- there is no clear separation between debug and production auth behavior
- WeCom flow is not yet represented in Route C APIs

If we keep building on top of this, later production auth wiring will require rewriting the frontend entry flow instead of just supplying configuration and callback logic.

## Recommended Approach

Three approaches were considered:

1. Keep manual login as the main entry and add WeCom later  
   Lowest effort now, but it cements the wrong production behavior.

2. Build a unified auth gateway with mode-based routing  
   Recommended. It supports local debugging now and clean WeCom entry later.

3. Split debug and production into separate frontends  
   Too much divergence and doubles maintenance.

**Chosen approach: unified auth gateway with mode-based routing.**

## Authentication Model

### Modes

Route C runtime should expose one auth mode setting:

- `local-debug`
  - primary entry lands on manual login
  - no automatic WeCom redirect
  - intended for current local development and backend debugging

- `wecom-preferred`
  - primary entry uses WeCom redirect path
  - if callback maps to a local user, create session and enter app
  - if callback returns an unmapped user, redirect to manual login fallback with `reason=unmapped`

This preserves one code path while allowing the environment to choose the entry behavior.

### Core rule

- WeCom remains the official production identity source
- local accounts remain a controlled fallback mechanism
- both auth methods create the same Route C session shape
- role and authorization logic remain entirely inside Route C

## Frontend Design

### Route model

Add one explicit auth entry route:

- `/auth/entry`

Current route behavior becomes:

- app startup checks `GET /api/me`
- if session exists, route to the correct home page
- if session does not exist, route to `/auth/entry`
- `/auth/entry` decides what to do based on backend auth mode result

### Login page role

`/login` is no longer the main application entry.

It becomes a purpose-specific page for:

- local debug sign-in when `AUTH_MODE=local-debug`
- fallback login after WeCom callback redirects with `reason=unmapped`

### Entry UX

#### `local-debug`

- `/auth/entry` renders a small transition state, calls backend start endpoint
- backend returns a redirect target of `/login`
- frontend navigates there

#### `wecom-preferred`

- `/auth/entry` calls backend start endpoint
- backend returns a redirect target for WeCom auth start
- frontend navigates there immediately

#### Existing session

- any route load first restores `GET /api/me`
- authenticated users should never be shown `/login` unless they explicitly log out and re-enter

### Return path

All auth entry flows should preserve `returnTo` when present.

Examples:

- user opens `/leader/workbench`
- session missing
- frontend sends user through `/auth/entry?returnTo=/leader/workbench`
- after successful login, backend/frontend return to the requested path

## Backend Design

### New endpoints

Add these endpoints to Route C:

- `GET /api/auth/start`
  - returns current auth-mode-aware next action
- `GET /api/auth/wecom/start`
  - builds and redirects to WeCom OAuth URL
- `GET /api/auth/wecom/callback`
  - handles OAuth callback
  - creates Route C session when mapped
  - redirects to login fallback when unmapped

### `GET /api/auth/start`

Behavior:

- if valid session already exists:
  - return `{ action: 'session', redirectTo: '/' or returnTo }`
- if `AUTH_MODE=local-debug`:
  - return `{ action: 'manual-login', redirectTo: '/login?...' }`
- if `AUTH_MODE=wecom-preferred`:
  - return `{ action: 'wecom', redirectTo: '/api/auth/wecom/start?...' }`

This endpoint keeps frontend logic small and environment-neutral.

### `GET /api/auth/wecom/start`

Behavior:

- validate required WeCom config exists
- build OAuth URL with:
  - corp id
  - agent id
  - redirect uri
  - state
- 302 redirect to WeCom

For current development, this route can remain configuration-gated:

- if required WeCom config is absent and mode is `wecom-preferred`, return a clear 503 or configuration error

### `GET /api/auth/wecom/callback`

Behavior:

1. validate callback parameters
2. exchange code for WeCom identity
3. resolve local user by `wecomUserId`
4. if user exists and is active:
   - create session
   - redirect to requested `returnTo`
5. if user does not exist:
   - redirect to `/login?reason=unmapped`
6. if user is disabled:
   - redirect to `/unauthorized` or a dedicated auth error page

### Manual login remains

`POST /api/auth/manual-login` stays in place.

It is still valid for:

- `local-debug`
- unmapped-user fallback
- administrator-managed local debug accounts

But it should no longer define the application’s default entry semantics.

## Configuration Contract

### Required runtime config

Add or standardize these settings in Route C:

- `AUTH_MODE`
- `APP_BASE_URL`
- `WEB_BASE_URL`
- `SESSION_COOKIE_NAME`
- `SESSION_TTL_MINUTES`

### WeCom-related config

Only required when `AUTH_MODE=wecom-preferred`:

- `WECOM_CORP_ID`
- `WECOM_AGENT_ID`
- `WECOM_SECRET`
- `WECOM_REDIRECT_URI`

### Local-debug expectations

`local-debug` must keep working without any WeCom configuration present.

That is the key rule that protects current development velocity.

## Error Handling

### Expected cases

- unauthenticated request:
  - frontend routes to `/auth/entry`
- unmapped WeCom account:
  - redirect to `/login?reason=unmapped`
- disabled local account:
  - reject manual login
- disabled mapped WeCom user:
  - deny entry and show unauthorized/auth-error page
- missing WeCom config while in `wecom-preferred`:
  - explicit backend configuration error

### User-facing guidance

The login page should clearly distinguish:

- local debug mode
- unmapped WeCom fallback

This avoids turning the fallback path into an accidental normal login entry.

## Audit Expectations

C5 should add or preserve audit events for:

- `auth.manual-login.success`
- `auth.manual-login.failure`
- `auth.logout`
- `auth.active-role.switch`
- `auth.wecom.login.success`
- `auth.wecom.login.unmapped`
- `auth.wecom.login.failure`

This gives the production path the same observability baseline as the debug path.

## Verification Expectations

C5 is complete only when all of the following are true:

- backend config rejects invalid `wecom-preferred` setup
- `local-debug` mode still allows local account login
- `/auth/entry` sends unauthenticated users to the correct next step
- `/login` still works for local fallback accounts
- existing session skips login and re-enters the app directly
- unmapped WeCom callback redirects to the fallback manual login page
- logout clears the session and re-entry follows the auth gateway path
- frontend build and tests stay green
- backend build, e2e, and smoke stay green

## Implementation Notes

To minimize rework, C5 should be implemented in this order:

1. backend config and `/api/auth/start`
2. frontend `/auth/entry` route and entry bootstrap
3. WeCom start/callback skeleton
4. login-page fallback adjustments
5. verification and documentation
