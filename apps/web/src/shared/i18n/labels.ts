import type { UserRole } from '../types/session';

export function getRoleLabel(role: UserRole) {
  switch (role) {
    case 'system-admin':
      return '系统管理员';
    case 'section-leader':
      return '科室领导';
    case 'group-leader':
      return '小组负责人';
    case 'employee':
    default:
      return '员工';
  }
}

export function getGoalStatusLabel(status: string) {
  switch (status) {
    case 'draft':
      return '草稿';
    case 'confirmed':
      return '已确认';
    case 'pending-submission':
      return '待提交';
    case 'pending-review':
      return '待评分';
    case 'completed':
      return '已完成';
    default:
      return status;
  }
}

export function getCompletionStateLabel(state: string) {
  switch (state) {
    case 'completed':
      return '已完成';
    case 'incomplete':
      return '待补充';
    default:
      return state;
  }
}

export function getLeaderEmployeeStatusLabel(status: string) {
  switch (status) {
    case 'completed':
      return '已完成';
    case 'in-progress':
      return '评分中';
    case 'pending':
      return '待开始';
    default:
      return status;
  }
}

export function formatQuarterLabel(year: number, quarter: number) {
  const quarterLabels = ['一季度', '二季度', '三季度', '四季度'];
  return `${year}年${quarterLabels[quarter - 1] ?? `${quarter}季度`}`;
}

export function formatNullableScore(value: number | null) {
  return value === null ? '-' : value.toFixed(1);
}
