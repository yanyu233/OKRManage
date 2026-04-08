function detailWorkspacePrimaryAction(goal) {
  if (canSubmitReview(goal)) {
    return `<button class="primary-button detail-workspace-primary" type="button" data-detail-act="submit-review" data-goal-id="${h(goal.id)}">确认</button>`;
  }
  if (canReview(goal)) {
    return `<button class="primary-button detail-workspace-primary" type="button" data-detail-act="review-goal" data-goal-id="${h(goal.id)}">进入评分</button>`;
  }
  return "";
}

function detailWorkspaceMeta(goal) {
  const chips = [
    GOAL_STATUS[goal.status] || goal.status,
    sectionOfGoal(goal),
    `分值 ${goal.points === null ? "-" : fmt(goal.points)}`
  ];
  if (goal.reviewScore !== null) {
    chips.push(`总分 ${fmt(goal.reviewScore)}`);
  }

  return chips.map((text) => `<span class="detail-workspace-meta-item">${h(text)}</span>`).join("");
}

function detailWorkspaceSummary(goal) {
  const cards = [
    ["当前进度", goalCompletionText(goal)],
    ["关键结果数", `${goalKrs(goal.id).length} 条`],
    ["材料总数", `${goalProofs(goal.id).length} 份`],
    ["最近更新", goal.updatedAt || "-"]
  ];

  return cards
    .map(
      ([label, value]) => `<div class="detail-workspace-tile">
        <div class="detail-workspace-tile-label">${h(label)}</div>
        <div class="detail-workspace-tile-value">${h(value)}</div>
      </div>`
    )
    .join("");
}

function detailWorkspaceSelectedKr(goal, focusKrId = "") {
  const krs = goalKrs(goal.id);
  const requestedId = focusKrId || state.detailWorkspaceKrId || "";
  const selected = krs.find((kr) => kr.id === requestedId) || krs[0] || null;
  state.detailWorkspaceGoalId = goal.id;
  state.detailWorkspaceKrId = selected?.id || "";
  return selected;
}

function detailWorkspaceStatusState(kr) {
  const completed = num(kr?.progress) >= 100 || `${kr?.status || ""}` === "completed";
  return {
    completed,
    sidebarLabel: completed ? "完成" : "待补充",
    chooserValue: completed ? "done" : "pending"
  };
}

function detailWorkspaceSidebar(goal, selectedKrId) {
  const items = goalKrs(goal.id).map((kr) => {
    const proofs = krProofs(kr.id);
    const statusState = detailWorkspaceStatusState(kr);
    return `<button class="workspace-sidebar-item${kr.id === selectedKrId ? " is-active" : ""}" type="button" data-workspace-act="select-kr" data-goal-id="${h(
      goal.id
    )}" data-kr-id="${h(kr.id)}">
      <div class="workspace-sidebar-top">
        <strong class="workspace-sidebar-title">${h(`${kr.code} ${kr.name}`)}</strong>
        <span class="workspace-status-chip ${statusState.completed ? "done" : "pending"}">${h(statusState.sidebarLabel)}</span>
      </div>
      <div class="workspace-sidebar-meta">
        <span class="workspace-meta-pill">${h(`分值 ${kr.points === null ? "-" : fmt(kr.points)}`)}</span>
        <span class="workspace-meta-pill">${h(`材料 ${proofs.length} 份`)}</span>
      </div>
    </button>`;
  });

  if (items.length) {
    return `<aside class="workspace-sidebar">${items.join("")}</aside>`;
  }

  return `<aside class="workspace-sidebar">
    <div class="workspace-empty">当前还没有关键结果。</div>
  </aside>`;
}

function detailWorkspaceCompletionChooser(goal, kr) {
  const statusState = detailWorkspaceStatusState(kr);
  const editable = canUploadProof(goal);

  return `<div class="workspace-confirm-strip">
    <strong class="workspace-confirm-title">完成确认</strong>
    <div class="workspace-completion-chooser${editable ? "" : " is-readonly"}" aria-label="当前关键结果完成确认">
      <button class="workspace-completion-button pending${statusState.chooserValue === "pending" ? " is-active" : ""}" type="button" ${
        editable ? "" : "disabled"
      } data-workspace-act="set-completion" data-goal-id="${h(goal.id)}" data-kr-id="${h(kr.id)}" data-completion-state="pending">未完成</button>
      <button class="workspace-completion-button done${statusState.chooserValue === "done" ? " is-active" : ""}" type="button" ${
        editable ? "" : "disabled"
      } data-workspace-act="set-completion" data-goal-id="${h(goal.id)}" data-kr-id="${h(kr.id)}" data-completion-state="done">已完成</button>
    </div>
  </div>`;
}

