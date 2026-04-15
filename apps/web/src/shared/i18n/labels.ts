import type { ScoreType, UserRoleCode } from '../types/admin-config';

const ROLE_LABELS: Record<UserRoleCode, string> = {
  'system-admin': '系统管理员',
  'department-head': '部门负责人',
  'section-leader': '科室负责人',
  'group-leader': '小组负责人',
  employee: '员工'
};

const GOAL_STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  confirmed: '已确认',
  'pending-review': '待评分',
  completed: '已完成'
};

const COMPLETION_STATE_LABELS: Record<string, string> = {
  incomplete: '待补充',
  completed: '已完成'
};

const LEADER_EMPLOYEE_STATUS_LABELS: Record<string, string> = {
  pending: '待开始',
  'in-progress': '评分中',
  completed: '已完成'
};

const SCORE_TYPE_LABELS: Record<ScoreType, string> = {
  objective: '客观评分项',
  subjective: '主观评分项'
};

const ROLE_DISPLAY_ORDER: UserRoleCode[] = ['employee', 'group-leader', 'section-leader', 'department-head', 'system-admin'];

export function getRoleLabel(role: UserRoleCode | string) {
  return ROLE_LABELS[role as UserRoleCode] ?? role;
}

export function formatAssignedRoleSummary(roles: Array<UserRoleCode | string>) {
  const normalized = Array.from(new Set(roles.filter(Boolean))) as UserRoleCode[];
  return ROLE_DISPLAY_ORDER.filter((role) => normalized.includes(role))
    .map((role) => getRoleLabel(role))
    .join('/');
}

export function getGoalStatusLabel(status: string) {
  return GOAL_STATUS_LABELS[status] ?? status;
}

export function getCompletionStateLabel(state: string) {
  return COMPLETION_STATE_LABELS[state] ?? state;
}

export function getLeaderEmployeeStatusLabel(status: string) {
  return LEADER_EMPLOYEE_STATUS_LABELS[status] ?? status;
}

export function formatQuarterLabel(year: number, quarter: number) {
  return `${year}年${['一', '二', '三', '四'][quarter - 1] ?? quarter}季度`;
}

export function formatNullableScore(score: number | null | undefined) {
  if (score === null || score === undefined) {
    return '-';
  }

  return Number.isInteger(score) ? `${score}` : score.toFixed(1);
}

export function getScoreTypeLabel(scoreType: ScoreType) {
  return SCORE_TYPE_LABELS[scoreType] ?? scoreType;
}
