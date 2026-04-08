const assert = require("node:assert/strict");

const { canUploadProofInStatus, goalPrimaryActionState } = require("../public/goal-action-utils.js");

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

test("treats confirmed and submission states as material-upload states", () => {
  assert.equal(canUploadProofInStatus("confirmed"), true);
  assert.equal(canUploadProofInStatus("pending_submission"), true);
  assert.equal(canUploadProofInStatus("pending_review"), true);
  assert.equal(canUploadProofInStatus("reviewed"), false);
});

test("returns edit for drafts and materials for locked uploadable goals", () => {
  assert.deepEqual(goalPrimaryActionState("draft"), {
    kind: "edit",
    label: "编辑",
    action: "edit-goal",
    tone: "active"
  });

  assert.deepEqual(goalPrimaryActionState("confirmed"), {
    kind: "materials",
    label: "提交材料",
    action: "detail-goal",
    tone: "materials"
  });
});

if (process.exitCode) {
  process.exit(process.exitCode);
}
