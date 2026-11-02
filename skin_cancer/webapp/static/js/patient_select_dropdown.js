(function (window, document) {
  "use strict";

  const selector = "select[data-custom-dropdown]";
  const instances = new WeakMap();
  const openInstances = new Set();
  const resetForms = new WeakSet();
  let nextId = 0;

  function uniqueId(prefix) {
    let id;
    do id = `custom-select-${prefix}-${++nextId}`;
    while (document.getElementById(id));
    return id;
  }

  function optionsOf(select) {
    return Array.from(select.options).map((option, index) => ({
      option,
      index,
      disabled: option.disabled || Boolean(option.parentElement?.disabled),
    }));
  }

  function enhanceSelect(select) {
    if (!select?.matches?.(selector)) return null;
    if (instances.has(select)) return instances.get(select);

    const labels = Array.from(select.labels || []);
    const control = document.createElement("span");
    control.className = "custom-select";
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "custom-select-trigger";
    trigger.setAttribute("role", "combobox");
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    const triggerId = uniqueId("trigger");
    const menuId = uniqueId("listbox");
    const valueId = uniqueId("value");
    trigger.id = triggerId;
    trigger.setAttribute("aria-controls", menuId);

    const valueLabel = document.createElement("span");
    valueLabel.className = "custom-select-value";
    valueLabel.id = valueId;
    trigger.append(valueLabel);

    const chevron = document.createElement("span");
    chevron.className = "custom-select-chevron";
    chevron.setAttribute("aria-hidden", "true");
    chevron.textContent = "";
    trigger.append(chevron);

    const menu = document.createElement("div");
    menu.id = menuId;
    menu.className = "custom-select-menu";
    menu.setAttribute("role", "listbox");
    menu.setAttribute("aria-hidden", "true");

    const associatedLabelIds = labels.map((label) => {
      if (!label.id) label.id = uniqueId("label");
      label.htmlFor = triggerId;
      return label.id;
    });
    const nativeLabel = select.getAttribute("aria-label");
    const nativeLabelledBy = select.getAttribute("aria-labelledby");
    if (associatedLabelIds.length || nativeLabelledBy) {
      trigger.setAttribute("aria-labelledby", [...associatedLabelIds, nativeLabelledBy, valueId].filter(Boolean).join(" "));
      menu.setAttribute("aria-labelledby", associatedLabelIds[0] || nativeLabelledBy || valueId);
    } else {
      trigger.setAttribute("aria-label", nativeLabel || select.title || select.name || select.id || "Ch\u1ECDn m\u1ED9t gi\u00E1 tr\u1ECB");
      menu.setAttribute("aria-label", nativeLabel || select.title || select.name || select.id || "C\u00E1c l\u1EF1a ch\u1ECDn");
    }

    const rect = select.getBoundingClientRect?.();
    const parentWidth = select.parentElement?.getBoundingClientRect?.().width || 0;
    const selectStyle = window.getComputedStyle?.(select);
    const computedWidth = selectStyle?.width;
    if (selectStyle?.margin) control.style.margin = selectStyle.margin;
    if ((rect?.width && parentWidth && rect.width >= parentWidth - 2) || computedWidth?.endsWith("%")) control.classList.add("custom-select-full-width");
    else if (rect?.width) control.style.width = `${rect.width}px`;

    const labelParent = labels.find((label) => label.contains(select));
    if (labelParent) labelParent.insertBefore(control, select);
    else select.parentNode?.insertBefore(control, select);
    control.append(trigger);
    control.append(select);
    select.classList.add("custom-select-native");
    select.setAttribute("aria-hidden", "true");
    select.setAttribute("tabindex", "-1");
    document.body.append(menu);

    let activeIndex = -1;
    let renderedOptions = [];
    let opened = false;

    function setExpanded(expanded) {
      opened = expanded;
      control.classList.toggle("is-open", expanded);
      menu.classList.toggle("is-open", expanded);
      trigger.setAttribute("aria-expanded", String(expanded));
      menu.setAttribute("aria-hidden", String(!expanded));
      if (!expanded) trigger.removeAttribute("aria-activedescendant");
      if (expanded) openInstances.add(instance);
      else openInstances.delete(instance);
    }

    function setActive(index) {
      activeIndex = index;
      const item = renderedOptions[index];
      renderedOptions.forEach((node, itemIndex) => node.classList.toggle("is-active", itemIndex === index));
      if (item) {
        trigger.setAttribute("aria-activedescendant", item.id);
        item.scrollIntoView?.({ block: "nearest" });
      } else trigger.removeAttribute("aria-activedescendant");
    }

    function enabledIndexes() {
      return optionsOf(select).filter((item) => !item.disabled).map((item) => item.index);
    }

    function positionMenu() {
      const bounds = trigger.getBoundingClientRect();
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const gap = 8;
      const sidePadding = 12;
      const width = Math.min(bounds.width, Math.max(0, viewportWidth - sidePadding * 2));
      const left = Math.max(sidePadding, Math.min(bounds.left, viewportWidth - sidePadding - width));
      const above = Math.max(0, bounds.top - gap - sidePadding);
      const below = Math.max(0, viewportHeight - bounds.bottom - gap - sidePadding);
      const placement = above > below ? "top" : "bottom";
      menu.style.left = `${left}px`;
      menu.style.width = `${width}px`;
      menu.style.maxHeight = `${Math.min(280, placement === "top" ? above : below)}px`;
      menu.style.top = placement === "bottom" ? `${bounds.bottom + gap}px` : "auto";
      menu.style.bottom = placement === "top" ? `${viewportHeight - bounds.top + gap}px` : "auto";
      menu.dataset.placement = placement;
    }

    function openMenu() {
      if (select.disabled) return;
      openInstances.forEach((other) => { if (other !== instance) other.close(); });
      positionMenu();
      setExpanded(true);
      const enabled = enabledIndexes();
      const selected = select.selectedIndex;
      setActive(enabled.includes(selected) ? selected : (enabled[0] ?? -1));
    }

    function closeMenu() {
      setExpanded(false);
      activeIndex = -1;
    }

    function moveActive(direction) {
      const enabled = enabledIndexes();
      if (!enabled.length) return;
      const current = enabled.indexOf(activeIndex);
      const next = current < 0
        ? (direction > 0 ? 0 : enabled.length - 1)
        : (current + direction + enabled.length) % enabled.length;
      setActive(enabled[next]);
    }

    function chooseOption(option) {
      if (option.disabled || select.disabled) return;
      if (select.value !== option.value) {
        select.value = option.value;
        refresh();
        select.dispatchEvent(new window.Event("change", { bubbles: true }));
      }
      closeMenu();
      trigger.focus();
    }

    function renderOption(option, index, groupDisabled = false, parent = menu) {
      const item = document.createElement("div");
      item.id = `${triggerId}-option-${index}`;
      item.className = "custom-select-option";
      item.setAttribute("role", "option");
      item.setAttribute("aria-selected", String(option.value === select.value));
      const disabled = option.disabled || groupDisabled;
      item.setAttribute("aria-disabled", String(disabled));
      item.textContent = option.label || option.textContent;
      if (option.value === select.value) item.classList.add("is-selected");
      if (disabled) item.classList.add("is-disabled");
      item.addEventListener("mouseenter", () => { if (!disabled) setActive(index); });
      item.addEventListener("click", () => { if (!disabled) chooseOption(option); });
      const check = document.createElement("span");
      check.className = "custom-select-check";
      check.setAttribute("aria-hidden", "true");
      check.textContent = "";
      item.append(check);
      parent.append(item);
      renderedOptions[index] = item;
    }

    function refresh() {
      const entries = optionsOf(select);
      const selected = entries.find(({ option }) => option.value === select.value)?.option;
      valueLabel.textContent = selected?.label || selected?.textContent || select.dataset.placeholder || "Kh\u00F4ng c\u00F3 l\u1EF1a ch\u1ECDn";
      trigger.disabled = select.disabled;
      trigger.setAttribute("aria-disabled", String(select.disabled));
      trigger.setAttribute("aria-valuetext", valueLabel.textContent);
      if (select.required) trigger.setAttribute("aria-required", "true");
      else trigger.removeAttribute("aria-required");
      menu.replaceChildren();
      renderedOptions = [];

      let index = 0;
      Array.from(select.children).forEach((child) => {
        if (child.tagName === "OPTGROUP") {
          const group = document.createElement("div");
          group.className = "custom-select-group";
          group.setAttribute("role", "group");
          group.setAttribute("aria-label", child.label || "");
          menu.append(group);
          child.options.forEach((option) => renderOption(option, index++, child.disabled, group));
        } else if (child.tagName === "OPTION") renderOption(child, index++);
      });

      if (!entries.length) {
        const empty = document.createElement("div");
        empty.className = "custom-select-empty";
        empty.setAttribute("role", "status");
        empty.textContent = select.dataset.emptyLabel || "Kh\u00F4ng c\u00F3 l\u1EF1a ch\u1ECDn";
        menu.append(empty);
      }
      if (select.disabled) closeMenu();
      else if (opened) {
        const enabled = enabledIndexes();
        const selectedIndex = select.selectedIndex;
        setActive(enabled.includes(selectedIndex) ? selectedIndex : (enabled[0] ?? -1));
      }
    }

    const instance = { select, control, trigger, menu, refresh, close: closeMenu, position: positionMenu };
    instances.set(select, instance);
    trigger.addEventListener("click", () => {
      if (select.disabled) return;
      if (opened) closeMenu();
      else openMenu();
    });
    trigger.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (!opened) openMenu();
        moveActive(event.key === "ArrowDown" ? 1 : -1);
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (!opened) openMenu();
        else {
          const option = select.options[activeIndex];
          if (option) chooseOption(option);
        }
      } else if (event.key === "Escape" && opened) {
        event.preventDefault();
        closeMenu();
        trigger.focus();
      } else if (event.key === "Tab" && opened) closeMenu();
    });
    trigger.addEventListener("focusout", () => {
      if (opened) window.setTimeout(() => {
        if (!control.contains(document.activeElement) && !menu.contains(document.activeElement)) closeMenu();
      }, 0);
    });
    select.addEventListener("change", () => {
      trigger.removeAttribute("aria-invalid");
      refresh();
    });
    select.addEventListener("invalid", () => {
      trigger.setAttribute("aria-invalid", "true");
      trigger.focus();
      openMenu();
    }, true);
    const form = select.form;
    if (form && !resetForms.has(form)) {
      resetForms.add(form);
      form.addEventListener("reset", () => window.setTimeout(() => refreshAll(form), 0));
    }

    refresh();
    return instance;
  }

  function findSelects(root) {
    if (root?.matches?.(selector)) return [root];
    return Array.from(root?.querySelectorAll?.(selector) || []);
  }

  function enhance(root = document) {
    return findSelects(root).map((select) => enhanceSelect(select)).filter(Boolean);
  }

  function refresh(select) {
    instances.get(select)?.refresh();
  }

  function refreshAll(root = document) {
    findSelects(root).forEach(refresh);
  }

  document.addEventListener("click", (event) => {
    openInstances.forEach((instance) => {
      if (!instance.control.contains(event.target) && !instance.menu.contains(event.target)) instance.close();
    });
  });
  const repositionOpenMenus = () => openInstances.forEach((instance) => instance.position());
  document.addEventListener("scroll", repositionOpenMenus, true);
  window.addEventListener("resize", repositionOpenMenus);

  const observer = new window.MutationObserver((records) => {
    const touched = new Set();
    records.forEach((record) => {
      const select = record.target.matches?.(selector) ? record.target : record.target.closest?.(selector);
      if (select) touched.add(select);
      record.addedNodes?.forEach((node) => enhance(node));
    });
    touched.forEach(refresh);
  });
  if (document.body) observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled", "selected", "value", "label"] });

  window.CustomSelectDropdown = { enhance, refresh, refreshAll };
  enhance(document);
})(window, document);
