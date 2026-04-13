import { describe, expect, it } from 'vitest';
import {
  formatAssignedRoleSummary,
  formatQuarterLabel,
  getCompletionStateLabel,
  getGoalStatusLabel,
  getLeaderEmployeeStatusLabel,
  getRoleLabel
} from '../src/shared/i18n/labels';

describe('labels', () => {
  it('maps roles to Chinese labels', () => {
    expect(getRoleLabel('system-admin')).toBe('系统管理员');
    expect(getRoleLabel('section-leader')).toBe('科室负责人');
    expect(getRoleLabel('group-leader')).toBe('小组负责人');
    expect(getRoleLabel('employee')).toBe('员工');
  });

  it('formats assigned role summary with employee first for combined identities', () => {
    expect(formatAssignedRoleSummary(['employee', 'group-leader'])).toBe('员工/小组负责人');
    expect(formatAssignedRoleSummary(['section-leader', 'group-leader'])).toBe('科室负责人/小组负责人');
  });

  it('maps business states to Chinese labels', () => {
    expect(getGoalStatusLabel('draft')).toBe('草稿');
    expect(getGoalStatusLabel('confirmed')).toBe('已确认');
    expect(getGoalStatusLabel('pending-review')).toBe('待评分');
    expect(getGoalStatusLabel('completed')).toBe('已完成');
    expect(getCompletionStateLabel('incomplete')).toBe('待补充');
    expect(getCompletionStateLabel('completed')).toBe('已完成');
    expect(getLeaderEmployeeStatusLabel('pending')).toBe('待开始');
  });

  it('formats quarter labels', () => {
    expect(formatQuarterLabel(2026, 1)).toBe('2026年一季度');
    expect(formatQuarterLabel(2026, 4)).toBe('2026年四季度');
  });
});
