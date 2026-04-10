# Route C C2 Leader Workbench And Ranking Design

**Date**

2026-04-10

**Goal**

Migrate the leader-side scoring experience into Route C so section leaders and group leaders can:

- browse employees in their visible scope
- switch between a person's goals for the current quarter
- score key results one by one with immediate persistence
- review uploaded proof material
- view ranking results by review group with fixed-seat grade occupation

## Scope

### Included in C2

- MySQL business models for quarter goals, key results, proof records, and KR review state
- seed data for:
  - one system admin
  - one section leader
  - one group leader
  - multiple employees
  - sample quarter OKR data
- NestJS leader module
- leader workbench API
- KR score update API
- leader ranking API
- React leader workbench page
- React leader ranking page

### Not included in C2

- employee-side Route C migration
- WeCom production login
- production file storage migration
- final score submission workflow for a whole quarter

## Functional Rules

### Workbench structure

- outer entry is the employee, not the goal
- selected employee can have multiple goals in the selected quarter
- each goal contains multiple key results
- leaders score key results directly

### Score persistence

- every KR score update is saved immediately
- later edits are allowed
- no separate "submit quarter score" button in C2

### Ranking logic

- ranking is grouped by review group
- current quarter score is computed from scored key results using KR point weight
- users with partial scoring stay visible in ranking
- grade labels are assigned from fixed seat counts configured by system admin

### Scope rules

- section leader can see employees in assigned sections
- group leader can see employees in assigned review groups
- if a person has both roles, Route C uses the current active role from session

## Data Model Additions

### Goal

- owner user
- year
- quarter
- code
- name
- description
- status
- total points

### KeyResult

- parent goal
- code
- name
- description
- points
- completion state
- review score
- review comment
- reviewed at
- reviewed by

### Proof

- key result
- file name
- file url
- file size
- note
- uploaded at

## Backend API Shape

### Workbench bootstrap

- `GET /api/leader/workbench?year=2026&quarter=1`

Returns:

- visible employees
- current employee summary
- current employee goals
- selected goal detail
- key results under selected goal
- proof list for each key result

### KR score update

- `PUT /api/leader/key-results/:krId/score`

Payload:

- `score`
- `comment`

Behavior:

- validates leader scope
- updates KR score fields
- writes audit log
- returns updated KR snapshot

### Ranking bootstrap

- `GET /api/leader/ranking?year=2026&quarter=1&reviewGroupId=...`

Returns:

- visible review groups
- quota summary for selected review group
- ranked employee list
- selected employee score breakdown

## Frontend Pages

### Leader Workbench

- left rail: people in scope
- top tabs: selected employee goals
- main area: selected goal summary plus KR cards
- each KR card shows:
  - points
  - completion state
  - proof count
  - score input
  - comment input
  - recent proof list

### Leader Ranking

- review group selector
- left panel ranking cards
- right panel employee score breakdown
- summary chips for grade seat occupation

## Verification Targets

C2 is complete only when:

- Prisma schema migrates cleanly
- seed creates leader and employee sample data
- leader workbench API returns scoped data
- KR score update works and writes audit
- ranking API returns ranked data with grade assignment
- React leader workbench loads real backend data
- React leader ranking loads real backend data
- backend build and e2e pass
- frontend build and tests pass
