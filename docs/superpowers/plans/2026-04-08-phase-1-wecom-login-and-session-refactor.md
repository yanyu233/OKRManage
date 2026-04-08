# Phase 1 WeCom Login And Session Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current demo-only global user switching model with "WeCom workbench identity + per-browser session", while keeping existing employee, leader, review, and admin business pages usable.

**Architecture:** Keep the current PowerShell monolith and native frontend for this phase, but insert a production-shaped authentication/session boundary. The backend becomes responsible for WeCom callback handling, cookie session management, and current-user resolution per request; the frontend stops treating user switching as the primary login path and instead reads the current user from session-backed bootstrap data.

**Tech Stack:** PowerShell `HttpListener`, native HTML/CSS/JS, JSON persistence (temporary for Phase 1 only), enterprise WeCom OAuth, cookie-based session store, existing PowerShell and Node test scripts.

---

## Scope

This plan only covers **Phase 1** of the larger productionization roadmap:

- WeCom workbench single-entry login
- Per-browser independent session
- Formal current-user resolution from cookie instead of global `currentUserId`
- Frontend login-state cleanup
- Config externalization for auth/session basics
- Validation gates and rollback conditions

This plan does **not** yet implement:

- MySQL migration
- File storage abstraction
- IIS/Nginx reverse proxy rollout
- HTTPS certificate installation
- Full audit log persistence redesign
- Full monitoring platform integration

Those come in later phases after session and authentication are stable.

## File Structure

### Existing files to modify

- Modify: `C:/Users/yanxi/Documents/OKRManage/mvp/server.ps1`
  - Add WeCom auth routes, session helpers, cookie parsing, config loading, and request-scoped current-user resolution.
- Modify: `C:/Users/yanxi/Documents/OKRManage/mvp/public/index.html`
  - Remove the production login dependency on the current user switcher, add auth bootstrap hooks and session-aware empty/loading states.
- Modify: `C:/Users/yanxi/Documents/OKRManage/mvp/public/role-app.js`
  - Stop using `/api/session` as primary login, stop assuming `store.settings.currentUserId`, and handle unauthenticated bootstrap responses.
- Modify: `C:/Users/yanxi/Documents/OKRManage/mvp/data/seed.json`
  - Add `wecomUserId`, `isActive`, and role-safe seed data for local verification.

### New backend/support files

- Create: `C:/Users/yanxi/Documents/OKRManage/mvp/config/appsettings.example.json`
  - Example runtime config for WeCom auth, cookie/session, public base URL, and local debug toggles.
- Create: `C:/Users/yanxi/Documents/OKRManage/mvp/tests/wecom-auth-start.ps1`
  - Verify `/api/auth/wecom/start` builds the expected redirect shape.
- Create: `C:/Users/yanxi/Documents/OKRManage/mvp/tests/wecom-auth-callback.ps1`
  - Verify callback success path, unknown-user rejection, and inactive-user rejection.
- Create: `C:/Users/yanxi/Documents/OKRManage/mvp/tests/bootstrap-session.ps1`
  - Verify `/api/bootstrap` returns the correct user by cookie session and that two sessions do not bleed into each other.
- Create: `C:/Users/yanxi/Documents/OKRManage/mvp/tests/logout.ps1`
  - Verify logout invalidates the cookie-backed session.

### Existing tests to reuse as regression gates

- Test: `C:/Users/yanxi/Documents/OKRManage/mvp/tests/validate-kr-weight.ps1`
- Test: `C:/Users/yanxi/Documents/OKRManage/mvp/tests/locked-goal-materials.ps1`
- Test: `C:/Users/yanxi/Documents/OKRManage/mvp/tests/leader-kr-scoring.ps1`
- Test: `C:/Users/yanxi/Documents/OKRManage/mvp/tests/review-grade-config.ps1`
- Test: `C:/Users/yanxi/Documents/OKRManage/mvp/tests/bootstrap-shape.ps1`

## Execution Order

