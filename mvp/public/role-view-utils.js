(function initRoleViewUtils(root) {
  const LEADER_ROLES = ["section-leader", "group-leader"];

  function isLeaderRole(role) {
    return LEADER_ROLES.includes(role || "");
  }

  function isDepartmentLeaderRole(role) {
    return role === "department-leader";
  }

  function isSystemAdminRole(role) {
    return role === "system-admin";
  }

  function getRoleViewState(options = {}) {
    const role = options.role || "";
    const leaderSubPage = options.leaderSubPage || "workbench";
    const departmentSubPage = options.departmentSubPage || "overview";
    const leader = isLeaderRole(role);
    const departmentLeader = isDepartmentLeaderRole(role);
    const systemAdmin = isSystemAdminRole(role);
    const showDepartmentConfig = departmentLeader && departmentSubPage === "config";
    const showLeaderRanking = leader && leaderSubPage === "ranking";
    const showLeaderWorkbench = leader && leaderSubPage !== "ranking";
    const showReportPanel = !systemAdmin && !leader && !showDepartmentConfig;

    return {
      showStatsGrid: !systemAdmin,
      showToolbar: !systemAdmin,
      showReportPanel,
      showListPanel: showReportPanel,
      showLeaderWorkbench,
      showLeaderRanking,
      showDepartmentConfig,
      showSystemAdmin: systemAdmin
    };
  }

  const api = {
    LEADER_ROLES,
    isLeaderRole,
    isDepartmentLeaderRole,
    isSystemAdminRole,
    getRoleViewState
  };

  root.RoleViewUtils = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
