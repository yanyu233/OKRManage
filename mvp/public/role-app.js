const GOAL_TYPES = [
  { value: "personal", label: "\u4e2a\u4eba" },
  { value: "section", label: "\u79d1\u5ba4" },
  { value: "department", label: "\u90e8\u95e8" }
];
const GOAL_STATUS = {
  draft: "\u8349\u7a3f",
  confirmed: "\u5df2\u786e\u8ba4",
  pending_submission: "\u5f85\u63d0\u4ea4",
  pending_review: "\u5f85\u8bc4\u5206",
  reviewed: "\u5df2\u8bc4\u5206"
};
const KR_STATUS = { draft: "\u8349\u7a3f", active: "\u672a\u5b8c\u6210", completed: "\u5df2\u5b8c\u6210", closed: "\u5df2\u5173\u95ed" };
const METRIC_TYPES = { milestone: "\u91cc\u7a0b\u7891\u578b" };
const ROLE_META = {
  employee: { label: "\u666e\u901a\u5458\u5de5\u7aef", scope: "\u5f53\u524d\u67e5\u770b\u5e76\u7ef4\u62a4\u672c\u4eba\u5b63\u5ea6 OKR\u3002" },
  "section-leader": { label: "\u79d1\u5ba4\u9886\u5bfc\u7aef", scope: "\u5f53\u524d\u67e5\u770b\u672c\u79d1\u5ba4\u5458\u5de5\u5b63\u5ea6 OKR\uff0c\u5e76\u5bf9\u5f85\u8bc4\u5206\u76ee\u6807\u8bc4\u5206\u3002" },
  "group-leader": { label: "\u5c0f\u7ec4\u8d1f\u8d23\u4eba\u7aef", scope: "\u5f53\u524d\u67e5\u770b\u672c\u7ec4\u5458\u5de5\u5b63\u5ea6 OKR\uff0c\u5e76\u6309\u5173\u952e\u7ed3\u679c\u9010\u6761\u8bc4\u5206\u3002" },
  "system-admin": { label: "\u7cfb\u7edf\u7ba1\u7406\u5458\u7aef", scope: "\u5f53\u524d\u7ef4\u62a4\u7ec4\u7ec7\u3001\u89d2\u8272\u3001\u8bc4\u4ef7\u7ec4\u4e0e\u8bc4\u5206\u540d\u989d\u914d\u7f6e\u3002" }
};

const state = {
  store: null,
  currentUser: null,
  search: "",
  cycleId: "",
  status: "",
  expanded: new Set(),
  goalDrafts: [],
  krReturnGoalId: ""
};

const refs = {};

document.addEventListener("DOMContentLoaded", async () => {
  initializeKrModalShell();
  cacheRefs();
  bindEvents();
  const store = await apiGet("/api/bootstrap");
  if (store) applyStore(store, true);
});

function initializeKrModalShell() {
  const krModal = document.getElementById("krModal");
  if (!krModal) return;

  krModal.innerHTML = `<div class="modal-card kr-modal-card">
    <div class="modal-header">
      <h3 id="krModalTitle">KR 维护</h3>
      <button class="icon-button" data-close-modal="krModal" type="button">×</button>
    </div>
    <div class="modal-body kr-workspace">
      <div id="krModalMeta" class="detail-meta"></div>
      <div id="krModalStateNotice" class="detail-note kr-workspace-note"></div>
      <div id="krModalSummary" class="kr-modal-summary"></div>

      <form id="singleKrForm" class="goal-form kr-form-shell">
        <input id="singleKrFormMode" type="hidden" value="create">
        <input id="singleKrGoalId" type="hidden" value="">
        <input id="singleKrId" type="hidden" value="">

        <div class="form-grid">
          <label class="full-width">
            <span>KR 名称 *</span>
            <input id="singleKrName" type="text" maxlength="100" placeholder="请输入 KR 名称">
          </label>

          <label>
            <span>完成状态</span>
            <select id="singleKrCompletion">
              <option value="pending">未完成</option>
              <option value="done">已完成</option>
            </select>
          </label>

          <label>
            <span>分值</span>
            <input id="singleKrPoints" type="number" min="0" step="0.1" placeholder="例如 20">
          </label>

          <label class="full-width">
            <span>说明</span>
            <textarea id="singleKrDescription" rows="4" placeholder="补充 KR 的交付口径、里程碑说明或验收标准"></textarea>
          </label>
        </div>

        <div class="modal-footer">
          <button class="ghost-button" data-close-modal="krModal" type="button">取消</button>
          <button id="singleKrSaveButton" class="primary-button" type="submit">保存 KR</button>
        </div>
      </form>

      <section class="modal-section">
          <div class="modal-section-header">
            <div>
              <div class="modal-section-title">KR 证明材料</div>
              <div class="modal-section-subtitle">材料支持挂在 KR 下，也可以从目标 O 详情中的对应 KR 卡片直接上传。</div>
            </div>
          </div>

        <div id="krModalProofList" class="proof-list"></div>

        <div id="krModalProofForm" class="proof-form upload-panel">
          <label class="upload-picker full-width">
            <input id="krProofFile" class="upload-picker-input" type="file" multiple>
            <span class="upload-picker-button">选择文件</span>
            <span class="upload-picker-text">支持所有文件类型，可多附件上传</span>
          </label>

          <div id="krProofUploadHint" class="detail-note compact hidden"></div>

          <div id="krProofProgressCard" class="upload-progress-card hidden">
            <div class="upload-progress-head">
              <span id="krProofProgressLabel">等待上传</span>
              <strong id="krProofProgressValue">0%</strong>
            </div>
            <div class="upload-progress-track">
              <div id="krProofProgressBar" class="upload-progress-fill" style="width:0%"></div>
            </div>
          </div>

          <label class="full-width">
            <span>资料说明</span>
            <textarea id="krProofNote" rows="3" placeholder="填写本次上传材料说明，可适用于所选全部文件"></textarea>
          </label>

          <button id="krProofUploadButton" class="primary-button" type="button">上传 KR 证明材料</button>
        </div>
      </section>
    </div>
  </div>`;
}

function cacheRefs() {
  [
    "userSwitcher","portalBadge","navList","sectionTitle","currentUserText","searchInput","yearFilter","quarterFilter","cycleFilter","statusFilter",
    "exportGoalsButton","exportSummaryButton","newGoalButton","statsGrid","reportScopeText","reportSummaryChips",
    "reportHead","reportRows","reportEmpty","goalRows","tableSubtitle","emptyState","detailModal","detailModalTitle",
    "detailModalBody","goalModal","goalModalTitle","goalForm","goalFormMode","goalFormGoalId","goalName","goalType",
    "goalDepartment","goalOwner","goalCycle","goalParent","goalPoints","goalDescription","goalEditSection","goalEditStatus",
    "goalEditProgress","goalEditSummary","goalKrSection","goalKrHint","addKrRowButton","krDraftList","goalKrList","goalKrActions",
    "openAddKrButton","goalProofSection","goalProofList","goalProofFile","goalProofUploadHint","goalProofNote",
    "goalProofUploadButton","saveDraftButton","goalSubmitButton","reviewModal","reviewModalTitle","reviewGoalMeta",
    "reviewGoalKpis","reviewKrList","reviewProofList","reviewSummary","reviewForm","reviewAttitude","reviewAbility",
    "reviewPerformance","reviewLevel","reviewTotal","reviewComment","krModal","krModalTitle","krModalMeta",
    "krModalStateNotice","krModalSummary","krModalProofList","krModalProofForm","krProofFile","krProofUploadHint","krProofProgressCard","krProofProgressLabel","krProofProgressValue","krProofProgressBar","krProofNote","krProofUploadButton",
    "singleKrForm","singleKrFormMode","singleKrGoalId","singleKrId","singleKrName","singleKrCompletion",
    "singleKrPoints","singleKrDescription","singleKrSaveButton"
  ].forEach((id) => {
    refs[id] = document.getElementById(id);
  });
}

function bindEvents() {
  refs.userSwitcher.addEventListener("change", onSwitchUser);
  refs.searchInput.addEventListener("input", (e) => {
    state.search = e.target.value.trim().toLowerCase();
    render();
  });
  refs.cycleFilter.addEventListener("change", (e) => {
    state.cycleId = e.target.value;
    render();
  });
  refs.yearFilter.addEventListener("change", syncCycleFilterFromToolbar);
  refs.quarterFilter.addEventListener("change", syncCycleFilterFromToolbar);
  refs.statusFilter.addEventListener("change", (e) => {
    state.status = e.target.value;
    render();
  });
  refs.newGoalButton.addEventListener("click", () => openGoalModal("create"));
  refs.exportGoalsButton.addEventListener("click", exportGoals);
  refs.exportSummaryButton.addEventListener("click", exportSummary);
  document.getElementById("expandAllButton").addEventListener("click", () => {
    state.expanded = new Set(filteredGoals().map((g) => g.id));
    renderTable();
  });
  document.getElementById("collapseAllButton").addEventListener("click", () => {
    state.expanded = new Set();
    renderTable();
  });
  refs.goalRows.addEventListener("click", onTableAction);
  refs.detailModalBody.addEventListener("click", onDetailAction);
  refs.detailModalBody.addEventListener("input", onDetailInput);
  refs.detailModalBody.addEventListener("change", onDetailInput);
  refs.goalKrList.addEventListener("click", onGoalKrAction);
  refs.goalProofList.addEventListener("click", onProofAction);
  refs.krDraftList.addEventListener("input", onKrDraftInput);
  refs.krDraftList.addEventListener("click", onKrDraftClick);
  refs.goalCycle.addEventListener("change", () => {
    if (refs.goalFormMode.value === "create") fillGoalParentOptions();
  });
  refs.addKrRowButton.addEventListener("click", () => {
    const draft = ensureCreateGoalDraft();
    draft.krs = [...(draft.krs || []), blankKr()];
    renderKrDrafts();
  });
  refs.openAddKrButton.addEventListener("click", () => {
    if (refs.goalFormMode.value !== "edit") return;
    const goalId = refs.goalFormGoalId.value;
    focusGoalModalNewKr(goalId);
  });
  refs.goalForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    await saveGoal(false);
  });
  refs.saveDraftButton.addEventListener("click", async () => saveGoal(true));
  [refs.reviewAttitude, refs.reviewAbility, refs.reviewPerformance].forEach((el) => {
    el.addEventListener("input", refreshReviewTotal);
  });
  refs.reviewForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    await saveReview();
  });
  refs.singleKrForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    await saveKr();
  });
  refs.krProofFile.addEventListener("change", renderKrProofHint);
  refs.krProofUploadButton.addEventListener("click", uploadKrWorkspaceProofs);
  refs.krModalProofList.addEventListener("click", onKrModalProofAction);
  document.addEventListener("click", (e) => {
    const closer = e.target.closest("[data-close-modal]");
    if (closer) closeModal(closer.dataset.closeModal);
    if (e.target.classList.contains("modal")) closeModal(e.target.id);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    ["krModal", "reviewModal", "goalModal", "detailModal"].forEach((id) => {
      if (!refs[id].classList.contains("hidden")) closeModal(id);
    });
  });
}

function applyStore(store, resetExpanded = false, expandGoalId = "") {
  state.store = store;
  state.currentUser = users(true).find((u) => u.id === store.settings.currentUserId) || null;
  if (!parseCycleId(state.cycleId)) {
    state.cycleId = currentCycleId();
  }
  state.expanded = resetExpanded
    ? new Set(store.goals.map((g) => g.id))
    : new Set([...state.expanded].filter((id) => store.goals.some((g) => g.id === id)));
  if (expandGoalId) state.expanded.add(expandGoalId);
  render();
}

function render() {
  if (!state.store || !state.currentUser) return;
  renderShell();
  renderStats();
  renderReport();
  renderTable();
  syncUiLabels();
}

function renderShell() {
  refs.userSwitcher.innerHTML = users(true)
    .map((u) => `<option value="${h(u.id)}">${h(u.name)} · ${h(roleMeta(u.role).label)}</option>`)
    .join("");
  refs.userSwitcher.value = state.currentUser.id;
  refs.portalBadge.textContent = roleMeta().label;
  refs.navList.innerHTML = '<button class="nav-item active" type="button">我的 OKR</button>';
  refs.sectionTitle.textContent = "我的 OKR";
  refs.currentUserText.textContent = [
    roleMeta().label,
    state.currentUser.name,
    sectionName(state.currentUser.sectionId) !== "-" ? sectionName(state.currentUser.sectionId) : deptName(state.currentUser.departmentId),
    roleMeta().scope
  ].join(" · ");
  refs.cycleFilter.innerHTML = cycles()
    .map((c) => `<option value="${h(c.id)}">${h(c.label)}${c.status === "active" ? "（当前）" : ""}</option>`)
    .join("");
  refs.cycleFilter.value = state.cycleId;
  refs.newGoalButton.classList.toggle("hidden", state.currentUser.role !== "employee");
}

function renderStats() {
  const goals = filteredGoals();
  const krs = goals.flatMap((g) => goalKrs(g.id));
  const reviewed = goals.filter((g) => g.reviewScore !== null);
  const cards = [
    ["目标数", goals.length, "当前筛选范围内的 OKR"],
    ["KR 数", krs.length, "关键结果数量"],
    ["平均进度", `${fmt(avg(goals.map(progressOfGoal)))}%`, "按目标进度计算"],
    [
      reviewed.length ? "平均得分" : "已评分目标",
      reviewed.length ? fmt(avg(reviewed.map((g) => g.reviewScore))) : "0",
      reviewed.length ? `已评分 ${reviewed.length} 条目标` : "当前暂无评分数据"
    ]
  ];
  refs.statsGrid.innerHTML = cards
    .map(
      ([label, value, hint]) =>
        `<div class="stat-card"><div class="stat-label">${h(label)}</div><div class="stat-value">${h(
          String(value)
        )}</div><div class="stat-hint">${h(hint)}</div></div>`
    )
    .join("");
}

function renderReport() {
  const goals = filteredGoals();
  const rows = summaryRows(goals);
  const proofs = goals.flatMap((g) => goalProofs(g.id));
  const reviewed = goals.filter((g) => g.reviewScore !== null);

  refs.reportScopeText.textContent = `${cycleLabel(state.cycleId)} · ${roleMeta().scope.replace("当前", "")}`;
  refs.reportSummaryChips.innerHTML = [
    ["当前季度", cycleLabel(state.cycleId)],
    ["目标 / KR", `${goals.length} / ${goals.flatMap((g) => goalKrs(g.id)).length}`],
    ["证明材料", `${proofs.length} 份`],
    ["已评分目标", `${reviewed.length} 条`]
  ]
    .map(
      ([label, value]) =>
        `<div class="report-chip"><div class="report-chip-label">${h(label)}</div><div class="report-chip-value">${h(
          value
        )}</div></div>`
    )
    .join("");

  refs.reportHead.innerHTML = ["员工", "科室", "目标数", "KR 数", "平均进度", "已评分", "平均得分"]
    .map((t) => `<th>${t}</th>`)
    .join("");
  refs.reportEmpty.classList.toggle("hidden", !!rows.length);
  refs.reportRows.innerHTML = rows
    .map(
      (r) =>
        `<tr><td>${h(r.owner)}</td><td>${h(r.section)}</td><td>${r.goalCount}</td><td>${r.krCount}</td><td>${h(
          `${fmt(r.progress)}%`
        )}</td><td>${r.reviewed}</td><td>${h(r.score === null ? "-" : fmt(r.score))}</td></tr>`
    )
    .join("");
}

function renderTable() {
  const goals = filteredGoals();
  const krCount = goals.reduce((sum, g) => sum + goalKrs(g.id).length, 0);
  refs.tableSubtitle.textContent = `共 ${goals.length} 条目标，${krCount} 条 KR`;
  refs.emptyState.classList.toggle("hidden", !!goals.length);
  refs.goalRows.innerHTML = goals
    .flatMap((goal) => {
      const rows = [goalRow(goal)];
      if (state.expanded.has(goal.id)) {
        goalKrs(goal.id).forEach((kr) => rows.push(krRow(goal, kr)));
      }
      return rows;
    })
    .join("");
}

function goalActionHelpers() {
  return globalThis.GoalActionUtils || {};
}

function goalEditAction(goal) {
  const helpers = goalActionHelpers();
  const action =
    typeof helpers.goalPrimaryActionState === "function"
      ? helpers.goalPrimaryActionState(goal.status)
      : goal.status === "draft"
        ? { label: "编辑", action: "edit-goal", tone: "active" }
        : { label: "提交材料", action: "detail-goal", tone: "materials" };

  const buttonClass =
    action.tone === "active"
      ? "edit-action-active"
      : action.tone === "materials"
        ? "edit-action-materials"
        : "edit-action-view";

  return `<button class="mini-button edit-action-button ${buttonClass}" type="button" data-act="${h(action.action)}" data-goal-id="${h(
    goal.id
  )}">${h(action.label)}</button>`;
}

function goalRow(goal) {
  const krs = goalKrs(goal.id);
  const points = goal.points === null ? "-" : fmt(goal.points);
  return `<tr class="goal-row">
    <td class="goal-col"><div class="goal-cell">${
      krs.length
        ? `<button class="tree-toggle" type="button" data-act="toggle" data-goal-id="${h(goal.id)}">${
            state.expanded.has(goal.id) ? "-" : "+"
          }</button>`
        : '<span class="tree-toggle placeholder">•</span>'
    }<span class="goal-chip">${h(goal.code)}</span><div class="goal-main"><button class="goal-name-button" type="button" data-act="detail-goal" data-goal-id="${h(goal.id)}">${h(goal.name)}</button><div class="goal-subtext">${h(goal.description || "暂无目标说明")}</div></div></div></td>
    <td>${h(cycleLabel(goal.cycleId))}</td><td>${h(userName(goal.ownerId))}</td><td>${h(sectionOfGoal(goal))}</td><td>${progress(
    progressOfGoal(goal)
  )}</td><td>${status(goal.status, false)}</td><td>${h(points)}</td><td>${goalProofs(goal.id).length}</td>
    <td><div class="row-actions">${goalEditAction(goal)}</div></td>
  </tr>`;
}

function krRow(goal, kr) {
  const proofCount = krProofs(kr.id).length;
  return `<tr class="goal-row kr-row">
    <td class="goal-col"><div class="goal-cell goal-cell-kr"><span class="tree-toggle placeholder">•</span><span class="goal-chip kr">${h(
      kr.code
    )}</span><div class="goal-main"><div class="goal-main-line"><button class="goal-name-button" type="button" data-act="detail-kr" data-kr-id="${h(
      kr.id
    )}">${h(kr.name)}</button><button class="table-proof-icon-button" type="button" data-act="view-kr-proofs" data-kr-id="${h(
      kr.id
    )}" title="查看上传文件">${paperclipIcon()}<span class="table-proof-icon-count">${proofCount}</span></button></div></div></div></td>
    <td>${h(cycleLabel(goal.cycleId))}</td><td>${h(userName(goal.ownerId))}</td><td>${h(sectionOfGoal(goal))}</td><td>${krProgressCell(
    kr
  )}</td><td>${status(goal.status, false)}</td><td>${h(kr.points === null ? "-" : fmt(kr.points))}</td><td>${krProofs(kr.id).length}</td>
    <td></td>
  </tr>`;
}

async function onSwitchUser(e) {
  const res = await apiPut("/api/session", { currentUserId: e.target.value });
  if (!res?.store) return;
  state.search = "";
  state.status = "";
  refs.searchInput.value = "";
  refs.statusFilter.value = "";
  applyStore(res.store, true);
}

function onTableAction(e) {
  const btn = e.target.closest("[data-act]");
  if (!btn) return;
  const act = btn.dataset.act;
  const goalId = btn.dataset.goalId;
  const krId = btn.dataset.krId;
  if (act === "toggle" && goalId) {
    state.expanded.has(goalId) ? state.expanded.delete(goalId) : state.expanded.add(goalId);
    renderTable();
  }
  if (act === "detail-goal" && goalId) openGoalDetail(goalId);
  if (act === "edit-goal" && goalId) openGoalModal("edit", goalId);
  if (act === "review-goal" && goalId) openReviewModal(goalId);
  if (act === "detail-kr" && krId) openKrDetail(krId);
  if (act === "view-kr-proofs" && krId) openKrProofViewer(krId);
}

