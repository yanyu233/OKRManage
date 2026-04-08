(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }
  root.PeriodUtils = factory();
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  const START_YEAR = 2026;
  const DEFAULT_FUTURE_YEARS = 5;

  function toDate(value) {
    if (value instanceof Date) return new Date(value.getTime());
    if (typeof value === "string" || typeof value === "number") return new Date(value);
    return new Date();
  }

  function quarterChoices() {
    return [
      { value: 1, label: "一季度" },
      { value: 2, label: "二季度" },
      { value: 3, label: "三季度" },
      { value: 4, label: "四季度" }
    ];
  }

  function parseCycleId(id) {
    const match = /^(\d{4})-Q([1-4])$/.exec(id || "");
    if (!match) return null;
    return { year: Number(match[1]), quarter: Number(match[2]) };
  }

  function cycleIdFromParts(parts) {
    return `${parts.year}-Q${parts.quarter}`;
  }

  function computeDefaultCycleParts(now) {
    const date = toDate(now);
    const shifted = new Date(date.getFullYear(), date.getMonth() - 1, 1);
    return {
      year: shifted.getFullYear(),
      quarter: Math.floor(shifted.getMonth() / 3) + 1
    };
  }

  function currentCycleId(now) {
    return cycleIdFromParts(computeDefaultCycleParts(now));
  }

  function formatCycleLabel(id) {
    const parsed = parseCycleId(id);
    if (!parsed) return "-";
    const quarter = quarterChoices().find((item) => item.value === parsed.quarter)?.label || `${parsed.quarter}季度`;
    return `${parsed.year}年${quarter}`;
  }

  function maxKnownYear(cycles, fallbackYear) {
    return (cycles || []).reduce((maxYear, cycle) => {
      const parsed = parseCycleId(cycle?.id);
      return parsed ? Math.max(maxYear, parsed.year) : maxYear;
    }, fallbackYear);
  }

  function availableYears(cycles, options = {}) {
    const nowParts = computeDefaultCycleParts(options.now);
    const startYear = options.startYear || START_YEAR;
    const futureYears = options.futureYears ?? DEFAULT_FUTURE_YEARS;
    const endYear = Math.max(startYear, nowParts.year + futureYears, maxKnownYear(cycles, startYear));
    const years = [];
    for (let year = endYear; year >= startYear; year -= 1) {
      years.push(year);
    }
    return years;
  }

  function availableCycleOptions(cycles, options = {}) {
    const startYear = options.startYear || START_YEAR;
    const nowCycleId = currentCycleId(options.now);
    const years = availableYears(cycles, options);
    const cycleMap = new Map();

    years.forEach((year) => {
      quarterChoices().forEach((quarter) => {
        const id = `${year}-Q${quarter.value}`;
        cycleMap.set(id, {
          id,
          label: formatCycleLabel(id),
          status: id === nowCycleId ? "active" : ""
        });
      });
    });

    (cycles || []).forEach((cycle) => {
      const parsed = parseCycleId(cycle.id);
      if (!parsed || parsed.year < startYear) return;
      cycleMap.set(cycle.id, {
        id: cycle.id,
        label: cycle.label || formatCycleLabel(cycle.id),
        status: cycle.status || (cycle.id === nowCycleId ? "active" : "")
      });
    });

    return [...cycleMap.values()].sort((left, right) => {
      const a = parseCycleId(left.id);
      const b = parseCycleId(right.id);
      if (!a || !b) return String(right.id || "").localeCompare(String(left.id || ""), "zh-CN", { numeric: true });
      if (a.year !== b.year) return b.year - a.year;
      return b.quarter - a.quarter;
    });
  }

  return {
    START_YEAR,
    DEFAULT_FUTURE_YEARS,
    quarterChoices,
    parseCycleId,
    cycleIdFromParts,
    computeDefaultCycleParts,
    currentCycleId,
    formatCycleLabel,
    availableYears,
    availableCycleOptions
  };
});