function detailWorkspaceUploadPanel(goal, kr) {
  if (!canUploadProof(goal)) {
    return `<div class="workspace-note-card">${h(proofActionNotice(goal))}</div>`;
  }

  return `<div class="workspace-upload-panel">
    <label class="workspace-dropzone" for="workspace-proof-file-${h(kr.id)}">
      <input id="workspace-proof-file-${h(kr.id)}" type="file" multiple data-workspace-proof-file="true" data-kr-id="${h(kr.id)}">
      <span class="workspace-dropzone-title">拖拽文件到这里，或点击选择文件</span>
      <span class="workspace-dropzone-copy">支持文档、图片、压缩包与视频</span>
    </label>

    <div id="workspace-proof-progress-${h(kr.id)}" class="workspace-progress-card hidden">
      <div class="workspace-progress-head">
        <span id="workspace-proof-progress-label-${h(kr.id)}">等待上传</span>
        <strong id="workspace-proof-progress-value-${h(kr.id)}">0%</strong>
      </div>
      <div class="workspace-progress-track">
        <div id="workspace-proof-progress-bar-${h(kr.id)}" class="workspace-progress-fill" style="width:0%"></div>
      </div>
    </div>

    <div class="workspace-upload-toolbar">
      <div id="workspace-proof-selection-${h(kr.id)}" class="workspace-upload-selection">未选择文件</div>
      <label class="workspace-upload-note">
        <input id="workspace-proof-note-${h(kr.id)}" type="text" maxlength="200" placeholder="备注：补充版本交付验收记录">
      </label>
      <button class="workspace-upload-button" type="button" data-workspace-act="upload-proof" data-goal-id="${h(goal.id)}" data-kr-id="${h(kr.id)}">开始上传</button>
    </div>
  </div>`;
}

function detailWorkspaceHistory(goal, kr) {
  const proofs = krProofs(kr.id);
  const allowDelete = canUploadProof(goal);

  if (!proofs.length) {
    return `<section class="workspace-pane-section">
      <div class="workspace-pane-section-title">最近材料</div>
      <div class="workspace-empty">当前还没有上传材料。</div>
    </section>`;
  }

  return `<section class="workspace-pane-section">
    <div class="workspace-pane-section-title">最近材料</div>
    <div class="workspace-history-list">
      ${proofs
        .map(
          (proof) => `<div class="workspace-history-item">
            <div class="workspace-history-main">
              <strong>${h(proof.fileName)}</strong>
              <span>${h(`${proof.uploadedAt || "-"} · ${size(proof.sizeBytes)}`)}</span>
              ${proof.note ? `<em>${h(proof.note)}</em>` : ""}
            </div>
            <div class="workspace-history-actions">
              <a class="workspace-history-link" href="${h(proof.url)}" target="_blank" rel="noreferrer">打开</a>
              ${
                allowDelete && proof.uploadedBy === state.currentUser.id
                  ? `<button class="workspace-history-delete" type="button" data-proof-act="delete" data-proof-id="${h(proof.id)}">删除</button>`
                  : ""
              }
            </div>
          </div>`
        )
        .join("")}
    </div>
  </section>`;
}

function detailWorkspacePane(goal, kr) {
  if (!kr) {
    return `<section class="workspace-pane">
      <div class="workspace-empty workspace-empty-pane">当前目标还没有关键结果。</div>
    </section>`;
  }

  const description = (kr.description || "").trim();
  return `<section class="workspace-pane">
    <div class="workspace-pane-head">
      <div>
        <h4>${h(`${kr.code} · ${kr.name}`)}</h4>
        ${description ? `<p>${h(description)}</p>` : ""}
      </div>
      <span class="workspace-pane-chip ${canUploadProof(goal) ? "materials" : "readonly"}">${canUploadProof(goal) ? "提交材料" : "查看材料"}</span>
    </div>
    ${detailWorkspaceCompletionChooser(goal, kr)}
    ${detailWorkspaceUploadPanel(goal, kr)}
    ${detailWorkspaceHistory(goal, kr)}
  </section>`;
}

function detailWorkspaceUploadUi(krId) {
  return {
    fileInput: document.getElementById(`workspace-proof-file-${krId}`),
    noteInput: document.getElementById(`workspace-proof-note-${krId}`),
    hintEl: null,
    progressCard: document.getElementById(`workspace-proof-progress-${krId}`),
    progressLabel: document.getElementById(`workspace-proof-progress-label-${krId}`),
    progressValue: document.getElementById(`workspace-proof-progress-value-${krId}`),
    progressBar: document.getElementById(`workspace-proof-progress-bar-${krId}`),
    buttonEl: document.querySelector(`[data-workspace-act="upload-proof"][data-kr-id="${krId}"]`)
  };
}

