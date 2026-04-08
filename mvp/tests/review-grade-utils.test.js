const assert = require("assert");
const {
  REVIEW_GRADE_LEVELS,
  DEFAULT_REVIEW_GROUPS,
  REVIEW_GROUPS,
  getReviewGroups,
  normalizeReviewGradeConfig,
  buildGradeQuotas,
  assignRankingGrades
} = require("../public/review-grade-utils.js");

const config = normalizeReviewGradeConfig({
  groups: {
    "信息化组": { "A+": 1, "A": 1, "B+": 1, "B": 0, "C": 0 }
  }
});

assert.deepStrictEqual(REVIEW_GRADE_LEVELS, ["A+", "A", "B+", "B", "C"]);
assert.deepStrictEqual(REVIEW_GROUPS, ["信息化组", "运营组", "综合组"]);
assert.deepStrictEqual(DEFAULT_REVIEW_GROUPS, ["信息化组", "运营组", "综合组"]);
assert.deepStrictEqual(getReviewGroups(config), ["信息化组"]);

const customConfig = normalizeReviewGradeConfig({
  groups: {
    "交付组": { "A+": 1, A: 0, "B+": 1, B: 0, C: 0 },
    "支撑组": { "A+": 0, A: 1, "B+": 0, B: 0, C: 0 }
  }
});

assert.deepStrictEqual(getReviewGroups(customConfig), ["交付组", "支撑组"]);

const quotas = buildGradeQuotas(5, config.groups["信息化组"]);
assert.deepStrictEqual(quotas, { "A+": 1, "A": 1, "B+": 1, "B": 0, "C": 0 });

const ranking = assignRankingGrades(
  [
    { id: "u1", name: "王敏", reviewGroup: "信息化组", score: 91.3, scored: true },
    { id: "u2", name: "张晨", reviewGroup: "信息化组", score: 86.7, scored: true },
    { id: "u3", name: "李涛", reviewGroup: "信息化组", score: null, scored: false },
    { id: "u4", name: "赵明", reviewGroup: "信息化组", score: 82.4, scored: true },
    { id: "u5", name: "孙岩", reviewGroup: "信息化组", score: 79.6, scored: true }
  ],
  config.groups["信息化组"]
);

assert.deepStrictEqual(
  ranking.map((item) => ({ id: item.id, grade: item.grade })),
  [
    { id: "u1", grade: "A+" },
    { id: "u2", grade: "A" },
    { id: "u4", grade: "B+" },
    { id: "u5", grade: null },
    { id: "u3", grade: null }
  ]
);

assert.deepStrictEqual(ranking.gradeUsage, { "A+": 1, "A": 1, "B+": 1, "B": 0, "C": 0 });

console.log("PASS: review grade utils normalized fixed seat quotas and ranking assignments.");