Implement tasks in order. Do not start MySQL or file storage work until every validation gate in this plan is green.

### Task 1: Freeze The Baseline And Add Phase-1 Guards

**Files:**
- Modify: `C:/Users/yanxi/Documents/OKRManage/mvp/server.ps1`
- Create: `C:/Users/yanxi/Documents/OKRManage/mvp/tests/bootstrap-session.ps1`
- Test: `C:/Users/yanxi/Documents/OKRManage/mvp/tests/bootstrap-shape.ps1`

- [ ] **Step 1: Add a temporary session-mode feature flag**

Add a single flag near the top of `server.ps1` so Phase 1 can be rolled out safely:

```powershell
$runtimeConfig = Get-RuntimeConfig
$sessionMode = if ($runtimeConfig.session.mode) { "$($runtimeConfig.session.mode)" } else { "legacy" }
$authMode = if ($runtimeConfig.auth.mode) { "$($runtimeConfig.auth.mode)" } else { "legacy" }
```

Expected behavior:
- `legacy` keeps the current behavior
- `wecom` enables new auth/session flow

- [ ] **Step 2: Add a shape-preserving bootstrap regression test**

Create `bootstrap-session.ps1` with a first failing assertion that unauthenticated access in `wecom` mode gets a predictable response:

```powershell
$res = Invoke-RestMethod -Method Get -Uri "http://localhost:5057/api/bootstrap" -SkipHttpErrorCheck
if ($res.authState -ne "anonymous") {
    throw "Expected anonymous bootstrap authState"
}
```

- [ ] **Step 3: Run the new test and confirm it fails before implementation**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Users\yanxi\Documents\OKRManage\mvp\tests\bootstrap-session.ps1"
```

Expected:
- FAIL because the current bootstrap still assumes a global current user

- [ ] **Step 4: Implement minimal anonymous bootstrap contract**

Update `Build-BootstrapPayload` so unauthenticated requests can return:

```powershell
@{
    authState = "anonymous"
    currentUser = $null
    users = @()
    goals = @()
    krs = @()
    proofs = @()
    activities = @()
    sessionsEnabled = $true
}
```

- [ ] **Step 5: Run bootstrap regression tests**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Users\yanxi\Documents\OKRManage\mvp\tests\bootstrap-session.ps1"
powershell -ExecutionPolicy Bypass -File "C:\Users\yanxi\Documents\OKRManage\mvp\tests\bootstrap-shape.ps1"
```

Expected:
- PASS

- [ ] **Step 6: Commit**

```bash
git add mvp/server.ps1 mvp/tests/bootstrap-session.ps1
git commit -m "refactor: add phase-1 bootstrap session guards"
```

### Task 2: Externalize Runtime Auth And Session Configuration

**Files:**
- Create: `C:/Users/yanxi/Documents/OKRManage/mvp/config/appsettings.example.json`
- Modify: `C:/Users/yanxi/Documents/OKRManage/mvp/server.ps1`

- [ ] **Step 1: Write the config example file**

Create:

```json
{
  "auth": {
    "mode": "wecom",
    "wecom": {
      "corpId": "wwxxxxxxxxxxxxxxxx",
      "agentId": "1000008",
      "secret": "replace-me",
      "trustedRedirectUri": "https://okr.example.com/api/auth/wecom/callback",
      "scope": "snsapi_base"
    }
  },
  "session": {
    "mode": "cookie",
    "cookieName": "okr_sid",
    "ttlMinutes": 480,
    "secureCookie": true
  },
  "app": {
    "publicBaseUrl": "https://okr.example.com"
  },
  "debug": {
    "allowLocalUserSwitch": false,
    "mockWecomUserId": ""
  }
}
```

- [ ] **Step 2: Add config loader helpers in `server.ps1`**

Implement:

