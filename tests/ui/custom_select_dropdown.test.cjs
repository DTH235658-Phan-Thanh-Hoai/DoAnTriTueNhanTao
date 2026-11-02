const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "../..");
const scriptPath = path.join(root, "skin_cancer/webapp/static/js/patient_select_dropdown.js");
const templatePath = path.join(root, "skin_cancer/webapp/templates/index.html");
const adminTemplatePath = path.join(root, "skin_cancer/webapp/templates/admin.html");
const cssPath = path.join(root, "skin_cancer/webapp/static/css/custom-select.css");
const adminScriptPath = path.join(root, "skin_cancer/webapp/static/js/admin.js");
const adminCasesPath = path.join(root, "skin_cancer/webapp/static/js/admin_cases.js");
const patientScriptPath = path.join(root, "skin_cancer/webapp/static/js/patient.js");

class FakeEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.bubbles = Boolean(options.bubbles);
    this.cancelable = Boolean(options.cancelable);
    this.defaultPrevented = false;
  }
  preventDefault() { this.defaultPrevented = true; }
  stopPropagation() { this.propagationStopped = true; }
}

class FakeClassList {
  constructor(element) { this.element = element; this.values = new Set(); }
  add(...values) { values.forEach((value) => this.values.add(value)); }
  remove(...values) { values.forEach((value) => this.values.delete(value)); }
  contains(value) { return this.values.has(value); }
  toggle(value, force = !this.values.has(value)) {
    force ? this.values.add(value) : this.values.delete(value);
    return force;
  }
}

class FakeMutationObserver {
  static observers = [];
  constructor(callback) { this.callback = callback; this.root = null; FakeMutationObserver.observers.push(this); }
  observe(rootNode) { this.root = rootNode; }
  disconnect() { this.root = null; }
  static notify(record) {
    queueMicrotask(() => {
      for (const observer of FakeMutationObserver.observers) {
        if (observer.root?.contains(record.target) || observer.root === record.target) observer.callback([record]);
      }
    });
  }
}

