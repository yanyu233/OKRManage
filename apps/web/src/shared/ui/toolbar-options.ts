export function normalizeKeyword(value: string | null | undefined) {
  return (value ?? '').trim().toLocaleLowerCase();
}

export function buildQuarterOptions() {
  return [
    { value: 1, label: '\u4e00\u5b63\u5ea6' },
    { value: 2, label: '\u4e8c\u5b63\u5ea6' },
    { value: 3, label: '\u4e09\u5b63\u5ea6' },
    { value: 4, label: '\u56db\u5b63\u5ea6' }
  ];
}

export function buildToolbarYearOptions(startYear: number, endYear: number) {
  const from = Math.min(startYear, endYear);
  const to = Math.max(startYear, endYear);
  const options: Array<{ value: number; label: string }> = [];

  for (let year = to; year >= from; year -= 1) {
    options.push({
      value: year,
      label: `${year}\u5e74`
    });
  }

  return options;
}
