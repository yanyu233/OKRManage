# Route C C6 Shell Alignment, Period Toolbar, and Goal Template Design

**Date**

2026-04-12

**Goal**

Fix three Route C usability gaps in one coherent slice:

- correct the header alignment bug where the current user's name and role text sit too high in the shell
- restore the employee and leader pages to the expected MVP-style period interaction with separate year and quarter selectors plus search
- add department-bound goal templates that system administrators can maintain and employees can import into their current OKR quarter through a selection dialog

This slice is intended to reduce visible polish issues while also adding the first reusable OKR authoring accelerator for employees.

## Scope

### Included in C6

- shell header vertical-alignment fix for all roles
- shared toolbar pattern on:
  - employee OKR list
  - leader scoring workbench
  - leader ranking
- separate year selector and quarter selector on those pages
- system-admin goal template management
- goal template persistence in MySQL
- department binding for goal templates
- template goal + template key result data model
- employee-side import dialog for templates
- multi-select template import into the currently selected year and quarter
- duplicate-import prevention per employee / year / quarter / template
- localized frontend copy for the new template flow
- backend and frontend verification for the new flow

### Not included in C6

- template version history
- template approval workflow
- cross-department template sharing
- global template library
- automatic overwrite/merge into already imported goals
- leader-side template management
- enterprise WeCom production auth changes

## Background

Route C is already usable for local-debug role flows, but three issues remain obvious in day-to-day use:

1. The top shell header shows the user name and current-role text vertically misaligned, which makes the application feel unfinished.
2. The employee and leader pages no longer match the tested MVP behavior where users can directly choose year and quarter as two explicit controls.
3. Employees still create quarter goals only from scratch, even though the business now needs department-level reusable template goals with predefined key results and point allocation.

These issues are related from a product perspective because they all affect the daily workflow entry points: entering the app, choosing the period, and quickly creating the quarter's working set.

## Recommended Approach

Three approaches were considered:

1. **Minimal patch**
   - fix header CSS
   - restore toolbar controls
   - add a single-template import shortcut
   - fast, but template capability would be too weak and likely need redesign

2. **Standard expandable slice**
   - fix shell alignment
   - restore shared year + quarter + search toolbar
   - add department-bound template goals
   - add employee multi-select import dialog
   - recommended because it solves the immediate workflow without overshooting into template governance

3. **Heavy operations model**
   - include template versioning, publish states, import history, and override handling
   - too large for the current optimization phase

**Chosen approach: Standard expandable slice.**

## Design

### 1. Shell Header Alignment

The Route C shell header should treat the current-user area as a vertically centered identity block.

Changes:

- keep the left side as:
  - sider toggle
  - identity block with user name and current role
- wrap name and subtitle in a fixed-height column
- use vertical centering rather than relying on default Ant Typography line-height
- keep right-side role tag and login dropdown unchanged

Result:

- employee, leader, and system-admin accounts all display with stable vertical alignment
- no role-specific page needs to handle the bug locally

### 2. Shared Period + Search Toolbar

The employee OKR list, leader workbench, and leader ranking pages should all expose the same top-level filtering pattern:

- search input
- year selector
- quarter selector
- refresh action

The interaction model intentionally matches the previous MVP usage pattern:

- year and quarter are chosen independently
- switching year or quarter triggers a new backend request for that page's dataset
- search remains a local frontend filter over the currently loaded payload

Page-specific search scope:

- employee OKR list:
  - goal code
  - goal name
  - goal description
  - key result names included in the summary payload
- leader workbench:
  - employee name
  - section name
  - review group
  - goal code
  - goal name
  - key result code
  - key result name
- leader ranking:
  - employee name
  - section name
  - review group
  - goal code
  - goal name
  - key result code
  - key result name

To keep the UI consistent, the toolbar should continue to be implemented as shared helper-driven controls rather than page-specific one-off markup.

### 3. Goal Template Model