```powershell
function Get-RuntimeConfig {
    $configPath = Join-Path $scriptRoot "config\\appsettings.json"
    $examplePath = Join-Path $scriptRoot "config\\appsettings.example.json"
    if (Test-Path $configPath) {
        return Get-Content -Path $configPath -Raw -Encoding UTF8 | ConvertFrom-Json -Depth 20
    }
    return Get-Content -Path $examplePath -Raw -Encoding UTF8 | ConvertFrom-Json -Depth 20
}
```

- [ ] **Step 3: Add required-config validation at startup**

Implement startup checks for:
- `auth.wecom.corpId`
- `auth.wecom.agentId`
- `auth.wecom.secret`
- `auth.wecom.trustedRedirectUri`
- `session.cookieName`

Expected failure:
- service startup should stop with a clear message if `auth.mode = "wecom"` and required fields are missing

- [ ] **Step 4: Run a startup validation smoke check**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Users\yanxi\Documents\OKRManage\mvp\server.ps1"
```

Expected:
- Starts successfully when `appsettings.json` is valid
- Fails fast when required config is missing

- [ ] **Step 5: Commit**

```bash
git add mvp/config/appsettings.example.json mvp/server.ps1
git commit -m "refactor: externalize auth and session runtime config"
```

### Task 3: Introduce Cookie-Based Session Storage

**Files:**
- Modify: `C:/Users/yanxi/Documents/OKRManage/mvp/server.ps1`
- Modify: `C:/Users/yanxi/Documents/OKRManage/mvp/data/seed.json`
- Create: `C:/Users/yanxi/Documents/OKRManage/mvp/tests/logout.ps1`

- [ ] **Step 1: Extend the seed data with WeCom identity fields**

For each user in `seed.json`, add:

```json
{
  "wecomUserId": "zhangchen",
  "isActive": true
}
```

Rules:
- Every production user must have a unique `wecomUserId`
- System admin must also have a `wecomUserId`

- [ ] **Step 2: Add session collection storage in the JSON store**

Ensure the store contains:

```powershell
Ensure-Property -Target $Store -Name "sessions" -Value @()
```

Each session record should contain:

```powershell
[pscustomobject]@{
    id = $sessionId
    userId = $user.id
    createdAt = (Get-Date).ToString("s")
    lastSeenAt = (Get-Date).ToString("s")
    expiresAt = $expiresAt.ToString("s")
    source = "wecom"
}
```

- [ ] **Step 3: Add helpers for session lifecycle**

Implement:

```powershell
function New-SessionRecord { ... }
function Get-SessionById { ... }
function Touch-Session { ... }
function Remove-Session { ... }
function Remove-ExpiredSessions { ... }
function Get-SessionIdFromCookie { ... }
function Set-SessionCookie { ... }
function Clear-SessionCookie { ... }
```

- [ ] **Step 4: Add a failing logout test first**

Create `logout.ps1` with this structure:

```powershell
$session = Invoke-RestMethod -Method Post -Uri "http://localhost:5057/api/auth/debug-login" -Body (@{ wecomUserId = "zhangchen" } | ConvertTo-Json) -ContentType "application/json"
$cookie = $session.cookie
$logout = Invoke-WebRequest -Method Post -Uri "http://localhost:5057/api/logout" -Headers @{ Cookie = $cookie } -SkipHttpErrorCheck
if ($logout.StatusCode -ne 200) { throw "Expected 200 logout" }
```

If a debug-login route is too invasive, use the callback route with mocked WeCom identity under local debug mode.

- [ ] **Step 5: Run the logout test to make sure it fails**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Users\yanxi\Documents\OKRManage\mvp\tests\logout.ps1"
```

Expected:
- FAIL because sessions and logout are not fully wired yet

- [ ] **Step 6: Implement session persistence and logout**

Add:
- `POST /api/logout`
- cookie clearing
- session deletion in store
- expired session cleanup on requests

