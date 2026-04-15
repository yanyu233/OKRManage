export type QuarterValue = 1 | 2 | 3 | 4;

export type QuarterPeriod = {
  year: number;
  quarter: QuarterValue;
};

export type PeriodOption = {
  value: number;
  label: string;
};

export function normalizeKeyword(value: string | null | undefined) {
  return (value ?? '').trim().toLocaleLowerCase();
}

export function buildQuarterOptions(): PeriodOption[] {
  return [
    { value: 1, label: '一季度' },
    { value: 2, label: '二季度' },
    { value: 3, label: '三季度' },
    { value: 4, label: '四季度' }
  ];
}

export function getQuarterFromMonth(month: number): QuarterValue {
  return (Math.floor(month / 3) + 1) as QuarterValue;
}

export function getCurrentQuarterPeriod(date = new Date()): QuarterPeriod {
  return {
    year: date.getFullYear(),
    quarter: getQuarterFromMonth(date.getMonth())
  };
}

export function getPreviousQuarterPeriod(period: QuarterPeriod): QuarterPeriod {
  if (period.quarter === 1) {
    return {
      year: period.year - 1,
      quarter: 4
    };
  }

  return {
    year: period.year,
    quarter: (period.quarter - 1) as QuarterValue
  };
}

export function getBusinessDefaultQuarterPeriod(date = new Date()): QuarterPeriod {
  const currentPeriod = getCurrentQuarterPeriod(date);
  const month = date.getMonth();
  const isQuarterOpeningMonth = month % 3 === 0;

  return isQuarterOpeningMonth ? getPreviousQuarterPeriod(currentPeriod) : currentPeriod;
}

export function buildCurrentAndFutureYearOptions(currentYear: number, futureRange: number): PeriodOption[] {
  return Array.from({ length: futureRange + 1 }, (_, index) => ({
    value: currentYear + index,
    label: `${currentYear + index}年`
  }));
}

export function buildQuarterPickerYearOptions(anchorYear: number, futureRange: number, selectedYear: number): PeriodOption[] {
  const startYear = Math.min(anchorYear, selectedYear);
  const endYear = Math.max(anchorYear + futureRange, selectedYear);

  return Array.from({ length: endYear - startYear + 1 }, (_, index) => ({
    value: startYear + index,
    label: `${startYear + index}年`
  }));
}

export function buildToolbarYearOptions(startYear: number, endYear: number): PeriodOption[] {
  const from = Math.min(startYear, endYear);
  const to = Math.max(startYear, endYear);
  const options: PeriodOption[] = [];

  for (let year = to; year >= from; year -= 1) {
    options.push({
      value: year,
      label: `${year}年`
    });
  }

  return options;
}