class FakeElement {
  constructor(tagName, document) {
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = document;
    this.parentElement = null;
    this.parentNode = null;
    this.children = [];
    this.listeners = new Map();
    this.attributes = new Map();
    this.dataset = {};
    this.style = {};
    this.classList = new FakeClassList(this);
    this._textContent = "";
    this._className = "";
    this.disabled = false;
    this.hidden = false;
    this.id = "";
    this.name = "";
    this.type = "";
    this.value = "";
    this.defaultValue = "";
    this.scrollTop = 0;
  }
  set className(value) {
    this._className = value;
    this.classList.values = new Set(String(value).split(/\s+/).filter(Boolean));
  }
  get className() { return this._className || [...this.classList.values].join(" "); }
  get textContent() { return this._textContent + this.children.map((child) => child.textContent).join(""); }
  set textContent(value) { this._textContent = String(value ?? ""); }
  append(...nodes) { nodes.forEach((node) => this.appendChild(node)); }
  appendChild(node) {
    if (node.parentNode) node.parentNode.removeChild(node, false);
    node.parentNode = this;
    node.parentElement = this.tagName === "#DOCUMENT" ? null : this;
    this.children.push(node);
    FakeMutationObserver.notify({ type: "childList", target: this, addedNodes: [node], removedNodes: [] });
    return node;
  }
  insertBefore(node, reference) {
    if (node.parentNode) node.parentNode.removeChild(node, false);
    const index = reference ? this.children.indexOf(reference) : -1;
    node.parentNode = this;
    node.parentElement = this.tagName === "#DOCUMENT" ? null : this;
    if (index < 0) this.children.push(node);
    else this.children.splice(index, 0, node);
    FakeMutationObserver.notify({ type: "childList", target: this, addedNodes: [node], removedNodes: [] });
    return node;
  }
  removeChild(node, notify = true) {
    const index = this.children.indexOf(node);
    if (index >= 0) this.children.splice(index, 1);
    node.parentNode = node.parentElement = null;
    if (notify) FakeMutationObserver.notify({ type: "childList", target: this, addedNodes: [], removedNodes: [node] });
    return node;
  }
  replaceChildren(...nodes) {
    const removedNodes = [...this.children];
    this.children.forEach((node) => { node.parentNode = node.parentElement = null; });
    this.children = [];
    nodes.forEach((node) => {
      node.parentNode = this;
      node.parentElement = this;
      this.children.push(node);
    });
    FakeMutationObserver.notify({ type: "childList", target: this, addedNodes: nodes, removedNodes });
  }
  addEventListener(type, listener, options) {
    const listeners = this.listeners.get(type) || [];
    listeners.push({ listener, once: Boolean(options?.once) });
    this.listeners.set(type, listeners);
  }
  dispatchEvent(event) {
    event.target ||= this;
    let current = this;
    while (current) {
      event.currentTarget = current;
      const listeners = current.listeners?.get(event.type) || [];
      for (const entry of [...listeners]) {
        entry.listener(event);
        if (entry.once) current.listeners.set(event.type, listeners.filter((item) => item !== entry));
      }
      if (!event.bubbles || event.propagationStopped) break;
      current = current.parentNode;
    }
    return !event.defaultPrevented;
  }
  click() { this.dispatchEvent(new FakeEvent("click", { bubbles: true })); }
  focus() { this.ownerDocument.activeElement = this; }
  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name === "id") this.id = String(value);
    if (name === "name") this.name = String(value);
    if (name === "disabled") this.disabled = true;
    if (name === "data-custom-dropdown") this.dataset.customDropdown = "";
    FakeMutationObserver.notify({ type: "attributes", target: this, attributeName: name });
  }
  getAttribute(name) {
    if (name === "id" && this.id) return this.id;
    if (name === "name" && this.name) return this.name;
    if (name === "disabled" && this.disabled) return "";
    return this.attributes.get(name) ?? null;
  }
  removeAttribute(name) {
    this.attributes.delete(name);
    if (name === "disabled") this.disabled = false;
    FakeMutationObserver.notify({ type: "attributes", target: this, attributeName: name });
  }
  matches(selector) {
    if (selector === "select[data-custom-dropdown]") return this.tagName === "SELECT" && this.hasAttribute("data-custom-dropdown");
    const attribute = selector.match(/^\[([^=\]]+)(?:=["']?([^\]"']+)["']?)?\]$/);
    if (attribute) return this.hasAttribute(attribute[1]) && (attribute[2] === undefined || this.getAttribute(attribute[1]) === attribute[2]);
    if (selector.startsWith(".")) return this.classList.contains(selector.slice(1));
    return this.tagName.toLowerCase() === selector.toLowerCase();
  }
  hasAttribute(name) { return this.attributes.has(name) || (name === "disabled" && this.disabled); }
  closest(selector) {
    let node = this;
    while (node) {
      if (node.matches?.(selector)) return node;
      node = node.parentElement;
    }
    return null;
  }
  contains(node) { return this === node || this.children.some((child) => child.contains(node)); }
  querySelectorAll(selector) {
    const selectors = selector.split(",").map((item) => item.trim());
    return this.children.flatMap((child) => [
      ...(selectors.some((item) => child.matches?.(item)) ? [child] : []),
      ...child.querySelectorAll(selector),
    ]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  getBoundingClientRect() { return { left: 40, right: 220, top: 100, bottom: 140, width: 180, height: 40 }; }
  scrollIntoView() {}
  get options() {
    if (this.tagName !== "SELECT") return undefined;
    return this.children.flatMap((child) => child.tagName === "OPTGROUP" ? child.options : child.tagName === "OPTION" ? [child] : []);
  }
  get selectedIndex() { return this.options?.findIndex((option) => option.value === this.value) ?? -1; }
  get labels() {
    const labels = [];
    let node = this.parentElement;
    while (node) { if (node.tagName === "LABEL") labels.push(node); node = node.parentElement; }
    return labels;
  }
  get form() { return this.closest("form"); }
  get label() { return this.textContent; }
  reset() { this.dispatchEvent(new FakeEvent("reset", { bubbles: true })); }
}

class FakeSelect extends FakeElement {
  constructor(document, value = "") { super("select", document); this._value = value; }
  get value() {
    const selected = this.options.find((option) => option.selected) || this.options.find((option) => option.value === this._value);
    return selected?.value ?? this._value;
  }
  set value(value) {
    this._value = String(value);
    this.options.forEach((option) => { option.selected = option.value === this._value; });
  }
}

class FakeDocument extends FakeElement {
  constructor() {
    super("#document", null);
    this.ownerDocument = this;
    this.activeElement = null;
    this.body = new FakeElement("body", this);
    this.documentElement = new FakeElement("html", this);
    this.documentElement.clientWidth = 1024;
    this.documentElement.clientHeight = 768;
    this.appendChild(this.body);
  }
  createElement(tagName) { return tagName.toLowerCase() === "select" ? new FakeSelect(this) : new FakeElement(tagName, this); }
  getElementById(id) { return this.querySelectorAll("*").find((node) => node.id === id) || null; }
  querySelectorAll(selector) {
    if (selector === "*") return this.children.flatMap((child) => [child, ...child.querySelectorAll("*")]);
    return super.querySelectorAll(selector);
  }
}

function option(document, value, text, { selected = false, disabled = false } = {}) {
  const item = document.createElement("option");
  item.value = value;
  item.textContent = text;
  item.selected = selected;
  item.disabled = disabled;
  return item;
}

async function setup({ count = 1, wrapInLabel = false } = {}) {
  FakeMutationObserver.observers = [];
  const document = new FakeDocument();
  const form = document.createElement("form");
  document.body.append(form);
  const selects = [];
  const labels = [];
  for (let index = 0; index < count; index += 1) {
    const field = document.createElement(wrapInLabel ? "label" : "div");
    field.textContent = `Field ${index}`;
    const select = document.createElement("select");
    select.name = `choice${index}`;
    select.id = `choice${index}`;
    select.setAttribute("data-custom-dropdown", "");
    select.append(option(document, "", "Choose...", { selected: true }));
    select.append(option(document, "a", "Option A"));
    select.append(option(document, "b", "Option B"));
    if (wrapInLabel) field.append(select);
    else {
      const label = document.createElement("label");
      label.id = `label${index}`;
      label.textContent = `Label ${index}`;
      label.setAttribute("for", select.id);
      field.append(label);
      field.append(select);
      labels.push(label);
    }
    form.append(field);
    selects.push(select);
  }
  const window = {
    innerWidth: 1024,
    innerHeight: 600,
    Event: FakeEvent,
    MutationObserver: FakeMutationObserver,
    addEventListener() {},
    getComputedStyle() { return { width: "180px" }; },
    setTimeout,
  };
  vm.runInNewContext(fs.readFileSync(scriptPath, "utf8"), {
    window,
    document,
    MutationObserver: FakeMutationObserver,
    Event: FakeEvent,
    setTimeout,
    queueMicrotask,
    Array,
    String,
    Math,
    Number,
  });
  await new Promise((resolve) => setImmediate(resolve));
  return { document, window, form, selects, labels };
}

test("component exposes a reusable initializer for marked native selects", async () => {
  const { window } = await setup();
  assert.equal(typeof window.CustomSelectDropdown?.enhance, "function");
});

test("multiple selects get unique controls and one native change per actual value change", async () => {
  const { document, window, selects } = await setup({ count: 3 });
  const triggers = document.querySelectorAll(".custom-select-trigger");
  assert.equal(triggers.length, 3);
  assert.equal(new Set(triggers.map((trigger) => trigger.id)).size, 3);
  let changes = 0;
  selects[0].addEventListener("change", () => changes++);
  triggers[0].click();
  const options = document.querySelectorAll("[role=option]");
  options.find((item) => item.textContent.startsWith("Option A")).click();
  assert.equal(selects[0].value, "a");
  assert.equal(changes, 1);
  triggers[0].click();
  document.querySelectorAll("[role=option]").find((item) => item.textContent.startsWith("Option A")).click();
  assert.equal(changes, 1);
  assert.equal(typeof window.CustomSelectDropdown.refresh, "function");
});

test("option mutations and later inserted selects are enhanced without duplicate listeners", async () => {
  const { document, window, selects } = await setup();
  const select = selects[0];
  select.append(option(document, "c", "Option C"));
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(document.querySelectorAll("[role=option]").some((item) => item.textContent.startsWith("Option C")));
  window.CustomSelectDropdown.enhance(document);
  window.CustomSelectDropdown.enhance(document);
  assert.equal((select.listeners.get("change") || []).length, 1);

  const dynamic = document.createElement("select");
  dynamic.name = "dynamic";
  dynamic.setAttribute("data-custom-dropdown", "");
  dynamic.append(option(document, "x", "Dynamic option"));
  document.body.append(dynamic);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(document.querySelectorAll(".custom-select-trigger").length, 2);
});

test("direct value writes, disabled state, and form reset sync the custom display", async () => {
  const { document, window, form, selects } = await setup();
  const select = selects[0];
  const trigger = document.querySelector(".custom-select-trigger");
  select.value = "b";
  window.CustomSelectDropdown.refresh(select);
  assert.match(document.querySelector(".custom-select-trigger").textContent, /Option B/);
  select.disabled = true;
  window.CustomSelectDropdown.refresh(select);
  assert.equal(trigger.disabled, true);
  select.disabled = false;
  select.value = "a";
  form.reset();
  select.value = "";
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.match(trigger.textContent, /Choose/);
});

test("keyboard, disabled options, and outside click follow listbox behavior", async () => {
  const { document, selects } = await setup();
  const select = selects[0];
  select.options[1].disabled = true;
  const trigger = document.querySelector(".custom-select-trigger");
  const key = (value) => trigger.dispatchEvent(Object.assign(new FakeEvent("keydown"), { key: value }));
  key("Enter");
  assert.equal(trigger.getAttribute("aria-expanded"), "true");
  key("ArrowDown");
  assert.equal(trigger.getAttribute("aria-activedescendant"), document.querySelectorAll("[role=option]").at(-1).id);
  key("Enter");
  assert.equal(select.value, "b");
  key(" ");
  key("Escape");
  assert.equal(trigger.getAttribute("aria-expanded"), "false");
  trigger.click();
  document.body.click();
  assert.equal(trigger.getAttribute("aria-expanded"), "false");
});

test("dropdown list is portaled out of clipping containers and keeps the native form value", async () => {
  const { document, selects } = await setup({ wrapInLabel: true });
  const select = selects[0];
  const trigger = document.querySelector(".custom-select-trigger");
  const menu = document.querySelector(".custom-select-menu");
  assert.equal(menu.parentElement, document.body);
  assert.equal(select.name, "choice0");
  assert.equal(select.getAttribute("aria-hidden"), "true");
  assert.equal(select.getAttribute("tabindex"), "-1");
  assert.equal(trigger.getAttribute("aria-expanded"), "false");
});

test("all dropdowns use shared theme styles and only existing select controls are marked", () => {
  const template = fs.readFileSync(templatePath, "utf8");
  const adminTemplate = fs.readFileSync(adminTemplatePath, "utf8");
  const adminScript = fs.readFileSync(adminScriptPath, "utf8");
  const adminCases = fs.readFileSync(adminCasesPath, "utf8");
  const patientScript = fs.readFileSync(patientScriptPath, "utf8");
  const css = fs.readFileSync(cssPath, "utf8");
  const staticSelects = [...template.matchAll(/<select\b[^>]*>/g), ...adminTemplate.matchAll(/<select\b[^>]*>/g)];
  assert.equal(staticSelects.length, 12);
  assert.ok(staticSelects.every(([markup]) => markup.includes("data-custom-dropdown")));
  assert.match(adminScript, /role-select" data-custom-dropdown/);
  assert.match(adminScript, /security-timeout" data-custom-dropdown/);
  assert.match(adminScript, /security-password" data-custom-dropdown/);
  assert.match(adminScript, /role-filter"\)\.value = "";[\s\S]*CustomSelectDropdown\?\.refresh/);
  assert.match(adminScript, /users-table"\)\.innerHTML[\s\S]*CustomSelectDropdown\?\.enhance/);
  assert.match(adminCases, /doctorSelect\.value = selected;[\s\S]*CustomSelectDropdown\?\.refresh\(doctorSelect\)/);
  assert.match(adminCases, /case-reset[\s\S]*CustomSelectDropdown\?\.refresh/);
  assert.match(patientScript, /patientProfileGender"\)\.value = user\.gender[\s\S]*CustomSelectDropdown\?\.refresh/);
  assert.match(css, /html\[data-theme="dark"\]/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /#2ba149/);
});
