import { describe, expect, it } from 'vitest';
import {
  formatQuarterLabel,
  getCompletionStateLabel,
  getGoalStatusLabel,
  getLeaderEmployeeStatusLabel,
  getRoleLabel
} from '../src/shared/i18n/labels';

describe('labels', () => {
  it('maps roles to Chinese labels', () => {
    expect(getRoleLabel('system-admin')).toBe('\u7cfb\u7edf\u7ba1\u7406\u5458');
    expect(getRoleLabel('section-leader')).toBe('\u79d1\u5ba4\u9886\u5bfc');
    expect(getRoleLabel('group-leader')).toBe('\u5c0f\u7ec4\u8d1f\u8d23\u4eba');
    expect(getRoleLabel('employee')).toBe('\u5458\u5de5');
  });

  it('maps business states to Chinese labels', () => {
    expect(getGoalStatusLabel('confirmed')).toBe('\u5df2\u786e\u8ba4');
    expect(getCompletionStateLabel('incomplete')).toBe('\u5f85\u8865\u5145');
    expect(getCompletionStateLabel('completed')).toBe('\u5df2\u5b8c\u6210');
    expect(getLeaderEmployeeStatusLabel('pending')).toBe('\u5f85\u5f00\u59cb');
  });

  it('formats quarter labels', () => {
    expect(formatQuarterLabel(2026, 1)).toBe('\u0032\u0030\u0032\u0036\u5e74\u4e00\u5b63\u5ea6');
    expect(formatQuarterLabel(2026, 4)).toBe('\u0032\u0030\u0032\u0036\u5e74\u56db\u5b63\u5ea6');
  });
});
