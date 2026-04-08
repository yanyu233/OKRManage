(function attachLeaderRoleOverrides() {
  if (typeof window === "undefined" || typeof renderShell !== "function") return;

  ROLE_META["section-leader"] = {
    label: "科室领导/小组负责人端",
    scope: "当前查看责任范围员工季度 OKR，并按关键结果逐条评分。"
  };
  ROLE_META["group-leader"] = ROLE_META["section-leader"];

  state.leaderSelectedUserId = state.leaderSelectedUserId || "";
  state.leaderSelectedGoalId = state.leaderSelectedGoalId || "";

  function isLeaderWorkbenchRole(role = state.currentUser?.role) {
    return role === "section-leader" || role === "group-leader";
  }

  function ensureLeaderWorkbench() {
    let mount = document.getElementById("leaderWorkbench");
    if (!mount) {
      mount = document.createElement("section");
      mount.id = "leaderWorkbench";
      mount.className = "leader-workbench hidden";
      refs.statsGrid.insertAdjacentElement("afterend", mount);
    }
    return mount;
  }

  function legacyPanels() {
    return {
      reportPanel: document.querySelector(".report-panel"),
      listPanel: document.querySelector(".list-panel")
    };
  }

  function toggleLeaderWorkbench(enabled) {
    const mount = ensureLeaderWorkbench();
    mount.classList.toggle("hidden", !enabled);
    document.body.classList.toggle("leader-role-active", enabled);
  }

  function leaderGoals() {
    return filteredGoals().filter((goal) => getUser(goal.ownerId)?.role === "employee");
  }

  function leaderGoalScoreable(goal) {
    return ["pending_review", "reviewed"].includes(goal.status);
  }

  function krHasScore(kr) {
    return kr.score !== null && kr.score !== undefined && `${kr.score}` !== "";
  }

  function weightedKrScore(krs) {
    const scored = krs.filter(krHasScore);
    if (!scored.length) return null;

    let weightedTotal = 0;
    let weightSum = 0;
    scored.forEach((kr) => {
      const weight = kr.points === null || kr.points === undefined || `${kr.points}` === "" ? 1 : num(kr.points);
      weightSum += weight;
      weightedTotal += num(kr.score) * weight;
    });

    return weightSum ? weightedTotal / weightSum : null;
  }

  function lastReviewAt(krs) {
    return [...krs]
      .map((kr) => kr.reviewedAt || "")
      .filter(Boolean)
      .sort((a, b) => b.localeCompare(a, "zh-CN"))[0] || "";
  }

  function leaderUserSummary(userId) {
    const owner = getUser(userId);
    const goals = leaderGoals().filter((goal) => goal.ownerId === userId);
    const krs = goals.flatMap((goal) => goalKrs(goal.id));
    const scoreableGoals = goals.filter(leaderGoalScoreable);
    const scoreableKrs = scoreableGoals.flatMap((goal) => goalKrs(goal.id));
    const scoredKrs = scoreableKrs.filter(krHasScore);
    const totalProofs = krs.reduce((sum, kr) => sum + krProofs(kr.id).length, 0);

    let status = { label: "待补充", tone: "waiting", priority: 1 };
    if (scoreableKrs.length && scoredKrs.length < scoreableKrs.length) {
      status = { label: "待评分", tone: "pending", priority: 0 };
    } else if (scoreableKrs.length && scoredKrs.length === scoreableKrs.length) {
      status = { label: "已完成", tone: "done", priority: 2 };
    }

    return {
      owner,
      goals,
      krs,
      scoreableGoals,
      scoreableKrs,
      scoredKrs,
      totalProofs,
      status,
      quarterScore: weightedKrScore(scoreableKrs),
      lastReviewedAt: lastReviewAt(scoreableKrs)
    };
  }

  function leaderUsers() {
    const map = new Map();
    leaderGoals().forEach((goal) => {
      if (!map.has(goal.ownerId)) {
        map.set(goal.ownerId, leaderUserSummary(goal.ownerId));
      }
    });

    return [...map.values()].sort((a, b) => {
      const priorityDiff = a.status.priority - b.status.priority;
      if (priorityDiff !== 0) return priorityDiff;
      return (a.owner?.name || "").localeCompare(b.owner?.name || "", "zh-CN");
    });
  }

  function ensureLeaderSelection() {
    const people = leaderUsers();
    if (!people.length) {
      state.leaderSelectedUserId = "";
      state.leaderSelectedGoalId = "";
      return { people, selectedPerson: null, selectedGoal: null };
    }

    if (!people.some((item) => item.owner?.id === state.leaderSelectedUserId)) {
      state.leaderSelectedUserId = people[0].owner.id;
    }

    const selectedPerson = people.find((item) => item.owner?.id === state.leaderSelectedUserId) || people[0];
    const goals = selectedPerson.goals;
    const preferredGoal = goals.find((goal) => goal.id === state.leaderSelectedGoalId);
    if (!preferredGoal) {
      state.leaderSelectedGoalId =
        goals.find((goal) => leaderGoalScoreable(goal))?.id ||
        goals[0]?.id ||
        "";
    }

    return {
      people,
      selectedPerson,
      selectedGoal: goals.find((goal) => goal.id === state.leaderSelectedGoalId) || goals[0] || null
    };
  }

  function leaderSummaryCards(people) {
    const scoreableKrs = people.flatMap((person) => person.scoreableKrs);
    const scoredKrs = scoreableKrs.filter(krHasScore);
    const pendingEmployees = people.filter((person) => person.status.tone === "pending").length;
    const completedEmployees = people.filter((person) => person.status.tone === "done").length;
    const quarterAverage = weightedKrScore(scoreableKrs);

    const cards = [
      ["待评分员工", pendingEmployees, pendingEmployees ? "本季度还有员工存在未完成评分的关键结果。" : "当前责任范围内暂无待评分员工。"],
      ["待评分关键结果", scoreableKrs.length - scoredKrs.length, scoredKrs.length ? `当前已完成 ${scoredKrs.length} 条 KR 评分。` : "当前还没有已保存的 KR 分数。"],
      ["已完成员工", completedEmployees, completedEmployees ? "这些员工本季度所有可评分 KR 都已有分数。" : "当前还没有完成评分的员工。"],
      ["当前季度均分", quarterAverage === null ? "-" : fmt(quarterAverage), quarterAverage === null ? "待有评分数据后自动显示。" : "按已评分 KR 的分值权重自动汇总。"]
    ];

    refs.statsGrid.innerHTML = cards
      .map(
        ([label, value, hint]) => `<div class="leader-summary-card">
          <div class="leader-summary-label">${h(label)}</div>
          <div class="leader-summary-value">${h(String(value))}</div>
          <div class="leader-summary-hint">${h(hint)}</div>
        </div>`
      )
      .join("");
  }

  function leaderPersonCard(person, selectedUserId) {
    return `<button class="leader-person-card${person.owner.id === selectedUserId ? " is-active" : ""}" type="button" data-leader-act="select-user" data-user-id="${h(
      person.owner.id
    )}">
      <div class="leader-person-top">
        <div>
          <div class="leader-person-name">${h(person.owner.name)}</div>
          <div class="leader-person-meta">${h(`${sectionName(person.owner.sectionId)} · ${reviewGroupForUser(person.owner.id)}`)}</div>
        </div>
        <span class="leader-status-pill ${person.status.tone}">${h(person.status.label)}</span>
      </div>
      <div class="leader-person-chips">
        <span class="leader-mini-chip">${h(`${person.goals.length} 个目标`)}</span>
        <span class="leader-mini-chip">${h(`${person.krs.length} 条关键结果`)}</span>
        <span class="leader-mini-chip">${h(`已评 ${person.scoredKrs.length} / ${person.scoreableKrs.length || 0}`)}</span>
        <span class="leader-mini-chip">${h(`材料 ${person.totalProofs} 份`)}</span>
      </div>
    </button>`;
  }

  function leaderGoalTab(goal, activeGoalId) {
    const krs = goalKrs(goal.id);
    const scored = krs.filter(krHasScore).length;
    const proofCount = goalProofs(goal.id).length;
    return `<button class="leader-goal-tab${goal.id === activeGoalId ? " is-active" : ""}" type="button" data-leader-act="select-goal" data-goal-id="${h(
      goal.id
    )}">
      <strong>${h(`${goal.code} ${goal.name}`)}</strong>
      <span>${h(`${krs.length} 条关键结果 · 已评 ${scored} 条 · 材料 ${proofCount} 份`)}</span>
    </button>`;
  }

  function leaderGoalNotice(goal) {
    if (!goal) return { text: "当前没有可展示的目标。", warning: false };
    if (goal.status === "pending_review") {
      return { text: "当前目标已经进入评分阶段，可以按关键结果逐条填写分数和备注。", warning: false };
    }
    if (goal.status === "reviewed") {
      return { text: "当前目标已经有评分结果，后续仍可继续修改关键结果分数和备注。", warning: false };
    }
    if (goal.status === "pending_submission") {
      return { text: "员工还在补充材料，当前先只读查看，暂不开放负责人评分。", warning: true };
    }
    if (goal.status === "confirmed") {
      return { text: "当前目标尚未进入评分阶段，请等待员工提交材料确认。", warning: true };
    }
    return { text: "该目标仍处于草稿阶段，当前不开放负责人评分。", warning: true };
  }

  function leaderKrStatus(goal, kr) {
    if (krHasScore(kr)) return { label: "已评分", tone: "done" };
    if (leaderGoalScoreable(goal)) return { label: "待评分", tone: "pending" };
    return { label: "待补充", tone: "waiting" };
  }

  function leaderProofItems(kr) {
    const proofs = krProofs(kr.id);
    if (!proofs.length) {
      return '<div class="leader-proof-empty">当前还没有上传证明材料。</div>';
    }

    return `<div class="leader-proof-list">
      ${proofs
        .map(
          (proof) => `<div class="leader-proof-item">
            <div class="leader-proof-main">
              <strong>${h(proof.fileName)}</strong>
              <span>${h(`${proof.uploadedAt || "-"} · ${size(proof.sizeBytes)}${proof.note ? ` · ${proof.note}` : ""}`)}</span>
            </div>
            <a class="leader-proof-link" href="${h(proof.url)}" target="_blank" rel="noreferrer">打开</a>
          </div>`
        )
        .join("")}
    </div>`;
  }

  function leaderKrCard(goal, kr) {
    const status = leaderKrStatus(goal, kr);
    const editable = leaderGoalScoreable(goal);
    const scoreValue = krHasScore(kr) ? String(kr.score) : "";
    const pointsText = kr.points === null ? "-" : fmt(kr.points);
    return `<article class="leader-kr-card">
      <div class="leader-kr-top">
        <div>
          <div class="leader-kr-name">${h(`${kr.code} · ${kr.name}`)}</div>
          <div class="leader-kr-submeta">${h(`分值 ${pointsText} · 完成状态 ${krCompletionText(kr)} · 材料 ${krProofs(kr.id).length} 份`)}</div>
        </div>
        <span class="leader-status-pill ${status.tone}">${h(status.label)}</span>
      </div>
      <div class="leader-kr-body">
        <div>
          <div class="leader-kr-description">${h(kr.description || "当前未填写关键结果说明。")}</div>
          ${leaderProofItems(kr)}
        </div>
        <div class="leader-score-card">
          <div class="leader-score-title">关键结果评分</div>
          <label class="leader-score-field">
            <span>评分</span>
            <input class="leader-score-input" type="number" min="0" max="100" step="0.1" value="${h(scoreValue)}" ${editable ? "" : "disabled"} data-leader-field="score" data-kr-id="${h(
              kr.id
            )}">
          </label>
          <div class="leader-score-range">请输入 0 - 100 分，保存后可继续修改。</div>
          <label class="leader-score-field">
            <span>负责人备注</span>
            <textarea class="leader-score-textarea" rows="4" ${editable ? "" : "disabled"} data-leader-field="reviewComment" data-kr-id="${h(
              kr.id
            )}" placeholder="补充本条关键结果的评分依据、材料缺口或修改建议">${h(kr.reviewComment || "")}</textarea>
          </label>
        </div>
      </div>
    </article>`;
  }

  function renderLeaderWorkbench() {
    const mount = ensureLeaderWorkbench();
    const { people, selectedPerson, selectedGoal } = ensureLeaderSelection();

    if (!people.length || !selectedPerson) {
      leaderSummaryCards([]);
      mount.innerHTML = `<div class="leader-panel">
        <div class="leader-empty">当前筛选条件下没有可评分员工，可以调整季度、状态或搜索条件后继续查看。</div>
      </div>`;
      return;
    }

    leaderSummaryCards(people);

    const selectedGoals = selectedPerson.goals;
    const selectedGoalKrs = selectedGoal ? goalKrs(selectedGoal.id) : [];
    const selectedGoalScore = selectedGoal?.reviewScore ?? weightedKrScore(selectedGoalKrs);
    const notice = leaderGoalNotice(selectedGoal);

    mount.innerHTML = `<div class="leader-board">
      <aside class="leader-panel">
        <div class="leader-panel-head">
          <div>
            <div class="leader-panel-title">人员队列</div>
            <div class="leader-panel-subtitle">先选员工，再切目标，最后在关键结果层级评分。</div>
          </div>
          <span class="leader-panel-badge">${h(cycleLabel(state.cycleId))}</span>
        </div>
        <div class="leader-queue">
          ${people.map((person) => leaderPersonCard(person, selectedPerson.owner.id)).join("")}
        </div>
      </aside>

      <section class="leader-panel">
        <div class="leader-stage">
          <div class="leader-stage-head">
            <div>
              <div class="leader-stage-name">${h(`${selectedPerson.owner.name} · ${cycleLabel(state.cycleId)}`)}</div>
              <div class="leader-stage-copy">${h(`${sectionName(selectedPerson.owner.sectionId)} · ${reviewGroupForUser(
                selectedPerson.owner.id
              )} · 本季度共有 ${selectedPerson.goals.length} 个目标、${selectedPerson.krs.length} 条关键结果。`)}</div>
            </div>
            <span class="leader-panel-badge">${h(`季度总分 ${selectedPerson.quarterScore === null ? "-" : fmt(selectedPerson.quarterScore)}`)}</span>
          </div>

          <div class="leader-goal-tabs">
            ${selectedGoals.map((goal) => leaderGoalTab(goal, selectedGoal?.id || "")).join("")}
          </div>

          ${
            selectedGoal
              ? `<div class="leader-overview">
                  <div class="leader-overview-card">
                    <div class="leader-overview-card-title">当前目标说明</div>
                    <div class="leader-overview-card-copy">${h(selectedGoal.description || "当前未填写目标说明。")}</div>
                  </div>
                  <div class="leader-overview-card">
                    <div class="leader-overview-card-title">当前员工本季度汇总</div>
                    <div class="leader-overview-grid">
                      <div class="leader-overview-kpi"><span>目标数</span><strong>${h(String(selectedPerson.goals.length))}</strong></div>
                      <div class="leader-overview-kpi"><span>关键结果数</span><strong>${h(String(selectedPerson.krs.length))}</strong></div>
                      <div class="leader-overview-kpi"><span>已评分 KR</span><strong>${h(String(selectedPerson.scoredKrs.length))}</strong></div>
                      <div class="leader-overview-kpi"><span>当前目标总分</span><strong>${h(selectedGoalScore === null ? "-" : fmt(selectedGoalScore))}</strong></div>
                    </div>
                  </div>
                </div>`
              : ""
          }

          <div class="leader-goal-notice${notice.warning ? " is-warning" : ""}">${h(notice.text)}</div>

          ${
            selectedGoal
              ? `<div class="leader-kr-list">
                  ${selectedGoalKrs.length ? selectedGoalKrs.map((kr) => leaderKrCard(selectedGoal, kr)).join("") : '<div class="leader-empty">当前目标还没有关键结果。</div>'}
                </div>`
              : '<div class="leader-empty">当前员工没有匹配的目标。</div>'
          }
        </div>
      </section>
    </div>`;
  }

  async function saveLeaderKrReview(krId) {
    const kr = getKr(krId);
    const goal = kr ? getGoal(kr.goalId) : null;
    if (!kr || !goal || !leaderGoalScoreable(goal)) return;

    const scoreInput = document.querySelector(`[data-leader-field="score"][data-kr-id="${krId}"]`);
    const commentInput = document.querySelector(`[data-leader-field="reviewComment"][data-kr-id="${krId}"]`);
    if (!scoreInput || !commentInput) return;

    const rawScore = scoreInput.value.trim();
    const score = rawScore === "" ? null : Number(rawScore);
    if (rawScore !== "" && Number.isNaN(score)) {
      window.alert("请输入有效的 KR 分数。");
      scoreInput.value = krHasScore(kr) ? String(kr.score) : "";
      return;
    }

    if (score !== null && (score < 0 || score > 100)) {
      window.alert("KR 评分范围为 0 到 100 分。");
      scoreInput.value = krHasScore(kr) ? String(kr.score) : "";
      return;
    }

    state.leaderSelectedUserId = goal.ownerId;
    state.leaderSelectedGoalId = goal.id;

    const res = await apiPut(`/api/krs/${krId}/score`, {
      score,
      reviewComment: commentInput.value.trim()
    });

    if (!res?.store) return;
    applyStore(res.store, false, goal.id);
  }

  document.addEventListener("click", (event) => {
    if (!isLeaderWorkbenchRole()) return;
    const trigger = event.target.closest("[data-leader-act]");
    if (!trigger) return;

    if (trigger.dataset.leaderAct === "select-user") {
      state.leaderSelectedUserId = trigger.dataset.userId || "";
      state.leaderSelectedGoalId = "";
      render();
      return;
    }

    if (trigger.dataset.leaderAct === "select-goal") {
      const goal = getGoal(trigger.dataset.goalId);
      if (!goal) return;
      state.leaderSelectedUserId = goal.ownerId;
      state.leaderSelectedGoalId = goal.id;
      render();
    }
  });

  document.addEventListener("change", (event) => {
    if (!isLeaderWorkbenchRole()) return;
    const field = event.target.closest("[data-leader-field]");
    if (!field) return;
    saveLeaderKrReview(field.dataset.krId);
  });

  window.LeaderRoleWorkbench = {
    isLeaderWorkbenchRole,
    ensureLeaderWorkbench,
    toggleLeaderWorkbench,
    renderLeaderWorkbench
  };
})();
