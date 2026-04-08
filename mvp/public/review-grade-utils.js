(function attachReviewGradeUtils(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.ReviewGradeUtils = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function reviewGradeUtilsFactory() {
  const REVIEW_GRADE_LEVELS = ["A+", "A", "B+", "B", "C"];
  const DEFAULT_REVIEW_GROUPS = ["信息化组", "运营组", "综合组"];
  const REVIEW_GROUPS = [...DEFAULT_REVIEW_GROUPS];
  const DEFAULT_GROUP_QUOTAS = { "A+": 0, "A": 0, "B+": 0, "B": 0, "C": 0 };

  function toNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function cloneDefaultGroupQuotas() {
    return REVIEW_GRADE_LEVELS.reduce((acc, level) => {
      acc[level] = DEFAULT_GROUP_QUOTAS[level];
      return acc;
    }, {});
  }

  function normalizeGroupQuotas(rawQuotas) {
    const merged = cloneDefaultGroupQuotas();
    if (rawQuotas && typeof rawQuotas === "object") {
      REVIEW_GRADE_LEVELS.forEach((level) => {
        const value = Math.floor(toNumber(rawQuotas[level], merged[level]));
        merged[level] = value < 0 ? 0 : value;
      });
    }
    return merged;
  }

  function getGroupSource(sourceGroups, group) {
    if (!sourceGroups || typeof sourceGroups !== "object") return null;
    if (Array.isArray(sourceGroups)) {
      const match = sourceGroups.find((entry) => `${entry?.group || entry?.name || ""}`.trim() === group);
      return match?.seats || match || null;
    }
    return sourceGroups[group] || null;
  }

  function getReviewGroups(rawConfig) {
    const sourceGroups = rawConfig && rawConfig.groups && typeof rawConfig.groups === "object" ? rawConfig.groups : null;
    const seen = new Set();
    const groups = [];

    if (Array.isArray(sourceGroups)) {
      sourceGroups.forEach((entry) => {
        const name = `${entry?.group || entry?.name || ""}`.trim();
        if (!name || seen.has(name)) return;
        seen.add(name);
        groups.push(name);
      });
    } else if (sourceGroups) {
      Object.keys(sourceGroups).forEach((name) => {
        const normalized = `${name || ""}`.trim();
        if (!normalized || seen.has(normalized)) return;
        seen.add(normalized);
        groups.push(normalized);
      });
    }

    if (!groups.length) {
      DEFAULT_REVIEW_GROUPS.forEach((group) => {
        if (seen.has(group)) return;
        seen.add(group);
        groups.push(group);
      });
    }

    return groups;
  }

  function normalizeReviewGradeConfig(rawConfig) {
    const groups = {};
    const sourceGroups = rawConfig && rawConfig.groups && typeof rawConfig.groups === "object" ? rawConfig.groups : {};
    const groupOrder = getReviewGroups(rawConfig);

    groupOrder.forEach((group) => {
      groups[group] = normalizeGroupQuotas(getGroupSource(sourceGroups, group));
    });

    return {
      levels: [...REVIEW_GRADE_LEVELS],
      groupOrder,
      groups
    };
  }

  function buildGradeQuotas(_totalPeople, quotas) {
    return normalizeGroupQuotas(quotas);
  }

  function compareRankingEntries(left, right) {
    const leftScore = left.score === null || left.score === undefined ? -Infinity : Number(left.score);
    const rightScore = right.score === null || right.score === undefined ? -Infinity : Number(right.score);
    if (rightScore !== leftScore) return rightScore - leftScore;

    const leftReviewedAt = `${left.lastReviewedAt || left.reviewedAt || ""}`;
    const rightReviewedAt = `${right.lastReviewedAt || right.reviewedAt || ""}`;
    if (rightReviewedAt !== leftReviewedAt) return rightReviewedAt.localeCompare(leftReviewedAt, "zh-CN");

    return `${left.name || ""}`.localeCompare(`${right.name || ""}`, "zh-CN");
  }

  function assignRankingGrades(entries, ratios) {
    const list = Array.isArray(entries) ? entries.map((entry) => ({ ...entry, grade: null, gradeRank: null })) : [];
    const quotas = buildGradeQuotas(list.length, ratios);
    const gradeUsage = REVIEW_GRADE_LEVELS.reduce((acc, level) => {
      acc[level] = 0;
      return acc;
    }, {});

    const scoredEntries = list
      .filter((entry) => entry.scored && entry.score !== null && entry.score !== undefined && `${entry.score}` !== "")
      .sort(compareRankingEntries);

    let pointer = 0;
    REVIEW_GRADE_LEVELS.forEach((level) => {
      for (let index = 0; index < quotas[level] && pointer < scoredEntries.length; index += 1) {
        scoredEntries[pointer].grade = level;
        scoredEntries[pointer].gradeRank = pointer + 1;
        gradeUsage[level] += 1;
        pointer += 1;
      }
    });

    const unscoredEntries = list
      .filter((entry) => !scoredEntries.some((item) => item.id === entry.id))
      .sort(compareRankingEntries)
      .map((entry) => ({ ...entry, grade: null, gradeRank: null }));

    const ranked = [
      ...scoredEntries.map((entry, index) => ({ ...entry, rank: index + 1 })),
      ...unscoredEntries.map((entry, index) => ({ ...entry, rank: scoredEntries.length + index + 1 }))
    ];

    ranked.gradeUsage = gradeUsage;
    ranked.gradeQuotas = quotas;
    return ranked;
  }

  return {
    REVIEW_GRADE_LEVELS,
    DEFAULT_REVIEW_GROUPS,
    REVIEW_GROUPS,
    DEFAULT_GROUP_QUOTAS,
    getReviewGroups,
    normalizeReviewGradeConfig,
    buildGradeQuotas,
    assignRankingGrades
  };
});