Goal templates are reusable goal blueprints maintained by system administrators and bound to a department.

Each goal template contains:

- template name
- optional template description
- department id
- active flag
- one or more template key results

Each template key result contains:

- code
- name
- optional description
- points

Important rules:

- templates are not quarter-specific
- templates belong to exactly one department
- template totals are defined by summing template key result points
- templates are reusable source data, not goals themselves

### 4. System Administrator Management

The system-admin configuration page gains a new module: `Goal Templates`.

Capabilities:

- create template goals
- edit template metadata
- bind template to a department
- add, edit, remove template key results
- toggle template active state
- validate point totals before save

The admin page should present templates in a layout that still scales when many departments and many templates exist:

- top-level filter or grouping by department
- template list on the left or top
- template editor panel for the selected template

This avoids forcing all templates into a single long form.

### 5. Employee Import Flow

The employee OKR list page gains an action: `Import Goal Templates`.

Flow:

1. employee selects year and quarter in the page toolbar
2. employee clicks `Import Goal Templates`
3. dialog opens and loads templates for the employee's own department
4. dialog shows:
   - template name
   - description
   - total points
   - key result count
   - import status for the currently selected year/quarter
5. employee can select one or more templates
6. confirm import
7. backend creates real goals and key results in the selected year/quarter
8. list refreshes immediately

Duplicate rule:

- the same employee cannot import the same template more than once for the same year and quarter
- imported templates appear disabled or marked as already imported in the dialog

Import result:

- imported goal becomes a normal employee goal for that quarter
- imported key results behave exactly like hand-created quarter key results

### 6. Backend Behavior

New server-side responsibilities:

- persist goal templates in MySQL
- provide system-admin CRUD endpoints for templates
- provide employee query endpoint for available templates by current department + year + quarter
- provide employee import endpoint that clones selected templates into quarter goals
- enforce duplicate-import prevention
- write audit logs for:
  - template create/update/delete
  - template import

Validation rules:

- template name required
- department required
- at least one template key result required
- each key result must have non-negative integer points
- template key result codes must be unique within one template

### 7. Data Model

The MySQL / Prisma layer should add template-specific tables rather than overloading normal goals:

- `GoalTemplate`
  - id
  - departmentId
  - name
  - description
  - isActive
  - createdAt
  - updatedAt
- `GoalTemplateKeyResult`
  - id
  - goalTemplateId
  - code
  - name
  - description
  - points
  - createdAt
  - updatedAt
- `ImportedGoalTemplate`
  - id
  - goalTemplateId
  - goalId
  - ownerUserId
  - year
  - quarter
  - createdAt

`ImportedGoalTemplate` exists specifically to enforce duplicate-import rules and keep import origin traceable.

## Error Handling

### User-facing

- if no templates exist for the employee's department:
  - dialog shows empty state
- if selected templates were already imported:
  - they appear disabled and cannot be reselected
- if import fails:
  - dialog stays open and shows error message
- if template save fails in system-admin:
  - page keeps draft state and surfaces exact validation error

### Server-side

- unknown department id on template save: reject
- duplicate template key result code: reject
- template import with mismatched department: reject
- duplicate template import for same employee/year/quarter: reject
- importing inactive template: reject

## Testing Expectations

C6 is complete only when all of the following are true:

- shell header identity block is visually centered
- the three pages all show year + quarter + search + refresh controls
- changing year/quarter triggers the corresponding data reload
- search still filters visible page data correctly
- system-admin can create and edit department-bound goal templates
- employee can open a template dialog and import one or more templates
- imported templates create real quarter goals and key results
- repeated import of the same template in the same quarter is blocked
- frontend build/tests remain green
- backend build/e2e/smoke remain green

## Implementation Notes

Implement C6 in this order:

1. shell header alignment test and CSS fix
2. backend template schema and migration
3. backend admin and employee template endpoints
4. frontend shared toolbar adjustments
5. system-admin template UI
6. employee import dialog and import mutation
7. full verification
