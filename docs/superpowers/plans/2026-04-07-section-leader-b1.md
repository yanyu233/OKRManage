# Section Leader B1 Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved B1 section-leader scoring workspace where leaders enter by employee, switch goals within the quarter, and score each KR directly with immediate persistence.

**Architecture:** Keep the employee experience intact, add a KR-scoring backend path in `server.ps1`, and layer a section-leader-specific frontend override on top of the existing shell. Goal totals are derived from KR scores for `reviewMode = "kr"` goals.

**Tech Stack:** PowerShell HTTP server, vanilla JavaScript, static HTML/CSS, PowerShell API regression scripts.

---

### Task 1: Add failing backend regression for KR-level leader scoring

**Files:**
- Create: `C:\Users\yanxi\Documents\OKRManage\mvp\tests\leader-kr-scoring.ps1`
- Test: `C:\Users\yanxi\Documents\OKRManage\mvp\tests\leader-kr-scoring.ps1`

- [ ] **Step 1: Write the failing test**

Add a test that:
- switches to employee `u-emp1`
- submits `goal-emp1-q1` into `pending_review`
- switches to section leader `u-sec1`
- scores `kr-emp1-1`
- verifies partial scoring keeps goal in `pending_review`
- scores the remaining KR rows
- verifies goal becomes `reviewed` with summed goal score
- re-scores one KR and verifies the goal total updates
- verifies out-of-scope leader `u-sec2` gets `403`

- [ ] **Step 2: Run test to verify it fails**

Run: `powershell -ExecutionPolicy Bypass -File C:\Users\yanxi\Documents\OKRManage\mvp\tests\leader-kr-scoring.ps1`

Expected: FAIL because `/api/krs/:id/score` does not exist yet.

- [ ] **Step 3: Implement the minimal backend to pass**

Modify `C:\Users\yanxi\Documents\OKRManage\mvp\server.ps1` to add:
- KR review metadata normalization
- `reviewMode` goal normalization
- leader KR scoring permission checks
- `/api/krs/:id/score` route
- goal score/status sync from KR scores

- [ ] **Step 4: Run test to verify it passes**

Run: `powershell -ExecutionPolicy Bypass -File C:\Users\yanxi\Documents\OKRManage\mvp\tests\leader-kr-scoring.ps1`

Expected: PASS.

### Task 2: Add the section-leader B1 frontend workspace

**Files:**
- Create: `C:\Users\yanxi\Documents\OKRManage\mvp\public\leader-role-overrides.js`
- Create: `C:\Users\yanxi\Documents\OKRManage\mvp\public\leader-role-overrides.css`
- Modify: `C:\Users\yanxi\Documents\OKRManage\mvp\public\index.html`

- [ ] **Step 1: Add the failing frontend wiring**

Load the new override files from `index.html` and branch rendering by `section-leader`, initially with placeholder content.

- [ ] **Step 2: Verify the new workspace is visibly incomplete**

Run the app and confirm the section-leader role shows the placeholder instead of the old goal list.

- [ ] **Step 3: Implement the approved B1 layout**

Build:
- summary cards
- employee queue
- employee-level goal tabs
- KR scoring cards with score + leader note
- material list reuse
- silent save on KR score/comment change

- [ ] **Step 4: Verify the page works end-to-end**

Manual checks:
- switch to `u-sec1`
- select employee
- switch goals
- edit KR score
- refresh and confirm persisted value

### Task 3: Protect employee experience and verify regressions

**Files:**
- Test: `C:\Users\yanxi\Documents\OKRManage\mvp\tests\locked-goal-materials.ps1`
- Test: `C:\Users\yanxi\Documents\OKRManage\mvp\tests\locked-goal-completion.ps1`
- Test: `C:\Users\yanxi\Documents\OKRManage\mvp\tests\validate-kr-weight.ps1`
- Test: `C:\Users\yanxi\Documents\OKRManage\mvp\tests\proof-download-path-decoding.ps1`
- Test: `C:\Users\yanxi\Documents\OKRManage\mvp\tests\streamed-kr-proof-upload.ps1`

- [ ] **Step 1: Run existing regressions after frontend/backend changes**

Run:
- `powershell -ExecutionPolicy Bypass -File C:\Users\yanxi\Documents\OKRManage\mvp\tests\locked-goal-materials.ps1`
- `powershell -ExecutionPolicy Bypass -File C:\Users\yanxi\Documents\OKRManage\mvp\tests\locked-goal-completion.ps1`
- `powershell -ExecutionPolicy Bypass -File C:\Users\yanxi\Documents\OKRManage\mvp\tests\validate-kr-weight.ps1`
- `powershell -ExecutionPolicy Bypass -File C:\Users\yanxi\Documents\OKRManage\mvp\tests\proof-download-path-decoding.ps1`
- `powershell -ExecutionPolicy Bypass -File C:\Users\yanxi\Documents\OKRManage\mvp\tests\streamed-kr-proof-upload.ps1`

- [ ] **Step 2: Run JS syntax checks**

Run:
- `C:\Users\yanxi\Documents\Codex\tools\node20\node-v20.18.1-win-x64\node.exe --check C:\Users\yanxi\Documents\OKRManage\mvp\public\role-app.js`
- `C:\Users\yanxi\Documents\Codex\tools\node20\node-v20.18.1-win-x64\node.exe --check C:\Users\yanxi\Documents\OKRManage\mvp\public\detail-workspace-overrides.js`
- `C:\Users\yanxi\Documents\Codex\tools\node20\node-v20.18.1-win-x64\node.exe --check C:\Users\yanxi\Documents\OKRManage\mvp\public\leader-role-overrides.js`

- [ ] **Step 3: Restart local server and smoke test**

Verify:
- employee role still opens employee OKR page
- section leader opens B1 workspace
- uploaded materials still open normally
