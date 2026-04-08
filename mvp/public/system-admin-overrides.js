(function attachSystemAdminOverrides() {
  if (typeof window === "undefined" || typeof render !== "function") return;

  const baseRender = render;
  const baseRenderShell = renderShell;
  const reviewUtils = window.ReviewGradeUtils || {};
  const DEFAULT_REVIEW_GROUPS = reviewUtils.DEFAULT_REVIEW_GROUPS || reviewUtils.REVIEW_GROUPS || ["信息化组", "运营组", "综合组"];
  const REVIEW_GRADE_LEVELS = reviewUtils.REVIEW_GRADE_LEVELS || ["A+", "A", "B+", "B", "C"];
  const getReviewGroups =
    reviewUtils.getReviewGroups ||
    ((config) => {
      const groups = Object.keys(config?.groups || {}).filter(Boolean);
      return groups.length ? groups : [...DEFAULT_REVIEW_GROUPS];
    });
  const normalizeReviewGradeConfig =
    reviewUtils.normalizeReviewGradeConfig ||
    ((config) => ({ groups: config?.groups || {} }));

  let tempSeed = 0;

  function isSystemAdminRole(role = state.currentUser?.role) {
    return role === "system-admin";
  }

  function nextTempId(prefix) {
    tempSeed += 1;
    return `${prefix}-tmp-${tempSeed}`;
  }

  function currentAdminDepartments() {
    const rows = Array.from(document.querySelectorAll("[data-admin-dept-row]"));
    if (rows.length) {
      return rows.map((row) => ({
        id: row.dataset.rowId || "",
        name: collectRowValue(row, "[data-admin-dept-name]")
      }));
    }
    return depts();
  }

  function currentAdminSections() {
    const rows = Array.from(document.querySelectorAll("[data-admin-section-row]"));
    if (rows.length) {
      return rows.map((row) => ({
        id: row.dataset.rowId || "",
        name: collectRowValue(row, "[data-admin-section-name]"),
        departmentId: collectRowValue(row, "[data-admin-section-department]"),
        reviewGroup: collectRowValue(row, "[data-admin-section-group]") || defaultAdminReviewGroup()
      }));
    }
    return state.store?.sections || [];
  }

  function adminGroupNamesFromCards() {
    const cards = Array.from(document.querySelectorAll("[data-admin-group-card]"));
    if (!cards.length) return getReviewGroups(state.store?.settings?.reviewGradeConfig);
    return cards.map((card) => `${card.querySelector("[data-admin-group-name]")?.value || ""}`.trim());
  }

  function currentAdminReviewGroups() {
    const seen = new Set();
    return adminGroupNamesFromCards().filter((group) => {
      if (!group || seen.has(group)) return false;
      seen.add(group);
      return true;
    });
  }

  function defaultAdminReviewGroup() {
    const groups = currentAdminReviewGroups();
    if (groups.includes("综合组")) return "综合组";
    return groups[0] || DEFAULT_REVIEW_GROUPS[0] || "综合组";
  }

  function ensureAdminMount() {
    let mount = document.getElementById("systemAdminConfigPage");
    if (!mount) {
      mount = document.createElement("section");
      mount.id = "systemAdminConfigPage";
      mount.className = "system-admin-page hidden";
      refs.statsGrid.insertAdjacentElement("afterend", mount);
    }
    return mount;
  }

  function roleOptions(selectedValue, roles) {
    return roles
      .map((role) => `<option value="${h(role)}" ${role === selectedValue ? "selected" : ""}>${h(roleMeta(role).label)}</option>`)
      .join("");
  }

  function departmentOptions(selectedValue) {
    return currentAdminDepartments()
      .map((dept) => `<option value="${h(dept.id)}" ${dept.id === selectedValue ? "selected" : ""}>${h(dept.name)}</option>`)
      .join("");
  }

  function sectionOptions(selectedValue, departmentId) {
    return currentAdminSections()
      .filter((section) => !departmentId || section.departmentId === departmentId)
      .map(
        (section) =>
          `<option value="${h(section.id)}" data-review-group="${h(section.reviewGroup || defaultAdminReviewGroup())}" ${section.id === selectedValue ? "selected" : ""}>${h(section.name)}</option>`
      )
      .join("");
  }

  function reviewGroupOptions(selectedValue) {
    return currentAdminReviewGroups().map(
      (group) => `<option value="${h(group)}" ${group === selectedValue ? "selected" : ""}>${h(group)}</option>`
    ).join("");
  }

  function currentAdminConfig() {
    return normalizeReviewGradeConfig(state.store?.settings?.reviewGradeConfig);
  }

  function staffAccounts() {
    return (state.store?.users || []).filter((user) => user.role === "employee" || user.role === "system-admin");
  }

  function leaderAccounts() {
    return (state.store?.users || []).filter((user) => user.role === "section-leader" || user.role === "group-leader");
  }

  function employeeCountsByGroup(users) {
    const counts = currentAdminReviewGroups().reduce((acc, group) => ({ ...acc, [group]: 0 }), {});
    users
      .filter((user) => user.role === "employee")
      .forEach((user) => {
        const group = user.reviewGroup || defaultAdminReviewGroup();
        if (counts[group] === undefined) counts[group] = 0;
        counts[group] = (counts[group] || 0) + 1;
      });
    return counts;
  }

  function departmentRow(department) {
    return `<tr data-admin-dept-row data-row-id="${h(department.id)}">
      <td><input type="text" class="admin-input" data-admin-dept-name value="${h(department.name || "")}" placeholder="请输入部门名称"></td>
      <td><button class="ghost-button danger-button" type="button" data-admin-act="remove-row">移除</button></td>
    </tr>`;
  }

  function sectionRow(section) {
    return `<tr data-admin-section-row data-row-id="${h(section.id)}">
      <td><input type="text" class="admin-input" data-admin-section-name value="${h(section.name || "")}" placeholder="请输入科室名称"></td>
      <td><select class="admin-select" data-admin-section-department>${departmentOptions(section.departmentId)}</select></td>
      <td><select class="admin-select" data-admin-section-group>${reviewGroupOptions(section.reviewGroup || defaultAdminReviewGroup())}</select></td>
      <td><button class="ghost-button danger-button" type="button" data-admin-act="remove-row">移除</button></td>
    </tr>`;
  }

  function staffRow(user) {
    return `<tr data-admin-staff-row data-row-id="${h(user.id)}">
      <td><input type="text" class="admin-input" data-admin-user-name value="${h(user.name || "")}" placeholder="请输入账号名称"></td>
      <td><select class="admin-select" data-admin-user-role>${roleOptions(user.role || "employee", ["employee", "system-admin"])}</select></td>
      <td><select class="admin-select" data-admin-user-department>${departmentOptions(user.departmentId)}</select></td>
      <td><select class="admin-select" data-admin-user-section>${sectionOptions(user.sectionId, user.departmentId)}</select></td>
      <td><select class="admin-select" data-admin-user-group>${reviewGroupOptions(user.reviewGroup || defaultAdminReviewGroup())}</select></td>
      <td><button class="ghost-button danger-button" type="button" data-admin-act="remove-row">移除</button></td>
    </tr>`;
  }

  function leaderRow(user) {
    return `<tr data-admin-leader-row data-row-id="${h(user.id)}">
      <td><input type="text" class="admin-input" data-admin-user-name value="${h(user.name || "")}" placeholder="请输入负责人名称"></td>
      <td><select class="admin-select" data-admin-user-role>${roleOptions(user.role || "section-leader", ["section-leader", "group-leader"])}</select></td>
      <td><select class="admin-select" data-admin-user-department>${departmentOptions(user.departmentId)}</select></td>
      <td><select class="admin-select" data-admin-user-section>${sectionOptions(user.sectionId, user.departmentId)}</select></td>
      <td><select class="admin-select" data-admin-user-group>${reviewGroupOptions(user.reviewGroup || defaultAdminReviewGroup())}</select></td>
      <td><button class="ghost-button danger-button" type="button" data-admin-act="remove-row">移除</button></td>
    </tr>`;
  }

  function nextGroupName() {
    const existing = new Set(currentAdminReviewGroups());
    let index = 1;
    while (existing.has(`新组别${index}`)) index += 1;
    return `新组别${index}`;
  }

  function quotaCard(group, config, counts, rowId = group) {
    const quotas = config.groups[group] || {};
    const totalSeats = REVIEW_GRADE_LEVELS.reduce((sum, level) => sum + Number(quotas[level] || 0), 0);
    return `<article class="admin-quota-card" data-admin-group-card data-row-id="${h(rowId)}" data-group-name="${h(group)}">
      <div class="admin-quota-head">
        <div class="admin-quota-meta">
          <input type="text" class="admin-input admin-group-name-input" value="${h(group)}" placeholder="请输入组别名称" data-admin-group-name>
          <span>组名支持直接修改，当前组内有 ${h(String(counts[group] || 0))} 位员工参与排名。</span>
        </div>
        <div class="admin-quota-actions">
          <span class="admin-quota-total" data-admin-quota-total>${h(`总名额 ${totalSeats} 人`)}</span>
          <button class="ghost-button danger-button" type="button" data-admin-act="remove-group">移除组别</button>
        </div>
      </div>
      <div class="admin-quota-grid">
        ${REVIEW_GRADE_LEVELS.map(
          (level) => `<label class="admin-quota-field">
            <span class="admin-quota-level">${h(level)}</span>
            <input type="text" inputmode="numeric" pattern="[0-9]*" class="admin-input admin-quota-input" value="${h(String(quotas[level] || 0))}" data-admin-seat-level="${h(level)}">
          </label>`
        ).join("")}
      </div>
      <div class="admin-quota-summary" data-admin-quota-note>
        <div class="admin-quota-summary-item">
          <span>当前总名额</span>
          <strong>${h(String(totalSeats))} 人</strong>
        </div>
        <div class="admin-quota-summary-item">
          <span>组内员工</span>
          <strong>${h(String(counts[group] || 0))} 人</strong>
        </div>
      </div>
      <div class="admin-module-note">固定人数名额按组直接控制，保存时会校验总名额不能超过组内员工人数。</div>
    </article>`;
  }

  function leaderBindingSummary() {
    const rows = leaderAccounts()
      .map((user) => {
        const scope =
          user.role === "section-leader"
            ? `${sectionName(user.sectionId)}员工`
            : `${user.reviewGroup || defaultAdminReviewGroup()}员工`;
        return `<tr>
          <td>${h(user.name)}</td>
          <td>${h(roleMeta(user.role).label)}</td>
          <td>${h(deptName(user.departmentId))}</td>
          <td>${h(scope)}</td>
        </tr>`;
      })
      .join("");

    return rows || '<tr><td colspan="4" class="admin-empty">当前还没有配置负责人账号。</td></tr>';
  }

  function renderAdminPage() {
    const mount = ensureAdminMount();
    const config = currentAdminConfig();
    const counts = employeeCountsByGroup(staffAccounts());

    mount.classList.remove("hidden");
    mount.innerHTML = `<div class="system-admin-layout">
      <aside class="system-admin-side">
        <div class="system-admin-side-head">
          <div class="portal-badge">系统管理员专属</div>
          <h3>配置模块</h3>
          <p>部门、科室、账号、固定名额与负责人绑定统一从这里维护。</p>
        </div>
        <div class="system-admin-anchor-list">
          <a class="system-admin-anchor active" href="#adminModuleDepartments">部门管理</a>
          <a class="system-admin-anchor" href="#adminModuleSections">科室管理</a>
          <a class="system-admin-anchor" href="#adminModuleStaff">员工与系统账号</a>
          <a class="system-admin-anchor" href="#adminModuleGrades">评价组与档位名额</a>
          <a class="system-admin-anchor" href="#adminModuleLeaders">负责人绑定</a>
        </div>
      </aside>

      <section class="system-admin-main">
        <section class="system-admin-hero">
          <div>
            <div class="system-admin-hero-tag">前台配置页</div>
            <h2>组织、角色与评分口径统一配置</h2>
            <p>系统管理员保存后，员工端、负责人打分端和评分排名页都会使用同一套组织与名额数据。固定名额总和超过组内员工数时会直接报错，不能保存。</p>
          </div>
          <div class="system-admin-hero-actions">
            <button class="ghost-button" type="button" data-admin-act="reset-config">恢复当前数据</button>
            <button class="primary-button" type="button" data-admin-act="save-config">保存配置</button>
          </div>
        </section>

        <section id="adminModuleDepartments" class="system-admin-module">
          <div class="system-admin-module-head">
            <div>
              <h3>部门管理</h3>
              <p>维护组织的一级部门结构，科室必须挂在某个部门下。</p>
            </div>
            <button class="ghost-button" type="button" data-admin-act="add-department">+ 新增部门</button>
          </div>
          <table class="system-admin-table">
            <thead><tr><th>部门名称</th><th>操作</th></tr></thead>
            <tbody id="adminDepartmentRows">${depts().map(departmentRow).join("")}</tbody>
          </table>
        </section>

        <section id="adminModuleSections" class="system-admin-module">
          <div class="system-admin-module-head">
            <div>
              <h3>科室管理</h3>
              <p>科室和评价组建立默认映射，员工没有单独覆盖时会继承这里的评价组。</p>
            </div>
            <button class="ghost-button" type="button" data-admin-act="add-section">+ 新增科室</button>
          </div>
          <table class="system-admin-table">
            <thead><tr><th>科室名称</th><th>所属部门</th><th>默认评价组</th><th>操作</th></tr></thead>
            <tbody id="adminSectionRows">${(state.store?.sections || []).map(sectionRow).join("")}</tbody>
          </table>
        </section>

        <section id="adminModuleStaff" class="system-admin-module">
          <div class="system-admin-module-head">
            <div>
              <h3>员工与系统账号</h3>
              <p>这里维护普通员工和系统管理员账号。员工会参与排名，系统管理员不参与评分排名。</p>
            </div>
            <button class="ghost-button" type="button" data-admin-act="add-staff">+ 新增账号</button>
          </div>
          <table class="system-admin-table">
            <thead><tr><th>账号名称</th><th>角色</th><th>所属部门</th><th>所属科室</th><th>评价组</th><th>操作</th></tr></thead>
            <tbody id="adminStaffRows">${staffAccounts().map(staffRow).join("")}</tbody>
          </table>
        </section>

        <section id="adminModuleGrades" class="system-admin-module">
          <div class="system-admin-module-head">
            <div>
              <h3>评价组与档位名额</h3>
              <p>按组直接配置固定人数名额，不按比例换算。总名额超过组内员工人数时会报错并禁止保存。</p>
            </div>
            <div class="system-admin-grade-tools">
              <div class="system-admin-note">组名支持直接修改，适合多个评价组并行维护。</div>
              <div class="system-admin-note">当前只支持 A+ / A / B+ / B / C 五档。</div>
              <button class="ghost-button" type="button" data-admin-act="add-group">+ 新增组别</button>
            </div>
          </div>
          <div class="system-admin-quota-list">${currentAdminReviewGroups().map((group) => quotaCard(group, config, counts, group)).join("")}</div>
        </section>

        <section id="adminModuleLeaders" class="system-admin-module">
          <div class="system-admin-module-head">
            <div>
              <h3>负责人绑定</h3>
              <p>这里维护科室领导和小组负责人账号，以及对应的评分范围。</p>
            </div>
            <button class="ghost-button" type="button" data-admin-act="add-leader">+ 新增负责人账号</button>
          </div>
          <table class="system-admin-table">
            <thead><tr><th>账号名称</th><th>负责人类型</th><th>所属部门</th><th>所属科室</th><th>负责评价组</th><th>操作</th></tr></thead>
            <tbody id="adminLeaderRows">${leaderAccounts().map(leaderRow).join("")}</tbody>
          </table>
          <div class="system-admin-binding-summary">
            <div class="system-admin-summary-title">当前负责人范围概览</div>
            <table class="system-admin-table compact">
              <thead><tr><th>负责人</th><th>身份</th><th>所属部门</th><th>评分范围</th></tr></thead>
              <tbody>${leaderBindingSummary()}</tbody>
            </table>
          </div>
        </section>
      </section>
    </div>`;

    syncAllAdminRows();
    refreshAdminQuotaSummary();
  }

  function adminRows(selector) {
    return Array.from(document.querySelectorAll(selector));
  }

  function syncUserRow(row) {
    if (!row) return;
    const departmentSelect = row.querySelector("[data-admin-user-department]");
    const sectionSelect = row.querySelector("[data-admin-user-section]");
    const roleSelect = row.querySelector("[data-admin-user-role]");
    const groupSelect = row.querySelector("[data-admin-user-group]");
    if (!departmentSelect || !sectionSelect || !roleSelect || !groupSelect) return;

    const departmentId = departmentSelect.value;
    const currentSection = sectionSelect.value;
    sectionSelect.innerHTML = `<option value="">无</option>${sectionOptions(currentSection, departmentId)}`;

    const selectedSection = sectionSelect.selectedOptions[0];
    const inheritedGroup = selectedSection?.dataset?.reviewGroup || "";
    if (!groupSelect.value && inheritedGroup) {
      groupSelect.value = inheritedGroup;
    }

    const needsSection = roleSelect.value === "employee" || roleSelect.value === "section-leader";
    sectionSelect.disabled = !needsSection;
    if (!needsSection) sectionSelect.value = "";

    const lockGroupToSection = roleSelect.value === "section-leader";
    groupSelect.disabled = false;
    if (lockGroupToSection && inheritedGroup) {
      groupSelect.value = inheritedGroup;
    }
  }

  function syncAllAdminRows() {
    adminRows("[data-admin-staff-row], [data-admin-leader-row]").forEach(syncUserRow);
  }

  function collectRowValue(row, selector) {
    const node = row.querySelector(selector);
    return node ? `${node.value || ""}`.trim() : "";
  }

  function collectDepartmentsFromDom() {
    return adminRows("[data-admin-dept-row]").map((row) => ({
      id: row.dataset.rowId || nextTempId("dept"),
      name: collectRowValue(row, "[data-admin-dept-name]")
    }));
  }

  function collectSectionsFromDom() {
    return adminRows("[data-admin-section-row]").map((row) => ({
      id: row.dataset.rowId || nextTempId("sec"),
      name: collectRowValue(row, "[data-admin-section-name]"),
      departmentId: collectRowValue(row, "[data-admin-section-department]"),
      reviewGroup: collectRowValue(row, "[data-admin-section-group]") || defaultAdminReviewGroup()
    }));
  }

  function collectUsersFromDom() {
    const collect = (selector) =>
      adminRows(selector).map((row) => ({
        id: row.dataset.rowId || nextTempId("u"),
        name: collectRowValue(row, "[data-admin-user-name]"),
        role: collectRowValue(row, "[data-admin-user-role]"),
        departmentId: collectRowValue(row, "[data-admin-user-department]"),
        sectionId: collectRowValue(row, "[data-admin-user-section]"),
        reviewGroup: collectRowValue(row, "[data-admin-user-group]") || defaultAdminReviewGroup()
      }));

    return [...collect("[data-admin-staff-row]"), ...collect("[data-admin-leader-row]")];
  }

  function collectGradeConfigFromDom() {
    const groups = {};
    adminRows("[data-admin-group-card]").forEach((card) => {
      const group = `${card.querySelector("[data-admin-group-name]")?.value || ""}`.trim();
      if (!group) return;
      groups[group] = {};
      REVIEW_GRADE_LEVELS.forEach((level) => {
        const input = card.querySelector(`[data-admin-seat-level="${level}"]`);
        groups[group][level] = input ? Math.max(0, Number.parseInt(`${input.value || 0}`.replace(/[^\d]/g, ""), 10) || 0) : 0;
      });
    });
    return { groups };
  }

  function validateAdminConfigPayload(payload) {
    if (!payload.departments.length) {
      window.alert("请至少保留一个部门。");
      return false;
    }
    if (!payload.sections.length) {
      window.alert("请至少保留一个科室。");
      return false;
    }
    if (!payload.users.length) {
      window.alert("请至少保留一个账号。");
      return false;
    }
    const rawGroupNames = adminGroupNamesFromCards();
    const reviewGroups = Object.keys(payload.reviewGradeConfig.groups || {});

    if (!rawGroupNames.length) {
      window.alert("请至少保留一个评价组。");
      return false;
    }

    if (!payload.users.some((user) => user.id === state.currentUser.id && user.role === "system-admin")) {
      window.alert("当前系统管理员账号必须保留，且角色仍需是系统管理员。");
      return false;
    }

    if (!payload.users.some((user) => user.role === "system-admin")) {
      window.alert("请至少保留一个系统管理员账号。");
      return false;
    }

    const sectionMap = new Map(payload.sections.map((section) => [section.id, section]));
    const counts = reviewGroups.reduce((acc, group) => ({ ...acc, [group]: 0 }), {});

    if (rawGroupNames.some((group) => !`${group}`.trim())) {
      window.alert("评价组名称不能为空。");
      return false;
    }

    if (new Set(rawGroupNames).size !== rawGroupNames.length) {
      window.alert("评价组名称不能重复。");
      return false;
    }

    if (!reviewGroups.length) {
      window.alert("请至少保留一个有效的评价组。");
      return false;
    }

    for (const department of payload.departments) {
      if (!department.name) {
        window.alert("部门名称不能为空。");
        return false;
      }
    }

    for (const section of payload.sections) {
      if (!section.name || !section.departmentId) {
        window.alert("科室名称和所属部门不能为空。");
        return false;
      }
      if (!reviewGroups.includes(section.reviewGroup)) {
        window.alert("科室默认评价组必须来自已配置的组别。");
        return false;
      }
    }

    for (const user of payload.users) {
      if (!user.name || !user.departmentId || !user.role) {
        window.alert("账号名称、角色和所属部门不能为空。");
        return false;
      }
      if ((user.role === "employee" || user.role === "section-leader") && !user.sectionId) {
        window.alert("员工和科室领导必须绑定所属科室。");
        return false;
      }
      if (user.sectionId && !sectionMap.has(user.sectionId)) {
        window.alert("存在账号绑定了不存在的科室，请检查。");
        return false;
      }
      if (!reviewGroups.includes(user.reviewGroup)) {
        window.alert("账号评价组必须来自已配置的组别。");
        return false;
      }
      if (user.role === "employee") {
        const group = user.reviewGroup || sectionMap.get(user.sectionId)?.reviewGroup || reviewGroups[0];
        counts[group] = (counts[group] || 0) + 1;
      }
    }

    for (const group of reviewGroups) {
      const seatTotal = REVIEW_GRADE_LEVELS.reduce((sum, level) => sum + Number(payload.reviewGradeConfig.groups[group]?.[level] || 0), 0);
      if (seatTotal > (counts[group] || 0)) {
        window.alert(`${group}的评分档位总名额不能超过当前组内员工人数。`);
        return false;
      }
    }

    return true;
  }

  function collectAdminConfigFromDom() {
    return {
      departments: collectDepartmentsFromDom(),
      sections: collectSectionsFromDom(),
      users: collectUsersFromDom(),
      reviewGradeConfig: collectGradeConfigFromDom()
    };
  }

  async function saveAdminConfig() {
    const payload = collectAdminConfigFromDom();
    if (!validateAdminConfigPayload(payload)) return;
    const res = await apiPut("/api/admin-config", payload);
    if (!res?.store) return;
    applyStore(res.store, false);
  }

  function refreshAdminQuotaSummary() {
    const payload = collectAdminConfigFromDom();
    const counts = employeeCountsByGroup(payload.users);
    adminRows("[data-admin-group-card]").forEach((card) => {
      const groupInput = card.querySelector("[data-admin-group-name]");
      const group = `${groupInput?.value || ""}`.trim();
      card.dataset.groupName = group;
      const seatTotal = REVIEW_GRADE_LEVELS.reduce(
        (sum, level) => sum + Math.max(0, Number.parseInt(`${card.querySelector(`[data-admin-seat-level="${level}"]`)?.value || 0}`.replace(/[^\d]/g, ""), 10) || 0),
        0
      );
      const totalNode = card.querySelector("[data-admin-quota-total]");
      const noteNode = card.querySelector("[data-admin-quota-note]");
      const summaryItems = card.querySelectorAll(".admin-quota-summary-item strong");
      if (totalNode) totalNode.textContent = `总名额 ${seatTotal} 人`;
      if (noteNode) {
        noteNode.classList.toggle("is-danger", seatTotal > (counts[group] || 0));
      }
      if (summaryItems[0]) summaryItems[0].textContent = `${seatTotal} 人`;
      if (summaryItems[1]) summaryItems[1].textContent = `${counts[group] || 0} 人`;
    });
  }

  function addDepartmentRow() {
    const tbody = document.getElementById("adminDepartmentRows");
    if (!tbody) return;
    tbody.insertAdjacentHTML("beforeend", departmentRow({ id: nextTempId("dept"), name: "" }));
    refreshAdminStructureUi();
  }

  function addSectionRow() {
    const tbody = document.getElementById("adminSectionRows");
    if (!tbody) return;
    const firstDepartmentId = currentAdminDepartments()[0]?.id || "";
    tbody.insertAdjacentHTML(
      "beforeend",
      sectionRow({ id: nextTempId("sec"), name: "", departmentId: firstDepartmentId, reviewGroup: defaultAdminReviewGroup() })
    );
    refreshAdminStructureUi();
  }

  function addStaffRow() {
    const tbody = document.getElementById("adminStaffRows");
    if (!tbody) return;
    const firstDepartmentId = currentAdminDepartments()[0]?.id || "";
    const firstSectionId = currentAdminSections().find((section) => section.departmentId === firstDepartmentId)?.id || "";
    tbody.insertAdjacentHTML(
      "beforeend",
      staffRow({ id: nextTempId("u"), name: "", role: "employee", departmentId: firstDepartmentId, sectionId: firstSectionId, reviewGroup: reviewGroupForSection(firstSectionId) })
    );
    syncAllAdminRows();
    refreshAdminQuotaSummary();
  }

  function addLeaderRow() {
    const tbody = document.getElementById("adminLeaderRows");
    if (!tbody) return;
    const firstDepartmentId = currentAdminDepartments()[0]?.id || "";
    const firstSectionId = currentAdminSections().find((section) => section.departmentId === firstDepartmentId)?.id || "";
    tbody.insertAdjacentHTML(
      "beforeend",
      leaderRow({ id: nextTempId("u"), name: "", role: "section-leader", departmentId: firstDepartmentId, sectionId: firstSectionId, reviewGroup: reviewGroupForSection(firstSectionId) })
    );
    syncAllAdminRows();
  }

  function reviewGroupForSection(sectionId) {
    return currentAdminSections().find((section) => section.id === sectionId)?.reviewGroup || defaultAdminReviewGroup();
  }

  function addGroupCard() {
    const list = document.querySelector(".system-admin-quota-list");
    if (!list) return;
    const group = nextGroupName();
    const counts = employeeCountsByGroup(collectUsersFromDom());
    const config = collectGradeConfigFromDom();
    config.groups[group] = REVIEW_GRADE_LEVELS.reduce((acc, level) => ({ ...acc, [level]: 0 }), {});
    list.insertAdjacentHTML("beforeend", quotaCard(group, config, counts, nextTempId("group")));
    refreshAdminGroupDependentUi();
  }

  function refreshGroupSelect(select, optionsHtml, preferredValue, fallbackValue) {
    if (!select) return;
    const currentValue = preferredValue || select.value;
    select.innerHTML = optionsHtml;
    if (currentValue && Array.from(select.options).some((option) => option.value === currentValue)) {
      select.value = currentValue;
      return;
    }
    if (fallbackValue && Array.from(select.options).some((option) => option.value === fallbackValue)) {
      select.value = fallbackValue;
      return;
    }
    if (select.options.length) {
      select.value = select.options[0].value;
    }
  }

  function refreshAdminStructureUi() {
    const fallbackDepartmentId = currentAdminDepartments()[0]?.id || "";

    adminRows("[data-admin-section-row]").forEach((row) => {
      const departmentSelect = row.querySelector("[data-admin-section-department]");
      refreshGroupSelect(departmentSelect, departmentOptions(departmentSelect?.value), departmentSelect?.value, fallbackDepartmentId);
    });

    adminRows("[data-admin-staff-row], [data-admin-leader-row]").forEach((row) => {
      const departmentSelect = row.querySelector("[data-admin-user-department]");
      refreshGroupSelect(departmentSelect, departmentOptions(departmentSelect?.value), departmentSelect?.value, fallbackDepartmentId);
    });

    syncAllAdminRows();
    refreshAdminGroupDependentUi();
  }

  function renameAdminGroupReferences(fromName, toName) {
    if (!fromName || !toName || fromName === toName) return;
    adminRows("[data-admin-section-row], [data-admin-staff-row], [data-admin-leader-row]").forEach((row) => {
      const groupSelect = row.querySelector("[data-admin-section-group], [data-admin-user-group]");
      if (groupSelect && groupSelect.value === fromName) {
        groupSelect.value = toName;
      }
    });
  }

  function refreshAdminGroupDependentUi() {
    const fallbackGroup = defaultAdminReviewGroup();
    adminRows("[data-admin-section-row]").forEach((row) => {
      const select = row.querySelector("[data-admin-section-group]");
      refreshGroupSelect(select, reviewGroupOptions(select?.value), select?.value, fallbackGroup);
    });

    adminRows("[data-admin-staff-row], [data-admin-leader-row]").forEach((row) => {
      const sectionId = collectRowValue(row, "[data-admin-user-section]");
      const inheritedGroup = reviewGroupForSection(sectionId);
      const select = row.querySelector("[data-admin-user-group]");
      refreshGroupSelect(select, reviewGroupOptions(select?.value), select?.value, inheritedGroup || fallbackGroup);
      syncUserRow(row);
    });

    refreshAdminQuotaSummary();
  }

  function resetAdminConfigView() {
    render();
  }

  function hideBasePanelsForAdmin() {
    refs.statsGrid?.classList.add("hidden");
    document.querySelector(".report-panel")?.classList.add("hidden");
    document.querySelector(".list-panel")?.classList.add("hidden");
    document.getElementById("leaderWorkbench")?.classList.add("hidden");
    document.getElementById("leaderRankingPage")?.classList.add("hidden");
    document.getElementById("reviewConfigPage")?.classList.add("hidden");
  }

  function showBasePanelsForNonAdmin() {
    refs.statsGrid?.classList.remove("hidden");
    document.getElementById("systemAdminConfigPage")?.classList.add("hidden");
    document.querySelector(".toolbar")?.classList.remove("hidden");
  }

  function renderSystemAdminShell() {
    baseRenderShell();
    if (!isSystemAdminRole()) {
      document.querySelector(".toolbar")?.classList.remove("hidden");
      return;
    }

    refs.navList.innerHTML = '<button class="nav-item active" type="button">系统配置</button>';
    refs.sectionTitle.textContent = "系统配置";
    document.querySelector(".toolbar")?.classList.add("hidden");
    refs.newGoalButton?.classList.add("hidden");
  }

  function renderSystemAdminPage() {
    if (!state.store || !state.currentUser) return;
    baseRender();

    if (!isSystemAdminRole()) {
      showBasePanelsForNonAdmin();
      return;
    }

    hideBasePanelsForAdmin();
    renderAdminPage();
  }

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-admin-act]");
    if (!trigger || !isSystemAdminRole()) return;

    const action = trigger.dataset.adminAct;
    if (action === "add-department") {
      addDepartmentRow();
      return;
    }
    if (action === "add-section") {
      addSectionRow();
      return;
    }
    if (action === "add-staff") {
      addStaffRow();
      return;
    }
    if (action === "add-leader") {
      addLeaderRow();
      return;
    }
    if (action === "add-group") {
      addGroupCard();
      return;
    }
    if (action === "remove-row") {
      trigger.closest("tr")?.remove();
      refreshAdminStructureUi();
      return;
    }
    if (action === "remove-group") {
      const cards = adminRows("[data-admin-group-card]");
      if (cards.length <= 1) {
        window.alert("请至少保留一个评价组。");
        return;
      }
      trigger.closest("[data-admin-group-card]")?.remove();
      refreshAdminGroupDependentUi();
      return;
    }
    if (action === "save-config") {
      saveAdminConfig();
      return;
    }
    if (action === "reset-config") {
      resetAdminConfigView();
    }
  });

  document.addEventListener("change", (event) => {
    if (!isSystemAdminRole()) return;
    const row = event.target.closest("[data-admin-staff-row], [data-admin-leader-row]");
    if (row) {
      syncUserRow(row);
    }
    if (event.target.matches("[data-admin-group-name]")) {
      const card = event.target.closest("[data-admin-group-card]");
      const oldName = `${card?.dataset.groupName || ""}`.trim();
      const newName = `${event.target.value || ""}`.trim();
      if (oldName && newName && oldName !== newName) {
        renameAdminGroupReferences(oldName, newName);
      }
      if (card) {
        card.dataset.groupName = newName;
      }
      refreshAdminGroupDependentUi();
      return;
    }
    if (event.target.matches("[data-admin-section-department], [data-admin-user-department]")) {
      refreshAdminStructureUi();
      return;
    }
    if (event.target.matches("[data-admin-section-group]")) {
      refreshAdminGroupDependentUi();
      return;
    }
    if (
      event.target.matches("[data-admin-user-role], [data-admin-user-department], [data-admin-user-section], [data-admin-user-group], [data-admin-seat-group], [data-admin-section-group]")
    ) {
      refreshAdminQuotaSummary();
    }
    if (event.target.matches("[data-admin-seat-level], [data-admin-section-group]")) {
      refreshAdminQuotaSummary();
    }
  });

  document.addEventListener("input", (event) => {
    if (!isSystemAdminRole()) return;
    if (event.target.matches("[data-admin-seat-level]")) {
      const digits = `${event.target.value || ""}`.replace(/[^\d]/g, "");
      event.target.value = digits;
      refreshAdminQuotaSummary();
      return;
    }
    if (event.target.matches("[data-admin-group-name]")) {
      const card = event.target.closest("[data-admin-group-card]");
      if (card) {
        card.dataset.groupName = `${event.target.value || ""}`.trim();
      }
    }
  });

  window.renderShell = renderShell = renderSystemAdminShell;
  window.render = render = renderSystemAdminPage;
})();
