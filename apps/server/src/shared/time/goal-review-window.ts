export function getQuarterFromDate(date: Date) {
  return (Math.floor(date.getMonth() / 3) + 1) as 1 | 2 | 3 | 4;
}

export function shouldAdvanceGoalsToPendingReview(year: number, quarter: number, date = new Date()) {
  const currentYear = date.getFullYear();
  const currentQuarter = getQuarterFromDate(date);

  if (currentYear !== year) {
    return currentYear > year;
  }

  return currentQuarter > quarter;
}
