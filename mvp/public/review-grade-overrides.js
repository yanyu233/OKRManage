(function attachReviewGradeOverrides() {
  if (typeof window === "undefined" || typeof render !== "function" || !window.ReviewGradeUtils) return;

  const baseRender = render;
  const baseRenderShell = renderShell;
  const viewUtils = window.RoleViewUtils || {};
  const leaderWorkbenchApi = window.LeaderRoleWorkbench || {};
  const {
    REVIEW_GRADE_LEVELS,
    DEFAULT_REVIEW_GROUPS,
    REVIEW_GROUPS,
    getReviewGroups,
    normalizeReviewGradeConfig,
    buildGradeQuotas,
    assignRankingGrades
  } = window.ReviewGradeUtils;
  const getRoleViewState =
    viewUtils.getRoleViewState ||
    ((options = {}) => {
      const role = options.role || "";
      const leader = role === "section-leader" || role === "group-leader";
      const systemAdmin = role === "system-admin";
      const departmentLeader = role === "department-leader";
      const showDepartmentConfig = departmentLeader && (options.departmentSubPage || "overview") === "config";
      const showLeaderRanking = leader && (options.leaderSubPage || "workbench") === "ranking";
      return {
        showReportPanel: !systemAdmin && !leader && !showDepartmentConfig,
        showListPanel: !systemAdmin && !leader && !showDepartmentConfig,
        showLeaderWorkbench: leader && !showLeaderRanking,
        showLeaderRanking,
        showDepartmentConfig
      };
    });
  const ensureLeaderWorkbench =
    leaderWorkbenchApi.ensureLeaderWorkbench ||
    (() => document.getElementById("leaderWorkbench"));
  const renderLeaderWorkbench = leaderWorkbenchApi.renderLeaderWorkbench || (() => {});
  const toggleLeaderWorkbench =
    leaderWorkbenchApi.toggleLeaderWorkbench ||
    ((enabled) => toggleElement(ensureLeaderWorkbench(), !enabled));

  state.leaderSubPage = state.leaderSubPage || "workbench";
  state.departmentSubPage = state.departmentSubPage || "overview";
  state.rankingSelectedGroup = state.rankingSelectedGroup || "";
  state.rankingSelectedUserId = state.rankingSelectedUserId || "";

  function isLeaderRole(role = state.currentUser?.role) {
    return role === "section-leader" || role === "group-leader";
  }

  function isDepartmentLeaderRole(role = state.currentUser?.role) {
    return role === "department-leader";
  }

  function ensureMount(id, className) {
    let mount = document.getElementById(id);
    if (!mount) {
      mount = document.createElement("section");
      mount.id = id;
      mount.className = `${className} hidden`;
      refs.statsGrid.insertAdjacentElement("afterend", mount);
    }
    return mount;
  }

  function appPanels() {
    return {
      reportPanel: document.querySelector(".report-panel"),
      listPanel: document.querySelector(".list-panel"),
      leaderWorkbench: document.getElementById("leaderWorkbench"),
      rankingMount: document.getElementById("leaderRankingPage"),
      configMount: document.getElementById("reviewConfigPage")
    };
  }

  function toggleElement(node, hidden) {
    node?.classList.toggle("hidden", hidden);
  }

  function currentReviewGradeConfig() {
    return normalizeReviewGradeConfig(state.store?.settings?.reviewGradeConfig);
  }

  function currentReviewGroups() {
    return (getReviewGroups && getReviewGroups(state.store?.settings?.reviewGradeConfig)) || REVIEW_GROUPS || DEFAULT_REVIEW_GROUPS || [];
  }

  function isScoredKr(kr) {
    return kr && kr.score !== null && kr.score !== undefined && `${kr.score}` !== "";
  }

  function weightedKrScore(krs) {
    const scored = (krs || []).filter(isScoredKr);
    if (!scored.length) return null;

    let weightedTotal = 0;
    let weightSum = 0;
    scored.forEach((kr) => {
      const weight = kr.points === null || kr.points === undefined || `${kr.points}` === "" ? 1 : num(kr.points);
      weightedTotal += num(kr.score) * weight;
      weightSum += weight;
    });

    return weightSum ? Number((weightedTotal / weightSum).toFixed(1)) : null;
  }

  function leaderVisibleGoals() {
    return filteredGoals().filter((goal) => getUser(goal.ownerId)?.role === "employee");
  }

  function scoreableLeaderGoal(goal) {
    return ["pending_review", "reviewed"].includes(goal.status);
  }

  function summaryStatus(scoreableKrs, scoredKrs) {
    if (!scoredKrs.length) return { tone: "pending", label: "待开始" };
    if (scoredKrs.length < scoreableKrs.length) return { tone: "progress", label: "评分中" };
    return { tone: "done", label: "已完成" };
  }

  function employeeSummaries() {
    const map = new Map();

    leaderVisibleGoals().forEach((goal) => {
      const owner = getUser(goal.ownerId);
      if (!owner) return;
      if (!map.has(owner.id)) {
        map.set(owner.id, {
          id: owner.id,
          name: owner.name,
          sectionName: sectionName(owner.sectionId),
          departmentName: deptName(owner.departmentId),
          reviewGroup: reviewGroupForUser(owner.id),
          goals: [],
          krs: [],
          scoreableGoals: [],
          scoreableKrs: [],
          scoredKrs: [],
          proofCount: 0,
          quarterScore: null,
          lastReviewedAt: "",
          status: { tone: "pending", label: "待开始" }
        });
      }

      const entry = map.get(owner.id);
      const krs = goalKrs(goal.id);
      entry.goals.push(goal);
      entry.krs.push(...krs);
      entry.proofCount += goalProofs(goal.id).length;
      if (scoreableLeaderGoal(goal)) {
        entry.scoreableGoals.push(goal);
        entry.scoreableKrs.push(...krs);
      }
    });

    return [...map.values()].map((entry) => {
      entry.scoredKrs = entry.scoreableKrs.filter(isScoredKr);
      entry.quarterScore = weightedKrScore(entry.scoreableKrs);
      entry.status = summaryStatus(entry.scoreableKrs, entry.scoredKrs);
      entry.lastReviewedAt = [...entry.scoredKrs]
        .map((kr) => kr.reviewedAt || "")
        .filter(Boolean)
        .sort((a, b) => b.localeCompare(a, "zh-CN"))[0] || "";
      return entry;
    });
  }

  function availableRankingGroups() {
    const groups = new Set(employeeSummaries().map((entry) => entry.reviewGroup).filter(Boolean));
    return currentReviewGroups().filter((group) => groups.has(group));
  }

  function ensureRankingSelection(entries, visibleGroups) {
    if (!visibleGroups.length) {
      state.rankingSelectedGroup = "";
      state.rankingSelectedUserId = "";
      return;
    }

    if (!visibleGroups.includes(state.rankingSelectedGroup)) {
      state.rankingSelectedGroup = visibleGroups[0];
    }

    if (!entries.some((entry) => entry.id === state.rankingSelectedUserId)) {
      state.rankingSelectedUserId = entries[0]?.id || "";
    }
  }

  function rankingEntriesForGroup(group) {
    const config = currentReviewGradeConfig().groups[group];
    const entries = employeeSummaries()
      .filter((entry) => entry.reviewGroup === group)
      .map((entry) => ({
        id: entry.id,
        name: entry.name,
        sectionName: entry.sectionName,
        reviewGroup: entry.reviewGroup,
        goals: entry.goals.length,
        totalKr: entry.krs.length,
        scoreableKr: entry.scoreableKrs.length,
        scoredKr: entry.scoredKrs.length,
        proofCount: entry.proofCount,
        score: entry.quarterScore,
        scored: entry.quarterScore !== null,
        statusTone: entry.status.tone,
        statusLabel: entry.status.label,
        lastReviewedAt: entry.lastReviewedAt
      }));

    return assignRankingGrades(entries, config);
  }

  function renderRankingSummaryCards(entries, group) {
    const topScore = entries.find((entry) => entry.score !== null);
    const doneCount = entries.filter((entry) => entry.statusTone === "done").length;
    const inProgressCount = entries.filter((entry) => entry.statusTone === "progress").length;
    const noScoreCount = entries.filter((entry) => entry.statusTone === "pending").length;

    refs.statsGrid.innerHTML = [
      ["当前组别", group || "-", "排名和档位都按当前责任范围内的评价组展示。"],
      ["已完成评分", doneCount, "所有可评分关键结果都已打分的员工数量。"],
      ["评分中", inProgressCount, "已开始评分但还没全部打完的员工数量。"],
      ["榜首分数", topScore?.score === null || topScore?.score === undefined ? "-" : fmt(topScore.score), `待开始 ${noScoreCount} 人`]
    ]
      .map(
        ([label, value, hint]) => `<div class="leader-summary-card">
          <div class="leader-summary-label">${h(String(label))}</div>
          <div class="leader-summary-value">${h(String(value))}</div>
          <div class="leader-summary-hint">${h(String(hint))}</div>
        </div>`
      )
      .join("");
  }

  function rankingGradeChips(entries) {
    const quotas = entries.gradeQuotas || {};
    const usage = entries.gradeUsage || {};
    return REVIEW_GRADE_LEVELS.map((level) => {
      const used = usage[level] || 0;
      const quota = quotas[level] || 0;
      return `<span class="review-grade-chip">${h(level)} ${used}/${quota}</span>`;
    }).join("");
  }

  function rankingCard(entry) {
    const gradeText = entry.grade || "待定";
    const scoreText = entry.score === null || entry.score === undefined ? "-" : fmt(entry.score);
    return `<button class="review-rank-card${entry.id === state.rankingSelectedUserId ? " is-active" : ""}" type="button" data-review-act="select-ranking-user" data-user-id="${h(entry.id)}">
      <div class="review-rank-head">
        <div class="review-rank-badge">#${h(String(entry.rank))}</div>
        <div class="review-rank-main">
          <div class="review-rank-name">${h(entry.name)}</div>
          <div class="review-rank-meta">${h(`${entry.sectionName} · ${entry.goals} 个目标 · 已评 ${entry.scoredKr}/${entry.scoreableKr || entry.totalKr} 条关键结果`)}</div>
        </div>
        <div class="review-rank-score">
          <strong>${h(String(scoreText))}</strong>
          <span>季度分</span>
        </div>
      </div>
      <div class="review-rank-foot">
        <div class="review-rank-pills">
          <span class="review-rank-grade">${h(gradeText)}</span>
          <span class="leader-status-pill ${entry.statusTone}">${h(entry.statusLabel)}</span>
        </div>
        <span class="review-rank-proof">${h(`材料 ${entry.proofCount} 份`)}</span>
      </div>
    </button>`;
  }

  function employeeGoalBreakdown(summary) {
    return summary.goals
      .map((goal) => {
        const krs = goalKrs(goal.id);
        const score = weightedKrScore(krs);
        const scoredCount = krs.filter(isScoredKr).length;
        return `<article class="review-breakdown-card">
          <strong>${h(`${goal.code} ${goal.name}`)}</strong>
          <span>${h(`${krs.length} 条关键结果 · 已评 ${scoredCount} 条 · 当前目标分 ${score === null ? "-" : fmt(score)}`)}</span>
        </article>`;
      })
      .join("");
  }

  function employeeKrTable(summary) {
    const rows = summary.krs
      .slice()
      .sort((left, right) => `${left.code}`.localeCompare(`${right.code}`, "zh-CN"))
      .map((kr) => `<tr>
          <td><strong>${h(kr.code)}</strong>${h(kr.name)}</td>
          <td>${h(fmt(kr.points))}</td>
          <td>${h(isScoredKr(kr) ? fmt(kr.score) : "-")}</td>
          <td>${h(kr.reviewComment || (isScoredKr(kr) ? "已评分" : "尚未评分"))}</td>
          <td>${h(kr.reviewedAt || "-")}</td>
        </tr>`)
      .join("");

    return `<table class="review-rank-table">
      <thead>
        <tr>
          <th>关键结果</th>
          <th>分值</th>
          <th>当前评分</th>
          <th>评分备注</th>
          <th>更新时间</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  function renderLeaderRankingPage() {
    const mount = ensureMount("leaderRankingPage", "review-grade-page");
    const groups = availableRankingGroups();
    const group = groups.includes(state.rankingSelectedGroup) ? state.rankingSelectedGroup : (groups[0] || "");
    const entries = group ? rankingEntriesForGroup(group) : [];
    ensureRankingSelection(entries, groups);
    const selectedEntry = entries.find((entry) => entry.id === state.rankingSelectedUserId) || entries[0] || null;
    const summary = selectedEntry ? employeeSummaries().find((entry) => entry.id === selectedEntry.id) : null;

    renderRankingSummaryCards(entries, group);
    mount.classList.remove("hidden");

    if (!entries.length || !summary) {
      mount.innerHTML = `<div class="review-grade-empty">当前组别还没有可排名的评分数据，可以继续录入关键结果评分后再查看。</div>`;
      return;
    }

    mount.innerHTML = `<div class="review-rank-layout">
      <aside class="review-rank-list-panel">
        <div class="review-rank-panel-head">
          <div>
            <div class="review-rank-title">评分排名</div>
            <div class="review-rank-subtitle">按当前周期和评价组查看实时排名与档位占用。</div>
          </div>
          <span class="review-rank-period">${h(cycleLabel(state.cycleId))}</span>
        </div>
        <div class="review-rank-group-tabs">
          ${groups.map((item) => `<button class="review-group-tab${item === group ? " is-active" : ""}" type="button" data-review-act="select-ranking-group" data-group="${h(item)}">${h(item)}</button>`).join("")}
        </div>
        <div class="review-grade-chip-row">${rankingGradeChips(entries)}</div>
        <div class="review-rank-card-list">${entries.map(rankingCard).join("")}</div>
      </aside>

      <section class="review-rank-detail-panel">
        <div class="review-rank-detail-head">
          <div>
            <div class="review-rank-detail-name">${h(summary.name)} · 评分明细</div>
            <div class="review-rank-detail-copy">${h(`${summary.sectionName} · ${summary.reviewGroup} · ${summary.goals.length} 个目标 / ${summary.krs.length} 条关键结果`)}</div>
          </div>
          <div class="review-rank-score-kpi">
            <span>当前档位</span>
            <strong>${h(selectedEntry.grade || "待定")}</strong>
          </div>
        </div>

        <div class="review-rank-metrics">
          <div class="review-rank-metric"><span>实时季度分</span><strong>${h(summary.quarterScore === null ? "-" : fmt(summary.quarterScore))}</strong></div>
          <div class="review-rank-metric"><span>已评关键结果</span><strong>${h(`${summary.scoredKrs.length}/${summary.scoreableKrs.length || summary.krs.length}`)}</strong></div>
          <div class="review-rank-metric"><span>证明材料</span><strong>${h(String(summary.proofCount))}</strong></div>
          <div class="review-rank-metric"><span>评分状态</span><strong>${h(summary.status.label)}</strong></div>
        </div>

        <div class="review-rank-detail-grid">
          <section class="review-rank-section">
            <h3>目标分数构成</h3>
            <div class="review-rank-note">帮助负责人快速看出分数集中在哪个目标，以及还有哪些目标尚未打分。</div>
            <div class="review-breakdown-list">${employeeGoalBreakdown(summary)}</div>
          </section>
          <section class="review-rank-section">
            <h3>档位口径</h3>
            <div class="review-rank-basis">当前档位按“已评分关键结果加权季度分”实时排序，并直接占用后台配置的固定名额。未开始评分的员工暂不占用档位名额。</div>
            <div class="review-rank-basis">本组当前名额：${REVIEW_GRADE_LEVELS.map((level) => `${level} ${(entries.gradeUsage[level] || 0)}/${(entries.gradeQuotas[level] || 0)}`).join(" · ")}</div>
          </section>
        </div>

        <section class="review-rank-section">
          <h3>关键结果评分明细</h3>
          ${employeeKrTable(summary)}
        </section>
      </section>
    </div>`;
  }

  function departmentEmployeeCountsByGroup() {
    const counts = Object.fromEntries(currentReviewGroups().map((group) => [group, 0]));
    const seen = new Set();
    (state.store?.users || []).forEach((user) => {
      if (!user || user.role !== "employee" || user.departmentId !== state.currentUser.departmentId) return;
      if (seen.has(user.id)) return;
      seen.add(user.id);
      const group = reviewGroupForUser(user.id);
      if (counts[group] === undefined) counts[group] = 0;
      counts[group] += 1;
    });
    return counts;
  }

  function renderDepartmentConfigSummary() {
    const counts = departmentEmployeeCountsByGroup();
    refs.statsGrid.innerHTML = currentReviewGroups().map((group) => {
      const quotas = buildGradeQuotas(counts[group], currentReviewGradeConfig().groups[group]);
      return `<div class="leader-summary-card">
        <div class="leader-summary-label">${h(group)}</div>
        <div class="leader-summary-value">${h(String(counts[group]))}</div>
        <div class="leader-summary-hint">${h(REVIEW_GRADE_LEVELS.map((level) => `${level} ${quotas[level]}`).join(" · "))}</div>
      </div>`;
    }).join("");
  }

  function renderReviewConfigPage() {
    const mount = ensureMount("reviewConfigPage", "review-grade-page");
    const counts = departmentEmployeeCountsByGroup();
    const config = currentReviewGradeConfig();

    renderDepartmentConfigSummary();
    mount.classList.remove("hidden");
    mount.innerHTML = `<div class="review-config-layout">
      <div class="review-config-hero">
        <div>
          <div class="review-rank-title">评价档位配置</div>
          <div class="review-rank-subtitle">按组别维护 A+ / A / B+ / B / C 的比例，排名页会自动换算当前名额并显示档位占用。</div>
        </div>
        <button class="primary-button" type="button" data-review-act="save-grade-config">保存配置</button>
      </div>

      <div class="review-config-card-list">
        ${currentReviewGroups().map((group) => {
          const quotas = buildGradeQuotas(counts[group], config.groups[group]);
          return `<article class="review-config-card">
            <div class="review-config-head">
              <div>
                <strong>${h(group)}</strong>
                <span>${h(`当前员工 ${counts[group]} 人`)}</span>
              </div>
              <span class="review-config-quota">${h(REVIEW_GRADE_LEVELS.map((level) => `${level} ${quotas[level]}人`).join(" · "))}</span>
            </div>
            <div class="review-config-grid">
              ${REVIEW_GRADE_LEVELS.map((level) => `<label class="review-config-field">
                <span>${h(level)}</span>
                <input type="number" min="0" step="0.1" value="${h(String(config.groups[group][level]))}" data-review-config-group="${h(group)}" data-review-config-level="${h(level)}">
                <small>${h(`预计 ${quotas[level]} 人`)}</small>
              </label>`).join("")}
            </div>
          </article>`;
        }).join("")}
      </div>
    </div>`;
  }

  function collectReviewGradeConfigFromForm() {
    const groups = {};
    currentReviewGroups().forEach((group) => {
      groups[group] = {};
      REVIEW_GRADE_LEVELS.forEach((level) => {
        const input = document.querySelector(`[data-review-config-group="${group}"][data-review-config-level="${level}"]`);
        groups[group][level] = input ? Number(input.value || 0) : 0;
      });
    });
    return { groups };
  }

  async function saveReviewGradeConfigFromUi() {
    const res = await apiPut("/api/review-grade-config", collectReviewGradeConfigFromForm());
    if (!res?.store) return;
    applyStore(res.store, false);
  }

  function applyLeaderNav() {
    refs.navList.innerHTML = [
      `<button class="nav-item${state.leaderSubPage === "workbench" ? " active" : ""}" type="button" data-review-act="leader-page" data-page="workbench">评分工作台</button>`,
      `<button class="nav-item${state.leaderSubPage === "ranking" ? " active" : ""}" type="button" data-review-act="leader-page" data-page="ranking">评分排名</button>`
    ].join("");
    refs.sectionTitle.textContent = state.leaderSubPage === "ranking" ? "评分排名" : "评分工作台";
  }

  function applyDepartmentNav() {
    refs.navList.innerHTML = [
      `<button class="nav-item${state.departmentSubPage === "overview" ? " active" : ""}" type="button" data-review-act="department-page" data-page="overview">部门概览</button>`,
      `<button class="nav-item${state.departmentSubPage === "config" ? " active" : ""}" type="button" data-review-act="department-page" data-page="config">评价配置</button>`
    ].join("");
    refs.sectionTitle.textContent = state.departmentSubPage === "config" ? "评价配置" : "部门概览";
    refs.newGoalButton?.classList.add("hidden");
  }

  function cleanupCustomViews() {
    const { leaderWorkbench, rankingMount, configMount, reportPanel, listPanel } = appPanels();
    const viewState = getRoleViewState({
      role: state.currentUser?.role,
      leaderSubPage: state.leaderSubPage,
      departmentSubPage: state.departmentSubPage
    });

    toggleElement(leaderWorkbench, !viewState.showLeaderWorkbench);
    toggleElement(rankingMount, !viewState.showLeaderRanking);
    toggleElement(configMount, !viewState.showDepartmentConfig);
    toggleElement(reportPanel, !viewState.showReportPanel);
    toggleElement(listPanel, !viewState.showListPanel);
  }

  function reviewGradeRenderShell() {
    baseRenderShell();
  }

  function reviewGradeRender() {
    if (!state.store || !state.currentUser) return;
    baseRender();
    cleanupCustomViews();

    if (isLeaderRole()) {
      applyLeaderNav();
      const { rankingMount } = appPanels();
      if (state.leaderSubPage === "ranking") {
        toggleLeaderWorkbench(false);
        renderLeaderRankingPage();
      } else {
        toggleElement(rankingMount, true);
        renderLeaderWorkbench();
        toggleLeaderWorkbench(true);
      }
      return;
    }

    if (isDepartmentLeaderRole()) {
      applyDepartmentNav();
      const { reportPanel, listPanel, configMount } = appPanels();
      if (state.departmentSubPage === "config") {
        toggleElement(reportPanel, true);
        toggleElement(listPanel, true);
        renderReviewConfigPage();
      } else {
        toggleElement(configMount, true);
      }
    }
  }

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-review-act]");
    if (!trigger) return;

    const action = trigger.dataset.reviewAct;
    if (action === "leader-page") {
      state.leaderSubPage = trigger.dataset.page || "workbench";
      render();
      return;
    }

    if (action === "department-page") {
      state.departmentSubPage = trigger.dataset.page || "overview";
      render();
      return;
    }

    if (action === "select-ranking-group") {
      state.rankingSelectedGroup = trigger.dataset.group || "";
      state.rankingSelectedUserId = "";
      render();
      return;
    }

    if (action === "select-ranking-user") {
      state.rankingSelectedUserId = trigger.dataset.userId || "";
      render();
      return;
    }

    if (action === "save-grade-config") {
      saveReviewGradeConfigFromUi();
    }
  });

  document.addEventListener("change", (event) => {
    if (!event.target.matches("[data-review-config-group][data-review-config-level]")) return;
    if (!isDepartmentLeaderRole() || state.departmentSubPage !== "config") return;
    renderReviewConfigPage();
  });

  window.renderShell = renderShell = reviewGradeRenderShell;
  window.render = render = reviewGradeRender;
})();
