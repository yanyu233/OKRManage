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
  const { toolbar, picker, trigger, prevYear, nextYear, yearRail, quarterGrid } = periodPickerRefs();
  if (!toolbar || !picker || toolbar.dataset.periodPickerBound === "true") return;

  trigger?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    togglePeriodPopover();
  });

  prevYear?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const years = availableYears();
    const minYear = years.at(-1);
    if (!years.length) return;
    state.periodPickerYear = Math.max(minYear, (state.periodPickerYear || years[0]) - 1);
    renderPeriodPopover();
  });

  nextYear?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const years = availableYears();
    const maxYear = years[0];
    if (!years.length) return;
    state.periodPickerYear = Math.min(maxYear, (state.periodPickerYear || years[0]) + 1);
    renderPeriodPopover();
  });

  yearRail?.addEventListener("click", (event) => {
    event.stopPropagation();
    const button = event.target.closest("[data-period-year]");
    if (!button) return;
    state.periodPickerYear = Number(button.dataset.periodYear);
    renderPeriodPopover();
  });

  quarterGrid?.addEventListener("click", (event) => {
    event.stopPropagation();
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
    const path = typeof event.composedPath === "function" ? event.composedPath() : [];
    if (!current || current.contains(event.target) || path.includes(current)) return;
    closePeriodPopover();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closePeriodPopover();
  });

  toolbar.dataset.periodPickerBound = "true";
}

function renderPeriodPopover() {
  const { prevYear, nextYear, yearLabel, yearRail, quarterGrid } = periodPickerRefs();
  if (!yearRail || !quarterGrid) return;

  const years = availableYears();
  const railYears = [...years].reverse();
  const selected = parseCycleId(state.cycleId) || currentDateParts();
  const maxYear = years[0] || selected.year;
  const minYear = years.at(-1) || selected.year;
  const viewingYear = Math.min(maxYear, Math.max(minYear, state.periodPickerYear || selected.year));
  state.periodPickerYear = viewingYear;

  if (yearLabel) yearLabel.textContent = `${viewingYear}年`;
  if (prevYear) prevYear.disabled = viewingYear <= minYear;
  if (nextYear) nextYear.disabled = viewingYear >= maxYear;

  yearRail.innerHTML = railYears
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