function renderDetailWorkspaceFileSelection(krId) {
  const fileInput = document.getElementById(`workspace-proof-file-${krId}`);
  const selection = document.getElementById(`workspace-proof-selection-${krId}`);
  if (!fileInput || !selection) return;

  const files = [...(fileInput.files || [])];
  selection.textContent = files.length ? `已选 ${files.length} 个文件` : "未选择文件";
  selection.classList.toggle("has-files", files.length > 0);
}

async function uploadDetailWorkspaceProofs(goalId, krId) {
  const goal = getGoal(goalId);
  const kr = getKr(krId);
  if (!goal || !kr) return;

  await uploadKrProofFiles({
    krId,
    goalId,
    ui: detailWorkspaceUploadUi(krId),
    afterUpload: async (store) => {
      state.detailWorkspaceKrId = krId;
      applyStore(store, false, goalId);
      openGoalDetail(goalId, krId);
    }
  });
}

async function setDetailWorkspaceCompletion(goalId, krId, completionState) {
  const res = await apiPut(`/api/krs/${krId}/completion`, { completionState });
  if (!res?.store) return;
  state.detailWorkspaceKrId = krId;
  applyStore(res.store, false, goalId);
  openGoalDetail(goalId, krId);
}

function openGoalDetail(goalId, focusKrId = "") {
  const goal = getGoal(goalId);
  if (!goal) return;

  if (canEdit(goal)) {
    openGoalModal("edit", goalId);
    return;
  }

  const selectedKr = detailWorkspaceSelectedKr(goal, focusKrId);
  refs.detailModalTitle.textContent = `${goal.code} ${goal.name}`;
  refs.detailModalBody.innerHTML = `<div class="detail-workspace-layout">
    <section class="detail-workspace-shell">
      <div class="detail-workspace-top">
        <div class="detail-workspace-meta">${detailWorkspaceMeta(goal)}</div>
        ${detailWorkspacePrimaryAction(goal)}
      </div>
      <div class="detail-workspace-summary">${detailWorkspaceSummary(goal)}</div>
      <div class="detail-workspace-main">
        ${detailWorkspaceSidebar(goal, selectedKr?.id || "")}
        ${detailWorkspacePane(goal, selectedKr)}
      </div>
    </section>
  </div>`;

  if (selectedKr) {
    renderDetailWorkspaceFileSelection(selectedKr.id);
  }

  openModal("detailModal");
}

function openKrDetail(krId) {
  const kr = getKr(krId);
  const goal = kr ? getGoal(kr.goalId) : null;
  if (!kr || !goal) return;

  if (canEdit(goal)) {
    openGoalModal("edit", goal.id);
    return;
  }

  state.detailWorkspaceKrId = kr.id;
  openGoalDetail(goal.id, kr.id);
}

function openKrProofViewer(krId) {
  openKrDetail(krId);
}

async function deleteDetailProof(proofId) {
  const proof = getProof(proofId);
  if (!proof) return;
  if (!window.confirm(`确认删除资料“${proof.fileName}”吗？`)) return;
  const res = await apiDelete(`/api/proofs/${proof.id}`);
  if (!res?.store) return;
  state.detailWorkspaceKrId = proof.krId || "";
  applyStore(res.store, false, proof.goalId);
  openGoalDetail(proof.goalId, proof.krId || "");
}

function onDetailWorkspaceClick(event) {
  const button = event.target.closest("[data-workspace-act]");
  if (!button) return;

  const action = button.dataset.workspaceAct;
  const goalId = button.dataset.goalId;
  const krId = button.dataset.krId;

  if (action === "select-kr") {
    state.detailWorkspaceKrId = krId;
    openGoalDetail(goalId, krId);
    return;
  }

  if (action === "upload-proof") {
    uploadDetailWorkspaceProofs(goalId, krId);
    return;
  }

  if (action === "set-completion") {
    setDetailWorkspaceCompletion(goalId, krId, button.dataset.completionState);
  }
}

function onDetailWorkspaceChange(event) {
  const input = event.target.closest("[data-workspace-proof-file]");
  if (!input) return;
  renderDetailWorkspaceFileSelection(input.dataset.krId);
}

document.addEventListener("DOMContentLoaded", () => {
  refs.detailModalBody?.addEventListener("click", onDetailWorkspaceClick);
  refs.detailModalBody?.addEventListener("change", onDetailWorkspaceChange);
});
