const assert = require("node:assert/strict");

const {
  computeDefaultCycleParts,
  currentCycleId,
  parseCycleId,
  formatCycleLabel,
  quarterChoices,
  availableYears,
  availableCycleOptions
} = require("../public/period-utils.js");

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

test("uses quarter-end-plus-one-month default window", () => {
  assert.deepEqual(computeDefaultCycleParts("2026-04-30"), { year: 2026, quarter: 1 });
  assert.deepEqual(computeDefaultCycleParts("2026-05-01"), { year: 2026, quarter: 2 });
  assert.deepEqual(computeDefaultCycleParts("2026-07-31"), { year: 2026, quarter: 2 });
  assert.deepEqual(computeDefaultCycleParts("2026-08-01"), { year: 2026, quarter: 3 });
  assert.deepEqual(computeDefaultCycleParts("2026-10-31"), { year: 2026, quarter: 3 });
  assert.deepEqual(computeDefaultCycleParts("2026-11-01"), { year: 2026, quarter: 4 });
  assert.deepEqual(computeDefaultCycleParts("2027-01-31"), { year: 2026, quarter: 4 });
  assert.deepEqual(computeDefaultCycleParts("2027-02-01"), { year: 2027, quarter: 1 });
});

test("builds current cycle id from the computed default cycle", () => {
  assert.equal(currentCycleId("2026-05-01"), "2026-Q2");
  assert.equal(currentCycleId("2027-01-15"), "2026-Q4");
});

test("parses and formats cycle ids", () => {
  assert.deepEqual(parseCycleId("2026-Q3"), { year: 2026, quarter: 3 });
  assert.equal(formatCycleLabel("2026-Q3"), "2026年三季度");
  assert.equal(formatCycleLabel(""), "-");
  assert.equal(quarterChoices()[0].label, "一季度");
});

test("limits available years to 2026 and later", () => {
  assert.deepEqual(
    availableYears(
      [{ id: "2026-Q1" }, { id: "2028-Q4" }, { id: "2025-Q4" }],
      { now: "2026-04-06", startYear: 2026, futureYears: 2 }
    ),
    [2028, 2027, 2026]
  );
});

test("produces cycle options starting at 2026-Q1", () => {
  const options = availableCycleOptions([{ id: "2026-Q1", label: "2026年一季度" }], {
    now: "2026-04-06",
    startYear: 2026,
    futureYears: 1
  });

  assert.equal(options[0].id, "2027-Q4");
  assert.equal(options.at(-1).id, "2026-Q1");
  assert.ok(options.every((item) => parseCycleId(item.id).year >= 2026));
  assert.ok(options.some((item) => item.id === "2026-Q1"));
});

if (process.exitCode) {
  process.exit(process.exitCode);
}
