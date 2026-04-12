import type { UserRole } from '../types/session';

export function getRoleLabel(role: UserRole) {
  switch (role) {
    case 'system-admin':
      return '\u7cfb\u7edf\u7ba1\u7406\u5458';
    case 'section-leader':
      return '\u79d1\u5ba4\u8d1f\u8d23\u4eba';
    case 'group-leader':
      return '\u5c0f\u7ec4\u8d1f\u8d23\u4eba';
    case 'employee':
    default:
      return '\u5458\u5de5';
  }
}

export function formatAssignedRoleSummary(roles: UserRole[]) {
  const displayOrder: UserRole[] = ['employee', 'section-leader', 'group-leader', 'system-admin'];
  const uniqueRoles = Array.from(new Set(roles));

  return displayOrder
    .filter((role) => uniqueRoles.includes(role))
    .map((role) => getRoleLabel(role))
    .join('/');
}

export function getGoalStatusLabel(status: string) {
  switch (status) {
    case 'draft':
      return '\u8349\u7a3f';
    case 'confirmed':
      return '\u5df2\u786e\u8ba4';
    case 'pending-submission':
      return '\u5f85\u63d0\u4ea4';
    case 'pending-review':
      return '\u5f85\u8bc4\u5206';
    case 'completed':
      return '\u5df2\u5b8c\u6210';
    default:
      return status;
  }
}

export function getCompletionStateLabel(state: string) {
  switch (state) {
    case 'completed':
      return '\u5df2\u5b8c\u6210';
    case 'incomplete':
      return '\u5f85\u8865\u5145';
    default:
      return state;
  }
}

export function getLeaderEmployeeStatusLabel(status: string) {
  switch (status) {
    case 'completed':
      return '\u5df2\u5b8c\u6210';
    case 'in-progress':
      return '\u8bc4\u5206\u4e2d';
    case 'pending':
      return '\u5f85\u5f00\u59cb';
    default:
      return status;
  }
}

export function formatQuarterLabel(year: number, quarter: number) {
  const quarterLabels = ['\u4e00\u5b63\u5ea6', '\u4e8c\u5b63\u5ea6', '\u4e09\u5b63\u5ea6', '\u56db\u5b63\u5ea6'];
  return `${year}\u5e74${quarterLabels[quarter - 1] ?? `${quarter}\u5b63\u5ea6`}`;
}

export function formatNullableScore(value: number | null) {
  return value === null ? '-' : value.toFixed(1);
}

export function getScoreTypeLabel(scoreType: string) {
  switch (scoreType) {
    case 'objective':
      return '\u5ba2\u89c2\u8bc4\u5206\u9879';
    case 'subjective':
      return '\u4e3b\u89c2\u8bc4\u5206\u9879';
    default:
      return scoreType;
  }
}
