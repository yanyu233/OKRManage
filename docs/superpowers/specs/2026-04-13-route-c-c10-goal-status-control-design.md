# Route C C10 Goal Status Control Design

## Goal

Implement a simple, enforceable goal status workflow for Route C that supports:

- employee editing in `draft`
- admin-controlled `draft <-> confirmed`
- employee submission from `confirmed -> pending-review`
- leader scoring only in `pending-review`
- automatic completion after all KR scores are present
- proof uploads remaining open after confirmation and after scoring

## Status Model

Route C goal status will be reduced to four business states:

- `draft`
- `confirmed`
- `pending-review`
- `completed`

`pending-submission` is removed from active behavior and no new Route C code should emit it.

## Workflow

### Employee

- newly created goals are `draft`
- imported template goals are `draft`
- employees can edit goal/KR content only while goal is `draft`
- employee-facing UI does not show a visible `draft` tag
- once a goal is `confirmed`, employee cannot edit goal/KR content anymore
- employees can still:
  - upload proofs
  - update KR completion state
  in `confirmed`, `pending-review`, and `completed`
- employees can submit a goal for review only when:
  - goal is `confirmed`
  - all KRs under that goal are marked `completed`
- submit action transitions `confirmed -> pending-review`

### System Administrator

System configuration gets a new goal-status-control section.

Admins can batch change goals between `draft` and `confirmed`:

- by quarter for all employees
- by quarter for a specific employee

This supports both lock-down after target confirmation and exceptional re-opening for edits.

### Section/Group Leader

- leaders can view all employee OKRs as before
- leaders can score only goals in `pending-review`
- once every KR under a `pending-review` goal has a non-null score, the goal transitions to `completed`
- proof upload availability does not affect leader scoring permissions

## Backend Changes

### Employee domain

Add:

- goal update endpoint
- submit-for-review endpoint

Rules:

- `updateGoal` allowed only for `draft`
- `submitGoalForReview` allowed only for `confirmed`
- `submitGoalForReview` requires all KRs completed

### Leader domain

Scoring endpoints must reject goals not in `pending-review`:

- single KR score update
- bulk objective scoring

After score write:

- if all KRs in the goal have `reviewScore !== null`, update goal to `completed`
- otherwise keep the goal in `pending-review`

### Admin config domain

Add dedicated endpoints for goal status control so this logic does not piggyback on unrelated system-config saves.

## Frontend Changes

### Employee pages

- list page hides `draft`
- detail page:
  - show edit entry only for `draft`
  - show submit-for-review action only for `confirmed`
  - keep proof upload visible for `confirmed`, `pending-review`, `completed`

### Leader pages

- workbench score controls enabled only when selected goal status is `pending-review` and user is in scoring scope
- readonly view remains available for all visible employees/goals

### Admin page

Add a new section in system configuration:

- year selector
- quarter selector
- optional employee selector
- action buttons:
  - confirm goals
  - reopen to draft

The section operates on the selected quarter scope and displays affected goal counts returned by the backend.

## Validation Rules

- employee cannot edit non-draft goal content
- employee cannot submit non-confirmed goal
- employee cannot submit unless all KR completion states are `completed`
- leader cannot score `draft`, `confirmed`, or `completed` goals
- proof upload stays allowed after confirmation and after completion

## Testing Strategy

Add failing tests first for:

- employee edit allowed in `draft`
- employee edit denied in `confirmed`
- employee proof upload allowed in `confirmed` and `completed`
- submit-for-review transition
- leader scoring rejected before `pending-review`
- leader scoring allowed in `pending-review`
- auto-complete after all KR scores exist
- admin batch confirm/reopen by quarter and by employee