function onDetailAction(e) {
  const proofButton = e.target.closest("[data-proof-act='delete']");
  if (proofButton) {
    deleteDetailProof(proofButton.dataset.proofId);
    return;
  }

  const btn = e.target.closest("[data-detail-act]");
  if (!btn) return;
  if (btn.dataset.detailAct === "detail-goal") {
    openGoalDetail(btn.dataset.goalId);
  }
  if (btn.dataset.detailAct === "edit-goal") {
    closeModal("detailModal");
    openGoalModal("edit", btn.dataset.goalId);
  }
  if (btn.dataset.detailAct === "review-goal") {
    closeModal("detailModal");
    openReviewModal(btn.dataset.goalId);
  }
  if (btn.dataset.detailAct === "submit-review") {
    submitGoalForReview(btn.dataset.goalId);
  }
  if (btn.dataset.detailAct === "authorize-goal-edit") {
    authorizeGoalEdit(btn.dataset.goalId);
  }
  if (btn.dataset.detailAct === "create-kr") {
    openGoalDetail(btn.dataset.goalId);
  }
  if (btn.dataset.detailAct === "detail-kr") {
    openKrDetail(btn.dataset.krId);
  }
  if (btn.dataset.detailAct === "manage-kr") {
    openKrDetail(btn.dataset.krId);
  }
  if (btn.dataset.detailAct === "save-inline-kr") {
    saveInlineKr(btn.dataset.krId);
  }
  if (btn.dataset.detailAct === "save-new-inline-kr") {
    saveNewInlineKr(btn.dataset.goalId);
  }
  if (btn.dataset.detailAct === "upload-kr-proof") {
    uploadGoalDetailKrProofs(btn.dataset.krId);
  }
}

function onGoalKrAction(e) {
  const btn = e.target.closest("[data-goal-kr-act]");
  const detailBtn = e.target.closest("[data-detail-act]");
  if (!btn && !detailBtn) return;
  if (detailBtn?.dataset.detailAct === "save-inline-kr") {
    saveInlineKr(detailBtn.dataset.krId, "goal-modal");
    return;
  }
  if (detailBtn?.dataset.detailAct === "save-new-inline-kr") {
    saveNewInlineKr(detailBtn.dataset.goalId, "goal-modal");
    return;
  }
  if (!btn) return;
  if (btn.dataset.goalKrAct === "detail") {
    closeModal("goalModal");
    openKrDetail(btn.dataset.krId);
  }
  if (btn.dataset.goalKrAct === "edit") {
    const kr = getKr(btn.dataset.krId);
    if (kr) {
      closeModal("goalModal");
      openKrModal("edit", kr.goalId, kr.id, true);
    }
  }
  if (btn.dataset.goalKrAct === "save-inline") {
    saveInlineKr(btn.dataset.krId, "goal-modal");
  }
  if (btn.dataset.goalKrAct === "save-new-inline") {
    saveNewInlineKr(btn.dataset.goalId, "goal-modal");
  }
}

async function onProofAction(e) {
  const btn = e.target.closest("[data-proof-act='delete']");
  if (!btn) return;
  const proof = getProof(btn.dataset.proofId);
  const goalId = refs.goalFormGoalId.value;
  if (!proof || !goalId) return;
  if (!window.confirm(`确认删除资料“${proof.fileName}”吗？`)) return;
  const res = await apiDelete(`/api/proofs/${proof.id}`);
  if (!res?.store) return;
  applyStore(res.store, false, goalId);
  openGoalModal("edit", goalId);
}

function onKrDraftInput(e) {
  const index = Number(e.target.dataset.index);
  const field = e.target.dataset.field;
  if (Number.isNaN(index) || !field || !state.krDrafts[index]) return;
  state.krDrafts[index][field] = e.target.value;
  if (field === "completionState") {
    state.krDrafts[index].progress = e.target.value === "done" ? "100" : "0";
  }
}

function onKrDraftClick(e) {
  const btn = e.target.closest("[data-kr-draft='delete']");
  if (!btn) return;
  state.krDrafts.splice(Number(btn.dataset.index), 1);
  renderKrDrafts();
}

function openGoalDetail(goalId) {
  const goal = getGoal(goalId);
  if (!goal) return;
  refs.detailModalTitle.textContent = `${goal.code} ${goal.name}`;
  refs.detailModalBody.innerHTML = `<div class="detail-stack">
    <section class="modal-section modal-section-first">
      <div class="detail-actions">${
        canEdit(goal)
          ? `<button class="secondary-button" type="button" data-detail-act="edit-goal" data-goal-id="${h(goal.id)}">编辑目标</button>`
          : ""
      }${
        canSubmitReview(goal)
          ? `<button class="primary-button" type="button" data-detail-act="submit-review" data-goal-id="${h(goal.id)}">确认材料齐备，提交评分</button>`
          : ""
      }${
        canReview(goal)
          ? `<button class="primary-button" type="button" data-detail-act="review-goal" data-goal-id="${h(goal.id)}">进入评分</button>`
          : ""
      }${
        canAuthorizeEdit(goal)
          ? `<button class="ghost-button" type="button" data-detail-act="authorize-goal-edit" data-goal-id="${h(goal.id)}">管理员授权修改</button>`
          : ""
      }</div>
      <div class="detail-meta">${meta(`状态：${GOAL_STATUS[goal.status] || goal.status}`)}${meta(`季度：${cycleLabel(goal.cycleId)}`)}${meta(`员工：${userName(goal.ownerId)}`)}${meta(`科室：${sectionOfGoal(goal)}`)}${meta(`分值：${goal.points === null ? "-" : fmt(goal.points)}`)}</div>
      <div class="detail-kpi-grid">${kpi("当前进度", `${fmt(progressOfGoal(goal))}%`)}${kpi("KR 材料数", `${goalProofs(goal.id).length} 份`)}${kpi("总分 / 等级", goal.reviewScore === null ? "-" : `${fmt(goal.reviewScore)} / ${goal.reviewLevel || "-"}`)}${kpi("最近更新", goal.updatedAt || "-")}</div>
      <div class="detail-note detail-state-note">${workflowNotice(goal)}</div>
    </section>
    <section class="modal-section"><div class="modal-section-title">目标说明</div><div class="detail-copy">${h(goal.description || "暂无目标说明")}</div></section>
    <section class="modal-section"><div class="modal-section-title">员工总结</div><div class="detail-copy">${h(goal.summary || "暂无员工总结")}</div></section>
    <section class="modal-section">
      <div class="modal-section-header">
        <div>
          <div class="modal-section-title">关键结果与证明材料</div>
          <div class="modal-section-subtitle">请从 KR 直接进入维护页面上传材料，目标详情中仅做汇总展示。</div>
        </div>
        ${canEdit(goal) ? `<button class="ghost-button" type="button" data-detail-act="create-kr" data-goal-id="${h(goal.id)}">新增 KR</button>` : ""}
      </div>
      ${goalDetailKrCards(goal)}
    </section>
    <section class="modal-section"><div class="modal-section-title">评分结果</div>${reviewSnapshot(goal)}</section>
  </div>`;
  openModal("detailModal");
}

