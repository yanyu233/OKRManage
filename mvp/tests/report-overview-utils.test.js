const assert = require("node:assert/strict");

const { computeQuarterTotalScore, buildSummaryCards } = require("../public/report-overview-utils.js");

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error.stack || error.message || String(error));
    process.exitCode = 1;
  }
}

test("computes quarter total score with goal points as weights", () => {
  const score = computeQuarterTotalScore([
    { points: 80, reviewScore: 90 },
    { points: 20, reviewScore: 70 },
    { points: 10, reviewScore: null },
    { points: null, reviewScore: 95 }
  ]);

  assert.equal(score, 86);
});

test("builds the condensed report summary cards", () => {
  const cards = buildSummaryCards({
    userName: "张晨",
    sectionName: "平台产品科",
    reviewGroup: "信息化组",
    goalCount: 2,
    krCount: 6,
    proofCount: 3,
    totalScore: 86
  });

  assert.deepEqual(cards, [
    {
      label: "员工 / 科室 / 所属小组",
      value: "张晨 / 平台产品科 / 信息化组",
      wide: true,
      tone: "identity"
    },
    {
      label: "目标 / 关键结果",
      value: "2 / 6",
      wide: false,
      tone: "default"
    },
    {
      label: "证明材料",
      value: "3 份",
      wide: false,
      tone: "default"
    },
    {
      label: "季度总分",
      value: "86 分",
      wide: false,
      tone: "score"
    }
  ]);
});

if (process.exitCode) {
  process.exit(process.exitCode);
}