- [ ] **Step 7: Run the session lifecycle tests**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Users\yanxi\Documents\OKRManage\mvp\tests\logout.ps1"
powershell -ExecutionPolicy Bypass -File "C:\Users\yanxi\Documents\OKRManage\mvp\tests\bootstrap-session.ps1"
```

Expected:
- PASS

- [ ] **Step 8: Commit**

```bash
git add mvp/server.ps1 mvp/data/seed.json mvp/tests/logout.ps1
git commit -m "refactor: add cookie-backed session storage"
```

### Task 4: Add WeCom OAuth Start And Callback Routes

**Files:**
- Modify: `C:/Users/yanxi/Documents/OKRManage/mvp/server.ps1`
- Create: `C:/Users/yanxi/Documents/OKRManage/mvp/tests/wecom-auth-start.ps1`
- Create: `C:/Users/yanxi/Documents/OKRManage/mvp/tests/wecom-auth-callback.ps1`

- [ ] **Step 1: Write the failing start-route test**

Create `wecom-auth-start.ps1`:

```powershell
$response = Invoke-WebRequest -Method Get -Uri "http://localhost:5057/api/auth/wecom/start" -MaximumRedirection 0 -SkipHttpErrorCheck
if ($response.StatusCode -ne 302) { throw "Expected 302 redirect" }
if ($response.Headers.Location -notmatch "open.weixin.qq.com/connect/oauth2/authorize") {
    throw "Expected WeCom OAuth authorize URL"
}
```

- [ ] **Step 2: Write the failing callback test**

Create `wecom-auth-callback.ps1` with three scenarios:
- valid code resolves to active user
- valid code resolves to unknown user and returns `403`
- valid code resolves to inactive user and returns `403`

Use local debug mock mode for deterministic tests:

```powershell
$env:OKR_MOCK_WECOM_USERID = "zhangchen"
$response = Invoke-WebRequest -Method Get -Uri "http://localhost:5057/api/auth/wecom/callback?code=fake-code&state=test" -MaximumRedirection 0 -SkipHttpErrorCheck
if ($response.StatusCode -ne 302) { throw "Expected callback redirect" }
```

- [ ] **Step 3: Run tests and confirm they fail**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Users\yanxi\Documents\OKRManage\mvp\tests\wecom-auth-start.ps1"
powershell -ExecutionPolicy Bypass -File "C:\Users\yanxi\Documents\OKRManage\mvp\tests\wecom-auth-callback.ps1"
```

Expected:
- FAIL

- [ ] **Step 4: Implement `/api/auth/wecom/start`**

Build the OAuth URL using runtime config:

```powershell
$oauthUrl = "https://open.weixin.qq.com/connect/oauth2/authorize?appid=$corpId&redirect_uri=$encodedRedirectUri&response_type=code&scope=snsapi_base&state=$state&agentid=$agentId#wechat_redirect"
```

Return:
- `302 Location: <oauthUrl>`

- [ ] **Step 5: Implement `/api/auth/wecom/callback`**

Callback logic:
- read `code`
- resolve `userid` from WeCom or debug mock
- find local user by `wecomUserId`
- reject inactive/unknown user
- create session
- set session cookie
- redirect to `/`

