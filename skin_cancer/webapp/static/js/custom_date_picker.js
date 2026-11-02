(function () {
  "use strict";

  const instances = new WeakMap();
  let nextId = 0;
  let activeState = null;
  let globalListenersBound = false;
  const locale = () => (document.documentElement.lang || "vi").toLowerCase().startsWith("en") ? "en-US" : "vi-VN";
  const parse = (value) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
    if (!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return date.getFullYear() === Number(match[1]) && date.getMonth() === Number(match[2]) - 1 && date.getDate() === Number(match[3]) ? date : null;
  };
  const iso = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const labels = () => locale() === "en-US"
    ? { today: "Today", clear: "Clear", previous: "Previous month", next: "Next month", previousYears: "Previous 12 years", nextYears: "Next 12 years", selectMonth: "Select month", selectYear: "Select year", back: "Back to calendar", chooseMonth: "Choose month", chooseYear: "Choose year", weekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] }
    : { today: "Hôm nay", clear: "Xóa", previous: "Tháng trước", next: "Tháng sau", previousYears: "12 năm trước", nextYears: "12 năm sau", selectMonth: "Chọn tháng", selectYear: "Chọn năm", back: "Quay lại lịch", chooseMonth: "Chọn tháng", chooseYear: "Chọn năm", weekdays: ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"] };

  function enhanceInput(input) {
    if (!input || input.type !== "date" || instances.has(input)) return instances.get(input)?.trigger || null;
    const trigger = document.createElement("input");
    trigger.type = "text";
    trigger.readOnly = true;
    trigger.className = "custom-date-trigger";
    trigger.id = `custom-date-trigger-${++nextId}`;
    trigger.setAttribute("aria-controls", `custom-date-popup-${nextId}`);
    trigger.setAttribute("role", "combobox");
    trigger.setAttribute("aria-haspopup", "dialog");
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("autocomplete", "off");
    input.setAttribute("aria-hidden", "true");
    input.setAttribute("tabindex", "-1");
    input.classList.add("custom-date-source");
    const labelsForInput = input.labels ? Array.from(input.labels) : [];
    labelsForInput.forEach((label) => { label.htmlFor = trigger.id; });
    if (labelsForInput.length) trigger.setAttribute("aria-labelledby", labelsForInput.map((label) => label.id).filter(Boolean).join(" "));
    else if (input.getAttribute("aria-label")) trigger.setAttribute("aria-label", input.getAttribute("aria-label"));
    else trigger.setAttribute("aria-label", "Chọn ngày");
    input.parentNode.insertBefore(trigger, input.nextSibling);

    const popup = document.createElement("section");
    popup.className = "custom-date-calendar";
    popup.id = `custom-date-popup-${nextId}`;
    popup.setAttribute("role", "dialog");
    popup.setAttribute("aria-label", "Chọn ngày");
    popup.hidden = true;
    document.body.appendChild(popup);
    const state = { input, trigger, popup, month: null, open: false, view: "days", yearGroup: null };
    instances.set(input, state);

    function refresh() {
      trigger.value = parse(input.value)?.toLocaleDateString(locale(), { day: "2-digit", month: "2-digit", year: "numeric" }) || "";
      trigger.disabled = input.disabled || input.readOnly;
      trigger.required = input.required;
      trigger.setAttribute("aria-disabled", String(input.disabled));
      if (input.getAttribute("aria-label")) trigger.setAttribute("aria-label", input.getAttribute("aria-label"));
      if (input.value) trigger.removeAttribute("aria-invalid");
      if (state.open) render();
    }
    function close(returnFocus) {
      state.open = false;
      popup.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
      if (activeState === state) activeState = null;
      if (returnFocus) trigger.focus();
    }
    function position() {
      const rect = trigger.getBoundingClientRect();
      popup.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 312))}px`;
      popup.style.top = `${Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - 330))}px`;
      popup.style.maxHeight = `${Math.max(180, window.innerHeight - 16)}px`;
    }
    function open() {
      if (input.disabled || input.readOnly) return;
      if (activeState && activeState !== state) activeState.close(false);
      state.month = parse(input.value) || new Date();
      state.month = new Date(state.month.getFullYear(), state.month.getMonth(), 1);
      state.view = "days";
      state.open = true;
      activeState = state;
      popup.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      render();
      position();
      const selected = popup.querySelector('[aria-pressed="true"]') || Array.from(popup.querySelectorAll("[data-date]")).find((day) => !day.disabled);
      if (selected) selected.focus();
    }
    function commit(value) {
      if (input.value !== value) {
        input.value = value;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
      refresh();
      close(true);
    }
    function focusCalendarDay() {
      const monthPrefix = `${state.month.getFullYear()}-${String(state.month.getMonth() + 1).padStart(2, "0")}-`;
      const selected = popup.querySelector(`[data-date="${input.value}"]`);
      const firstInMonth = Array.from(popup.querySelectorAll("[data-date]")).find((day) => day.dataset.date.startsWith(monthPrefix) && !day.disabled);
      const firstEnabled = Array.from(popup.querySelectorAll("[data-date]")).find((day) => !day.disabled);
      (selected && !selected.disabled ? selected : firstInMonth || firstEnabled)?.focus();
    }
    function button(text, action, ariaLabel) {
      const element = document.createElement("button");
      element.type = "button";
      element.dataset.action = action;
      element.setAttribute("data-action", action);
      element.setAttribute("aria-label", ariaLabel);
      element.textContent = text;
      return element;
    }
    function isMonthAvailable(year, month) {
      const min = input.getAttribute("min") || "";
      const max = input.getAttribute("max") || "";
      const first = iso(new Date(year, month, 1));
      const last = iso(new Date(year, month + 1, 0));
      return (!min || last >= min) && (!max || first <= max);
    }
    function renderChooser() {
      const t = labels();
      const header = document.createElement("header");
      header.className = "custom-date-header";
      const options = document.createElement("div");
      options.className = "custom-date-options";
      options.setAttribute("role", "listbox");
      options.setAttribute("aria-label", state.view === "months" ? t.chooseMonth : t.chooseYear);
      if (state.view === "months") {
        const back = button("‹", "show-days", t.back);
        const title = button(String(state.month.getFullYear()), "select-year", t.selectYear);
        title.className = "custom-date-picker-title";
        header.append(back, title);
        Array.from({ length: 12 }, (_, month) => {
          const monthName = new Date(2020, month, 1).toLocaleDateString(locale(), { month: "long" });
          const option = button(monthName, "choose-month", `${t.chooseMonth}: ${monthName}`);
          option.dataset.month = String(month);
          option.setAttribute("data-month", String(month));
          option.setAttribute("role", "option");
          option.setAttribute("aria-selected", String(month === state.month.getMonth()));
          option.disabled = !isMonthAvailable(state.month.getFullYear(), month);
          if (month === state.month.getMonth()) option.classList.add("is-selected");
          options.appendChild(option);
        });
      } else {
        const previous = button("‹", "previous-years", t.previousYears);
        const title = document.createElement("strong");
        title.className = "custom-date-picker-title";
        title.textContent = `${state.yearGroup}–${state.yearGroup + 11}`;
        title.setAttribute("aria-label", `${t.chooseYear} ${title.textContent}`);
        const next = button("›", "next-years", t.nextYears);
        header.append(previous, title, next);
        Array.from({ length: 12 }, (_, offset) => state.yearGroup + offset).forEach((year) => {
          const option = button(String(year), "choose-year", `${t.chooseYear} ${year}`);
          option.dataset.year = String(year);
          option.setAttribute("data-year", String(year));
          option.setAttribute("role", "option");
          option.setAttribute("aria-selected", String(year === state.month.getFullYear()));
          const min = input.getAttribute("min") || "";
          const max = input.getAttribute("max") || "";
          option.disabled = (min && `${year}-12-31` < min) || (max && `${year}-01-01` > max);
          if (year === state.month.getFullYear()) option.classList.add("is-selected");
          options.appendChild(option);
        });
      }
      popup.append(header, options);
    }
    function render() {
      const t = labels();
      popup.replaceChildren();
      if (state.view !== "days") {
        renderChooser();
        return;
      }
      const header = document.createElement("header");
      header.className = "custom-date-header";
      const prev = button("‹", "previous", t.previous);
      const month = button(locale() === "en-US" ? state.month.toLocaleDateString(locale(), { month: "long" }) : `Tháng ${state.month.getMonth() + 1}`, "select-month", t.selectMonth);
      month.className = "custom-date-month custom-date-month-picker";
      const year = button(String(state.month.getFullYear()), "select-year", t.selectYear);
      year.className = "custom-date-year-picker";
      const next = button("›", "next", t.next);
      header.append(prev, month, year, next); popup.appendChild(header);
      const weekdays = document.createElement("div"); weekdays.className = "custom-date-weekdays"; weekdays.setAttribute("role", "row");
      t.weekdays.forEach((day) => { const cell = document.createElement("span"); cell.setAttribute("role", "columnheader"); cell.textContent = day; weekdays.appendChild(cell); });
      popup.appendChild(weekdays);
      const grid = document.createElement("div"); grid.className = "custom-date-grid"; grid.setAttribute("role", "grid");
      const first = new Date(state.month.getFullYear(), state.month.getMonth(), 1);
      const start = new Date(first); start.setDate(1 - ((first.getDay() + 6) % 7));
      const today = iso(new Date());
      for (let i = 0; i < 42; i++) {
        const day = new Date(start); day.setDate(start.getDate() + i);
        const value = iso(day);
        const button = document.createElement("button");
        button.type = "button"; button.className = "custom-date-day"; button.dataset.date = value; button.setAttribute("data-date", value); button.textContent = String(day.getDate());
        button.setAttribute("aria-label", day.toLocaleDateString(locale(), { dateStyle: "full" }));
        button.setAttribute("aria-pressed", String(input.value === value));
        if (day.getMonth() !== state.month.getMonth()) button.classList.add("is-outside");
        if (value === today) button.classList.add("is-today");
        const min = input.getAttribute("min") || "";
        const max = input.getAttribute("max") || "";
        if ((min && value < min) || (max && value > max)) button.disabled = true;
        grid.appendChild(button);
      }
      popup.appendChild(grid);
      const footer = document.createElement("footer"); footer.className = "custom-date-footer";
      const todayButton = document.createElement("button"); todayButton.type = "button"; todayButton.dataset.action = "today"; todayButton.setAttribute("data-action", "today"); todayButton.textContent = t.today; footer.appendChild(todayButton);
      if (!input.required) { const clear = document.createElement("button"); clear.type = "button"; clear.dataset.action = "clear"; clear.setAttribute("data-action", "clear"); clear.textContent = t.clear; footer.appendChild(clear); }
      popup.appendChild(footer);
    }

    trigger.addEventListener("click", () => state.open ? close(false) : open());
    trigger.addEventListener("keydown", (event) => {
      if (["Enter", " ", "ArrowDown"].includes(event.key)) { event.preventDefault(); open(); }
      else if (event.key === "Escape" && state.open) close(true);
    });
    popup.addEventListener("click", (event) => {
      const actionButton = event.target.closest?.("[data-action]");
      const action = actionButton?.dataset.action;
      if (action === "previous" || action === "next") { state.month = new Date(state.month.getFullYear(), state.month.getMonth() + (action === "next" ? 1 : -1), 1); render(); position(); popup.querySelector(`[data-action="${action}"]`)?.focus(); return; }
      if (action === "select-month") { state.view = "months"; render(); position(); popup.querySelector(`[data-month="${state.month.getMonth()}"]`)?.focus(); return; }
      if (action === "select-year") { state.yearGroup = Math.floor(state.month.getFullYear() / 12) * 12; state.view = "years"; render(); position(); popup.querySelector(`[data-year="${state.month.getFullYear()}"]`)?.focus(); return; }
      if (action === "previous-years" || action === "next-years") { state.yearGroup += action === "next-years" ? 12 : -12; render(); position(); popup.querySelector(`[data-action="${action}"]`)?.focus(); return; }
      if (action === "show-days") { state.view = "days"; render(); position(); popup.querySelector('[data-action="select-month"]')?.focus(); return; }
      if (action === "choose-month" && !actionButton.disabled) { state.month = new Date(state.month.getFullYear(), Number(actionButton.dataset.month), 1); state.view = "days"; render(); position(); focusCalendarDay(); return; }
      if (action === "choose-year" && !actionButton.disabled) { state.month = new Date(Number(actionButton.dataset.year), state.month.getMonth(), 1); state.view = "days"; render(); position(); focusCalendarDay(); return; }
      if (action === "today") { const now = new Date(); const value = iso(now); const min = input.getAttribute("min") || ""; const max = input.getAttribute("max") || ""; if ((!min || value >= min) && (!max || value <= max)) commit(value); return; }
      if (action === "clear") { commit(""); return; }
      if (event.target.dataset.date && !event.target.disabled) commit(event.target.dataset.date);
    });
    popup.addEventListener("keydown", (event) => {
      const current = parse(event.target.dataset.date);
      if (event.key === "Escape") { event.preventDefault(); if (state.view !== "days") { const previousView = state.view; state.view = "days"; render(); popup.querySelector(`[data-action="select-${previousView === "months" ? "month" : "year"}"]`)?.focus(); } else close(true); return; }
      if (event.key === "Tab") { close(false); return; }
      if (event.key === "Enter" || event.key === " ") { if (current) { event.preventDefault(); commit(iso(current)); } return; }
      if (!current || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
      event.preventDefault();
      const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
      current.setDate(current.getDate() + delta);
      if (current.getMonth() !== state.month.getMonth()) { state.month = new Date(current.getFullYear(), current.getMonth(), 1); render(); }
      const target = popup.querySelector(`[data-date="${iso(current)}"]`);
      if (target && !target.disabled) target.focus();
    });
    input.addEventListener("change", refresh);
    input.addEventListener("input", refresh);
    input.addEventListener("invalid", () => { trigger.setAttribute("aria-invalid", "true"); trigger.focus(); });
    if (input.form) input.form.addEventListener("reset", () => window.setTimeout(refresh, 0));
    state.close = close;
    state.position = position;
    if (!globalListenersBound) {
      document.addEventListener("click", (event) => { const path = event.composedPath?.() || []; if (activeState && !path.includes(activeState.popup) && !activeState.popup.contains(event.target) && event.target !== activeState.trigger) activeState.close(false); });
      window.addEventListener("resize", () => activeState?.position());
      window.addEventListener("scroll", () => activeState?.position(), true);
      globalListenersBound = true;
    }
    refresh();
    return trigger;
  }

  function enhance(root) {
    (root || document).querySelectorAll('input[type="date"]').forEach(enhanceInput);
  }
  window.CustomDatePicker = { enhance, refresh(input) { const state = instances.get(input); if (state) { state.trigger.value = parse(input.value)?.toLocaleDateString(locale(), { day: "2-digit", month: "2-digit", year: "numeric" }) || ""; state.trigger.disabled = input.disabled || input.readOnly; state.trigger.required = input.required; if (state.open) state.popup.querySelectorAll("[data-date]").forEach((day) => day.setAttribute("aria-pressed", String(day.dataset.date === input.value))); } } };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => enhance(document));
  else enhance(document);
  if (window.MutationObserver) new window.MutationObserver((records) => records.forEach((record) => record.addedNodes.forEach((node) => { if (node.nodeType === 1) enhance(node); }))).observe(document.body, { childList: true, subtree: true });
})();
