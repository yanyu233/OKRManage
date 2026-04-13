# Route C C9 Actual Point Scoring Design

## Goal

Switch Route C from percentage-based KR review scores to actual-point scoring so every KR is scored directly in its own point range, batch full-score actions write each KR's configured full points, and all goal/quarter/ranking totals are summed from actual earned points.

## Why This Change

The current Route C scoring model stores `reviewScore` as a 0-100 percentage and derives actual points with `points * reviewScore / 100`. That worked for the early prototype, but it conflicts with the real business workflow:

- leaders think in "this KR gets full points" or "this KR gets 18 out of 20"
- objective batch scoring should write each KR's full configured points
- the workbench preview already shows KR points, so a separate percentage model is confusing
- the user explicitly wants score entry and storage to be actual points

## Target Behavior

### Scoring semantics

- `reviewScore` remains the storage field name for now, but its meaning changes to "actual earned points for this KR"
- a KR with `points = 35` can only be scored in the range `0..35`
- a KR with `points = 20` can only be scored in the range `0..20`
- batch "full score" writes `reviewScore = keyResult.points` for every matched objective KR

### Aggregation

- goal current score = sum of scored KR `reviewScore`
- employee quarter score = sum of all scored KR `reviewScore`
- leader ranking sorts by quarter score directly
- no remaining percentage conversion should exist in Route C runtime calculations

### UI

- leader single-KR scoring input uses the KR's own point ceiling
- batch objective scoring preview shows selected employees, goals, KRs, KR points, and current earned points
- batch action stays "批量赋满分", but now means "write each KR's own points value"
- batch modal and related actions must be fully Chinese, including cancel button copy

### Backward compatibility

- existing Route C data seeded or already stored with percentage-style values must be converted once during migration:
  - new stored value = `points * oldReviewScore / 100`
  - rounded consistently to one decimal place
- after migration, all new reads and writes use actual-point semantics only

## Scope

### Backend

- Prisma migration to transform existing stored review scores
- leader single score update validation
- leader bulk score behavior
- employee and leader goal/quarter aggregate calculations
- ranking score display payloads
- seeds updated to actual-point values

### Frontend

- leader workbench score input range and copy
- leader batch scoring preview and submission semantics
- ranking and employee score displays continue to show actual points
- remove remaining English modal copy

### Tests

- migration-sensitive backend e2e assertions updated to actual-point expectations
- batch scoring e2e verifies full score writes KR points
- front-end tests updated to actual-point preview wording and behavior

## Non-Goals

- renaming the database column away from `reviewScore` in this slice
- changing MVP legacy scoring model
- introducing a separate score unit enum

## Risks and Mitigations

- **Risk:** partially switching semantics leaves mixed totals.
  - **Mitigation:** change aggregate helpers first and cover with e2e tests before UI updates.
- **Risk:** migrated data becomes inconsistent.
  - **Mitigation:** perform deterministic migration formula and reset/seed verification.
- **Risk:** leaders confuse "满分" with 100 again.
  - **Mitigation:** preview and alerts explicitly show KR points and "按关键结果分值赋满分".

## Acceptance Criteria

- leaders can only enter scores within each KR's configured points
- objective batch scoring writes each matched KR's own points as the earned score
- goal score, quarter score, and ranking totals are direct sums of earned points
- no Route C batch modal action shows English `Cancel`
- full web test suite, full server e2e suite, build, Prisma validation, and smoke all pass
