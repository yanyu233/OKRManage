function reportOverviewHelpers() {
  return globalThis.ReportOverviewUtils || {};
}

function reportProofCount(goals, krs) {
  const goalIds = new Set((goals || []).map((goal) => goal.id));
  const krIds = new Set((krs || []).map((kr) => kr.id));
  return (state.store?.proofs || []).filter((proof) => goalIds.has(proof.goalId) || krIds.has(proof.krId)).length;
}

function reportIdentityLabel() {
  const section = sectionName(state.currentUser.sectionId);
  const team = section !== "-" ? section : deptName(state.currentUser.departmentId);
  return {
    userName: state.currentUser.name || "-",
    sectionName: team,
    reviewGroup: reviewGroupForUser(state.currentUser.id)
  };
}

function reportPanelRefs() {
  const panel = document.querySelector(".report-panel");
  return {
    panel,
    tableWrapper: panel?.querySelector(".table-wrapper")
  };
}

function renderStats() {
  if (!refs.statsGrid) return;
  refs.statsGrid.innerHTML = "";
  refs.statsGrid.classList.add("hidden");
}

function renderReport() {
  const helpers = reportOverviewHelpers();
  const goals = filteredGoals();
  const krs = goals.flatMap((goal) => goalKrs(goal.id));
  const identity = reportIdentityLabel();
  const summaryCards =
    typeof helpers.buildSummaryCards === "function"
      ? helpers.buildSummaryCards({
          ...identity,
          goals,
          goalCount: goals.length,
          krCount: krs.length,
          proofCount: reportProofCount(goals, krs),
          totalScore:
            typeof helpers.computeQuarterTotalScore === "function"
              ? helpers.computeQuarterTotalScore(goals)
              : goals.reduce((total, goal) => {
                  if (goal.reviewScore === null || goal.points === null) return total;
                  return total + (Number(goal.reviewScore) * Number(goal.points)) / 100;
                }, 0)
        })
      : [];

  refs.reportScopeText.textContent = "聚合当前筛选周期内的目标、关键结果与评分数据。";
  refs.reportSummaryChips.innerHTML = summaryCards
    .map(
      (card) =>
        `<div class="report-chip${card.wide ? " report-chip-wide" : ""}${card.tone ? ` report-chip-${card.tone}` : ""}">
          <div class="report-chip-label">${h(card.label)}</div>
          <div class="report-chip-value${card.tone === "identity" ? " report-chip-value-identity" : ""}">${h(card.value)}</div>
        </div>`
    )
    .join("");

  refs.reportHead.innerHTML = "";
  refs.reportRows.innerHTML = "";
  refs.reportEmpty.classList.add("hidden");

  const panelRefs = reportPanelRefs();
  panelRefs.tableWrapper?.classList.add("hidden");
  panelRefs.panel?.classList.add("report-panel-summary-only");
}