function openKrDetail(krId) {
  const kr = getKr(krId);
  const goal = kr ? getGoal(kr.goalId) : null;
  if (!kr || !goal) return;
  openGoalDetail(goal.id);
  window.setTimeout(() => {
    const card = refs.detailModalBody.querySelector(`[data-kr-card="${kr.id}"]`);
    card?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, 60);
}

function openKrProofViewer(krId) {
  const kr = getKr(krId);
  const goal = kr ? getGoal(kr.goalId) : null;
  if (!kr || !goal) return;

  const proofs = krProofs(kr.id);
  refs.detailModalTitle.textContent = `${kr.code} 上传文件`;
  refs.detailModalBody.innerHTML = `<div class="detail-stack">
    <section class="modal-section modal-section-first">
      <div class="detail-meta">${meta(`所属目标：${goal.name}`)}${meta(`季度：${cycleLabel(goal.cycleId)}`)}${meta(
        `员工：${userName(goal.ownerId)}`
      )}${meta(`分值：${kr.points === null ? "-" : fmt(kr.points)}`)}</div>
      <div class="detail-note detail-state-note">${proofs.length ? `当前共 ${proofs.length} 份上传文件。` : "当前还没有上传文件。"}</div>
    </section>
    <section class="modal-section">
      <div class="modal-section-title">上传文件</div>
      ${proofList(proofs, false)}
    </section>
  </div>`;
  openModal("detailModal");
}

function goalModalKrCards(goal) {
  const cards = goalKrs(goal.id).map((kr) => goalModalKrCard(goal, kr));
  cards.push(goalModalNewKrCard(goal));
  return `<div class="kr-detail-list">${cards.join("")}</div>`;
}

function goalModalKrCard(goal, kr) {
  const proofs = krProofs(kr.id);
  return `<div class="kr-detail-card" data-goal-modal-kr-card="${h(kr.id)}">
    <div class="kr-detail-header">
      <div class="kr-heading">
        <div class="embedded-title-row">
          <span class="goal-chip kr">${h(kr.code)}</span>
          <strong>${h(kr.name)}</strong>
          ${milestoneTag(kr)}
        </div>
      </div>
      <div class="goal-draft-chip-row">
        <span class="type-tag">${h(`分值 ${kr.points === null ? "-" : fmt(kr.points)}`)}</span>
        <span class="type-tag">${h(`材料 ${proofs.length} 份`)}</span>
      </div>
    </div>
    <div class="kr-card-surface">${inlineKrEditor(goal, kr, false, false, "goal-modal")}</div>
  </div>`;
}

function workflowNotice(goal) {
  if (goal.status === "draft") {
    return "草稿状态，可继续调整 O 和 KR。";
  }
  if (goal.status === "confirmed") {
    return "已确认，目标与 KR 内容已锁定；你可以继续在下方 KR 中补充证明材料。";
  }
  if (goal.status === "pending_submission") {
    return "待提交，可在下方 KR 中继续补充材料并提交评分。";
  }
  if (goal.status === "pending_review") {
    return "待评分，当前不能再修改目标与 KR 内容，但仍可继续补充 KR 材料。";
  }
  if (goal.status === "reviewed") {
    return "已评分，当前页面仅支持查看历史内容与材料。";
  }
  return "当前目标已进入锁定流程。";
}

function proofActionNotice(goal) {
  if (goal.status === "reviewed") {
    return "当前目标已完成评分，仅支持查看历史材料。";
  }
  if (canUploadProof(goal)) {
    return "当前阶段可以继续在 KR 下上传证明材料。";
  }
  return "当前阶段不允许补充材料。";
}

function goalModalNewKrCard(goal) {
  return `<div class="kr-detail-card kr-detail-card-new" data-goal-modal-new-kr="${h(goal.id)}">
    <div class="kr-detail-header">
      <div class="kr-heading">
        <div class="embedded-title-row"><span class="goal-chip kr">KR+</span><strong>新增 KR</strong></div>
        <div class="kr-description">在当前目标 O 下直接补充新的 KR，新增时默认按未完成处理。</div>
      </div>
    </div>
    <div class="kr-card-surface">${inlineKrEditor(goal, blankKr(), true, false, "goal-modal")}</div>
  </div>`;
}

function openGoalModal(mode, goalId = "") {
  if (state.currentUser.role !== "employee") return;
  refs.goalForm.reset();
  fillGoalFormOptions();
  refs.goalFormMode.value = mode;
  refs.goalFormGoalId.value = goalId;
  refs.goalModalTitle.textContent = mode === "create" ? "新建季度 OKR" : "编辑目标 O";
  refs.goalSubmitButton.textContent = mode === "create" ? "提交本季度 OKR" : "保存修改";
  refs.goalModalTitle.textContent = mode === "create" ? "新建季度 OKR" : "编辑目标";
  refs.goalSubmitButton.textContent = mode === "create" ? "创建季度目标 O" : "保存修改";
  refs.goalEditSection.classList.toggle("hidden", mode !== "edit");
  refs.goalModalTitle.textContent = mode === "create" ? "新建季度 OKR" : "编辑目标 O";
  refs.goalSubmitButton.textContent = mode === "create" ? "提交本季度 OKR" : "保存修改";
  refs.goalKrSection.classList.toggle("hidden", mode === "edit");
  refs.goalProofSection.classList.add("hidden");
  refs.goalKrList.classList.add("hidden");
  refs.goalKrActions.classList.add("hidden");
  refs.krDraftList.classList.toggle("hidden", mode === "edit");
  refs.addKrRowButton.classList.toggle("hidden", mode === "edit");
  refs.goalDepartment.disabled = true;
  refs.goalOwner.disabled = true;
  refs.goalCycle.disabled = mode === "edit";
  refs.saveDraftButton.classList.remove("hidden");
  refs.goalProofUploadHint.classList.add("hidden");
  refs.goalProofUploadHint.textContent = "";
  refs.goalName.closest("label")?.classList.toggle("hidden", mode === "create");
  refs.goalPoints.closest("label")?.classList.toggle("hidden", mode === "create");
  refs.goalDescription.closest("label")?.classList.toggle("hidden", mode === "create");
  refs.goalEditProgress.closest("label")?.classList.add("hidden");

  if (mode === "create") {
    state.krDrafts = [];
    refs.goalType.value = "personal";
    refs.goalDepartment.value = state.currentUser.departmentId;
    refs.goalOwner.value = state.currentUser.id;
    refs.goalCycle.value = state.cycleId;
    state.goalDrafts = [blankGoalDraft()];
    refs.goalPoints.value = "100";
    refs.addKrRowButton.textContent = "+ 添加 KR（可选）";
    refs.goalEditStatus.innerHTML = goalStatusOptions("draft");
    refs.goalEditStatus.disabled = false;
    refs.addKrRowButton.textContent = "+ 添加 O";
    refs.goalKrHint.textContent = "先新增一个或多个目标 O，再为每个 O 补充对应 KR；提交时会一次性创建本季度 OKR。";
    refs.goalKrHint.textContent = "请先创建季度目标 O，KR 为可选项，后续也可以继续补充。";
    renderKrDrafts();
    refs.goalKrHint.textContent = "先新增一个或多个目标 O，再为每个 O 补充对应 KR；提交时会一次性创建本季度 OKR。";
    openModal("goalModal");
    return;
  }

  const goal = getGoal(goalId);
  if (!goal || !canEdit(goal)) return;
  refs.goalName.value = goal.name || "";
  refs.goalType.value = goal.type || "personal";
  refs.goalDepartment.value = goal.departmentId;
  refs.goalOwner.value = goal.ownerId;
  refs.goalCycle.value = goal.cycleId;
  refs.goalPoints.value = goal.points === null ? "" : String(goal.points);
  refs.goalDescription.value = goal.description || "";
  refs.goalEditStatus.innerHTML = goalStatusOptions(goal.status);
  refs.goalEditStatus.value = goal.status === "draft" ? "confirmed" : goal.status;
  refs.goalEditStatus.disabled = goal.status !== "draft";
  refs.goalEditProgress.value = goal.manualProgress === null ? "" : String(goal.manualProgress);
  refs.goalEditSummary.value = goal.summary || "";
  refs.saveDraftButton.classList.toggle("hidden", goal.status !== "draft");
  refs.goalSubmitButton.textContent = goal.status === "draft" ? "保存并确认" : "保存修改";
  refs.goalKrHint.textContent = "KR 请在目标详情或 KR 页面中直接维护；材料请从 KR 中上传，O 页面仅做汇总显示。";
  refs.goalSubmitButton.textContent = goal.status === "draft" ? "保存并确定" : "保存修改";
  refs.goalKrHint.textContent = "KR 请在列表或目标详情中直接维护，证明材料请从 KR 进入上传。";
  refs.goalSubmitButton.textContent = goal.status === "draft" ? "保存并确认" : "保存修改";
  refs.goalKrHint.textContent = "KR 请在目标详情或 KR 页面中直接维护；材料请从 KR 中上传，O 页面仅做汇总显示。";
  refs.openAddKrButton.textContent = "+ 鏂板 KR";
  refs.goalKrHint.textContent = "鍦ㄨ繖閲屽彲鐩存帴淇濆瓨銆佹柊澧?KR锛屾潗鏂欏湪 O 璇︽儏涓粺涓€涓婁紶銆?";
  openModal("goalModal");
}

function fillGoalFormOptions() {
  refs.goalType.innerHTML = GOAL_TYPES.map((t) => `<option value="${h(t.value)}">${h(t.label)}</option>`).join("");
  refs.goalDepartment.innerHTML = depts().map((d) => `<option value="${h(d.id)}">${h(d.name)}</option>`).join("");
  refs.goalOwner.innerHTML = `<option value="${h(state.currentUser.id)}">${h(state.currentUser.name)}</option>`;
  refs.goalCycle.innerHTML = cycles().map((c) => `<option value="${h(c.id)}">${h(c.label)}</option>`).join("");
  fillGoalParentOptions("", refs.goalCycle.value || state.cycleId);
}

function renderKrDrafts() {
  refs.krDraftList.innerHTML = state.krDrafts.length
    ? state.krDrafts
        .map(
          (kr, i) => `<div class="kr-draft-card"><div class="kr-draft-head"><div class="kr-draft-title">KR ${i + 1}</div><button class="mini-button danger-button" type="button" data-kr-draft="delete" data-index="${i}">删除</button></div><div class="kr-draft-grid">
    <label class="full-width"><span>KR 名称</span><input data-index="${i}" data-field="name" type="text" value="${h(kr.name || "")}" placeholder="请输入 KR 名称"></label>
    <label><span>完成状态</span><select data-index="${i}" data-field="completionState"><option value="pending" ${kr.completionState === "done" ? "" : "selected"}>未完成</option><option value="done" ${kr.completionState === "done" ? "selected" : ""}>已完成</option></select></label>
    <label><span>分值</span><input data-index="${i}" data-field="points" type="number" min="0" step="0.1" value="${h(kr.points || "")}" placeholder="例如 20"></label>
    <label class="full-width"><span>说明</span><textarea data-index="${i}" data-field="description" rows="2" placeholder="补充 KR 说明">${h(kr.description || "")}</textarea></label>
  </div></div>`
        )
        .join("")
    : '<div class="proof-empty">可以先只创建季度目标 O，KR 后续再补也可以。</div>';
}

async function saveGoal(saveAsDraft) {
  if (refs.goalFormMode.value === "create") {
    const payload = {
      name: refs.goalName.value.trim(),
      type: refs.goalType.value,
      departmentId: refs.goalDepartment.value,
      ownerId: refs.goalOwner.value,
      cycleId: refs.goalCycle.value,
      points: refs.goalPoints.value,
      description: refs.goalDescription.value.trim(),
      saveAsDraft,
      krs: state.krDrafts
        .filter((k) => k.name && k.name.trim())
        .map((k) => ({
          name: k.name.trim(),
          metricType: "milestone",
          progress: k.completionState === "done" ? 100 : 0,
          points: k.points || "",
          description: k.description || ""
        }))
    };
    if (!payload.name || !payload.type || !payload.departmentId || !payload.ownerId || !payload.cycleId) {
      return window.alert("请完整填写目标名称、类型、所属部门、所属员工和目标周期。");
    }
    const res = await apiPost("/api/goals", payload);
    if (!res?.store) return;
    closeModal("goalModal");
    applyStore(res.store, false, res.goal?.id || "");
    return;
  }

  const goalId = refs.goalFormGoalId.value;
  const goal = getGoal(goalId);
  if (!goal || !canEdit(goal)) return;
  const nextStatus = saveAsDraft ? "draft" : goal.status === "draft" ? refs.goalEditStatus.value : "confirmed";
  const res = await apiPut(`/api/goals/${goalId}`, {
    name: refs.goalName.value.trim(),
    type: refs.goalType.value,
    points: refs.goalPoints.value,
    description: refs.goalDescription.value.trim(),
    manualProgress: refs.goalEditProgress.value,
    summary: refs.goalEditSummary.value.trim(),
    status: nextStatus
  });
  if (!res?.store) return;
  closeModal("goalModal");
  applyStore(res.store, false, goalId);
}

async function submitGoalForReview(goalId) {
  const goal = getGoal(goalId);
  if (!goal || !canSubmitReview(goal)) return;
  if (!window.confirm("确认本季度 OKR 的证明材料已基本齐备，并提交给科室领导评分吗？提交后 OKR 仍保持锁定，但可以继续补充 KR 证明材料。")) return;
  const res = await apiPost(`/api/goals/${goalId}/submit-review`, {});
  if (!res?.store) return;
  applyStore(res.store, false, goalId);
  openGoalDetail(goalId);
}

async function authorizeGoalEdit(goalId) {
  const goal = getGoal(goalId);
  if (!goal || !canAuthorizeEdit(goal)) return;
  if (!window.confirm("确认给该目标一次修改授权吗？员工保存 OKR 或 KR 后会重新进入锁定流程，已有评分也会清空。")) return;
  const res = await apiPost(`/api/goals/${goalId}/authorize-edit`, {});
  if (!res?.store) return;
  applyStore(res.store, false, goalId);
  openGoalDetail(goalId);
}

async function uploadGoalProofs() {
  const goalId = refs.goalFormGoalId.value;
  const goal = getGoal(goalId);
  const files = [...(refs.goalProofFile.files || [])];
  if (!goal || !canEdit(goal)) return window.alert("当前目标不能上传证明材料。");
  if (!files.length) return window.alert("请至少选择一个资料文件。");
  let latestStore = null;
  for (const file of files) {
    const res = await apiPost(`/api/goals/${goalId}/proofs`, {
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      fileBase64: await toBase64(file),
      note: refs.goalProofNote.value.trim()
    });
    if (!res?.store) break;
    latestStore = res.store;
  }
  if (!latestStore) return;
  applyStore(latestStore, false, goalId);
  openGoalModal("edit", goalId);
}

function renderProofHint() {
  const files = [...(refs.goalProofFile.files || [])];
  refs.goalProofUploadHint.classList.toggle("hidden", !files.length);
  refs.goalProofUploadHint.textContent = files.length
    ? `已选择 ${files.length} 个文件：${files.map((f) => f.name).join("、")}`
    : "";
}

function openReviewModal(goalId) {
  const goal = getGoal(goalId);
  if (!goal || !canReview(goal)) return;
  refs.reviewModal.dataset.goalId = goal.id;
  refs.reviewModalTitle.textContent = `${goal.code} ${goal.name}`;
  refs.reviewGoalMeta.innerHTML = `${meta(`员工：${userName(goal.ownerId)}`)}${meta(`科室：${sectionOfGoal(goal)}`)}${meta(`季度：${cycleLabel(goal.cycleId)}`)}${meta(`状态：${GOAL_STATUS[goal.status] || goal.status}`)}`;
  refs.reviewGoalKpis.innerHTML = `${kpi("当前进度", goalCompletionText(goal))}${kpi(
    "目标分值",
    goal.points === null ? "-" : fmt(goal.points)
  )}${kpi("KR 数量", String(goalKrs(goal.id).length))}${kpi("证明材料", `${goalProofs(goal.id).length} 份`)}`;
  refs.reviewKrList.innerHTML = embeddedKrs(goalKrs(goal.id), "readonly");
  refs.reviewProofList.innerHTML = proofList(goalProofs(goal.id), false);
  refs.reviewSummary.innerHTML = reviewSnapshot(goal);
  refs.reviewAttitude.value = goal.attitudeScore === null ? "" : String(goal.attitudeScore);
  refs.reviewAbility.value = goal.abilityScore === null ? "" : String(goal.abilityScore);
  refs.reviewPerformance.value = goal.performanceScore === null ? "" : String(goal.performanceScore);
  refs.reviewLevel.value = "";
  refs.reviewLevel.closest("label")?.classList.add("hidden");
  refs.reviewComment.value = goal.reviewComment || "";
  refreshReviewTotal();
  openModal("reviewModal");
}

function refreshReviewTotal() {
  const total = num(refs.reviewAttitude.value) + num(refs.reviewAbility.value) + num(refs.reviewPerformance.value);
  refs.reviewTotal.value = fmt(total);
}

async function saveReview() {
  const goalId = refs.reviewModal.dataset.goalId;
  const res = await apiPost(`/api/goals/${goalId}/review`, {
    attitudeScore: refs.reviewAttitude.value,
    abilityScore: refs.reviewAbility.value,
    performanceScore: refs.reviewPerformance.value,
    reviewLevel: "",
    reviewComment: refs.reviewComment.value.trim()
  });
  if (!res?.store) return;
  closeModal("reviewModal");
  applyStore(res.store, false, goalId);
}

function openKrModal(mode, goalId, krId = "", returnToGoal = false) {
  const goal = getGoal(goalId);
  if (!goal) return;
  const isCreate = mode === "create";
  if (isCreate && !canEdit(goal)) return;
  refs.singleKrForm.reset();
  refs.singleKrFormMode.value = mode;
  refs.singleKrGoalId.value = goalId;
  refs.singleKrId.value = krId;
  state.krReturnGoalId = returnToGoal ? goalId : "";
  refs.krProofFile.value = "";
  refs.krProofNote.value = "";

  const kr = isCreate ? null : getKr(krId);
  if (!isCreate && !kr) return;

  const editable = canEdit(goal);
  const proofEditable = !isCreate && canUploadProof(goal);

  refs.krModalTitle.textContent = isCreate ? `新增 KR · ${goal.name}` : `${kr.code} ${kr.name}`;
  refs.krModalMeta.innerHTML = `${meta(`所属目标：${goal.name}`)}${meta(`季度：${cycleLabel(goal.cycleId)}`)}${meta(`状态：${isCreate ? "新建中" : KR_STATUS[kr.status] || kr.status || "-"}`)}${meta(`目标状态：${GOAL_STATUS[goal.status] || goal.status}`)}`;
  refs.krModalStateNotice.textContent = krWorkspaceNotice(goal, isCreate, editable, proofEditable);
  refs.krModalStateNotice.classList.remove("hidden");

  refs.singleKrName.value = kr?.name || "";
  refs.singleKrCompletion.value = !kr || num(kr.progress) < 100 ? "pending" : "done";
  refs.singleKrPoints.value = kr?.points === null || !kr ? "" : String(kr.points);
  refs.singleKrDescription.value = kr?.description || "";
  refs.singleKrSaveButton.classList.toggle("hidden", !editable);
  toggleKrFormReadOnly(!editable);

  refs.krModalProofList.innerHTML = isCreate ? '<div class="proof-empty">请先保存 KR，再上传证明材料。</div>' : proofList(krProofs(kr.id), proofEditable);
  refs.krModalProofForm.classList.toggle("hidden", isCreate || !proofEditable);
  openModal("krModal");
}

async function saveKr() {
  const goalId = refs.singleKrGoalId.value;
  const goal = getGoal(goalId);
  if (!goal) return;
  const payload = {
    name: refs.singleKrName.value.trim(),
    metricType: "milestone",
    progress: refs.singleKrCompletion.value === "done" ? 100 : 0,
    points: refs.singleKrPoints.value,
    description: refs.singleKrDescription.value.trim()
  };
  if (!payload.name) return window.alert("请输入 KR 名称。");
  const proposedGoalPoints = projectedGoalPointsAfterKrChange(
    goalId,
    payload.points,
    refs.singleKrFormMode.value === "create" ? "" : refs.singleKrId.value
  );
  if (!validateGoalPointMutation(goalId, proposedGoalPoints)) return;
  const res =
    refs.singleKrFormMode.value === "create"
      ? await apiPost(`/api/goals/${goalId}/krs`, payload)
      : await apiPut(`/api/krs/${refs.singleKrId.value}`, payload);
  if (!res?.store) return;
  applyStore(res.store, false, goalId);
  if (refs.singleKrFormMode.value === "create" && res.kr?.id) {
    openKrModal("detail", goalId, res.kr.id, false);
    return;
  }
  openKrModal("detail", goalId, refs.singleKrId.value, false);
}

function toggleKrFormReadOnly(readOnly) {
  refs.singleKrName.disabled = readOnly;
  refs.singleKrCompletion.disabled = readOnly;
  refs.singleKrPoints.disabled = readOnly;
  refs.singleKrDescription.disabled = readOnly;
}

function krWorkspaceNotice(goal, isCreate, editable, proofEditable) {
  if (isCreate) {
    return "这里创建的是 KR，本次会挂到当前目标 O 下。请先填写 KR 内容并保存，材料后续可从 KR 页面或目标 O 详情里的对应 KR 卡片继续上传。";
  }
  if (editable) {
    return "当前目标允许修改，你可以直接调整 KR 名称、完成状态、分值和说明。保存后目标会重新进入锁定流程。";
  }
  if (proofEditable) {
    return "当前目标已锁定，KR 内容不能修改；你可以继续在这里补充或删除自己上传的证明材料。";
  }
  return "当前 KR 处于只读查看状态。";
}

async function uploadKrWorkspaceProofs() {
  const krId = refs.singleKrId.value;
  const goalId = refs.singleKrGoalId.value;
  const kr = getKr(krId);
  const files = [...(refs.krProofFile.files || [])];
  if (!kr || !goalId) return;
  if (!files.length) return window.alert("请至少选择一个资料文件。");

  let latestStore = null;
  for (const file of files) {
    const res = await apiPost(`/api/krs/${krId}/proofs`, {
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      fileBase64: await toBase64(file),
      note: refs.krProofNote.value.trim()
    });
    if (!res?.store) break;
    latestStore = res.store;
  }

  if (!latestStore) return;
  applyStore(latestStore, false, goalId);
  openKrModal("detail", goalId, krId, false);
}

async function onKrModalProofAction(e) {
  const btn = e.target.closest("[data-proof-act='delete']");
  if (!btn) return;
  const proof = getProof(btn.dataset.proofId);
  if (!proof) return;
  if (!window.confirm(`确认删除资料“${proof.fileName}”吗？`)) return;
  const res = await apiDelete(`/api/proofs/${proof.id}`);
  if (!res?.store) return;
  applyStore(res.store, false, proof.goalId);
  if (proof.krId) {
    openKrModal("detail", proof.goalId, proof.krId, false);
  }
}

function onDetailInput(e) {
  const progressSource = e.target.dataset.progressSource;
  if (progressSource) {
    refs.detailModalBody
      .querySelectorAll(`[data-progress-target="${progressSource}"]`)
      .forEach((node) => (node.textContent = `${e.target.value}%`));
  }

  const metricSelect = e.target.closest("[data-metric-select]");
  if (metricSelect) {
    syncMetricFieldVisibility(metricSelect.closest("[data-kr-card]"));
  }

  const detailProofFile = e.target.closest("[data-detail-proof-file]");
  if (detailProofFile?.dataset.krId) {
    renderDetailProofHint(detailProofFile.dataset.krId);
  }
}

function goalDetailKrCards(goal) {
  const cards = goalKrs(goal.id).map((kr) => goalDetailKrCard(goal, kr)).join("");
  return cards ? `<div class="embedded-list kr-summary-list">${cards}</div>` : '<div class="proof-empty">当前还没有维护 KR。</div>';
}

function goalDetailKrCard(goal, kr) {
  const actionLabel = canManageKr(goal) ? "维护 KR" : "查看 KR";
  return `<div class="embedded-item kr-summary-card">
    <div class="embedded-main">
      <div class="embedded-title-row">
        <span class="goal-chip kr">${h(kr.code)}</span>
        <strong>${h(kr.name)}</strong>
        ${milestoneTag(kr)}
      </div>
      <div class="embedded-subtext">${h(kr.description || "点击进入 KR 页面维护完成状态和证明材料。")}</div>
      <div class="embedded-subtext">${h(`分值 ${kr.points === null ? "-" : fmt(kr.points)} · 材料 ${krProofs(kr.id).length} 份`)}</div>
    </div>
    <div class="embedded-actions">
      <button class="mini-button" type="button" data-detail-act="manage-kr" data-kr-id="${h(kr.id)}">${actionLabel}</button>
    </div>
  </div>`;
}

function newGoalDetailKrCard(goal) {
  return `<div class="kr-detail-card kr-detail-card-new" data-kr-card="new-${h(goal.id)}">
    <div class="kr-detail-header">
      <div class="kr-heading">
        <div class="embedded-title-row"><span class="goal-chip kr">KR+</span><strong>新增 KR</strong></div>
        <div class="kr-description">直接在当前目标 O 下补充新的 KR。</div>
      </div>
    </div>
    <div class="kr-card-surface">${inlineKrEditor(goal, blankKr(), true, false)}</div>
  </div>`;
}

function inlineKrEditor(goal, kr, isNew, readOnly = false, actionScope = "detail") {
  const key = isNew ? `new-${goal.id}` : kr.id;
  const milestoneState = num(kr.progress) >= 100 ? "done" : "pending";
  return `<div class="inline-kr-form ${readOnly ? "kr-inline-readonly" : ""}">
    <div class="form-grid compact-form-grid">
      <label class="full-width"><span>KR 名称</span><input id="inline-kr-name-${h(key)}" type="text" value="${h(
        kr.name || ""
      )}" placeholder="请输入 KR 名称" ${readOnly ? "disabled" : ""}></label>
      ${
        isNew
          ? ""
          : `<label><span>完成状态</span><select id="inline-kr-completion-${h(key)}" ${readOnly ? "disabled" : ""}><option value="pending" ${
              milestoneState === "done" ? "" : "selected"
            }>未完成</option><option value="done" ${milestoneState === "done" ? "selected" : ""}>已完成</option></select></label>`
      }
      <label><span>分值</span><input id="inline-kr-points-${h(key)}" type="number" min="0" step="0.1" value="${h(
        kr.points === null ? "" : String(kr.points)
      )}" placeholder="例如 20" ${readOnly ? "disabled" : ""}></label>
      <label class="full-width"><span>说明</span><textarea id="inline-kr-description-${h(key)}" rows="3" placeholder="补充 KR 说明" ${
        readOnly ? "disabled" : ""
      }>${h(kr.description || "")}</textarea></label>
    </div>
    ${
      readOnly
        ? ""
        : `<div class="section-actions kr-editor-actions"><button class="secondary-button" type="button" data-detail-act="${
            isNew ? "save-new-inline-kr" : "save-inline-kr"
          }" data-goal-id="${h(goal.id)}" data-kr-id="${h(kr.id || "")}">${isNew ? "新增 KR" : "保存 KR"}</button></div>`
    }
  </div>`;
}

function syncMetricFieldVisibility(card) {
  if (!card) return;
  const metricSelect = card.querySelector('[id^="inline-kr-metric-"]');
  if (!metricSelect) return;
  const isMilestone = metricSelect.value === "milestone";
  card.querySelectorAll(".metric-fields-percentage").forEach((node) => node.classList.toggle("hidden", isMilestone));
  card.querySelectorAll(".metric-fields-milestone").forEach((node) => node.classList.toggle("hidden", !isMilestone));
}

function inlineKrPayload(key) {
  return {
    name: document.getElementById(`inline-kr-name-${key}`)?.value.trim() || "",
    metricType: "milestone",
    progress: document.getElementById(`inline-kr-completion-${key}`)?.value === "done" ? 100 : 0,
    points: document.getElementById(`inline-kr-points-${key}`)?.value || "",
    description: document.getElementById(`inline-kr-description-${key}`)?.value.trim() || ""
  };
}

function scrollGoalModalKrCard(selector) {
  window.setTimeout(() => {
    refs.goalKrList.querySelector(selector)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, 80);
}

function focusGoalModalNewKr(goalId) {
  const card =
    refs.goalKrList.querySelector(`[data-goal-modal-new-kr="${goalId}"]`) ||
    refs.goalKrList.querySelector("[data-goal-modal-new-kr]");
  if (!card) return;
  card.scrollIntoView({ block: "center", behavior: "smooth" });
  card.classList.add("kr-card-focus");
  window.setTimeout(() => card.classList.remove("kr-card-focus"), 1200);
  const input = card.querySelector('input[id^="inline-kr-name-"]');
  window.setTimeout(() => input?.focus(), 140);
}

async function saveInlineKr(krId, reopen = "detail") {
  const kr = getKr(krId);
  if (!kr) return;
  const payload = inlineKrPayload(krId);
  if (!payload.name) return window.alert("请输入 KR 名称。");
  const proposedGoalPoints = projectedGoalPointsAfterKrChange(kr.goalId, payload.points, krId);
  if (!validateGoalPointMutation(kr.goalId, proposedGoalPoints)) return;
  const res = await apiPut(`/api/krs/${krId}`, payload);
  if (!res?.store) return;
  applyStore(res.store, false, kr.goalId);
  if (reopen === "goal-modal") {
    openGoalModal("edit", kr.goalId);
    scrollGoalModalKrCard(`[data-goal-modal-kr-card="${krId}"]`);
    return;
  }
  openGoalDetail(kr.goalId);
}

async function saveNewInlineKr(goalId, reopen = "detail") {
  const payload = inlineKrPayload(`new-${goalId}`);
  if (!payload.name) return window.alert("请输入 KR 名称。");
  const proposedGoalPoints = projectedGoalPointsAfterKrChange(goalId, payload.points);
  if (!validateGoalPointMutation(goalId, proposedGoalPoints)) return;
  const res = await apiPost(`/api/goals/${goalId}/krs`, payload);
  if (!res?.store) return;
  applyStore(res.store, false, goalId);
  if (reopen === "goal-modal") {
    openGoalModal("edit", goalId);
    if (res.kr?.id) {
      scrollGoalModalKrCard(`[data-goal-modal-kr-card="${res.kr.id}"]`);
    } else {
      scrollGoalModalKrCard(`[data-goal-modal-new-kr="${goalId}"]`);
    }
    return;
  }
  openGoalDetail(goalId);
}

async function uploadInlineProof(krId) {
  const kr = getKr(krId);
  if (!kr) return;
  const fileInput = document.getElementById(`kr-proof-file-${krId}`);
  const noteInput = document.getElementById(`kr-proof-note-${krId}`);
  const files = [...(fileInput?.files || [])];
  if (!files.length) return window.alert("请至少选择一个资料文件。");

  let latestStore = null;
  for (const file of files) {
    const res = await apiPost(`/api/krs/${krId}/proofs`, {
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      fileBase64: await toBase64(file),
      note: noteInput?.value.trim() || ""
    });
    if (!res?.store) break;
    latestStore = res.store;
  }

  if (!latestStore) return;
  applyStore(latestStore, false, kr.goalId);
  openGoalDetail(kr.goalId);
}

async function deleteDetailProof(proofId) {
  const proof = getProof(proofId);
  if (!proof) return;
  if (!window.confirm(`确认删除资料“${proof.fileName}”吗？`)) return;
  const res = await apiDelete(`/api/proofs/${proof.id}`);
  if (!res?.store) return;
  applyStore(res.store, false, proof.goalId);
  openGoalDetail(proof.goalId);
}

function blankGoalDraft() {
  return {
    name: "",
    parentId: "",
    description: "",
    krs: [blankKr()]
  };
}

function goalDraftKrCount(draft) {
  return (draft.krs || []).filter((kr) => (kr.name || "").trim()).length;
}

function draftGoalPoints(draft) {
  return sumPoints((draft.krs || []).map((kr) => kr.points));
}

function sumPoints(values) {
  return Math.round(values.reduce((sum, value) => sum + num(value), 0) * 10) / 10;
}

function isHundredPointPlan(total) {
  return Math.abs(num(total) - 100) < 0.001;
}

function ownerCycleGoalTotal(ownerId, cycleId) {
  return sumPoints(
    (state.store?.goals || [])
      .filter((goal) => goal.ownerId === ownerId && goal.cycleId === cycleId)
      .map((goal) => goal.points)
  );
}

function goalParentOptions(selectedId = "", cycleId = state.cycleId) {
  const options = (state.store?.goals || [])
    .filter((goal) => goal.ownerId === state.currentUser.id && goal.cycleId === cycleId)
    .sort((a, b) => (a.code || "").localeCompare(b.code || "", "zh-CN", { numeric: true, sensitivity: "base" }))
    .map((goal) => `<option value="${h(goal.id)}" ${goal.id === selectedId ? "selected" : ""}>${h(`${goal.code} ${goal.name}`)}</option>`)
    .join("");
  return `<option value="">请选择父目标</option>${options}`;
}

function ensureCreateGoalDraft() {
  if (!Array.isArray(state.goalDrafts) || !state.goalDrafts.length) {
    state.goalDrafts = [blankGoalDraft()];
  }
  if (!Array.isArray(state.goalDrafts[0].krs) || !state.goalDrafts[0].krs.length) {
    state.goalDrafts[0].krs = [blankKr()];
  }
  return state.goalDrafts[0];
}

function fillGoalParentOptions(selectedId = refs.goalParent?.value || "", cycleId = refs.goalCycle?.value || state.cycleId) {
  if (!refs.goalParent) return;
  refs.goalParent.innerHTML = goalParentOptions(selectedId, cycleId);
  if (selectedId && ![...refs.goalParent.options].some((option) => option.value === selectedId)) {
    refs.goalParent.value = "";
  }
}

function currentGoalPoints(goalId) {
  return num(getGoal(goalId)?.points);
}

function projectedGoalPointsAfterKrChange(goalId, nextKrPoints, krId = "") {
  const krs = goalKrs(goalId);
  if (!krId) return sumPoints([...krs.map((kr) => kr.points), nextKrPoints]);

  let found = false;
  const points = krs.map((kr) => {
    if (kr.id === krId) {
      found = true;
      return nextKrPoints;
    }
    return kr.points;
  });
  return sumPoints(found ? points : [...points, nextKrPoints]);
}

function projectedOwnerCycleGoalTotal(ownerId, cycleId, nextGoalPoints, goalId = "") {
  const currentTotal = ownerCycleGoalTotal(ownerId, cycleId);
  if (!goalId) return sumPoints([currentTotal, nextGoalPoints]);
  return sumPoints([currentTotal - currentGoalPoints(goalId), nextGoalPoints]);
}

function validateDraftGoalPointMutation(currentTotal, proposedTotal) {
  if (proposedTotal <= 100.001) return true;
  if (currentTotal > 100.001 && proposedTotal <= currentTotal + 0.001) return true;
  window.alert(`当前季度该员工所有 O 的分值合计不能超过 100 分，当前已为 ${fmt(currentTotal)} 分，本次保存后会变为 ${fmt(proposedTotal)} 分。`);
  return false;
}

function validateGoalPointMutation(goalId, proposedGoalPoints) {
  const goal = getGoal(goalId);
  if (!goal) return true;

  const currentTotal = ownerCycleGoalTotal(goal.ownerId, goal.cycleId);
  const proposedTotal = projectedOwnerCycleGoalTotal(goal.ownerId, goal.cycleId, proposedGoalPoints, goalId);

  if (goal.status === "draft") {
    return validateDraftGoalPointMutation(currentTotal, proposedTotal);
  }

  if (!isHundredPointPlan(proposedTotal)) {
    window.alert(`当前季度所有 O 的分值合计必须为 100 分，当前为 ${fmt(proposedTotal)} 分。`);
    return false;
  }

  return true;
}

function collectCreateGoalPayload(saveAsDraft) {
  const draft = ensureCreateGoalDraft();
  return {
    name: refs.goalName.value.trim(),
    type: refs.goalType.value,
    departmentId: refs.goalDepartment.value,
    ownerId: refs.goalOwner.value,
    cycleId: refs.goalCycle.value,
    parentId: refs.goalParent.value || "",
    points: draftGoalPoints(draft),
    description: refs.goalDescription.value.trim(),
    saveAsDraft,
    krs: (draft.krs || [])
      .filter((kr) => (kr.name || "").trim())
      .map((kr) => ({
        name: kr.name.trim(),
        metricType: "milestone",
        progress: 0,
        points: kr.points || "",
        description: kr.description || ""
      }))
  };
}

function goalDraftKrCard(kr, goalIndex, krIndex) {
  const expanded = kr.expanded !== false;
  return `<div class="goal-create-kr-item ${expanded ? "is-expanded" : ""}">
    <div class="goal-create-kr-head">
      <button class="goal-create-kr-toggle" type="button" data-goal-draft-act="toggle-kr" data-goal-index="${goalIndex}" data-kr-index="${krIndex}" title="${expanded ? "收起" : "展开"}">${chevronIcon(
        expanded
      )}</button>
      <span class="goal-create-kr-badge">KR</span>
      <textarea class="goal-create-kr-title-input" data-goal-index="${goalIndex}" data-kr-index="${krIndex}" data-kr-field="name" rows="1" placeholder="请输入关键结果">${h(
        kr.name || ""
      )}</textarea>
      <button class="goal-create-kr-delete" type="button" data-goal-draft-act="delete-kr" data-goal-index="${goalIndex}" data-kr-index="${krIndex}" title="删除 KR">${trashIcon()}</button>
    </div>
    <div class="goal-create-kr-body${expanded ? "" : " hidden"}">
      <div class="goal-create-kr-meta">
        <label>
          <span>分值</span>
          <input data-goal-index="${goalIndex}" data-kr-index="${krIndex}" data-kr-field="points" type="number" min="0" step="0.1" value="${h(
            kr.points || ""
          )}" placeholder="例如 20">
        </label>
        <div class="goal-create-kr-default-state">默认未完成</div>
      </div>
      <label class="full-width">
        <span>补充说明</span>
        <textarea data-goal-index="${goalIndex}" data-kr-index="${krIndex}" data-kr-field="description" rows="3" placeholder="请输入说明">${h(
          kr.description || ""
        )}</textarea>
      </label>
    </div>
  </div>`;
}

function goalDraftCard(draft, goalIndex) {
  const krCount = goalDraftKrCount(draft);
  const goalPoints = draftGoalPoints(draft);
  return `<div class="goal-draft-card goal-create-card">
    <div class="goal-draft-head goal-create-card-head">
      <div class="goal-create-card-main">
        <div class="goal-create-card-badge">O${goalIndex + 1}</div>
        <div>
          <div class="goal-draft-title">目标信息</div>
          <div class="goal-draft-subtitle">总分值按当前 KR 自动汇总，确认时会校验本季度是否正好 100 分。</div>
        </div>
      </div>
      <div class="goal-create-card-actions">
        <div class="goal-create-total" data-goal-draft-points="${goalIndex}">分值 ${fmt(goalPoints)}</div>
        <button class="mini-button danger-button" type="button" data-goal-draft-act="delete-goal" data-goal-index="${goalIndex}">删除 O</button>
      </div>
    </div>

    <div class="form-grid goal-draft-grid goal-create-form-grid">
      <label class="full-width">
        <span>目标名称 *</span>
        <input data-goal-index="${goalIndex}" data-goal-field="name" type="text" value="${h(draft.name || "")}" placeholder="请输入目标名称">
      </label>
      <label class="full-width">
        <span>父目标</span>
        <select data-goal-index="${goalIndex}" data-goal-field="parentId">${goalParentOptions(draft.parentId || "")}</select>
      </label>
      <label class="full-width">
        <span>目标说明</span>
        <textarea data-goal-index="${goalIndex}" data-goal-field="description" rows="3" placeholder="请输入目标说明">${h(draft.description || "")}</textarea>
      </label>
    </div>

    <div class="goal-draft-kr-shell goal-create-kr-shell">
      <div class="goal-draft-kr-header goal-create-kr-header">
        <div>
          <div class="goal-draft-kr-title"><span class="goal-create-kr-badge soft">KR</span>关键结果</div>
          <div class="goal-draft-kr-subtitle">已添加 ${krCount} 条 KR，新建 KR 默认未完成。</div>
        </div>
        <button class="ghost-button" type="button" data-goal-draft-act="add-kr" data-goal-index="${goalIndex}">+ 新增 KR</button>
      </div>
      <div class="goal-draft-kr-list goal-create-kr-list">
        ${(draft.krs || []).length
          ? (draft.krs || []).map((kr, krIndex) => goalDraftKrCard(kr, goalIndex, krIndex)).join("")
          : '<div class="proof-empty">当前还没有 KR，可以继续新增。</div>'}
      </div>
    </div>
  </div>`;
}

function renderKrDrafts() {
  refs.krDraftList.innerHTML = (state.goalDrafts || []).length
    ? state.goalDrafts.map((draft, goalIndex) => goalDraftCard(draft, goalIndex)).join("")
    : '<div class="proof-empty">先添加一个目标 O，再为它补充 KR。</div>';
}

function openGoalModal(mode, goalId = "") {
  if (state.currentUser.role !== "employee") return;

  refs.goalForm.reset();
  refs.goalModal.dataset.mode = mode;
  fillGoalFormOptions();
  refs.goalFormMode.value = mode;
  refs.goalFormGoalId.value = goalId;
  refs.goalDepartment.disabled = true;
  refs.goalOwner.disabled = true;
  refs.goalCycle.disabled = mode === "edit";
  refs.goalProofSection.classList.add("hidden");
  refs.goalKrList.classList.add("hidden");
  refs.goalKrActions.classList.add("hidden");
  refs.goalEditSection.classList.toggle("hidden", mode !== "edit");
  refs.goalKrSection.classList.remove("hidden");
  refs.krDraftList.classList.toggle("hidden", mode !== "create");
  refs.addKrRowButton.classList.toggle("hidden", mode !== "create");
  refs.saveDraftButton.classList.remove("hidden");
  refs.goalProofUploadHint.classList.add("hidden");
  refs.goalProofUploadHint.textContent = "";
  refs.goalName.closest("label")?.classList.toggle("hidden", mode === "create");
  refs.goalPoints.closest("label")?.classList.add("hidden");
  refs.goalDescription.closest("label")?.classList.toggle("hidden", mode === "create");
  refs.goalEditStatus.closest("label")?.classList.add("hidden");
  refs.goalEditProgress.closest("label")?.classList.add("hidden");

  const goalKrTitle = refs.goalKrSection.querySelector(".modal-section-title");
  if (goalKrTitle) {
    goalKrTitle.textContent = mode === "create" ? "目标 O 与 KR" : "当前 KR";
  }

  if (mode === "create") {
    state.goalDrafts = [blankGoalDraft()];
    refs.goalModalTitle.textContent = "新建目标";
    refs.goalSubmitButton.textContent = "确定";
    refs.saveDraftButton.textContent = "保存为草稿";
    refs.goalType.value = "personal";
    refs.goalDepartment.value = state.currentUser.departmentId;
    refs.goalOwner.value = state.currentUser.id;
    refs.goalCycle.value = state.cycleId;
    refs.addKrRowButton.textContent = "+ 新增 O";
    refs.goalKrHint.textContent = "先新增 O，再填写各自的 KR。确认时本季度所有 O 的分值合计必须为 100。";
    renderKrDrafts();
    openModal("goalModal");
    return;
  }

  const goal = getGoal(goalId);
  if (!goal || !canEdit(goal)) return;

  refs.goalModalTitle.textContent = "编辑目标 O";
  refs.goalSubmitButton.textContent = goal.status === "draft" ? "\u4fdd\u5b58\u5e76\u786e\u8ba4" : "\u4fdd\u5b58\u4fee\u6539";
  refs.saveDraftButton.textContent = "保存草稿";
  refs.goalName.value = goal.name || "";
  refs.goalType.value = goal.type || "personal";
  refs.goalDepartment.value = goal.departmentId;
  refs.goalOwner.value = goal.ownerId;
  refs.goalCycle.value = goal.cycleId;
  refs.goalPoints.value = goal.points === null ? "" : String(goal.points);
  refs.goalDescription.value = goal.description || "";
  refs.goalEditStatus.innerHTML = goalStatusOptions(goal.status);
  refs.goalEditStatus.value = goal.status === "draft" ? "confirmed" : goal.status;
  refs.goalEditStatus.disabled = goal.status !== "draft";
  refs.goalEditProgress.value = goal.manualProgress === null ? "" : String(goal.manualProgress);
  refs.goalEditSummary.value = goal.summary || "";
  refs.saveDraftButton.classList.toggle("hidden", goal.status !== "draft");
  refs.goalKrList.innerHTML = goalModalKrCards(goal);
  refs.goalKrList.classList.remove("hidden");
  refs.goalKrActions.classList.remove("hidden");
  refs.openAddKrButton.textContent = "+ 新增 KR";
  refs.goalKrHint.textContent = "这里可以直接新增和保存 KR，目标分值会按当前 KR 分值自动汇总。";
  openModal("goalModal");
}

async function saveGoal(saveAsDraft) {
  if (refs.goalFormMode.value === "create") {
    const sharedPayload = {
      type: refs.goalType.value,
      departmentId: refs.goalDepartment.value,
      ownerId: refs.goalOwner.value,
      cycleId: refs.goalCycle.value,
      saveAsDraft
    };

    if (!sharedPayload.type || !sharedPayload.departmentId || !sharedPayload.ownerId || !sharedPayload.cycleId) {
      return window.alert("请先选择完整的目标类型、归属部门、归属员工和季度。");
    }

    const goalPayloads = (state.goalDrafts || [])
      .map((draft) => ({
        ...sharedPayload,
        name: (draft.name || "").trim(),
        parentId: draft.parentId || "",
        points: draftGoalPoints(draft),
        description: (draft.description || "").trim(),
        krs: (draft.krs || [])
          .filter((kr) => (kr.name || "").trim())
          .map((kr) => ({
            name: kr.name.trim(),
            metricType: "milestone",
            progress: 0,
            points: kr.points || "",
            description: kr.description || ""
          }))
      }))
      .filter((draft) => draft.name);

    if (!goalPayloads.length) {
      return window.alert("请至少填写一个目标 O 的名称。");
    }

    const totalPoints = sumPoints(goalPayloads.map((draft) => draft.points));
    if (!saveAsDraft && !isHundredPointPlan(totalPoints)) {
      return window.alert(`当前季度所有 O 的分值合计必须为 100 分，当前为 ${fmt(totalPoints)} 分。`);
    }

    let latestStore = null;
    let latestGoalId = "";
    const createdGoals = [];
    for (const payload of goalPayloads) {
      const res = await apiPost("/api/goals", { ...payload, saveAsDraft: true });
      if (!res?.store) return;
      latestStore = res.store;
      latestGoalId = res.goal?.id || latestGoalId;
      createdGoals.push({ id: res.goal?.id, payload });
    }

    if (!saveAsDraft) {
      for (const item of createdGoals) {
        if (!item.id) continue;
        const res = await apiPut(`/api/goals/${item.id}`, {
          name: item.payload.name,
          type: item.payload.type,
          description: item.payload.description,
          summary: "",
          status: "confirmed"
        });
        if (!res?.store) return;
        latestStore = res.store;
        latestGoalId = item.id;
      }
    }

    if (!latestStore) return;
    closeModal("goalModal");
    applyStore(latestStore, false, latestGoalId);
    return;
  }

  const goalId = refs.goalFormGoalId.value;
  const goal = getGoal(goalId);
  if (!goal || !canEdit(goal)) return;

  if (!saveAsDraft && goal.status === "draft") {
    const totalPoints = ownerCycleGoalTotal(goal.ownerId, goal.cycleId);
    if (!isHundredPointPlan(totalPoints)) {
      return window.alert(`当前季度所有 O 的分值合计必须为 100 分，当前为 ${fmt(totalPoints)} 分。`);
    }
  }

  const nextStatus = saveAsDraft ? "draft" : "confirmed";
  const res = await apiPut(`/api/goals/${goalId}`, {
    name: refs.goalName.value.trim(),
    type: refs.goalType.value,
    description: refs.goalDescription.value.trim(),
    manualProgress: goal.manualProgress === null ? "" : goal.manualProgress,
    summary: refs.goalEditSummary.value.trim(),
    status: nextStatus
  });
  if (!res?.store) return;
  closeModal("goalModal");
  applyStore(res.store, false, goalId);
}

function onKrDraftInput(e) {
  const goalIndex = Number(e.target.dataset.goalIndex);
  if (Number.isNaN(goalIndex) || !state.goalDrafts[goalIndex]) return;

  const goalField = e.target.dataset.goalField;
  if (goalField) {
    state.goalDrafts[goalIndex][goalField] = e.target.value;
    return;
  }

  const krIndex = Number(e.target.dataset.krIndex);
  const krField = e.target.dataset.krField;
  if (Number.isNaN(krIndex) || !krField || !state.goalDrafts[goalIndex].krs?.[krIndex]) return;

  state.goalDrafts[goalIndex].krs[krIndex][krField] = e.target.value;
  if (krField === "completionState") {
    state.goalDrafts[goalIndex].krs[krIndex].progress = e.target.value === "done" ? "100" : "0";
  }
  if (krField === "points") {
    const pointsChip = refs.krDraftList.querySelector(`[data-goal-draft-points="${goalIndex}"]`);
    if (pointsChip) {
      pointsChip.textContent = `分值 ${fmt(draftGoalPoints(state.goalDrafts[goalIndex]))}`;
    }
  }
}

function onKrDraftClick(e) {
  const btn = e.target.closest("[data-goal-draft-act]");
  if (!btn) return;

  const goalIndex = Number(btn.dataset.goalIndex);
  const draft = state.goalDrafts[goalIndex];
  if (Number.isNaN(goalIndex) || !draft) return;

  if (btn.dataset.goalDraftAct === "add-kr") {
    draft.krs = [...(draft.krs || []), blankKr()];
    renderKrDrafts();
    return;
  }

  if (btn.dataset.goalDraftAct === "toggle-kr") {
    const krIndex = Number(btn.dataset.krIndex);
    if (Number.isNaN(krIndex) || !draft.krs?.[krIndex]) return;
    draft.krs[krIndex].expanded = draft.krs[krIndex].expanded === false;
    renderKrDrafts();
    return;
  }

  if (btn.dataset.goalDraftAct === "delete-goal") {
    state.goalDrafts.splice(goalIndex, 1);
    if (!state.goalDrafts.length) state.goalDrafts = [blankGoalDraft()];
    renderKrDrafts();
    return;
  }

  if (btn.dataset.goalDraftAct === "delete-kr") {
    const krIndex = Number(btn.dataset.krIndex);
    if (Number.isNaN(krIndex) || !draft.krs?.[krIndex]) return;
    draft.krs.splice(krIndex, 1);
    if (!draft.krs.length) draft.krs = [blankKr()];
    renderKrDrafts();
  }
}

function proofCompactList(proofs) {
  return proofs.length
    ? `<div class="proof-compact-list">${proofs
        .map(
          (proof) => `<div class="proof-compact-item">
            <div class="proof-compact-main">
              <div class="proof-compact-name">${h(proof.fileName)}</div>
              <div class="proof-compact-meta">${h(`${proof.uploadedAt || "-"} · ${size(proof.sizeBytes)}`)}</div>
              ${proof.note ? `<div class="proof-compact-note">${h(proof.note)}</div>` : ""}
            </div>
            <a class="mini-button proof-link-button" href="${h(proof.url)}" target="_blank" rel="noreferrer">打开</a>
          </div>`
        )
        .join("")}</div>`
    : '<div class="proof-empty proof-empty-compact">当前还没有上传证明材料。</div>';
}

function openGoalDetail(goalId) {
  const goal = getGoal(goalId);
  if (!goal) return;

  refs.detailModalTitle.textContent = `${goal.code} ${goal.name}`;
  refs.detailModalBody.innerHTML = `<div class="detail-stack">
    <section class="modal-section modal-section-first">
      <div class="detail-actions">${
        canEdit(goal) ? `<button class="secondary-button" type="button" data-detail-act="edit-goal" data-goal-id="${h(goal.id)}">编辑目标</button>` : ""
      }${
        canSubmitReview(goal)
          ? `<button class="primary-button" type="button" data-detail-act="submit-review" data-goal-id="${h(goal.id)}">确认材料齐备并提交评分</button>`
          : ""
      }${
        canReview(goal) ? `<button class="primary-button" type="button" data-detail-act="review-goal" data-goal-id="${h(goal.id)}">进入评分</button>` : ""
      }${
        canAuthorizeEdit(goal)
          ? `<button class="ghost-button" type="button" data-detail-act="authorize-goal-edit" data-goal-id="${h(goal.id)}">管理员授权修改</button>`
          : ""
      }</div>
      <div class="detail-meta">${meta(`状态：${GOAL_STATUS[goal.status] || goal.status}`)}${meta(`季度：${cycleLabel(goal.cycleId)}`)}${meta(
        `员工：${userName(goal.ownerId)}`
      )}${meta(`科室：${sectionOfGoal(goal)}`)}${meta(`分值：${goal.points === null ? "-" : fmt(goal.points)}`)}</div>
      <div class="detail-kpi-grid">${kpi("当前进度", goalCompletionText(goal))}${kpi(
        "KR 材料数",
        `${goalProofs(goal.id).length} 份`
      )}${kpi("总分", goal.reviewScore === null ? "-" : fmt(goal.reviewScore))}${kpi(
        "最近更新",
        goal.updatedAt || "-"
      )}</div>
      <div class="detail-note detail-state-note">${workflowNotice(goal)}</div>
    </section>
    <section class="modal-section"><div class="modal-section-title">目标说明</div><div class="detail-copy">${h(goal.description || "暂无目标说明")}</div></section>
    <section class="modal-section"><div class="modal-section-title">员工总结</div><div class="detail-copy">${h(goal.summary || "暂无员工总结")}</div></section>
      <section class="modal-section">
        <div class="modal-section-header">
          <div>
          <div class="modal-section-title">目标 O 下的 KR 维护</div>
          <div class="modal-section-subtitle">KR 调整和材料补充都在这里完成。</div>
        </div>
      </div>
      ${goalDetailKrCards(goal)}
    </section>
    <section class="modal-section"><div class="modal-section-title">评分结果</div>${reviewSnapshot(goal)}</section>
  </div>`;
  openModal("detailModal");
}

function goalDetailKrCards(goal) {
  const cards = goalKrs(goal.id).map((kr) => goalDetailKrCard(goal, kr));
  if (canEdit(goal)) {
    cards.push(newGoalDetailKrCard(goal));
  }
  return cards.length ? `<div class="kr-detail-list">${cards.join("")}</div>` : '<div class="proof-empty">当前还没有维护 KR。</div>';
}

function goalDetailKrCard(goal, kr) {
  const proofs = krProofs(kr.id);
  return `<div class="kr-detail-card" data-kr-card="${h(kr.id)}">
    <div class="kr-detail-header">
      <div class="kr-heading">
        <div class="embedded-title-row">
          <span class="goal-chip kr">${h(kr.code)}</span>
          <strong>${h(kr.name)}</strong>
          ${milestoneTag(kr)}
        </div>
      </div>
      <div class="goal-draft-chip-row">
        <span class="type-tag">${h(`分值 ${kr.points === null ? "-" : fmt(kr.points)}`)}</span>
        <span class="type-tag">${h(`材料 ${proofs.length} 份`)}</span>
      </div>
    </div>
    <div class="kr-card-surface">
      ${inlineKrEditor(goal, kr, false, !canEdit(goal))}
      <div class="kr-proof-inline">
        <div class="kr-proof-inline-head">
          <div class="kr-proof-inline-title">证明材料</div>
        </div>
        ${proofCompactList(proofs)}
        ${detailProofUploader(goal, kr)}
      </div>
    </div>
  </div>`;
}

function detailProofUploader(goal, kr) {
  if (!canUploadProof(goal)) return "";
  return `<div class="upload-panel upload-panel-inline detail-proof-uploader">
    <div class="upload-panel-head">
      <div>
        <div class="upload-panel-title">直接补充本 KR 材料</div>
        <div class="upload-panel-subtitle">支持所有文件类型与多文件上传。</div>
      </div>
    </div>

    <label class="upload-picker full-width">
      <input id="detail-proof-file-${h(kr.id)}" class="upload-picker-input" data-detail-proof-file="true" data-kr-id="${h(
        kr.id
      )}" type="file" multiple>
      <span class="upload-picker-button">选择文件</span>
      <span class="upload-picker-text">文档、图片、压缩包、音视频等都可上传</span>
    </label>

    <div id="detail-proof-hint-${h(kr.id)}" class="detail-note compact hidden"></div>

    <div id="detail-proof-progress-${h(kr.id)}" class="upload-progress-card hidden">
      <div class="upload-progress-head">
        <span id="detail-proof-progress-label-${h(kr.id)}">等待上传</span>
        <strong id="detail-proof-progress-value-${h(kr.id)}">0%</strong>
      </div>
      <div class="upload-progress-track">
        <div id="detail-proof-progress-bar-${h(kr.id)}" class="upload-progress-fill" style="width:0%"></div>
      </div>
    </div>

    <label class="full-width">
      <span>资料说明</span>
      <textarea id="detail-proof-note-${h(kr.id)}" rows="3" placeholder="填写本次上传说明，可作用于所选全部文件"></textarea>
    </label>

    <div class="section-actions">
      <button class="secondary-button" type="button" data-detail-act="upload-kr-proof" data-kr-id="${h(kr.id)}">上传材料</button>
    </div>
  </div>`;
}

function krModalStat(label, value, raw = false) {
  return `<div class="kr-modal-stat">
    <div class="kr-modal-stat-label">${h(label)}</div>
    <div class="kr-modal-stat-value">${raw ? value : h(value)}</div>
  </div>`;
}

function uploadUi({
  fileInput,
  noteInput,
  hintEl,
  progressCard,
  progressLabel,
  progressValue,
  progressBar,
  buttonEl
}) {
  return { fileInput, noteInput, hintEl, progressCard, progressLabel, progressValue, progressBar, buttonEl };
}

function krModalUploadUi() {
  return uploadUi({
    fileInput: refs.krProofFile,
    noteInput: refs.krProofNote,
    hintEl: refs.krProofUploadHint,
    progressCard: refs.krProofProgressCard,
    progressLabel: refs.krProofProgressLabel,
    progressValue: refs.krProofProgressValue,
    progressBar: refs.krProofProgressBar,
    buttonEl: refs.krProofUploadButton
  });
}

function detailKrUploadUi(krId) {
  return uploadUi({
    fileInput: document.getElementById(`detail-proof-file-${krId}`),
    noteInput: document.getElementById(`detail-proof-note-${krId}`),
    hintEl: document.getElementById(`detail-proof-hint-${krId}`),
    progressCard: document.getElementById(`detail-proof-progress-${krId}`),
    progressLabel: document.getElementById(`detail-proof-progress-label-${krId}`),
    progressValue: document.getElementById(`detail-proof-progress-value-${krId}`),
    progressBar: document.getElementById(`detail-proof-progress-bar-${krId}`),
    buttonEl: document.querySelector(`[data-detail-act="upload-kr-proof"][data-kr-id="${krId}"]`)
  });
}

function renderUploadHint(ui, emptyText = "支持所有文件类型，可多附件上传") {
  if (!ui?.hintEl) return;
  const files = [...(ui.fileInput?.files || [])];
  ui.hintEl.classList.toggle("hidden", !files.length);
  ui.hintEl.textContent = files.length ? `已选择 ${files.length} 个文件：${files.map((file) => file.name).join("、")}` : emptyText;
}

function renderKrProofHint() {
  renderUploadHint(krModalUploadUi());
}

function renderDetailProofHint(krId) {
  renderUploadHint(detailKrUploadUi(krId));
}

function resetUploadProgress(ui, label = "等待上传") {
  if (!ui?.progressCard) return;
  ui.progressCard.classList.add("hidden");
  if (ui.progressLabel) ui.progressLabel.textContent = label;
  if (ui.progressValue) ui.progressValue.textContent = "0%";
  if (ui.progressBar) ui.progressBar.style.width = "0%";
}

function updateUploadProgress(ui, progress, label) {
  if (!ui?.progressCard) return;
  const safe = clamp(Math.round(num(progress)), 0, 100);
  ui.progressCard.classList.remove("hidden");
  if (label && ui.progressLabel) ui.progressLabel.textContent = label;
  if (ui.progressValue) ui.progressValue.textContent = `${safe}%`;
  if (ui.progressBar) ui.progressBar.style.width = `${safe}%`;
}

function setUploadBusy(ui, busy, busyText = "上传中...") {
  if (!ui) return;
  [ui.fileInput, ui.noteInput].forEach((node) => {
    if (node) node.disabled = busy;
  });
  if (ui.buttonEl) {
    if (!ui.buttonEl.dataset.labelDefault) {
      ui.buttonEl.dataset.labelDefault = ui.buttonEl.textContent;
    }
    ui.buttonEl.disabled = busy;
    ui.buttonEl.textContent = busy ? busyText : ui.buttonEl.dataset.labelDefault;
  }
}

function readFileAsDataUrlWithProgress(file, onProgress) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    reader.onload = () => {
      if (onProgress) onProgress(100);
      resolve(reader.result);
    };
    reader.onerror = () => reject(reader.error || new Error("文件读取失败"));
    reader.readAsDataURL(file);
  });
}

function apiPostWithProgress(url, body, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      let data = {};
      try {
        data = JSON.parse(xhr.responseText || "{}");
      } catch {
        data = {};
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        if (onProgress) onProgress(100);
        resolve(data);
        return;
      }
      reject(new Error(data.error || `请求失败：${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("上传失败，请检查网络连接。"));
    xhr.send(JSON.stringify(body));
  });
}

