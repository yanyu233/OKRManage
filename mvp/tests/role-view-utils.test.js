const path = require("path");

const {
  getRoleViewState,
  isLeaderRole,
  isSystemAdminRole
} = require(path.join(__dirname, "..", "public", "role-view-utils.js"));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const employeeView = getRoleViewState({ role: "employee" });
assert(employeeView.showReportPanel === true, "employee should show report panel");
assert(employeeView.showListPanel === true, "employee should show list panel");
assert(employeeView.showLeaderWorkbench === false, "employee should not show leader workbench");
assert(employeeView.showSystemAdmin === false, "employee should not show system admin page");

const leaderWorkbenchView = getRoleViewState({ role: "section-leader", leaderSubPage: "workbench" });
assert(isLeaderRole("section-leader") === true, "section-leader should be a leader role");
assert(leaderWorkbenchView.showReportPanel === false, "leader workbench should hide employee report panel");
assert(leaderWorkbenchView.showListPanel === false, "leader workbench should hide employee list panel");
assert(leaderWorkbenchView.showLeaderWorkbench === true, "leader workbench should show workbench");
assert(leaderWorkbenchView.showLeaderRanking === false, "leader workbench should hide ranking page");

const leaderRankingView = getRoleViewState({ role: "group-leader", leaderSubPage: "ranking" });
assert(leaderRankingView.showLeaderWorkbench === false, "leader ranking should hide workbench");
assert(leaderRankingView.showLeaderRanking === true, "leader ranking should show ranking page");
assert(leaderRankingView.showReportPanel === false, "leader ranking should hide employee report panel");

const adminView = getRoleViewState({ role: "system-admin" });
assert(isSystemAdminRole("system-admin") === true, "system-admin should be detected");
assert(adminView.showSystemAdmin === true, "system-admin should show admin page");
assert(adminView.showStatsGrid === false, "system-admin should hide stats grid");
assert(adminView.showToolbar === false, "system-admin should hide toolbar");
assert(adminView.showReportPanel === false, "system-admin should hide employee report panel");
assert(adminView.showListPanel === false, "system-admin should hide employee list panel");

console.log("PASS: role view utils isolated employee, leader, and system-admin page visibility.");
