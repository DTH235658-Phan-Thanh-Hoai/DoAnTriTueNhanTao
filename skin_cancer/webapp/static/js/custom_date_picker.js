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
    ? { today: "Today", clear: "Clear", previous: "Previous month", next: "Next month", weekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] }
    : { today: "Hôm nay", clear: "Xóa", previous: "Tháng trước", next: "Tháng sau", weekdays: ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"] };

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
    const state = { input, trigger, popup, month: null, open: false };
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
    function render() {
      const t = labels();
      popup.replaceChildren();
      const header = document.createElement("header");
      header.className = "custom-date-header";
      const prev = document.createElement("button");
      prev.type = "button"; prev.dataset.action = "previous"; prev.setAttribute("data-action", "previous"); prev.setAttribute("aria-label", t.previous); prev.textContent = "‹";
      const title = document.createElement("strong");
      title.className = "custom-date-month";
      title.textContent = locale() === "en-US" ? state.month.toLocaleDateString(locale(), { month: "long", year: "numeric" }) : `Tháng ${state.month.getMonth() + 1} năm ${state.month.getFullYear()}`;
      const next = document.createElement("button");
      next.type = "button"; next.dataset.action = "next"; next.setAttribute("data-action", "next"); next.setAttribute("aria-label", t.next); next.textContent = "›";
      header.append(prev, title, next); popup.appendChild(header);
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
      const action = event.target.dataset.action;
      if (action === "previous" || action === "next") { state.month.setMonth(state.month.getMonth() + (action === "next" ? 1 : -1)); render(); position(); return; }
      if (action === "today") { const now = new Date(); const value = iso(now); const min = input.getAttribute("min") || ""; const max = input.getAttribute("max") || ""; if ((!min || value >= min) && (!max || value <= max)) commit(value); return; }
      if (action === "clear") { commit(""); return; }
      if (event.target.dataset.date && !event.target.disabled) commit(event.target.dataset.date);
    });
    popup.addEventListener("keydown", (event) => {
      const current = parse(event.target.dataset.date);
      if (event.key === "Escape") { event.preventDefault(); close(true); return; }
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
      document.addEventListener("click", (event) => { if (activeState && !activeState.popup.contains(event.target) && event.target !== activeState.trigger) activeState.close(false); });
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
