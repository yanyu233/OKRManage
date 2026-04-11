# Route C C3 Employee Shell And CN Design

**Date**

2026-04-10

**Goal**

Migrate the employee-side OKR experience into Route C and complete the first full Chinese localization pass for the new React frontend.

## Scope

### Included in C3

- employee OKR list page
- employee goal detail page
- key-result completion toggle for the owner
- proof upload and proof download for the owner
- local proof storage for Route C development and internal testing
- Chinese UI text for:
  - login page
  - shell navigation
  - admin console
  - leader workbench
  - leader ranking
  - employee pages
- frontend-only status and role localization
- Stable backend seed display data for Route C demo users, goals, and key results

### Not included in C3

- employee-side goal creation and draft editing
- production object storage migration
- WeCom production login wiring
- final quarter submission workflow

## Functional Rules

### Employee list page

- shows current quarter goals for the signed-in employee
- outer structure is still quarter -> goals -> key results
- list page must include:
  - current period
  - goal count
  - key-result count
  - proof count
  - goal status
  - direct entry into goal detail

### Employee goal detail

- displays goal summary and goal status
- displays key-result cards
- each key-result card shows:
  - code
  - name
  - points
  - completion state
  - proof list
  - upload area
- employee may toggle completion state
- employee may upload more proof materials even after a goal is confirmed

### Proof upload and download

- uploads are stored in local Route C proof storage
- metadata is stored in MySQL
- download is served by the NestJS backend
- leaders and the owning employee should be able to open proof links

### Localization strategy

- backend state values remain stable English codes
- frontend maps stable backend values to Chinese labels
- visible page copy is changed to Chinese
- backend seed display data stays stable and does not participate in localization

## Backend API Shape

### Employee OKR list

- `GET /api/employee/okr?year=2026&quarter=1`

Returns:

- current employee summary
- goal list
- current quarter counts

### Employee goal detail

- `GET /api/employee/goals/:goalId`

Returns:

- goal summary
- key results
- proof list for each key result

### Completion toggle

- `PUT /api/employee/key-results/:krId/completion`

Payload:

- `completionState`

### Proof upload

- `POST /api/employee/key-results/:krId/proofs`

Multipart payload:

- `file`
- `note`

### Proof download

- `GET /api/employee/proofs/:proofId/download`

Behavior:

- validates that the current user is either the proof owner or a leader with access to the owner
- streams the file

## Frontend Pages

### Employee OKR page

- compact quarter header
- summary metrics
- goal cards
- expandable key-result preview
- detail link per goal

### Employee goal detail page

- goal summary header
- status chip
- key-result cards
- completion toggle
- upload button and note field
- uploaded proof list

## Verification Targets

C3 is complete only when:

- employee APIs return real MySQL-backed data
- proof upload stores metadata and file content
- proof download returns the uploaded file
- completion state changes persist
- leader pages still render after proof changes
- all Route C visible pages use Chinese labels
- backend build, e2e, and smoke pass
- frontend build and tests pass
