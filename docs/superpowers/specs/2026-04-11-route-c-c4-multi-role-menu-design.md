# Route C C4 Multi-Role Menu Design

**Date**

2026-04-11

**Goal**

Enable one user to hold multiple roles in Route C and access them directly from the left navigation. When a user is both an employee and a group leader, the menu should show both role groups. When a user is only an employee, the menu should show only employee functions.

This stage focuses on:

- multi-role session shape
- grouped role menu in the React shell
- automatic active-role switching when the user clicks a function under another role group
- route guards that respect both assigned roles and current active role

## Scope

### Included in C4

- backend session response supports multiple assigned roles
- backend stores one current `activeRole`
- manual login restores all assigned roles, not only one role
- new backend endpoint to switch active role inside the same authenticated session
- frontend shell renders role-grouped navigation
- clicking a menu item under another role automatically switches active role first
- top bar shows the current active role
- users with one role still see a single menu group
- users with multiple roles see multiple grouped menu sections

### Not included in C4

- production WeCom callback wiring
- new business pages beyond C1, C2, and C3
- permission model redesign beyond current assigned-role model
- backend super-admin impersonation

## User Experience

### Single-role user

Example: employee only

- left menu shows one employee role group
- visible item is the employee OKR entry
- no extra role switching control is required

### Multi-role user

Example: employee plus group leader

- left menu shows grouped sections:
  - employee group
    - employee OKR entry
  - group-leader group
    - leader workbench entry
    - leader ranking entry
- user clicks any function directly
- app switches active role automatically if needed
- page then opens under the correct role context

### Top bar behavior

- top bar continues to show current user name
- top bar shows the current role label
- top bar does not require a manual dropdown switch in C4
- switching is menu-driven to match the requested UX

## Recommended Approach

Three possible approaches were considered:

1. Flat merged menu  
   Simple, but scales poorly and loses role boundaries.

2. Grouped role menu with automatic role switch  
   Recommended. Clear role boundaries, direct access through function menus, and still simple for single-role users.

3. Manual role switch first, then show current-role menu  
   Clean technically, but adds an extra step and does not match the requested UX.

**Chosen approach: grouped role menu with automatic role switch.**

## Backend Design

### Session shape

Current Route C session user only contains one role. C4 changes this to:

```ts
type SessionRole = 'system-admin' | 'section-leader' | 'group-leader' | 'employee';

type SessionRoleAssignment = {
  role: SessionRole;
  isPrimary: boolean;
};

type SessionUser = {
  id: string;
  name: string;
  loginName: string;
  activeRole: SessionRole;
  roles: SessionRoleAssignment[];
};
```

### Rules

- `roles` includes all enabled assigned roles for the authenticated user
- `activeRole` must always be one of the assigned roles
- login chooses the initial active role by:
  1. primary enabled role if present
  2. otherwise first enabled role in stable priority order
- stable priority order:
  - `system-admin`
  - `section-leader`
  - `group-leader`
  - `employee`

### Role switch endpoint

Add one endpoint:

- `POST /api/auth/active-role`

Request:

```json
{
  "role": "group-leader"
}
```

Behavior:

- request must be authenticated
- target role must exist in current user's assigned enabled roles
- backend updates session `activeRole`
- backend writes audit log with action `auth.active-role.switch`
- response returns refreshed session user payload

### Authorization model

Route C APIs should now use:

- `assigned roles` to determine whether a route is reachable at all
- `activeRole` to decide which role context applies to the current request

Examples:

- `/leader/*` requires assigned role `section-leader` or `group-leader`
- `/employee/*` requires assigned role `employee`
- if a user has both employee and group-leader roles, both route families are reachable
- once a leader route is entered through its menu item, the app switches `activeRole` to the leader role first

This keeps business scope logic stable while allowing one session to expose multiple role menus.

## Frontend Design

### Navigation model

Replace current `menuItemsForRole(role)` with a grouped navigation builder:

```ts
type NavRoleGroup = {
  role: SessionRole;
  title: string;
  items: Array<{
    key: string;
    label: string;
    icon: ReactNode;
    targetRole: SessionRole;
  }>;
};
```

### Example output

For employee plus group leader:

- employee group
  - `/employee/okr`
- group-leader group
  - `/leader/workbench`
  - `/leader/ranking`

For employee only:

- employee group
  - `/employee/okr`

### Click flow

When user clicks a menu item:

1. check the menu item's `targetRole`
2. if `targetRole !== activeRole`, call `POST /api/auth/active-role`
3. update session query cache with the returned user
4. navigate to the target route

This keeps switching invisible and tied to the menu itself.

### Route guards

Current guards assume only one role. C4 changes them to:

- protected route checks session exists
- route role checks search the assigned role list
- unauthorized page is shown only if the user truly lacks the required role

This means:

- employee plus group leader can open both employee and leader routes
- employee-only user cannot open leader routes
- leader-only user cannot open employee routes unless employee role is also assigned

## Data and persistence impact

C4 does not require a new Prisma model. Existing role-assignment tables already support multiple roles.

Required repository and service changes:

- session hydration must load all enabled role assignments
- manual login must return multi-role session user
- current-user endpoint must return multi-role payload
- role switch writes only to session storage, not to `UserRoleAssignment`

## Audit impact

Add one new audit action:

- `auth.active-role.switch`

Recommended fields:

- actor user id
- previous active role
- next active role
- login name

## Testing Strategy

### Backend automated

- extend auth and session e2e tests:
  - multi-role login returns assigned roles
  - role switch succeeds for assigned role
  - role switch fails for unassigned role
- verify `GET /api/me` returns updated `activeRole`

### Frontend automated

- add menu builder tests:
  - single-role employee returns one menu group
  - employee plus group leader returns two menu groups
- add app-shell tests:
  - clicking cross-role menu item triggers role switch mutation
  - route guards accept assigned role even when current active role differs before switch

### Manual validation

- login as employee only:
  - only employee menu appears
- login as group leader only:
  - only leader group appears
- login as employee plus group leader:
  - both groups appear
  - clicking employee page updates current role to employee
  - clicking leader workbench updates current role to leader
  - current role badge in header follows the selected function

## Exit criteria

C4 is complete when:

- multi-role user sees grouped menus by role
- single-role user sees only one menu group
- menu click automatically activates the correct role context
- leader and employee pages both open correctly for a dual-role user
- unauthorized behavior remains correct for users lacking a role
- backend and frontend automated tests pass