function progressLabel(fileIndex, totalFiles, phase, fileName) {
  const action = phase === "encoding" ? "处理中" : "上传中";
  return `${action} ${fileIndex + 1}/${totalFiles} · ${fileName}`;
}

async function uploadKrProofFiles({ krId, goalId, ui, afterUpload }) {
  const files = [...(ui?.fileInput?.files || [])];
  if (!krId || !goalId) return;
  if (!files.length) return window.alert("请至少选择一个资料文件。");

  const note = ui.noteInput?.value.trim() || "";
  setUploadBusy(ui, true);
  updateUploadProgress(ui, 0, `准备上传 ${files.length} 个文件`);

  try {
    let latestStore = null;
    for (let fileIndex = 0; fileIndex < files.length; fileIndex += 1) {
      const file = files[fileIndex];
      const fileBase64 = await readFileAsDataUrlWithProgress(file, (encodeProgress) => {
        const localProgress = Math.round(encodeProgress * 0.35);
        const totalProgress = ((fileIndex + localProgress / 100) / files.length) * 100;
        updateUploadProgress(ui, totalProgress, progressLabel(fileIndex, files.length, "encoding", file.name));
      });

      const res = await apiPostWithProgress(
        `/api/krs/${krId}/proofs`,
        {
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          fileBase64,
          note
        },
        (uploadProgress) => {
          const localProgress = 35 + Math.round(uploadProgress * 0.65);
          const totalProgress = ((fileIndex + localProgress / 100) / files.length) * 100;
          updateUploadProgress(ui, totalProgress, progressLabel(fileIndex, files.length, "uploading", file.name));
        }
      );

      if (!res?.store) {
        throw new Error("上传失败，请重试。");
      }
      latestStore = res.store;
    }

    updateUploadProgress(ui, 100, `已完成上传，共 ${files.length} 个文件`);
    if (ui.fileInput) ui.fileInput.value = "";
    if (ui.noteInput) ui.noteInput.value = "";
    renderUploadHint(ui);
    if (typeof afterUpload === "function" && latestStore) {
      await afterUpload(latestStore);
    }
  } catch (error) {
    updateUploadProgress(ui, 0, error.message || "上传失败");
    window.alert(error.message || "上传失败");
  } finally {
    setUploadBusy(ui, false);
  }
}