- [ ] **Step 6: Run auth-route tests**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Users\yanxi\Documents\OKRManage\mvp\tests\wecom-auth-start.ps1"
powershell -ExecutionPolicy Bypass -File "C:\Users\yanxi\Documents\OKRManage\mvp\tests\wecom-auth-callback.ps1"
```

Expected:
- PASS

- [ ] **Step 7: Commit**

```bash
git add mvp/server.ps1 mvp/tests/wecom-auth-start.ps1 mvp/tests/wecom-auth-callback.ps1
git commit -m "feat: add wecom oauth start and callback routes"
```

### Task 5: Replace Global Current User Resolution Everywhere

**Files:**
- Modify: `C:/Users/yanxi/Documents/OKRManage/mvp/server.ps1`
- Test: `C:/Users/yanxi/Documents/OKRManage/mvp/tests/bootstrap-session.ps1`
- Test: `C:/Users/yanxi/Documents/OKRManage/mvp/tests/leader-kr-scoring.ps1`
- Test: `C:/Users/yanxi/Documents/OKRManage/mvp/tests/locked-goal-materials.ps1`

- [ ] **Step 1: Change `Get-CurrentUser` to accept request context**

Refactor to:

```powershell
function Get-CurrentUser {
    param(
        [object]$Store,
        [object]$Request
    )

    $sessionId = Get-SessionIdFromCookie -Request $Request
    if ([string]::IsNullOrWhiteSpace($sessionId)) {
        return $null
    }

    $session = Get-SessionById -Store $Store -SessionId $sessionId
    if ($null -eq $session) {
        return $null
    }

    return Get-UserById -Store $Store -UserId $session.userId
}
```

- [ ] **Step 2: Update all call sites**

Every place that currently does:

```powershell
$currentUser = Get-CurrentUser -Store $Store
```

must become:

```powershell
$currentUser = Get-CurrentUser -Store $Store -Request $Request
```

Affected examples in `server.ps1`:
- `Build-BootstrapPayload`
- score update endpoints
- proof upload/delete endpoints
- admin config endpoints
- goal/kr mutation endpoints

- [ ] **Step 3: Replace actor fields that still read global `currentUserId`**

These fields must use the request-scoped user:

```powershell
$actorUserId = $currentUser.id
$goal.reviewerId = $actorUserId
$proof.uploadedBy = $actorUserId
```

Do **not** keep reading `Store.settings.currentUserId` for audit or mutation ownership.

- [ ] **Step 4: Run multi-role regression tests**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Users\yanxi\Documents\OKRManage\mvp\tests\bootstrap-session.ps1"
powershell -ExecutionPolicy Bypass -File "C:\Users\yanxi\Documents\OKRManage\mvp\tests\leader-kr-scoring.ps1"
powershell -ExecutionPolicy Bypass -File "C:\Users\yanxi\Documents\OKRManage\mvp\tests\locked-goal-materials.ps1"
```

Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add mvp/server.ps1
git commit -m "refactor: resolve current user from cookie session"
```

### Task 6: Refactor Frontend To Session-Backed Bootstrap

**Files:**
- Modify: `C:/Users/yanxi/Documents/OKRManage/mvp/public/index.html`
- Modify: `C:/Users/yanxi/Documents/OKRManage/mvp/public/role-app.js`

- [ ] **Step 1: Remove production dependency on the user switcher**

In `index.html`, keep the switcher only behind a debug placeholder or remove it entirely from the production toolbar:

```html
<!-- remove -->
<select id="userSwitcher"></select>
```

Replace with:

```html
<div id="currentUserText" class="topbar-subtitle"></div>
```

- [ ] **Step 2: Add unauthenticated bootstrap handling**

In `role-app.js`, after loading `/api/bootstrap`, branch on `authState`:

```javascript
if (store.authState === "anonymous") {
  window.location.href = "/api/auth/wecom/start";
  return;
}
```

- [ ] **Step 3: Remove `/api/session` switching as the default login path**

Delete or debug-gate:

```javascript
refs.userSwitcher.addEventListener("change", onSwitchUser);
const res = await apiPut("/api/session", { currentUserId: e.target.value });
```

If local dev switching must remain, gate it behind:

```javascript
if (store.debug?.allowLocalUserSwitch) { ... }
```

- [ ] **Step 4: Stop resolving the current user from `store.settings.currentUserId`**

Replace:

```javascript
state.currentUser = users(true).find((u) => u.id === store.settings.currentUserId) || null;
```

With:

```javascript
state.currentUser = store.currentUser || null;
```

- [ ] **Step 5: Add session-expired fallback behavior**

When any authenticated API call gets `401`:
- clear local state
- redirect to `/api/auth/wecom/start`

- [ ] **Step 6: Run frontend syntax checks**

Run:

```powershell
@'
Get-Content "C:\Users\yanxi\Documents\OKRManage\mvp\public\role-app.js" -Raw -Encoding UTF8 | node -e "new Function(require('fs').readFileSync(0,'utf8')); console.log('role-app ok')"
Get-Content "C:\Users\yanxi\Documents\OKRManage\mvp\public\index.html" -Raw -Encoding UTF8 > $null
'@ | powershell
```

Expected:
- `role-app ok`

- [ ] **Step 7: Commit**

```bash
git add mvp/public/index.html mvp/public/role-app.js
git commit -m "refactor: switch frontend to session-backed bootstrap"
```

### Task 7: Add `/api/me` And Authentication Observability

**Files:**
- Modify: `C:/Users/yanxi/Documents/OKRManage/mvp/server.ps1`
- Modify: `C:/Users/yanxi/Documents/OKRManage/mvp/public/role-app.js`

- [ ] **Step 1: Add `/api/me`**

Return:

```powershell
@{
    ok = $true
    user = @{
        id = $currentUser.id
        name = $currentUser.name
        role = $currentUser.role
        sectionId = $currentUser.sectionId
        departmentId = $currentUser.departmentId
        reviewGroup = $currentUser.reviewGroup
    }
}
```

- [ ] **Step 2: Add structured auth logging**

Log events:
- `auth.wecom.start`
- `auth.wecom.callback.success`
- `auth.wecom.callback.unknown_user`
- `auth.wecom.callback.inactive_user`
- `auth.logout`
- `auth.session.expired`

Current phase can write these into existing activity/log structures, but each entry must include:
- timestamp
- event
- remote address
- resolved user id if available

- [ ] **Step 3: Add a smoke command for auth observability**

Run:

```powershell
Invoke-RestMethod -Method Get -Uri "http://localhost:5057/api/me" -Headers @{ Cookie = $cookie }
```

Expected:
- returns current user summary for authenticated session

- [ ] **Step 4: Commit**

```bash
git add mvp/server.ps1 mvp/public/role-app.js
git commit -m "feat: add authenticated user summary and auth logging"
```

### Task 8: End-To-End Validation Gate For Phase 1

**Files:**
- Test: `C:/Users/yanxi/Documents/OKRManage/mvp/tests/wecom-auth-start.ps1`
- Test: `C:/Users/yanxi/Documents/OKRManage/mvp/tests/wecom-auth-callback.ps1`
- Test: `C:/Users/yanxi/Documents/OKRManage/mvp/tests/bootstrap-session.ps1`
- Test: `C:/Users/yanxi/Documents/OKRManage/mvp/tests/logout.ps1`
- Test: `C:/Users/yanxi/Documents/OKRManage/mvp/tests/bootstrap-shape.ps1`
- Test: `C:/Users/yanxi/Documents/OKRManage/mvp/tests/leader-kr-scoring.ps1`
- Test: `C:/Users/yanxi/Documents/OKRManage/mvp/tests/locked-goal-materials.ps1`
- Test: `C:/Users/yanxi/Documents/OKRManage/mvp/tests/validate-kr-weight.ps1`
- Test: `C:/Users/yanxi/Documents/OKRManage/mvp/tests/review-grade-config.ps1`

- [ ] **Step 1: Run the full automated Phase-1 suite**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Users\yanxi\Documents\OKRManage\mvp\tests\wecom-auth-start.ps1"
powershell -ExecutionPolicy Bypass -File "C:\Users\yanxi\Documents\OKRManage\mvp\tests\wecom-auth-callback.ps1"
powershell -ExecutionPolicy Bypass -File "C:\Users\yanxi\Documents\OKRManage\mvp\tests\bootstrap-session.ps1"
powershell -ExecutionPolicy Bypass -File "C:\Users\yanxi\Documents\OKRManage\mvp\tests\logout.ps1"
powershell -ExecutionPolicy Bypass -File "C:\Users\yanxi\Documents\OKRManage\mvp\tests\bootstrap-shape.ps1"
powershell -ExecutionPolicy Bypass -File "C:\Users\yanxi\Documents\OKRManage\mvp\tests\leader-kr-scoring.ps1"
powershell -ExecutionPolicy Bypass -File "C:\Users\yanxi\Documents\OKRManage\mvp\tests\locked-goal-materials.ps1"
powershell -ExecutionPolicy Bypass -File "C:\Users\yanxi\Documents\OKRManage\mvp\tests\validate-kr-weight.ps1"
powershell -ExecutionPolicy Bypass -File "C:\Users\yanxi\Documents\OKRManage\mvp\tests\review-grade-config.ps1"
```

