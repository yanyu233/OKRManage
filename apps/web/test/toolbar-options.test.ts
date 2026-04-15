import { describe, expect, it } from 'vitest';
import {
  buildCurrentAndFutureYearOptions,
  buildQuarterPickerYearOptions,
  getBusinessDefaultQuarterPeriod,
  getCurrentQuarterPeriod
} from '../src/shared/ui/toolbar-options';

describe('toolbar options', () => {
  it('builds current and future year options from the anchor year', () => {
    expect(buildCurrentAndFutureYearOptions(2026, 3)).toEqual([
      { value: 2026, label: '2026年' },
      { value: 2027, label: '2027年' },
      { value: 2028, label: '2028年' },
      { value: 2029, label: '2029年' }
    ]);
  });

  it('includes the selected previous year in quarter picker options', () => {
    expect(buildQuarterPickerYearOptions(2026, 3, 2025)).toEqual([
      { value: 2025, label: '2025年' },
      { value: 2026, label: '2026年' },
      { value: 2027, label: '2027年' },
      { value: 2028, label: '2028年' },
      { value: 2029, label: '2029年' }
    ]);
  });

  it('derives the natural quarter from the provided date', () => {
    expect(getCurrentQuarterPeriod(new Date('2026-04-14T09:00:00'))).toEqual({
      year: 2026,
      quarter: 2
    });
  });

  it('defaults to the previous quarter throughout the opening month of a quarter', () => {
    expect(getBusinessDefaultQuarterPeriod(new Date('2026-04-01T00:00:00'))).toEqual({
      year: 2026,
      quarter: 1
    });
    expect(getBusinessDefaultQuarterPeriod(new Date('2026-04-30T23:59:59'))).toEqual({
      year: 2026,
      quarter: 1
    });
    expect(getBusinessDefaultQuarterPeriod(new Date('2026-01-10T09:00:00'))).toEqual({
      year: 2025,
      quarter: 4
    });
  });

  it('switches back to the natural quarter starting from the second month', () => {
    expect(getBusinessDefaultQuarterPeriod(new Date('2026-05-01T00:00:00'))).toEqual({
      year: 2026,
      quarter: 2
    });
    expect(getBusinessDefaultQuarterPeriod(new Date('2026-07-15T09:00:00'))).toEqual({
      year: 2026,
      quarter: 2
    });
    expect(getBusinessDefaultQuarterPeriod(new Date('2026-08-01T00:00:00'))).toEqual({
      year: 2026,
      quarter: 3
    });
  });
});