function proofList(proofs, allowDelete) {
  return proofs.length
    ? proofs
        .map((proof) => {
          const krName = proof.krId ? getKr(proof.krId)?.name || proof.krId : "";
          return `<div class="proof-item">
            <div class="proof-item-layout">
              <div class="proof-item-preview">${proofPreview(proof)}</div>
              <div class="proof-item-main">
                <div class="proof-topline">
                  <div class="proof-copy">
                    <div class="proof-name-row">
                      <div class="proof-name">${h(proof.fileName)}</div>
                      ${proof.krId ? `<span class="type-tag proof-kr-tag">${h(krName)}</span>` : ""}
                    </div>
                    <div class="proof-meta-row">
                      <span class="proof-meta-chip">${h(`上传人 ${userName(proof.uploadedBy)}`)}</span>
                      <span class="proof-meta-chip">${h(proof.uploadedAt || "-")}</span>
                      <span class="proof-meta-chip">${h(size(proof.sizeBytes))}</span>
                    </div>
                    ${proof.note ? `<div class="proof-note">${h(proof.note)}</div>` : ""}
                  </div>
                  <span class="type-tag proof-type">${h(proof.mimeType || "file")}</span>
                </div>
                <div class="proof-actions">
                  <a class="ghost-button proof-link-button" href="${h(proof.url)}" target="_blank" rel="noreferrer">打开附件</a>
                  ${
                    allowDelete && proof.uploadedBy === state.currentUser.id
                      ? `<button class="ghost-button danger-button" type="button" data-proof-act="delete" data-proof-id="${h(proof.id)}">删除</button>`
                      : ""
                  }
                </div>
              </div>
            </div>
          </div>`;
        })
        .join("")
    : '<div class="proof-empty">当前还没有上传证明材料。</div>';
}

function openKrModal(mode, goalId, krId = "", returnToGoal = false) {
  const goal = getGoal(goalId);
  if (!goal) return;

  const isCreate = mode === "create";
  if (isCreate && !canEdit(goal)) return;

  refs.singleKrForm.reset();
  refs.singleKrFormMode.value = mode;
  refs.singleKrGoalId.value = goalId;
  refs.singleKrId.value = krId;
  state.krReturnGoalId = returnToGoal ? goalId : "";
  refs.krProofFile.value = "";
  refs.krProofNote.value = "";
  resetUploadProgress(krModalUploadUi());
  renderKrProofHint();

  const kr = isCreate ? null : getKr(krId);
  if (!isCreate && !kr) return;

  const editable = canEdit(goal);
  const proofEditable = !isCreate && canUploadProof(goal);
  const proofCount = isCreate ? 0 : krProofs(kr.id).length;

  refs.krModalTitle.textContent = isCreate ? `新增 KR · ${goal.name}` : `${kr.code} ${kr.name}`;
  refs.krModalMeta.innerHTML = `${meta(`所属目标：${goal.name}`)}${meta(`季度：${cycleLabel(goal.cycleId)}`)}${meta(
    `员工：${userName(goal.ownerId)}`
  )}${meta(`目标状态：${GOAL_STATUS[goal.status] || goal.status}`)}`;
  refs.krModalStateNotice.textContent = krWorkspaceNotice(goal, isCreate, editable, proofEditable);
  refs.krModalStateNotice.classList.remove("hidden");
  refs.krModalSummary.innerHTML = "";




  refs.singleKrName.value = kr?.name || "";
  refs.singleKrCompletion.value = !kr || num(kr.progress) < 100 ? "pending" : "done";
  refs.singleKrPoints.value = kr?.points === null || !kr ? "" : String(kr.points);
  refs.singleKrDescription.value = kr?.description || "";
  refs.singleKrSaveButton.textContent = isCreate ? "保存 KR" : "保存 KR 修改";
  refs.singleKrSaveButton.classList.toggle("hidden", !editable);
  toggleKrFormReadOnly(!editable);

  refs.krModalProofList.innerHTML = isCreate ? '<div class="proof-empty">请先保存 KR，再上传证明材料。</div>' : proofList(krProofs(kr.id), proofEditable);
  refs.krModalProofForm.classList.toggle("hidden", isCreate || !proofEditable);
  openModal("krModal");
}

function toggleKrFormReadOnly(readOnly) {
  refs.singleKrName.disabled = readOnly;
  refs.singleKrCompletion.disabled = readOnly;
  refs.singleKrPoints.disabled = readOnly;
  refs.singleKrDescription.disabled = readOnly;
  refs.singleKrForm.classList.toggle("kr-form-readonly", readOnly);
}

async function uploadKrWorkspaceProofs() {
  const krId = refs.singleKrId.value;
  const goalId = refs.singleKrGoalId.value;
  const kr = getKr(krId);
  if (!kr || !goalId) return;

  await uploadKrProofFiles({
    krId,
    goalId,
    ui: krModalUploadUi(),
    afterUpload: async (store) => {
      applyStore(store, false, goalId);
      openKrModal("detail", goalId, krId, false);
    }
  });
}

async function uploadGoalDetailKrProofs(krId) {
  const kr = getKr(krId);
  const goal = kr ? getGoal(kr.goalId) : null;
  if (!kr || !goal) return;

  await uploadKrProofFiles({
    krId,
    goalId: goal.id,
    ui: detailKrUploadUi(krId),
    afterUpload: async (store) => {
      applyStore(store, false, goal.id);
      openGoalDetail(goal.id);
    }
  });
}

function apiUploadFileWithProgress(url, file, note, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.setRequestHeader("X-Upload-File-Name", encodeURIComponent(file.name || "upload.bin"));
    xhr.setRequestHeader("X-Upload-Note", encodeURIComponent(note || ""));
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      let data = {};
      try {
        data = JSON.parse(xhr.responseText || "{}");
      } catch {
        data = {};
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        if (onProgress) onProgress(100);
        resolve(data);
        return;
      }
      reject(new Error(data.error || `请求失败：${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("上传失败，请检查网络连接。"));
    xhr.send(file);
  });
}

function progressLabel(fileIndex, totalFiles, phase, fileName) {
  const action = phase === "preparing" ? "准备上传" : "上传中";
  return `${action} ${fileIndex + 1}/${totalFiles} 路 ${fileName}`;
}

async function uploadKrProofFiles({ krId, goalId, ui, afterUpload }) {
  const files = [...(ui?.fileInput?.files || [])];
  if (!krId || !goalId) return;
  if (!files.length) return window.alert("请至少选择一个文件。");

  const note = ui.noteInput?.value.trim() || "";
  setUploadBusy(ui, true);
  updateUploadProgress(ui, 0, `准备上传 ${files.length} 个文件`);

  try {
    let latestStore = null;
    for (let fileIndex = 0; fileIndex < files.length; fileIndex += 1) {
      const file = files[fileIndex];
      updateUploadProgress(ui, (fileIndex / files.length) * 100, progressLabel(fileIndex, files.length, "preparing", file.name));

      const res = await apiUploadFileWithProgress(`/api/krs/${krId}/proofs`, file, note, (uploadProgress) => {
        const totalProgress = ((fileIndex + uploadProgress / 100) / files.length) * 100;
        updateUploadProgress(ui, totalProgress, progressLabel(fileIndex, files.length, "uploading", file.name));
      });

      if (!res?.store) {
        throw new Error("上传失败，请重试。");
      }
      latestStore = res.store;
    }

    updateUploadProgress(ui, 100, `已完成上传，共 ${files.length} 个文件`);
    if (ui.fileInput) ui.fileInput.value = "";
    if (ui.noteInput) ui.noteInput.value = "";
    renderUploadHint(ui);
    if (typeof afterUpload === "function" && latestStore) {
      await afterUpload(latestStore);
    }
  } catch (error) {
    updateUploadProgress(ui, 0, error.message || "上传失败");
    window.alert(error.message || "上传失败");
  } finally {
    setUploadBusy(ui, false);
  }
}

async function uploadInlineProof(krId) {
  const kr = getKr(krId);
  if (!kr) return;
  const fileInput = document.getElementById(`kr-proof-file-${krId}`);
  const noteInput = document.getElementById(`kr-proof-note-${krId}`);

  await uploadKrProofFiles({
    krId,
    goalId: kr.goalId,
    ui: {
      fileInput,
      noteInput,
      buttonEl: document.querySelector(`[data-inline-proof-upload="${krId}"]`)
    },
    afterUpload: async (store) => {
      applyStore(store, false, kr.goalId);
      openGoalDetail(kr.goalId);
    }
  });
}

function filteredGoals() {
  return [...(state.store?.goals || [])]
    .filter((g) => !state.cycleId || g.cycleId === state.cycleId)
    .filter((g) => !state.status || g.status === state.status)
    .filter(matchSearch)
    .sort((a, b) => (a.code || "").localeCompare(b.code || "", "zh-CN", { numeric: true, sensitivity: "base" }));
}

function matchSearch(goal) {
  if (!state.search) return true;
  const text = [
    goal.code,
    goal.name,
    goal.description,
    userName(goal.ownerId),
    sectionOfGoal(goal),
    cycleLabel(goal.cycleId),
    ...goalKrs(goal.id).flatMap((kr) => [kr.code, kr.name, kr.description, kr.targetValue, kr.currentValue])
  ]
    .join(" ")
    .toLowerCase();
  return text.includes(state.search);
}

function summaryRows(goals) {
  const map = new Map();
  goals.forEach((goal) => {
    const owner = getUser(goal.ownerId);
    if (!owner) return;
    const item =
      map.get(owner.id) || { owner: owner.name, section: sectionName(owner.sectionId), goalCount: 0, krCount: 0, progresses: [], scores: [], reviewed: 0 };
    item.goalCount += 1;
    item.krCount += goalKrs(goal.id).length;
    item.progresses.push(progressOfGoal(goal));
    if (goal.reviewScore !== null) {
      item.reviewed += 1;
      item.scores.push(goal.reviewScore);
    }
    map.set(owner.id, item);
  });
  return [...map.values()]
    .map((item) => ({
      owner: item.owner,
      section: item.section || "-",
      goalCount: item.goalCount,
      krCount: item.krCount,
      progress: avg(item.progresses),
      reviewed: item.reviewed,
      score: item.scores.length ? avg(item.scores) : null
    }))
    .sort((a, b) => a.section.localeCompare(b.section, "zh-CN") || a.owner.localeCompare(b.owner, "zh-CN"));
}

function users(all = false) {
  return all ? state.store?.demoUsers || [] : state.store?.users || [];
}

function depts() {
  return state.store?.departments || [];
}

function cycles() {
  return state.store?.cycles || [];
}

function getUser(id) {
  return users(true).find((u) => u.id === id) || null;
}

function getGoal(id) {
  return state.store?.goals.find((g) => g.id === id) || null;
}

function getKr(id) {
  return state.store?.krs.find((k) => k.id === id) || null;
}

function getProof(id) {
  return state.store?.proofs.find((p) => p.id === id) || null;
}

function goalKrs(goalId) {
  return [...(state.store?.krs || [])]
    .filter((k) => k.goalId === goalId)
    .sort((a, b) => (a.code || "").localeCompare(b.code || "", "zh-CN", { numeric: true, sensitivity: "base" }));
}

function goalProofs(goalId) {
  return [...(state.store?.proofs || [])]
    .filter((p) => p.goalId === goalId)
    .sort((a, b) => (b.uploadedAt || "").localeCompare(a.uploadedAt || "", "zh-CN"));
}

function krProofs(krId) {
  return [...(state.store?.proofs || [])]
    .filter((p) => p.krId === krId)
    .sort((a, b) => (b.uploadedAt || "").localeCompare(a.uploadedAt || "", "zh-CN"));
}

function userName(id) {
  return getUser(id)?.name || "-";
}

function deptName(id) {
  return depts().find((d) => d.id === id)?.name || "-";
}

function sectionName(id) {
  return id ? state.store?.sections.find((s) => s.id === id)?.name || "-" : "-";
}

function cycleLabel(id) {
  return cycles().find((c) => c.id === id)?.label || "-";
}

function sectionOfGoal(goal) {
  return sectionName(getUser(goal.ownerId)?.sectionId);
}

function roleMeta(role = state.currentUser.role) {
  return ROLE_META[role] || ROLE_META.employee;
}

function canEdit(goal) {
  return state.currentUser.role === "employee" && goal.ownerId === state.currentUser.id && goal.status === "draft";
}

function canManageKr(goal) {
  return canEdit(goal) || canUploadProof(goal);
}

function canUploadProof(goal) {
  if (state.currentUser.role !== "employee" || goal.ownerId !== state.currentUser.id) return false;
  const helpers = goalActionHelpers();
  if (typeof helpers.canUploadProofInStatus === "function") {
    return helpers.canUploadProofInStatus(goal.status);
  }
  return ["confirmed", "pending_submission", "pending_review"].includes(goal.status);
}

function canSubmitReview(goal) {
  return state.currentUser.role === "employee" && goal.ownerId === state.currentUser.id && goal.status === "pending_submission";
}

function canAuthorizeEdit(goal) {
  return false;
}

function canReview(goal) {
  const owner = getUser(goal.ownerId);
  return state.currentUser.role === "section-leader" && goal.status === "pending_review" && !!owner && owner.sectionId === state.currentUser.sectionId;
}

function goalStatusOptions(currentStatus = "draft") {
  return Object.entries(GOAL_STATUS)
    .map(([value, label]) => {
      const disabled = !["draft", "confirmed"].includes(value) || (currentStatus !== "draft" && value !== currentStatus);
      return `<option value="${h(value)}" ${disabled ? "disabled" : ""}>${h(label)}</option>`;
    })
    .join("");
}

function workflowNotice(goal) {
  if (goal.status === "draft") {
    return "草稿状态，可继续调整 O 和 KR。";
  }
  if (goal.status === "confirmed") {
    return "已确定，季度末月 25 日起会自动转为待提交。";
  }
  if (goal.status === "pending_submission") {
    return "待提交，可在下方 KR 中补充材料并提交评分。";
  }
  if (goal.status === "pending_review") {
    return "待评分，仍可继续补充 KR 材料。";
  }
  if (goal.status === "reviewed") {
    return "已评分，如需修改需管理员重新授权。";
  }
  return "当前目标已进入锁定流程。";
}

function proofActionNotice(goal) {
  if (goal.status === "confirmed") {
    return "当前还不能上传材料，季度末月 25 日起会自动开放。";
  }
  if (goal.status === "reviewed") {
    return "当前目标已完成评分，如需调整 OKR，请先申请管理员授权。";
  }
  return "当前角色仅可查看该 KR 的证明材料。";
}

function milestoneTag(kr) {
  const done = num(kr.progress) >= 100 || kr.status === "completed";
  return `<span class="status-pill completion-pill ${done ? "done" : "pending"}">${done ? "已完成" : "未完成"}</span>`;
}

function goalCompletionDone(goal) {
  return progressOfGoal(goal) >= 100;
}

function goalCompletionText(goal) {
  return goalCompletionDone(goal) ? "已完成" : "未完成";
}

function goalCompletionPill(goal) {
  const done = goalCompletionDone(goal);
  return `<span class="status-pill completion-pill ${done ? "done" : "pending"}">${done ? "已完成" : "未完成"}</span>`;
}

function krCompletionText(kr) {
  return num(kr.progress) >= 100 || kr.status === "completed" ? "已完成" : "未完成";
}

function krProgressCell(kr) {
  return `<div class="kr-progress-cell">${milestoneTag(kr)}</div>`;
}

function progressOfGoal(goal) {
  const krs = goalKrs(goal.id);
  if (!krs.length) return clamp(num(goal.manualProgress), 0, 100);
  const totalWeight = krs.filter((k) => k.points !== null && k.points !== "").reduce((sum, k) => sum + num(k.points), 0);
  return clamp(
    totalWeight ? krs.reduce((sum, k) => sum + num(k.progress) * num(k.points), 0) / totalWeight : avg(krs.map((k) => num(k.progress))),
    0,
    100
  );
}

function blankKr() {
  return { name: "", completionState: "pending", progress: "0", points: "", description: "", expanded: true };
}

function embeddedKrs(krs, mode) {
  return krs.length
    ? `<div class="embedded-list">${krs
        .map(
          (kr) =>
            `<div class="embedded-item"><div class="embedded-main"><div class="embedded-title-row"><span class="goal-chip kr">${h(
              kr.code
            )}</span><strong>${h(kr.name)}</strong>${milestoneTag(kr)}</div><div class="embedded-subtext">${h(
              `分值 ${kr.points === null ? "-" : fmt(kr.points)} · 材料 ${krProofs(kr.id).length} 份`
            )}</div></div>${embeddedKrActions(kr, mode)}</div>`
        )
        .join("")}</div>`
    : '<div class="proof-empty">当前还没有维护 KR。</div>';
}

function embeddedKrActions(kr, mode) {
  if (mode === "goal-editable") {
    return `<div class="embedded-actions"><button class="mini-button" type="button" data-goal-kr-act="detail" data-kr-id="${h(
      kr.id
    )}">详情</button><button class="mini-button" type="button" data-goal-kr-act="edit" data-kr-id="${h(kr.id)}">编辑</button></div>`;
  }
  if (mode === "detail-editable") {
    return `<div class="embedded-actions"><button class="mini-button" type="button" data-detail-act="detail-kr" data-kr-id="${h(
      kr.id
    )}">详情</button><button class="mini-button" type="button" data-detail-act="edit-kr" data-kr-id="${h(kr.id)}">编辑</button></div>`;
  }
  if (mode === "detail-readonly") {
    return `<div class="embedded-actions"><button class="mini-button" type="button" data-detail-act="detail-kr" data-kr-id="${h(
      kr.id
    )}">详情</button></div>`;
  }
  return "";
}

