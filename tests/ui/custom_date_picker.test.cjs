const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "../..");
const scriptPath = path.join(root, "skin_cancer/webapp/static/js/custom_date_picker.js");
const cssPath = path.join(root, "skin_cancer/webapp/static/css/custom-date-picker.css");

class FakeEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.bubbles = Boolean(options.bubbles);
    this.defaultPrevented = false;
  }
  preventDefault() { this.defaultPrevented = true; }
  stopPropagation() { this.propagationStopped = true; }
}

class FakeClassList {
  constructor() { this.values = new Set(); }
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
  static notify(record) {
    record.addedNodes ||= [];
    queueMicrotask(() => FakeMutationObserver.observers.forEach((observer) => {
      if (observer.root?.contains(record.target)) observer.callback([record]);
    }));
  }
}

class FakeElement {
  constructor(tagName, document) {
    this.nodeType = 1;
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = document;
    this.parentElement = null;
    this.parentNode = null;
    this.children = [];
    this.listeners = new Map();
    this.attributes = new Map();
    this.dataset = {};
    this.style = {};
    this.classList = new FakeClassList();
    this._className = "";
    this.textContent = "";
    this.id = "";
    this.name = "";
    this.type = "";
    this.value = "";
    this.defaultValue = "";
    this.disabled = false;
    this.required = false;
    this.readOnly = false;
    this.tabIndex = 0;
  }
  get className() { return this._className; }
  set className(value) { this._className = String(value); this.classList = new FakeClassList(); this._className.split(/\s+/).filter(Boolean).forEach((name) => this.classList.add(name)); }
  append(...nodes) { nodes.forEach((node) => this.appendChild(node)); }
  appendChild(node) {
    if (node.parentNode) node.parentNode.removeChild(node);
    node.parentNode = this;
    node.parentElement = this.tagName === "#DOCUMENT" ? null : this;
    this.children.push(node);
    FakeMutationObserver.notify({ target: this, addedNodes: [node] });
    return node;
  }
  insertBefore(node, reference) {
    if (node.parentNode) node.parentNode.removeChild(node);
    const index = reference ? this.children.indexOf(reference) : -1;
    node.parentNode = this;
    node.parentElement = this.tagName === "#DOCUMENT" ? null : this;
    if (index < 0) this.children.push(node);
    else this.children.splice(index, 0, node);
    FakeMutationObserver.notify({ target: this, addedNodes: [node] });
    return node;
  }
  removeChild(node) {
    const index = this.children.indexOf(node);
    if (index >= 0) this.children.splice(index, 1);
    node.parentNode = node.parentElement = null;
    return node;
  }
  replaceChildren(...nodes) {
    this.children.forEach((node) => { node.parentNode = node.parentElement = null; });
    this.children = [];
    nodes.forEach((node) => {
      node.parentNode = node.parentElement = this;
      this.children.push(node);
    });
    FakeMutationObserver.notify({ target: this, addedNodes: nodes });
  }
  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }
  dispatchEvent(event) {
    event.target ||= this;
    let node = this;
    while (node) {
      event.currentTarget = node;
      (node.listeners?.get(event.type) || []).forEach((listener) => listener(event));
      if (!event.bubbles || event.propagationStopped) break;
      node = node.parentNode;
    }
    return !event.defaultPrevented;
  }
  click() { this.dispatchEvent(new FakeEvent("click", { bubbles: true })); }
  focus() { this.ownerDocument.activeElement = this; }
  setAttribute(name, value) {
    const stringValue = String(value);
    this.attributes.set(name, stringValue);
    if (name === "id") this.id = stringValue;
    if (name === "name") this.name = stringValue;
    if (name === "type") this.type = stringValue;
    if (name === "disabled") this.disabled = true;
    if (name === "required") this.required = true;
    if (name === "readonly") this.readOnly = true;
    if (name.startsWith("data-")) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, char) => char.toUpperCase())] = stringValue;
    FakeMutationObserver.notify({ target: this, attributeName: name });
  }
  getAttribute(name) {
    if (name === "id" && this.id) return this.id;
    if (name === "name" && this.name) return this.name;
    if (name === "type" && this.type) return this.type;
    if (name === "disabled" && this.disabled) return "";
    if (name === "required" && this.required) return "";
    return this.attributes.get(name) ?? null;
  }
  removeAttribute(name) {
    this.attributes.delete(name);
    if (name === "disabled") this.disabled = false;
    if (name === "required") this.required = false;
    if (name === "readonly") this.readOnly = false;
    FakeMutationObserver.notify({ target: this, attributeName: name });
  }
  hasAttribute(name) { return this.attributes.has(name) || (name === "disabled" && this.disabled) || (name === "required" && this.required); }
  matches(selector) {
    if (selector === "*") return true;
    const attribute = selector.match(/^\[([^=\]]+)(?:=["']?([^\]"']+)["']?)?\]$/);
    if (attribute) return this.hasAttribute(attribute[1]) && (attribute[2] === undefined || this.getAttribute(attribute[1]) === attribute[2]);
    if (selector.startsWith(".")) return this.classList.contains(selector.slice(1));
    if (selector.startsWith("#")) return this.id === selector.slice(1);
    const typed = selector.match(/^([a-z]+)\[type=["']?([^\]"']+)["']?\]$/i);
    if (typed) return this.tagName.toLowerCase() === typed[1].toLowerCase() && this.type === typed[2];
    const data = selector.match(/^\[data-([^=\]]+)(?:=["']?([^\]"']+)["']?)?\]$/);
    if (data) {
      const key = data[1].replace(/-([a-z])/g, (_, char) => char.toUpperCase());
      const actual = this.getAttribute(`data-${data[1]}`) ?? this.dataset[key];
      return actual !== undefined && (data[2] === undefined || String(actual) === data[2]);
    }
    return this.tagName.toLowerCase() === selector.toLowerCase();
  }
  closest(selector) {
    for (let node = this; node; node = node.parentElement) if (node.matches?.(selector)) return node;
    return null;
  }
  contains(node) { return this === node || this.children.some((child) => child.contains(node)); }
  querySelectorAll(selector) {
    if (selector === 'input[type="date"]') return this.querySelectorAll("input").filter((input) => input.type === "date");
    const selectors = selector.split(",").map((item) => item.trim());
    return this.children.flatMap((child) => [
      ...(selectors.some((item) => child.matches(item)) ? [child] : []),
      ...child.querySelectorAll(selector),
    ]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  get labels() {
    return this.ownerDocument.querySelectorAll("label").filter((label) => label.htmlFor === this.id || label.contains(this));
  }
  get form() { return this.closest("form"); }
  reset() {
    if (this.tagName !== "FORM") return;
    this.dispatchEvent(new FakeEvent("reset", { bubbles: true }));
    this.querySelectorAll("input").forEach((input) => { input.value = input.defaultValue; });
  }
  getBoundingClientRect() { return { left: 280, right: 420, top: 700, bottom: 740, width: 140, height: 40 }; }
  scrollIntoView() {}
}

class FakeDocument extends FakeElement {
  constructor() {
    super("#document", null);
    this.ownerDocument = this;
    this.activeElement = null;
    this.documentElement = new FakeElement("html", this);
    this.documentElement.clientWidth = 375;
    this.documentElement.clientHeight = 812;
    this.body = new FakeElement("body", this);
    this.appendChild(this.body);
  }
  createElement(tagName) { return new FakeElement(tagName, this); }
  getElementById(id) { return this.querySelectorAll("*").find((node) => node.id === id) || null; }
  querySelectorAll(selector) {
    if (selector === "*") return this.children.flatMap((child) => [child, ...child.querySelectorAll("*")]);
    return super.querySelectorAll(selector);
  }
}

function dateInput(document, { id = "date", value = "", min = "", max = "", required = false, disabled = false } = {}) {
  const form = document.createElement("form");
  document.body.append(form);
  const label = document.createElement("label");
  label.id = `${id}-label`;
  label.htmlFor = id;
  label.textContent = "Ngày cần chọn";
  form.append(label);
  const input = document.createElement("input");
  input.id = id;
  input.name = `${id}_field`;
  input.setAttribute("type", "date");
  input.value = value;
  input.defaultValue = value;
  if (min) input.setAttribute("min", min);
  if (max) input.setAttribute("max", max);
  input.required = required;
  input.disabled = disabled;
  form.append(input);
  return { form, label, input };
}

async function setup(options = {}) {
  FakeMutationObserver.observers = [];
  const document = new FakeDocument();
  const fields = [dateInput(document, options)];
  const window = {
    innerWidth: 375,
    innerHeight: 812,
    Event: FakeEvent,
    MutationObserver: FakeMutationObserver,
    listeners: new Map(),
    addEventListener(type, listener) { this.listeners.set(type, (this.listeners.get(type) || 0) + 1); },
    getComputedStyle() { return { width: "140px", margin: "0px" }; },
    setTimeout,
  };
  const source = fs.existsSync(scriptPath) ? fs.readFileSync(scriptPath, "utf8") : "";
  vm.runInNewContext(source, { window, document, MutationObserver: FakeMutationObserver, Event: FakeEvent, setTimeout, queueMicrotask, Intl, Date, Array, String, Number, Math, Set, WeakMap, Object, Boolean });
  window.CustomDatePicker?.enhance(document);
  await new Promise((resolve) => setImmediate(resolve));
  return { document, window, ...fields[0] };
}

function key(element, value, options = {}) {
  const event = Object.assign(new FakeEvent("keydown", { bubbles: true }), { key: value, shiftKey: Boolean(options.shiftKey) });
  element.dispatchEvent(event);
  return event;
}

test("shared date picker enhances native date inputs without replacing their form source", async () => {
  const { window, document, input, label } = await setup({ value: "2024-02-29", required: true });
  assert.equal(typeof window.CustomDatePicker?.enhance, "function");
  assert.equal(document.querySelectorAll(".custom-date-trigger").length, 1);
  assert.equal(input.id, "date");
  assert.equal(input.name, "date_field");
  assert.equal(input.value, "2024-02-29");
  assert.equal(input.required, true);
  assert.equal(input.getAttribute("aria-hidden"), "true");
  assert.equal(input.getAttribute("tabindex"), "-1");
  assert.match(label.htmlFor, /^custom-date-trigger-/);
});

test("calendar renders leap day, localized month and weekdays, then emits input/change once with ISO value", async () => {
  const { document, input } = await setup({ value: "2024-02-29" });
  const trigger = document.querySelector(".custom-date-trigger");
  let inputs = 0;
  let changes = 0;
  input.addEventListener("input", () => inputs++);
  input.addEventListener("change", () => changes++);
  trigger.click();
  const calendar = document.querySelector(".custom-date-calendar");
  assert.match(calendar.querySelector(".custom-date-month").textContent, /Tháng 2 năm 2024/);
  assert.equal(calendar.querySelectorAll("[data-date]").length, 42);
  assert.ok(calendar.querySelector('[data-date="2024-02-29"]'));
  calendar.querySelector('[data-date="2024-02-29"]').click();
  assert.equal(input.value, "2024-02-29");
  assert.equal(inputs, 0);
  assert.equal(changes, 0);
  calendar.querySelector('[data-date="2024-02-28"]').click();
  assert.equal(input.value, "2024-02-28");
  assert.equal(inputs, 1);
  assert.equal(changes, 1);
});

test("min/max constrain calendar days and month navigation; selected and current days are exposed", async () => {
  const { document } = await setup({ value: "2024-02-29", min: "2024-02-28", max: "2024-03-01" });
  const trigger = document.querySelector(".custom-date-trigger");
  trigger.click();
  const calendar = document.querySelector(".custom-date-calendar");
  assert.equal(calendar.querySelector('[data-date="2024-02-27"]').disabled, true);
  assert.equal(calendar.querySelector('[data-date="2024-02-29"]').getAttribute("aria-pressed"), "true");
  calendar.querySelector('[data-action="next"]').click();
  assert.match(calendar.querySelector(".custom-date-month").textContent, /Tháng 3 năm 2024/);
  assert.equal(calendar.querySelector('[data-date="2024-03-02"]').disabled, true);
});

test("disabled, required, direct native writes, reset, clear and today keep native validity and UI synchronized", async () => {
  const { document, window, form, input } = await setup({ value: "2025-05-10", min: "2025-01-01", max: "2025-12-31" });
  const trigger = document.querySelector(".custom-date-trigger");
  input.value = "2025-06-11";
  window.CustomDatePicker.refresh(input);
  assert.equal(trigger.value, "11/06/2025");
  input.disabled = true;
  window.CustomDatePicker.refresh(input);
  assert.equal(trigger.disabled, true);
  input.disabled = false;
  input.value = "2025-05-10";
  form.reset();
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(trigger.value, "10/05/2025");
  trigger.disabled = false;
  trigger.click();
  const calendar = document.querySelector(".custom-date-calendar");
  calendar.querySelector('[data-action="today"]').click();
  assert.match(input.value, /^\d{4}-\d{2}-\d{2}$/);
  calendar.querySelector('[data-action="clear"]').click();
  assert.equal(input.value, "");
});

test("keyboard opens, navigates, selects, escapes, and outside click closes without duplicate instances", async () => {
  const { document, window, input } = await setup({ value: "2024-02-29" });
  const trigger = document.querySelector(".custom-date-trigger");
  key(trigger, "ArrowDown");
  assert.equal(trigger.getAttribute("aria-expanded"), "true");
  assert.equal(document.activeElement.getAttribute("data-date"), "2024-02-29");
  key(document.activeElement, "ArrowRight");
  assert.equal(document.activeElement.getAttribute("data-date"), "2024-03-01");
  key(document.activeElement, "Enter");
  assert.equal(input.value, "2024-03-01");
  assert.equal(trigger.getAttribute("aria-expanded"), "false");
  key(trigger, "Enter");
  key(document.activeElement, "Escape");
  assert.equal(trigger.getAttribute("aria-expanded"), "false");
  assert.equal(document.activeElement, trigger);
  trigger.click();
  document.body.click();
  assert.equal(trigger.getAttribute("aria-expanded"), "false");
  window.CustomDatePicker.enhance(document);
  assert.equal(document.querySelectorAll(".custom-date-trigger").length, 1);
});

test("dynamic date inputs enhance once and English locale uses English calendar labels", async () => {
  const { document, window } = await setup();
  document.documentElement.lang = "en";
  const form = document.createElement("form");
  const input = document.createElement("input");
  input.setAttribute("type", "date");
  input.value = "2025-01-02";
  form.append(input);
  document.body.append(form);
  await new Promise((resolve) => setImmediate(resolve));
  window.CustomDatePicker.enhance(document);
  window.CustomDatePicker.enhance(document);
  assert.equal(document.querySelectorAll(".custom-date-trigger").length, 2);
  assert.equal(document.listeners.get("click").length, 1);
  assert.equal(window.listeners.get("resize"), 1);
  assert.equal(window.listeners.get("scroll"), 1);
  document.querySelectorAll(".custom-date-trigger")[1].click();
  assert.match(document.querySelector(".custom-date-month").textContent, /January 2025/);
});

test("all date consumers preserve native ISO values and page assets include the themed picker", () => {
  const indexTemplate = fs.readFileSync(path.join(root, "skin_cancer/webapp/templates/index.html"), "utf8");
  const adminTemplate = fs.readFileSync(path.join(root, "skin_cancer/webapp/templates/admin.html"), "utf8");
  const main = fs.readFileSync(path.join(root, "skin_cancer/webapp/static/js/main.js"), "utf8");
  const patient = fs.readFileSync(path.join(root, "skin_cancer/webapp/static/js/patient.js"), "utf8");
  const adminCases = fs.readFileSync(path.join(root, "skin_cancer/webapp/static/js/admin_cases.js"), "utf8");
  const admin = fs.readFileSync(path.join(root, "skin_cancer/webapp/static/js/admin.js"), "utf8");
  const css = fs.readFileSync(cssPath, "utf8");
  assert.match(indexTemplate, /custom_date_picker\.js/);
  assert.match(adminTemplate, /custom_date_picker\.js/);
  assert.match(main, /to\.value = formatLocalDate\(end\)[\s\S]*CustomDatePicker\?\.refresh\(to\)/);
  assert.match(main, /from\.value = formatLocalDate\(start\)[\s\S]*CustomDatePicker\?\.refresh\(from\)/);
  assert.match(main, /const params = new URLSearchParams\(\)[\s\S]*\$\("statsFrom"\)\.value\)[\s\S]*params\.set\("from"/);
  assert.match(patient, /patientProfileDob[\s\S]*CustomDatePicker\?\.refresh/);
  assert.match(adminCases, /case-reset[\s\S]*CustomDatePicker\?\.refresh/);
  assert.match(admin, /type="date" id="audit-start"/);
  assert.match(css, /html\[data-theme="dark"\]/);
  assert.match(css, /var\(--text/);
  assert.match(css, /var\(--line/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /position:\s*fixed/);
});
