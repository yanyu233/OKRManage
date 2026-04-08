(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }
  root.ReportOverviewUtils = factory();
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  function toFiniteNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function formatNumber(value) {
    const rounded = Math.round((toFiniteNumber(value) || 0) * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  }

  function computeQuarterTotalScore(goals) {
    return (goals || []).reduce((total, goal) => {
      const score = toFiniteNumber(goal?.reviewScore);
      const points = toFiniteNumber(goal?.points);
      if (score === null || points === null) return total;
      return total + (score * points) / 100;
    }, 0);
  }

  function buildIdentityValue(parts) {
    const values = (parts || []).filter((part) => part && part !== "-");
    return values.length ? values.join(" / ") : "-";
  }

  function buildSummaryCards(options = {}) {
    const totalScore = options.totalScore ?? computeQuarterTotalScore(options.goals || []);

    return [
      {
        label: "员工 / 科室 / 所属小组",
        value: buildIdentityValue([options.userName, options.sectionName, options.reviewGroup]),
        wide: true,
        tone: "identity"
      },
      {
        label: "目标 / 关键结果",
        value: `${formatNumber(options.goalCount || 0)} / ${formatNumber(options.krCount || 0)}`,
        wide: false,
        tone: "default"
      },
      {
        label: "证明材料",
        value: `${formatNumber(options.proofCount || 0)} 份`,
        wide: false,
        tone: "default"
      },
      {
        label: "季度总分",
        value: `${formatNumber(totalScore)} 分`,
        wide: false,
        tone: "score"
      }
    ];
  }

  return {
    formatNumber,
    computeQuarterTotalScore,
    buildIdentityValue,
    buildSummaryCards
  };
});