function proofList(proofs, allowDelete) {
  return proofs.length
    ? proofs
        .map(
          (proof) => `<div class="proof-item"><div class="proof-topline"><div><div class="proof-name">${h(
            proof.fileName
          )}</div><div class="proof-meta">${h(`上传人：${userName(proof.uploadedBy)} · 时间：${proof.uploadedAt || "-"} · 大小：${size(proof.sizeBytes)}`)}</div>${
            proof.krId ? `<div class="proof-meta">${h(`归属 KR：${getKr(proof.krId)?.name || proof.krId}`)}</div>` : ""
          }${
            proof.note ? `<div class="proof-meta">${h(`说明：${proof.note}`)}</div>` : ""
          }</div><span class="type-tag proof-type">${h(proof.mimeType || "file")}</span></div>${proofPreview(
            proof
          )}<div class="proof-actions"><a class="ghost-button" href="${h(proof.url)}" target="_blank" rel="noreferrer">打开附件</a>${
            allowDelete && proof.uploadedBy === state.currentUser.id
              ? `<button class="ghost-button danger-button" type="button" data-proof-act="delete" data-proof-id="${h(proof.id)}">删除</button>`
              : ""
          }</div></div>`
        )
        .join("")
    : '<div class="proof-empty">当前还没有上传证明材料。</div>';
}

function proofPreview(proof) {
  const url = h(proof.url);
  const mime = proof.mimeType || "";
  if (mime.startsWith("image/")) {
    return `<div class="proof-preview"><img class="proof-preview-image" src="${url}" alt="${h(proof.fileName)}"></div>`;
  }
  if (mime.includes("pdf") || mime.startsWith("text/")) {
    return `<div class="proof-preview"><iframe class="proof-preview-frame" src="${url}" title="${h(proof.fileName)}"></iframe></div>`;
  }
  return `<div class="proof-preview proof-preview-file"><div class="proof-preview-file-label">当前文件类型不支持内嵌预览</div><div class="proof-preview-file-name">${h(
    proof.fileName
  )}</div></div>`;
}

function reviewSnapshot(goal) {
  return goal.reviewScore === null
    ? '<div class="review-empty">当前还没有评分记录。</div>'
    : `<div class="review-grid"><div class="review-score-box"><div class="review-score-label">工作态度</div><div class="review-score-value">${h(
        fmt(goal.attitudeScore)
      )}</div></div><div class="review-score-box"><div class="review-score-label">工作能力</div><div class="review-score-value">${h(
        fmt(goal.abilityScore)
      )}</div></div><div class="review-score-box"><div class="review-score-label">工作业绩</div><div class="review-score-value">${h(
        fmt(goal.performanceScore)
      )}</div></div><div class="review-score-box highlight"><div class="review-score-label">总分</div><div class="review-score-value">${h(
        fmt(goal.reviewScore)
      )}</div></div></div><div class="detail-copy detail-copy-spaced">${h(goal.reviewComment || "暂无评价意见")}</div>`;
}

function meta(text) {
  return `<span class="detail-meta-item">${h(text)}</span>`;
}

function kpi(label, value) {
  return `<div class="detail-kpi"><div class="detail-kpi-label">${h(label)}</div><div class="detail-kpi-value">${h(value)}</div></div>`;
}

