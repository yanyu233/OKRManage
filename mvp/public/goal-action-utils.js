(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }
  root.GoalActionUtils = factory();
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  function canUploadProofInStatus(status) {
    return ["confirmed", "pending_submission", "pending_review"].includes(String(status || ""));
  }

  function goalPrimaryActionState(status) {
    const value = String(status || "");
    if (value === "draft") {
      return { kind: "edit", label: "编辑", action: "edit-goal", tone: "active" };
    }
    if (canUploadProofInStatus(value)) {
      return { kind: "materials", label: "提交材料", action: "detail-goal", tone: "materials" };
    }
    return { kind: "view", label: "查看", action: "detail-goal", tone: "disabled" };
  }

  return {
    canUploadProofInStatus,
    goalPrimaryActionState
  };
});