Expected:
- all PASS

- [ ] **Step 2: Run manual browser validation**

Use this checklist:

1. Open the app in a clean browser session without cookies.
2. Confirm it redirects to `/api/auth/wecom/start`.
3. Complete callback with a mapped user.
4. Confirm employee page renders correctly.
5. Confirm leader page renders correctly.
6. Confirm system admin page renders correctly.
7. Open a second browser profile with another mapped user and confirm the two sessions do not interfere.
8. Log out in one browser and confirm the other browser remains logged in.

- [ ] **Step 3: Capture go/no-go criteria**

Phase 1 can be marked complete only if:
- no endpoint still depends on `Store.settings.currentUserId` for runtime auth
- all automated tests pass
- dual-browser isolation is confirmed
- unmapped WeCom user is rejected cleanly
- inactive WeCom user is rejected cleanly
- logout always invalidates only the current session

- [ ] **Step 4: Commit validation artifacts if new scripts were added**

```bash
git add mvp/tests
git commit -m "test: add phase-1 auth and session validation suite"
```

## Verification Mechanism

This phase must use **three validation layers** before rollout.

### 1. Developer-level verification

Run on every task completion:

- target test for the task
- syntax validation for modified JS
- startup smoke for `server.ps1`

No task is considered done until the local targeted test is green.