function paperclipIcon() {
  return `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7.7 14.8a3.1 3.1 0 0 1 0-4.4l4.7-4.7a2.2 2.2 0 1 1 3.1 3.1l-5.1 5.1a4.3 4.3 0 0 1-6.1-6.1l5-5a5.5 5.5 0 0 1 7.8 7.8l-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function chevronIcon(expanded) {
  return expanded
    ? `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`
    : `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M8 5l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function trashIcon() {
  return `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6.5 6.5v8m3.5-8v8m3.5-8v8M4.5 5h11m-7.5-2h4l.8 2H7.2l.8-2Zm-1 14h6a1 1 0 0 0 1-1V5h-8v11a1 1 0 0 0 1 1Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function progress(value) {
  const done = clamp(num(value), 0, 100) >= 100;
  return `<span class="status-pill completion-pill ${done ? "done" : "pending"}">${done ? "已完成" : "未完成"}</span>`;
}

function status(value, kr) {
  return `<span class="status-pill ${h(value || "unknown")}">${h((kr ? KR_STATUS[value] : GOAL_STATUS[value]) || value || "-")}</span>`;
}

function avg(arr) {
  return arr.length ? arr.reduce((sum, value) => sum + num(value), 0) / arr.length : 0;
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function fmt(value) {
  const n = Math.round(num(value) * 10) / 10;
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function size(bytes) {
  const n = num(bytes);
  if (n >= 1048576) return `${fmt(n / 1048576)} MB`;
  if (n >= 1024) return `${fmt(n / 1024)} KB`;
  return `${fmt(n)} B`;
}

function h(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function openModal(id) {
  refs[id].classList.remove("hidden");
  document.body.classList.add("modal-open");
}

function closeModal(id) {
  refs[id].classList.add("hidden");
  if (id === "krModal") state.krReturnGoalId = "";
  const anyOpen = ["detailModal", "goalModal", "reviewModal", "krModal"].some((key) => !refs[key].classList.contains("hidden"));
  document.body.classList.toggle("modal-open", anyOpen);
}

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function exportGoals() {
  const goals = filteredGoals();
  if (!goals.length) return window.alert("当前没有可导出的目标数据。");
  const rows = [["层级", "编码", "名称", "季度", "员工", "科室", "进度", "状态", "分值", "总分", "资料数"]];
  goals.forEach((goal) => {
    rows.push([
      "目标",
      goal.code || "",
      goal.name || "",
      cycleLabel(goal.cycleId),
      userName(goal.ownerId),
      sectionOfGoal(goal),
      `${fmt(progressOfGoal(goal))}%`,
      GOAL_STATUS[goal.status] || goal.status || "",
      goal.points === null ? "" : fmt(goal.points),
      goal.reviewScore === null ? "" : fmt(goal.reviewScore),
      String(goalProofs(goal.id).length)
    ]);
    goalKrs(goal.id).forEach((kr) => {
      rows.push([
        "KR",
        kr.code || "",
        kr.name || "",
        cycleLabel(goal.cycleId),
        userName(goal.ownerId),
        sectionOfGoal(goal),
        krCompletionText(kr),
        KR_STATUS[kr.status] || kr.status || "",
        kr.points === null ? "" : fmt(kr.points),
        kr.score === null ? "" : fmt(kr.score),
        String(krProofs(kr.id).length)
      ]);
    });
  });
  downloadCsv(`okr-goals-${state.cycleId}.csv`, rows);
}

function exportSummary() {
  const rows = summaryRows(filteredGoals());
  if (!rows.length) return window.alert("当前没有可导出的汇总数据。");
  downloadCsv(`okr-summary-${state.cycleId}.csv`, [
    ["员工", "科室", "目标数", "KR数", "平均进度", "已评分", "平均得分"],
    ...rows.map((r) => [r.owner, r.section, String(r.goalCount), String(r.krCount), `${fmt(r.progress)}%`, String(r.reviewed), r.score === null ? "" : fmt(r.score)])
  ]);
}

function downloadCsv(name, rows) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}

async function apiGet(url) {
  return request(url, { method: "GET" });
}

async function apiPost(url, body) {
  return request(url, { method: "POST", body: JSON.stringify(body) });
}

async function apiPut(url, body) {
  return request(url, { method: "PUT", body: JSON.stringify(body) });
}

async function apiDelete(url) {
  return request(url, { method: "DELETE" });
}

async function request(url, options) {
  try {
    const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...options });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      window.alert(data.error || `Request failed: ${res.status}`);
      return null;
    }
    return data;
  } catch (error) {
    window.alert(error.message || "请求失败");
    return null;
  }
}
function renderKrDrafts() {
  const draft = ensureCreateGoalDraft();
  const krCount = goalDraftKrCount(draft);
  const goalPoints = draftGoalPoints(draft);

  refs.krDraftList.innerHTML = `<div class="goal-draft-kr-shell goal-create-kr-shell goal-create-panel">
    <div class="goal-draft-kr-header goal-create-panel-head">
      <div>
        <div class="goal-draft-kr-title"><span class="goal-create-kr-badge soft">KR</span>关键结果</div>
        <div class="goal-draft-kr-subtitle">已添加 ${krCount} 条 KR，目标分值会按下方 KR 自动汇总，默认新增 KR 为未完成。</div>
      </div>
      <div class="goal-create-panel-meta">
        <div class="goal-create-total" data-goal-draft-points="0">分值 ${fmt(goalPoints)}</div>
      </div>
    </div>
    <div class="goal-draft-kr-list goal-create-kr-list">
      ${(draft.krs || []).length
        ? (draft.krs || []).map((kr, krIndex) => goalDraftKrCard(kr, 0, krIndex)).join("")
        : '<div class="proof-empty">当前还没有 KR，可以继续新增。</div>'}
    </div>
  </div>`;
}

function periodHelpers() {
  return globalThis.PeriodUtils || {};
}

function currentDateParts(now) {
  const helpers = periodHelpers();
  if (typeof helpers.computeDefaultCycleParts === "function") return helpers.computeDefaultCycleParts(now);
  const date = now ? new Date(now) : new Date();
  return { year: date.getFullYear(), quarter: Math.floor(date.getMonth() / 3) + 1 };
}

function currentCycleId(now) {
  const helpers = periodHelpers();
  if (typeof helpers.currentCycleId === "function") return helpers.currentCycleId(now);
  const current = currentDateParts(now);
  return `${current.year}-Q${current.quarter}`;
}

function parseCycleId(id) {
  const helpers = periodHelpers();
  if (typeof helpers.parseCycleId === "function") return helpers.parseCycleId(id);
  const match = /^(\d{4})-Q([1-4])$/.exec(id || "");
  if (!match) return null;
  return { year: Number(match[1]), quarter: Number(match[2]) };
}

function quarterChoices() {
  const helpers = periodHelpers();
  if (typeof helpers.quarterChoices === "function") return helpers.quarterChoices();
  return [
    { value: 1, label: "一季度" },
    { value: 2, label: "二季度" },
    { value: 3, label: "三季度" },
    { value: 4, label: "四季度" }
  ];
}

function formatCycleLabel(id) {
  const helpers = periodHelpers();
  if (typeof helpers.formatCycleLabel === "function") return helpers.formatCycleLabel(id);
  const parsed = parseCycleId(id);
  if (!parsed) return "-";
  const quarter = quarterChoices().find((item) => item.value === parsed.quarter)?.label || `${parsed.quarter}季度`;
  return `${parsed.year}年${quarter}`;
}

function availableCycleOptions() {
  const helpers = periodHelpers();
  if (typeof helpers.availableCycleOptions === "function") {
    return helpers.availableCycleOptions(cycles(), {
      now: new Date(),
      startYear: helpers.START_YEAR || 2026,
      futureYears: helpers.DEFAULT_FUTURE_YEARS || 5
    });
  }
  return cycles();
}

function availableYears() {
  const helpers = periodHelpers();
  if (typeof helpers.availableYears === "function") {
    return helpers.availableYears(cycles(), {
      now: new Date(),
      startYear: helpers.START_YEAR || 2026,
      futureYears: helpers.DEFAULT_FUTURE_YEARS || 5
    });
  }
  return [];
}

function periodPickerRefs() {
  return {
    toolbar: document.querySelector(".topbar .toolbar"),
    picker: document.getElementById("periodPicker"),
    trigger: document.getElementById("periodTrigger"),
    triggerValue: document.getElementById("periodTriggerValue"),
    popover: document.getElementById("periodPopover"),
    prevYear: document.getElementById("periodPrevYear"),
    nextYear: document.getElementById("periodNextYear"),
    yearLabel: document.getElementById("periodPopoverYearLabel"),
    yearRail: document.getElementById("periodYearRail"),
    quarterGrid: document.getElementById("periodQuarterGrid")
  };
}

function ensureToolbarShell() {
  const toolbar = document.querySelector(".topbar .toolbar");
  if (!toolbar || toolbar.dataset.periodEnhanced === "true") return;

  const mainRow = document.createElement("div");
  mainRow.className = "toolbar-main-row";
  const actionRow = document.createElement("div");
  actionRow.className = "toolbar-action-row";
  const actions = document.createElement("div");
  actions.className = "toolbar-actions";
  const hiddenCycles = document.createElement("div");
  hiddenCycles.className = "toolbar-cycle-group hidden";

  const picker = document.createElement("div");
  picker.id = "periodPicker";
  picker.className = "period-picker";
  picker.innerHTML = `<button id="periodTrigger" class="period-trigger" type="button" aria-expanded="false" aria-haspopup="true">
      <span class="period-trigger-copy">
        <span class="period-trigger-label">当前周期</span>
        <strong id="periodTriggerValue">2026年一季度</strong>
      </span>
      <span class="period-trigger-icon">⌄</span>
    </button>
    <div id="periodPopover" class="period-popover hidden">
      <div class="period-popover-head">
        <button id="periodPrevYear" class="period-nav-button" type="button" aria-label="上一年">‹</button>
        <strong id="periodPopoverYearLabel">2026年</strong>
        <button id="periodNextYear" class="period-nav-button" type="button" aria-label="下一年">›</button>
      </div>
      <div id="periodYearRail" class="period-year-rail"></div>
      <div id="periodQuarterGrid" class="period-quarter-grid"></div>
    </div>`;

  if (refs.searchInput) mainRow.append(refs.searchInput);
  mainRow.append(picker);

  if (refs.statusFilter) actionRow.append(refs.statusFilter);
  [refs.exportGoalsButton, refs.exportSummaryButton, refs.newGoalButton]
    .filter(Boolean)
    .forEach((button) => actions.append(button));
  actionRow.append(actions);

  [refs.yearFilter, refs.quarterFilter, refs.cycleFilter].filter(Boolean).forEach((node) => hiddenCycles.append(node));
  toolbar.replaceChildren(mainRow, actionRow, hiddenCycles);
  toolbar.dataset.periodEnhanced = "true";
}

function closePeriodPopover() {
  const { trigger, popover } = periodPickerRefs();
  if (trigger) trigger.setAttribute("aria-expanded", "false");
  if (popover) popover.classList.add("hidden");
}

function togglePeriodPopover(forceOpen) {
  const { trigger, popover } = periodPickerRefs();
  if (!trigger || !popover) return;
  const shouldOpen = typeof forceOpen === "boolean" ? forceOpen : popover.classList.contains("hidden");
  popover.classList.toggle("hidden", !shouldOpen);
  trigger.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
  if (shouldOpen) renderPeriodPopover();
}

function ensurePeriodPickerBound() {
  const { toolbar, picker, trigger, popover, prevYear, nextYear, yearRail, quarterGrid } = periodPickerRefs();
  if (!toolbar || !picker || toolbar.dataset.periodPickerBound === "true") return;

  trigger?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    togglePeriodPopover();
  });

  prevYear?.addEventListener("click", (event) => {
    event.preventDefault();
    const years = availableYears();
    const lastYear = years.at(-1);
    if (!years.length) return;
    state.periodPickerYear = Math.max(lastYear, (state.periodPickerYear || years[0]) - 1);
    renderPeriodPopover();
  });

  nextYear?.addEventListener("click", (event) => {
    event.preventDefault();
    const years = availableYears();
    const firstYear = years[0];
    if (!years.length) return;
    state.periodPickerYear = Math.min(firstYear, (state.periodPickerYear || years[0]) + 1);
    renderPeriodPopover();
  });

  yearRail?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-period-year]");
    if (!button) return;
    state.periodPickerYear = Number(button.dataset.periodYear);
    renderPeriodPopover();
  });

  quarterGrid?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-period-quarter]");
    if (!button) return;
    const year = Number(button.dataset.periodYear);
    const quarter = Number(button.dataset.periodQuarter);
    if (Number.isNaN(year) || Number.isNaN(quarter)) return;
    if (refs.yearFilter) refs.yearFilter.value = String(year);
    if (refs.quarterFilter) refs.quarterFilter.value = String(quarter);
    syncCycleFilterFromToolbar();
    closePeriodPopover();
  });

  document.addEventListener("click", (event) => {
    const current = periodPickerRefs().picker;
    if (!current || current.contains(event.target)) return;
    closePeriodPopover();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closePeriodPopover();
  });

  toolbar.dataset.periodPickerBound = "true";
}

function renderPeriodPopover() {
  const { popover, prevYear, nextYear, yearLabel, yearRail, quarterGrid } = periodPickerRefs();
  if (!popover || !yearRail || !quarterGrid) return;

  const years = availableYears();
  const selected = parseCycleId(state.cycleId) || currentDateParts();
  const firstYear = years[0] || selected.year;
  const lastYear = years.at(-1) || selected.year;
  const viewingYear = Math.min(firstYear, Math.max(lastYear, state.periodPickerYear || selected.year));
  state.periodPickerYear = viewingYear;

  if (yearLabel) yearLabel.textContent = `${viewingYear}年`;
  if (prevYear) prevYear.disabled = viewingYear >= firstYear;
  if (nextYear) nextYear.disabled = viewingYear <= lastYear;

  yearRail.innerHTML = years
    .map((year) => `<button class="period-year-chip${year === viewingYear ? " active" : ""}${year === selected.year ? " is-selected" : ""}" type="button" data-period-year="${year}">${year}</button>`)
    .join("");

  quarterGrid.innerHTML = quarterChoices()
    .map((quarter) => {
      const active = selected.year === viewingYear && selected.quarter === quarter.value;
      return `<button class="period-quarter-chip${active ? " active" : ""}" type="button" data-period-year="${viewingYear}" data-period-quarter="${quarter.value}">
          <span class="period-quarter-code">Q${quarter.value}</span>
          <strong>${h(quarter.label)}</strong>
        </button>`;
    })
    .join("");

  const activeYear = yearRail.querySelector(".period-year-chip.active");
  activeYear?.scrollIntoView({ block: "nearest", inline: "center" });
}

function renderPeriodPicker() {
  const { triggerValue } = periodPickerRefs();
  const selected = parseCycleId(state.cycleId) || currentDateParts();
  state.periodPickerYear = selected.year;
  if (triggerValue) triggerValue.textContent = formatCycleLabel(state.cycleId);
  renderPeriodPopover();
}

function syncCycleFilterFromToolbar() {
  const year = refs.yearFilter?.value;
  const quarter = refs.quarterFilter?.value;
  if (!year || !quarter) return;
  state.cycleId = `${year}-Q${quarter}`;
  if (refs.cycleFilter) refs.cycleFilter.value = state.cycleId;
  render();
}

function renderShell() {
  const cycleOptions = availableCycleOptions();
  const selectedCycle = parseCycleId(state.cycleId) || currentDateParts();

  refs.userSwitcher.innerHTML = users(true)
    .map((u) => `<option value="${h(u.id)}">${h(u.name)} · ${h(roleMeta(u.role).label)}</option>`)
    .join("");
  refs.userSwitcher.value = state.currentUser.id;
  refs.portalBadge.textContent = roleMeta().label;
  refs.navList.innerHTML = '<button class="nav-item active" type="button">我的 OKR</button>';
  refs.sectionTitle.textContent = "我的 OKR";
  refs.currentUserText.textContent = [
    roleMeta().label,
    state.currentUser.name,
    sectionName(state.currentUser.sectionId) !== "-" ? sectionName(state.currentUser.sectionId) : deptName(state.currentUser.departmentId),
    roleMeta().scope
  ].join(" · ");

  if (refs.cycleFilter) {
    refs.cycleFilter.innerHTML = cycleOptions.map((cycle) => `<option value="${h(cycle.id)}">${h(cycle.label)}</option>`).join("");
    refs.cycleFilter.value = state.cycleId;
  }
  if (refs.yearFilter) {
    refs.yearFilter.innerHTML = availableYears().map((year) => `<option value="${year}">${year}年</option>`).join("");
    refs.yearFilter.value = String(selectedCycle.year);
  }
  if (refs.quarterFilter) {
    refs.quarterFilter.innerHTML = quarterChoices().map((quarter) => `<option value="${quarter.value}">${quarter.label}</option>`).join("");
    refs.quarterFilter.value = String(selectedCycle.quarter);
  }

  ensureToolbarShell();
  ensurePeriodPickerBound();
  renderPeriodPicker();
  refs.newGoalButton.classList.toggle("hidden", state.currentUser.role !== "employee");
}

function openGoalModal(mode, goalId = "") {
  if (state.currentUser.role !== "employee") return;

  refs.goalForm.reset();
  refs.goalModal.dataset.mode = mode;
  fillGoalFormOptions();
  refs.goalFormMode.value = mode;
  refs.goalFormGoalId.value = goalId;
  refs.goalDepartment.disabled = true;
  refs.goalOwner.disabled = true;
  refs.goalCycle.disabled = mode === "edit";
  refs.goalProofSection.classList.add("hidden");
  refs.goalKrList.classList.add("hidden");
  refs.goalKrActions.classList.add("hidden");
  refs.goalEditSection.classList.toggle("hidden", mode !== "edit");
  refs.goalKrSection.classList.remove("hidden");
  refs.krDraftList.classList.toggle("hidden", mode !== "create");
  refs.addKrRowButton.classList.toggle("hidden", mode !== "create");
  refs.saveDraftButton.classList.remove("hidden");
  refs.goalProofUploadHint.classList.add("hidden");
  refs.goalProofUploadHint.textContent = "";

  const goalParentField = refs.goalParent.closest("label") || document.getElementById("goalParentField");
  refs.goalName.closest("label")?.classList.remove("hidden");
  refs.goalPoints.closest("label")?.classList.add("hidden");
  refs.goalDescription.closest("label")?.classList.toggle("hidden", mode === "create");
  goalParentField?.classList.toggle("hidden", mode !== "create");
  refs.goalParent.disabled = mode !== "create";
  refs.goalEditStatus.closest("label")?.classList.add("hidden");
  refs.goalEditProgress.closest("label")?.classList.add("hidden");

  const goalKrTitle = refs.goalKrSection.querySelector(".modal-section-title");
  if (goalKrTitle) {
    goalKrTitle.textContent = mode === "create" ? "KR 关键结果" : "当前 KR";
  }

  if (mode === "create") {
    state.goalDrafts = [blankGoalDraft()];
    refs.goalModalTitle.textContent = "新建目标";
    refs.goalSubmitButton.textContent = "确定";
    refs.saveDraftButton.textContent = "保存为草稿";
    refs.goalType.value = "personal";
    refs.goalDepartment.value = state.currentUser.departmentId;
    refs.goalOwner.value = state.currentUser.id;
    refs.goalCycle.value = state.cycleId;
    refs.goalParent.value = "";
    fillGoalParentOptions("", refs.goalCycle.value);
    refs.addKrRowButton.textContent = "+ 新增 KR";
    refs.goalKrHint.textContent = "先填写目标基础信息，再补充关键结果；目标分值会按下方 KR 自动汇总。";
    renderKrDrafts();
    openModal("goalModal");
    return;
  }

  const goal = getGoal(goalId);
  if (!goal || !canEdit(goal)) return;

  refs.goalModalTitle.textContent = "编辑目标 O";
  refs.goalSubmitButton.textContent = goal.status === "draft" ? "保存并确认" : "保存修改";
  refs.saveDraftButton.textContent = "保存草稿";
  refs.goalName.value = goal.name || "";
  refs.goalType.value = goal.type || "personal";
  refs.goalDepartment.value = goal.departmentId;
  refs.goalOwner.value = goal.ownerId;
  refs.goalCycle.value = goal.cycleId;
  refs.goalParent.value = goal.parentId || "";
  refs.goalPoints.value = goal.points === null ? "" : String(goal.points);
  refs.goalDescription.value = goal.description || "";
  refs.goalEditStatus.innerHTML = goalStatusOptions(goal.status);
  refs.goalEditStatus.value = goal.status === "draft" ? "confirmed" : goal.status;
  refs.goalEditStatus.disabled = goal.status !== "draft";
  refs.goalEditProgress.value = goal.manualProgress === null ? "" : String(goal.manualProgress);
  refs.goalEditSummary.value = goal.summary || "";
  refs.saveDraftButton.classList.toggle("hidden", goal.status !== "draft");
  refs.goalKrList.innerHTML = goalModalKrCards(goal);
  refs.goalKrList.classList.remove("hidden");
  refs.goalKrActions.classList.remove("hidden");
  refs.openAddKrButton.textContent = "+ 新增 KR";
  refs.goalKrHint.textContent = "这里可以直接新增和维护 KR，目标分值会按当前 KR 分值自动汇总。";
  openModal("goalModal");
}

async function saveGoal(saveAsDraft) {
  if (refs.goalFormMode.value === "create") {
    const payload = collectCreateGoalPayload(saveAsDraft);

    if (!payload.name || !payload.departmentId || !payload.ownerId || !payload.cycleId) {
      return window.alert("请先填写目标名称，并确认当前负责人和已选周期后再提交。");
    }

    const currentTotal = ownerCycleGoalTotal(payload.ownerId, payload.cycleId);
    const proposedTotal = projectedOwnerCycleGoalTotal(payload.ownerId, payload.cycleId, payload.points);

    if (saveAsDraft) {
      if (!validateDraftGoalPointMutation(currentTotal, proposedTotal)) return;
    } else if (!isHundredPointPlan(proposedTotal)) {
      return window.alert(`当前季度所有 O 的分值合计必须为 100 分，当前为 ${fmt(proposedTotal)} 分。`);
    }

    const res = await apiPost("/api/goals", payload);
    if (!res?.store) return;
    closeModal("goalModal");
    applyStore(res.store, false, res.goal?.id || "");
    return;
  }

  const goalId = refs.goalFormGoalId.value;
  const goal = getGoal(goalId);
  if (!goal || !canEdit(goal)) return;

  if (!saveAsDraft && goal.status === "draft") {
    const totalPoints = ownerCycleGoalTotal(goal.ownerId, goal.cycleId);
    if (!isHundredPointPlan(totalPoints)) {
      return window.alert(`当前季度所有 O 的分值合计必须为 100 分，当前为 ${fmt(totalPoints)} 分。`);
    }
  }

  const nextStatus = saveAsDraft ? "draft" : "confirmed";
  const res = await apiPut(`/api/goals/${goalId}`, {
    name: refs.goalName.value.trim(),
    type: refs.goalType.value,
    description: refs.goalDescription.value.trim(),
    manualProgress: goal.manualProgress === null ? "" : goal.manualProgress,
    summary: refs.goalEditSummary.value.trim(),
    status: nextStatus
  });
  if (!res?.store) return;
  closeModal("goalModal");
  applyStore(res.store, false, goalId);
}

function onKrDraftInput(e) {
  const goalIndex = Number(e.target.dataset.goalIndex);
  if (Number.isNaN(goalIndex) || !state.goalDrafts[goalIndex]) return;

  const krIndex = Number(e.target.dataset.krIndex);
  const krField = e.target.dataset.krField;
  if (Number.isNaN(krIndex) || !krField || !state.goalDrafts[goalIndex].krs?.[krIndex]) return;

  state.goalDrafts[goalIndex].krs[krIndex][krField] = e.target.value;
  if (krField === "points") {
    const pointsChip = refs.krDraftList.querySelector('[data-goal-draft-points="0"]');
    if (pointsChip) {
      pointsChip.textContent = `分值 ${fmt(draftGoalPoints(state.goalDrafts[goalIndex]))}`;
    }
  }
}

function onKrDraftClick(e) {
  const btn = e.target.closest("[data-goal-draft-act]");
  if (!btn) return;

  const goalIndex = Number(btn.dataset.goalIndex);
  const draft = state.goalDrafts[goalIndex];
  if (Number.isNaN(goalIndex) || !draft) return;

  if (btn.dataset.goalDraftAct === "add-kr") {
    draft.krs = [...(draft.krs || []), blankKr()];
    renderKrDrafts();
    return;
  }

  if (btn.dataset.goalDraftAct === "toggle-kr") {
    const krIndex = Number(btn.dataset.krIndex);
    if (Number.isNaN(krIndex) || !draft.krs?.[krIndex]) return;
    draft.krs[krIndex].expanded = draft.krs[krIndex].expanded === false;
    renderKrDrafts();
    return;
  }

  if (btn.dataset.goalDraftAct === "delete-goal") {
    state.goalDrafts = [blankGoalDraft()];
    renderKrDrafts();
    return;
  }

  if (btn.dataset.goalDraftAct === "delete-kr") {
    const krIndex = Number(btn.dataset.krIndex);
    if (Number.isNaN(krIndex) || !draft.krs?.[krIndex]) return;
    draft.krs.splice(krIndex, 1);
    if (!draft.krs.length) draft.krs = [blankKr()];
    renderKrDrafts();
  }
}

async function saveKr() {
  const goalId = refs.singleKrGoalId.value;
  const goal = getGoal(goalId);
  if (!goal) return;

  const payload = {
    name: refs.singleKrName.value.trim(),
    metricType: "milestone",
    progress: refs.singleKrCompletion.value === "done" ? 100 : 0,
    points: refs.singleKrPoints.value,
    description: refs.singleKrDescription.value.trim()
  };
  if (!payload.name) return window.alert("请输入 KR 名称。");

  const proposedGoalPoints = projectedGoalPointsAfterKrChange(
    goalId,
    payload.points,
    refs.singleKrFormMode.value === "create" ? "" : refs.singleKrId.value
  );
  if (!validateGoalPointMutation(goalId, proposedGoalPoints)) return;

  const res =
    refs.singleKrFormMode.value === "create"
      ? await apiPost(`/api/goals/${goalId}/krs`, payload)
      : await apiPut(`/api/krs/${refs.singleKrId.value}`, payload);
  if (!res?.store) return;
  applyStore(res.store, false, goalId);
  if (refs.singleKrFormMode.value === "create" && res.kr?.id) {
    openKrModal("detail", goalId, res.kr.id, false);
    return;
  }
  openKrModal("detail", goalId, refs.singleKrId.value, false);
}

async function saveInlineKr(krId, reopen = "detail") {
  const kr = getKr(krId);
  if (!kr) return;

  const payload = inlineKrPayload(krId);
  if (!payload.name) return window.alert("请输入 KR 名称。");

  const proposedGoalPoints = projectedGoalPointsAfterKrChange(kr.goalId, payload.points, krId);
  if (!validateGoalPointMutation(kr.goalId, proposedGoalPoints)) return;

  const res = await apiPut(`/api/krs/${krId}`, payload);
  if (!res?.store) return;
  applyStore(res.store, false, kr.goalId);
  if (reopen === "goal-modal") {
    openGoalModal("edit", kr.goalId);
    scrollGoalModalKrCard(`[data-goal-modal-kr-card="${krId}"]`);
    return;
  }
  openGoalDetail(kr.goalId);
}

async function saveNewInlineKr(goalId, reopen = "detail") {
  const payload = inlineKrPayload(`new-${goalId}`);
  if (!payload.name) return window.alert("请输入 KR 名称。");

  const proposedGoalPoints = projectedGoalPointsAfterKrChange(goalId, payload.points);
  if (!validateGoalPointMutation(goalId, proposedGoalPoints)) return;

  const res = await apiPost(`/api/goals/${goalId}/krs`, payload);
  if (!res?.store) return;
  applyStore(res.store, false, goalId);
  if (reopen === "goal-modal") {
    openGoalModal("edit", goalId);
    if (res.kr?.id) {
      scrollGoalModalKrCard(`[data-goal-modal-kr-card="${res.kr.id}"]`);
    } else {
      scrollGoalModalKrCard(`[data-goal-modal-new-kr="${goalId}"]`);
    }
    return;
  }
  openGoalDetail(goalId);
}

function currentDateParts() {
  const now = new Date();
  return { year: now.getFullYear(), quarter: Math.floor(now.getMonth() / 3) + 1 };
}

function currentCycleId() {
  const current = currentDateParts();
  return `${current.year}-Q${current.quarter}`;
}

function parseCycleId(id) {
  const match = /^(\d{4})-Q([1-4])$/.exec(id || "");
  if (!match) return null;
  return { year: Number(match[1]), quarter: Number(match[2]) };
}

function quarterChoices() {
  return [
    { value: 1, label: "一季度" },
    { value: 2, label: "二季度" },
    { value: 3, label: "三季度" },
    { value: 4, label: "四季度" }
  ];
}

function formatCycleLabel(id) {
  const parsed = parseCycleId(id);
  if (!parsed) return "-";
  const quarter = quarterChoices().find((item) => item.value === parsed.quarter)?.label || `${parsed.quarter}季度`;
  return `${parsed.year}年${quarter}`;
}

function availableCycleOptions() {
  const { year } = currentDateParts();
  const map = new Map();

  for (let y = year - 4; y <= year + 5; y += 1) {
    quarterChoices().forEach((quarter) => {
      const id = `${y}-Q${quarter.value}`;
      map.set(id, { id, label: formatCycleLabel(id), status: id === currentCycleId() ? "active" : "" });
    });
  }

  cycles().forEach((cycle) => {
    map.set(cycle.id, { id: cycle.id, label: cycle.label || formatCycleLabel(cycle.id), status: cycle.status || "" });
  });

  return [...map.values()].sort((a, b) => {
    const left = parseCycleId(a.id);
    const right = parseCycleId(b.id);
    if (!left || !right) return String(b.id || "").localeCompare(String(a.id || ""), "zh-CN", { numeric: true });
    if (left.year !== right.year) return right.year - left.year;
    return right.quarter - left.quarter;
  });
}

function availableYears() {
  return [...new Set(availableCycleOptions().map((cycle) => parseCycleId(cycle.id)?.year).filter(Boolean))].sort((a, b) => b - a);
}

function syncCycleFilterFromToolbar() {
  const year = refs.yearFilter?.value;
  const quarter = refs.quarterFilter?.value;
  if (!year || !quarter) return;
  state.cycleId = `${year}-Q${quarter}`;
  refs.cycleFilter.value = state.cycleId;
  render();
}

function normalizeKrCopy(text) {
  return String(text || "")
    .replaceAll("关键结果 KR", "关键结果")
    .replaceAll("KR 关键结果", "关键结果")
    .replaceAll("当前 KR", "当前关键结果")
    .replaceAll("新增 KR", "新增关键结果")
    .replaceAll("保存 KR 修改", "保存关键结果修改")
    .replaceAll("保存 KR", "保存关键结果")
    .replaceAll("创建 KR", "创建关键结果")
    .replaceAll("编辑 KR", "编辑关键结果")
    .replaceAll("维护 KR", "维护关键结果")
    .replaceAll("查看 KR", "查看关键结果")
    .replaceAll("KR 维护", "关键结果维护")
    .replaceAll("KR 证明材料", "关键结果证明材料")
    .replaceAll("上传 KR 证明材料", "上传关键结果证明材料")
    .replaceAll("归属 KR：", "归属关键结果：")
    .replaceAll("该 KR", "该关键结果")
    .replaceAll("从 KR", "从关键结果")
    .replaceAll("条 KR", "条关键结果")
    .replaceAll("KR 数", "关键结果数")
    .replaceAll("KR名称", "关键结果名称")
    .replaceAll("KR 名称", "关键结果名称")
    .replace(/\bKR\b/g, "关键结果");
}

function syncUiLabels() {
  if (refs.searchInput) refs.searchInput.placeholder = "搜索目标、关键结果、员工、科室";
  if (refs.newGoalButton) refs.newGoalButton.textContent = "+ 新建目标";

  const goalColHeader = document.querySelector("th.goal-col");
  if (goalColHeader) goalColHeader.textContent = "目标 / 关键结果";

  const textWalker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || !node.nodeValue || !node.nodeValue.includes("KR")) return NodeFilter.FILTER_REJECT;
      if (parent.closest("script, style")) return NodeFilter.FILTER_REJECT;
      if (parent.closest(".goal-row.kr-row .goal-chip.kr")) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  const textNodes = [];
  while (textWalker.nextNode()) textNodes.push(textWalker.currentNode);
  textNodes.forEach((node) => {
    node.nodeValue = normalizeKrCopy(node.nodeValue);
  });

  document.querySelectorAll("[placeholder],[title]").forEach((el) => {
    if (el.closest(".goal-row.kr-row .goal-chip.kr")) return;
    if (el.hasAttribute("placeholder")) {
      const placeholder = el.getAttribute("placeholder");
      if (placeholder?.includes("KR")) el.setAttribute("placeholder", normalizeKrCopy(placeholder));
    }
    if (el.hasAttribute("title")) {
      const title = el.getAttribute("title");
      if (title?.includes("KR")) el.setAttribute("title", normalizeKrCopy(title));
    }
  });
}

function applyStore(store, resetExpanded = false, expandGoalId = "") {
  state.store = store;
  state.currentUser = users(true).find((u) => u.id === store.settings.currentUserId) || null;
  if (!parseCycleId(state.cycleId)) {
    state.cycleId = currentCycleId();
  }
  state.expanded = resetExpanded
    ? new Set(store.goals.map((g) => g.id))
    : new Set([...state.expanded].filter((id) => store.goals.some((g) => g.id === id)));
  if (expandGoalId) state.expanded.add(expandGoalId);
  render();
}

function renderShell() {
  const cycleOptions = availableCycleOptions();
  const selectedCycle = parseCycleId(state.cycleId) || currentDateParts();

  refs.userSwitcher.innerHTML = users(true)
    .map((u) => `<option value="${h(u.id)}">${h(u.name)} 路 ${h(roleMeta(u.role).label)}</option>`)
    .join("");
  refs.userSwitcher.value = state.currentUser.id;
  refs.portalBadge.textContent = roleMeta().label;
  refs.navList.innerHTML = '<button class="nav-item active" type="button">我的 OKR</button>';
  refs.sectionTitle.textContent = "我的 OKR";
  refs.currentUserText.textContent = [
    roleMeta().label,
    state.currentUser.name,
    sectionName(state.currentUser.sectionId) !== "-" ? sectionName(state.currentUser.sectionId) : deptName(state.currentUser.departmentId),
    roleMeta().scope
  ].join(" 路 ");
  refs.cycleFilter.innerHTML = cycleOptions
    .map((cycle) => `<option value="${h(cycle.id)}">${h(cycle.label)}${cycle.id === currentCycleId() ? "（当前）" : ""}</option>`)
    .join("");
  refs.cycleFilter.value = state.cycleId;
  refs.yearFilter.innerHTML = availableYears().map((year) => `<option value="${year}">${year}年</option>`).join("");
  refs.quarterFilter.innerHTML = quarterChoices().map((quarter) => `<option value="${quarter.value}">${quarter.label}</option>`).join("");
  refs.yearFilter.value = String(selectedCycle.year);
  refs.quarterFilter.value = String(selectedCycle.quarter);
  refs.newGoalButton.classList.toggle("hidden", state.currentUser.role !== "employee");
}

function fillGoalFormOptions() {
  refs.goalType.innerHTML = GOAL_TYPES.map((t) => `<option value="${h(t.value)}">${h(t.label)}</option>`).join("");
  refs.goalDepartment.innerHTML = depts().map((d) => `<option value="${h(d.id)}">${h(d.name)}</option>`).join("");
  refs.goalOwner.innerHTML = `<option value="${h(state.currentUser.id)}">${h(state.currentUser.name)}</option>`;
  refs.goalCycle.innerHTML = availableCycleOptions().map((cycle) => `<option value="${h(cycle.id)}">${h(cycle.label)}</option>`).join("");
  refs.goalCycle.value = state.cycleId;
  fillGoalParentOptions("", refs.goalCycle.value || state.cycleId);
}

function renderTable() {
  const goals = filteredGoals();
  const krCount = goals.reduce((sum, goal) => sum + goalKrs(goal.id).length, 0);
  refs.tableSubtitle.textContent = `共 ${goals.length} 条目标，${krCount} 条关键结果`;
  refs.emptyState.classList.toggle("hidden", !!goals.length);
  refs.goalRows.innerHTML = goals
    .flatMap((goal) => {
      const rows = [goalRow(goal)];
      if (state.expanded.has(goal.id)) {
        goalKrs(goal.id).forEach((kr) => rows.push(krRow(goal, kr)));
      }
      return rows;
    })
    .join("");
}

function krRow(goal, kr) {
  const proofCount = krProofs(kr.id).length;
  return `<tr class="goal-row kr-row">
    <td class="goal-col"><div class="goal-cell goal-cell-kr"><span class="tree-toggle placeholder">•</span><span class="goal-chip kr">${h(
      kr.code
    )}</span><div class="goal-main"><div class="goal-main-line"><button class="goal-name-button" type="button" data-act="detail-kr" data-kr-id="${h(
      kr.id
    )}">${h(kr.name)}</button></div></div></div></td>
    <td>${h(cycleLabel(goal.cycleId))}</td><td>${h(userName(goal.ownerId))}</td><td>${h(sectionOfGoal(goal))}</td><td>${krProgressCell(
      kr
    )}</td><td>${status(goal.status, false)}</td><td>${h(kr.points === null ? "-" : fmt(kr.points))}</td><td><button class="table-count-button" type="button" data-act="view-kr-proofs" data-kr-id="${h(
      kr.id
    )}" title="查看上传文件">${proofCount}</button></td>
    <td></td><td></td>
  </tr>`;
}

function cycleLabel(id) {
  return cycles().find((cycle) => cycle.id === id)?.label || formatCycleLabel(id);
}

function openModal(id) {
  refs[id].classList.remove("hidden");
  document.body.classList.add("modal-open");
  syncUiLabels();
}

function reviewGroupForUser(userId) {
  const configuredGroups = Object.keys(state.store?.settings?.reviewGradeConfig?.groups || {}).filter(Boolean);
  const fallbackGroup = configuredGroups.includes("综合组") ? "综合组" : configuredGroups[0] || "综合组";
  const user = getUser(userId) || {};
  if (user.reviewGroup) return user.reviewGroup;
  if (!user.sectionId) return fallbackGroup;
  const section = (state.store?.sections || []).find((item) => item.id === user.sectionId);
  if (section?.reviewGroup) return section.reviewGroup;
  return fallbackGroup;
}

function reviewGroupOptions(selectedValue = "") {
  const groups = Object.keys(state.store?.settings?.reviewGradeConfig?.groups || {}).filter(Boolean);
  const orderedGroups = groups.length ? groups : ["运营组", "信息化组", "综合组"];
  return orderedGroups
    .map((group) => `<option value="${h(group)}" ${group === selectedValue ? "selected" : ""}>${h(group)}</option>`)
    .join("");
}

function fillGoalReviewGroupField(userId = state.currentUser?.id) {
  const select = document.getElementById("goalReviewGroup");
  if (!select) return;
  const value = reviewGroupForUser(userId);
  select.innerHTML = reviewGroupOptions(value);
  select.value = value;
}

function fillGoalFormOptions() {
  refs.goalType.innerHTML = '<option value="personal">个人</option>';
  refs.goalType.value = "personal";
  refs.goalDepartment.innerHTML = depts().map((dept) => `<option value="${h(dept.id)}">${h(dept.name)}</option>`).join("");
  refs.goalOwner.innerHTML = `<option value="${h(state.currentUser.id)}">${h(state.currentUser.name)}</option>`;
  refs.goalCycle.innerHTML = availableCycleOptions().map((cycle) => `<option value="${h(cycle.id)}">${h(cycle.label)}</option>`).join("");
  refs.goalCycle.value = state.cycleId;
  if (refs.goalParent) refs.goalParent.innerHTML = '<option value="">无</option>';
  fillGoalReviewGroupField(state.currentUser.id);
}

function goalDraftKrCard(kr, goalIndex, krIndex) {
  const expanded = kr.expanded !== false;
  return `<div class="goal-create-kr-item ${expanded ? "is-expanded" : ""}">
    <div class="goal-create-kr-head">
      <button class="goal-create-kr-toggle" type="button" data-goal-draft-act="toggle-kr" data-goal-index="${goalIndex}" data-kr-index="${krIndex}" title="${
        expanded ? "收起" : "展开"
      }">${chevronIcon(expanded)}</button>
      <span class="goal-create-kr-badge">KR</span>
      <div class="goal-create-kr-inline">
        <input class="goal-create-kr-title-input" data-goal-index="${goalIndex}" data-kr-index="${krIndex}" data-kr-field="name" type="text" value="${h(
          kr.name || ""
        )}" placeholder="请输入KR">
        <label class="goal-create-kr-points">
          <span>分值</span>
          <input data-goal-index="${goalIndex}" data-kr-index="${krIndex}" data-kr-field="points" type="number" min="0" step="0.1" value="${h(
            kr.points === null || kr.points === undefined ? "" : String(kr.points)
          )}" placeholder="20">
        </label>
      </div>
      <button class="goal-create-kr-delete" type="button" data-goal-draft-act="delete-kr" data-goal-index="${goalIndex}" data-kr-index="${krIndex}" title="删除KR">${trashIcon()}</button>
    </div>
    <div class="goal-create-kr-body${expanded ? "" : " hidden"}">
      <label class="full-width">
        <span>补充说明</span>
        <textarea data-goal-index="${goalIndex}" data-kr-index="${krIndex}" data-kr-field="description" rows="3" placeholder="请输入说明">${h(
          kr.description || ""
        )}</textarea>
      </label>
    </div>
  </div>`;
}

function renderKrDrafts() {
  const draft = ensureCreateGoalDraft();
  const krCount = goalDraftKrCount(draft);
  const goalPoints = draftGoalPoints(draft);

  refs.krDraftList.innerHTML = `<div class="goal-draft-kr-shell goal-create-kr-shell goal-create-panel">
    <div class="goal-draft-kr-header goal-create-panel-head">
      <div>
        <div class="goal-draft-kr-title"><span class="goal-create-kr-badge soft">KR</span>关键结果</div>
        <div class="goal-draft-kr-subtitle">已添加 ${krCount} 条KR，目标分值会按下方KR自动汇总。</div>
      </div>
      <div class="goal-create-panel-meta">
        <div class="goal-create-total" data-goal-draft-points="0">分值 ${fmt(goalPoints)}</div>
      </div>
    </div>
    <div class="goal-draft-kr-list goal-create-kr-list">
      ${(draft.krs || []).length
        ? (draft.krs || []).map((item, krIndex) => goalDraftKrCard(item, 0, krIndex)).join("")
        : '<div class="proof-empty">当前还没有KR，可以继续新增。</div>'}
    </div>
  </div>`;
}

function openGoalModal(mode, goalId = "") {
  if (state.currentUser.role !== "employee") return;

  refs.goalForm.reset();
  refs.goalModal.dataset.mode = mode;
  fillGoalFormOptions();
  refs.goalFormMode.value = mode;
  refs.goalFormGoalId.value = goalId;
  refs.goalDepartment.disabled = true;
  refs.goalOwner.disabled = true;
  refs.goalCycle.disabled = true;
  refs.goalProofSection.classList.add("hidden");
  refs.goalKrList.classList.add("hidden");
  refs.goalKrActions.classList.add("hidden");
  refs.goalEditSection.classList.toggle("hidden", mode !== "edit");
  refs.goalKrSection.classList.remove("hidden");
  refs.krDraftList.classList.toggle("hidden", mode !== "create");
  refs.addKrRowButton.classList.toggle("hidden", mode !== "create");
  refs.saveDraftButton.classList.remove("hidden");
  refs.goalProofUploadHint.classList.add("hidden");
  refs.goalProofUploadHint.textContent = "";

  const goalTypeField = refs.goalType.closest("label");
  const goalCycleField = refs.goalCycle.closest("label");
  const goalParentField = refs.goalParent.closest("label") || document.getElementById("goalParentField");
  const reviewGroupField = document.getElementById("goalReviewGroup")?.closest("label");

  refs.goalName.closest("label")?.classList.remove("hidden");
  refs.goalDescription.closest("label")?.classList.remove("hidden");
  refs.goalPoints.closest("label")?.classList.add("hidden");
  refs.goalEditStatus.closest("label")?.classList.add("hidden");
  refs.goalEditProgress.closest("label")?.classList.add("hidden");
  goalTypeField?.classList.add("hidden");
  goalCycleField?.classList.add("hidden");
  goalParentField?.classList.add("hidden");
  reviewGroupField?.classList.remove("hidden");

  const goalKrTitle = refs.goalKrSection.querySelector(".modal-section-title");
  if (goalKrTitle) {
    goalKrTitle.textContent = mode === "create" ? "关键结果" : "当前KR";
  }

  if (mode === "create") {
    state.goalDrafts = [blankGoalDraft()];
    refs.goalModalTitle.textContent = "新建目标";
    refs.goalSubmitButton.textContent = "确定";
    refs.saveDraftButton.textContent = "保存为草稿";
    refs.goalType.value = "personal";
    refs.goalDepartment.value = state.currentUser.departmentId;
    refs.goalOwner.value = state.currentUser.id;
    refs.goalCycle.value = state.cycleId;
    refs.goalParent.value = "";
    fillGoalReviewGroupField(state.currentUser.id);
    refs.addKrRowButton.textContent = "+ 新增KR";
    refs.goalKrHint.textContent = "先填写目标基础信息，再补充KR；目标分值会按下方KR自动汇总。";
    renderKrDrafts();
    openModal("goalModal");
    return;
  }

  const goal = getGoal(goalId);
  if (!goal || !canEdit(goal)) return;

  refs.goalModalTitle.textContent = "编辑目标";
  refs.goalSubmitButton.textContent = goal.status === "draft" ? "保存并确认" : "保存修改";
  refs.saveDraftButton.textContent = "保存草稿";
  refs.goalName.value = goal.name || "";
  refs.goalType.value = goal.type || "personal";
  refs.goalDepartment.value = goal.departmentId;
  refs.goalOwner.value = goal.ownerId;
  refs.goalCycle.value = goal.cycleId;
  refs.goalParent.value = goal.parentId || "";
  refs.goalPoints.value = goal.points === null ? "" : String(goal.points);
  refs.goalDescription.value = goal.description || "";
  refs.goalEditStatus.innerHTML = goalStatusOptions(goal.status);
  refs.goalEditStatus.value = goal.status === "draft" ? "confirmed" : goal.status;
  refs.goalEditStatus.disabled = goal.status !== "draft";
  refs.goalEditProgress.value = goal.manualProgress === null ? "" : String(goal.manualProgress);
  refs.goalEditSummary.value = goal.summary || "";
  refs.saveDraftButton.classList.toggle("hidden", goal.status !== "draft");
  fillGoalReviewGroupField(goal.ownerId);
  refs.goalKrList.innerHTML = goalModalKrCards(goal);
  refs.goalKrList.classList.remove("hidden");
  refs.goalKrActions.classList.remove("hidden");
  refs.openAddKrButton.textContent = "新增KR";
  refs.goalKrHint.textContent = "这里可以直接新增和维护KR，目标分值会按当前KR分值自动汇总。";
  openModal("goalModal");
}

function renderTable() {
  const goals = filteredGoals();
  const krCount = goals.reduce((sum, goal) => sum + goalKrs(goal.id).length, 0);
  refs.tableSubtitle.textContent = `共 ${goals.length} 条目标，${krCount} 条KR`;
  refs.emptyState.classList.toggle("hidden", !!goals.length);
  refs.goalRows.innerHTML = goals
    .flatMap((goal) => {
      const rows = [goalRow(goal)];
      if (state.expanded.has(goal.id)) {
        goalKrs(goal.id).forEach((kr) => rows.push(krRow(goal, kr)));
      }
      return rows;
    })
    .join("");
}

function syncUiLabels() {
  if (refs.searchInput) refs.searchInput.placeholder = "搜索目标、KR、员工、科室";
  if (refs.newGoalButton) refs.newGoalButton.textContent = "+ 新建目标";
  document.querySelector("th.goal-col")?.replaceChildren(document.createTextNode("目标 / KR"));
}

function goalDraftKrCard(kr, goalIndex, krIndex) {
  const expanded = kr.expanded !== false;
  const badgeLabel = `KR${krIndex + 1}`;
  return `<div class="goal-create-kr-item ${expanded ? "is-expanded" : ""}">
    <div class="goal-create-kr-head">
      <button class="goal-create-kr-toggle" type="button" data-goal-draft-act="toggle-kr" data-goal-index="${goalIndex}" data-kr-index="${krIndex}" title="${
        expanded ? "收起" : "展开"
      }">${chevronIcon(expanded)}</button>
      <span class="goal-create-kr-badge-wrap"><span class="goal-create-kr-badge">${h(badgeLabel)}</span></span>
      <div class="goal-create-kr-inline">
        <input class="goal-create-kr-title-input" data-goal-index="${goalIndex}" data-kr-index="${krIndex}" data-kr-field="name" type="text" value="${h(
          kr.name || ""
        )}" placeholder="请输入KR">
        <label class="goal-create-kr-points">
          <span>分值</span>
          <input data-goal-index="${goalIndex}" data-kr-index="${krIndex}" data-kr-field="points" type="number" min="0" step="0.1" value="${h(
            kr.points === null || kr.points === undefined ? "" : String(kr.points)
          )}" placeholder="20">
        </label>
      </div>
      <span class="goal-create-kr-delete-wrap"><button class="goal-create-kr-delete" type="button" data-goal-draft-act="delete-kr" data-goal-index="${goalIndex}" data-kr-index="${krIndex}" title="删除KR">${trashIcon()}</button></span>
    </div>
    <div class="goal-create-kr-body${expanded ? "" : " hidden"}">
      <label class="full-width">
        <span>补充说明</span>
        <textarea data-goal-index="${goalIndex}" data-kr-index="${krIndex}" data-kr-field="description" rows="3" placeholder="请输入说明">${h(
          kr.description || ""
        )}</textarea>
      </label>
    </div>
  </div>`;
}

function goalDraftKrCard(kr, goalIndex, krIndex) {
  const expanded = kr.expanded !== false;
  const badgeLabel = `KR${krIndex + 1}`;
  return `<div class="goal-create-kr-item ${expanded ? "is-expanded" : ""}">
    <div class="goal-create-kr-head">
      <button class="goal-create-kr-toggle" type="button" data-goal-draft-act="toggle-kr" data-goal-index="${goalIndex}" data-kr-index="${krIndex}" title="${
        expanded ? "收起" : "展开"
      }">${chevronIcon(expanded)}</button>
      <span class="goal-create-kr-badge-wrap"><span class="goal-create-kr-badge">${h(badgeLabel)}</span></span>
      <div class="goal-create-kr-inline">
        <label class="goal-create-kr-main-field">
          <span>KR</span>
          <input class="goal-create-kr-title-input" data-goal-index="${goalIndex}" data-kr-index="${krIndex}" data-kr-field="name" type="text" value="${h(
            kr.name || ""
          )}" placeholder="请输入关键结果">
        </label>
        <label class="goal-create-kr-points">
          <span>分值</span>
          <input data-goal-index="${goalIndex}" data-kr-index="${krIndex}" data-kr-field="points" type="number" min="0" step="0.1" value="${h(
            kr.points === null || kr.points === undefined ? "" : String(kr.points)
          )}" placeholder="20">
        </label>
      </div>
      <span class="goal-create-kr-delete-wrap"><button class="goal-create-kr-delete" type="button" data-goal-draft-act="delete-kr" data-goal-index="${goalIndex}" data-kr-index="${krIndex}" title="删除KR">${trashIcon()}</button></span>
    </div>
    <div class="goal-create-kr-body${expanded ? "" : " hidden"}">
      <label class="full-width">
        <span>补充说明</span>
        <textarea data-goal-index="${goalIndex}" data-kr-index="${krIndex}" data-kr-field="description" rows="3" placeholder="请输入说明">${h(
          kr.description || ""
        )}</textarea>
      </label>
    </div>
  </div>`;
}

function renderKrDrafts() {
  const draft = ensureCreateGoalDraft();
  const krCount = goalDraftKrCount(draft);
  const goalPoints = draftGoalPoints(draft);

  refs.krDraftList.innerHTML = `<div class="goal-draft-kr-shell goal-create-kr-shell goal-create-panel">
    <div class="goal-draft-kr-header goal-create-panel-head">
      <div>
        <div class="goal-draft-kr-title"><span class="goal-create-kr-badge soft">KR</span>关键结果</div>
        <div class="goal-draft-kr-subtitle">已添加 ${krCount} 条关键结果，目标分值会按下方关键结果自动汇总。</div>
      </div>
      <div class="goal-create-panel-meta">
        <div class="goal-create-total" data-goal-draft-points="0">分值 ${fmt(goalPoints)}</div>
      </div>
    </div>
    <div class="goal-draft-kr-list goal-create-kr-list">
      ${(draft.krs || []).length
        ? (draft.krs || []).map((item, krIndex) => goalDraftKrCard(item, 0, krIndex)).join("")
        : '<div class="proof-empty">当前还没有关键结果，可以继续新增。</div>'}
    </div>
  </div>`;
}