### 2. Phase gate verification

Run the full automated Phase-1 suite from Task 8 before:

- merging the phase branch
- enabling `auth.mode = "wecom"` in shared environment
- disabling local user switch in shared environment

### 3. Pilot-environment verification

In the company test server:

- one employee user
- one leader user
- one system admin user
- one unmapped enterprise WeCom user
- one inactive local user with mapped `wecomUserId`

Expected outcomes:
- mapped active users login successfully
- unmapped/inactive users are blocked
- sessions are isolated by browser
- all existing business functions continue working after login

## Rollback Mechanism

If any of the following occur in pilot:

- callback success rate is unstable
- users are intermittently anonymous after callback
- sessions bleed across browsers
- existing employee/leader/admin pages fail to load

then rollback immediately by:

1. set `auth.mode = "legacy"`
2. set `session.mode = "legacy"`
3. restart the service
4. keep newly added tests in place
5. triage and fix before retrying shared rollout

Rollback is acceptable in Phase 1 because business data has not yet migrated to MySQL.

## Phase 1 Deliverables

At the end of this plan, the repo must contain:

- WeCom start/callback/logout/me endpoints
- cookie-backed per-browser sessions
- runtime auth/session config example
- session-aware bootstrap contract
- frontend redirect-to-login behavior
- a test suite proving session isolation and auth correctness

## Handoff To Phase 2

Only after this plan is fully green should the next implementation plan start:

- multi-role refinement
- permission matrix cleanup
- MySQL repository abstraction

## Self-Review

### Spec coverage

This plan directly implements the approved WeCom single-entry login design and the first stage called out in the production roadmap: authentication, independent sessions, config externalization for auth basics, and explicit validation/rollback gates.

### Placeholder scan

No `TODO`, `TBD`, or deferred implementation placeholders are intentionally left in task steps. Where the exact WeCom live call cannot run in local deterministic tests, the plan explicitly uses debug mock mode rather than vague wording.

### Type consistency

The plan consistently uses:
- `wecomUserId` for local-to-WeCom mapping
- `session.id` for cookie session key
- `authState = "anonymous"` for unauthenticated bootstrap
- `store.currentUser` as the frontend source of truth

Plan complete and saved to `docs/superpowers/plans/2026-04-08-phase-1-wecom-login-and-session-refactor.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
