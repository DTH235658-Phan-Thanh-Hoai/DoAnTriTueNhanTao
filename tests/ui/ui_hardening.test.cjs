const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "../..");
const focusRegionSource = fs.readFileSync(
  path.join(root, "skin_cancer/webapp/static/js/focus_region.js"),
  "utf8"
);
const mainSource = fs.readFileSync(
  path.join(root, "skin_cancer/webapp/static/js/main.js"),
  "utf8"
);

class ElementStub {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.listeners = {};
    this.style = {};
    this.dataset = {};
    this.classList = { add() {}, remove() {} };
    this.disabled = false;
    this.textContent = "";
    this.attributes = {};
  }
  append(...children) { this.children.push(...children); }
  addEventListener(name, callback) { (this.listeners[name] ||= []).push(callback); }
  setAttribute(name, value) { this.attributes[name] = value; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 100 }; }
  getContext() {
    return new Proxy({}, { get: () => () => {} , set: () => true });
  }
  focus() { this.ownerDocument.activeElement = this; }
  remove() { this.removed = true; }
  dispatch(name, values = {}) {
    const event = { preventDefault() {}, ...values };
    for (const callback of this.listeners[name] || []) callback(event);
    return event;
  }
}

function openModal(oldPoints = []) {
  const document = { activeElement: new ElementStub("button") };
  const trigger = document.activeElement;
  trigger.ownerDocument = document;
  document.createElement = (tag) => {
    const element = new ElementStub(tag);
    element.ownerDocument = document;
    return element;
  };
  document.body = document.createElement("body");
  const image = {
    width: 100,
    height: 100,
    set src(_value) { this.onload(); },
  };
  const context = {
    document,
    window: { innerHeight: 800 },
    Image: function ImageStub() { return image; },
    URL: { createObjectURL: () => "blob:synthetic", revokeObjectURL() {} },
    Promise,
  };
  vm.runInNewContext(`${focusRegionSource}; this.open = openFocusRegionModal;`, context);
  const result = context.open({ type: "image/png" }, oldPoints);
  const overlay = document.body.children[0];
  const box = overlay.children[0];
  const [hint, canvas, pointStatus, bar] = box.children;
  const buttons = bar.children;
  return { document, trigger, overlay, box, hint, canvas, pointStatus, buttons, result };
}

test("FIND-013: ROI canvas is focusable and explains keyboard controls", () => {
  const { box, hint, canvas, document } = openModal();
  assert.equal(box.attributes.role, "dialog");
  assert.equal(box.attributes["aria-modal"], "true");
  assert.ok(Number(canvas.tabIndex) >= 0);
  assert.ok(canvas.attributes["aria-label"]);
  assert.equal(document.activeElement, canvas);
  assert.match(hint.textContent, /phím mũi tên/i);
  assert.match(hint.textContent, /Enter|Space/i);
});

test("FIND-013: arrows position points and Enter/Space save normalized coordinates", async () => {
  const open = openModal();
  const { canvas, buttons, document, trigger } = open;
  assert.ok(canvas.listeners.keydown, "canvas must respond to keyboard input");
  for (let i = 0; i < 20; i += 1) canvas.dispatch("keydown", { key: "ArrowRight" });
  canvas.dispatch("keydown", { key: "Enter" });
  for (let i = 0; i < 20; i += 1) canvas.dispatch("keydown", { key: "ArrowDown" });
  canvas.dispatch("keydown", { key: " " });
  for (let i = 0; i < 20; i += 1) canvas.dispatch("keydown", { key: "ArrowLeft" });
  canvas.dispatch("keydown", { key: "Enter" });
  assert.equal(buttons[4].disabled, false);
  buttons[4].dispatch("click");
  const points = await open.result;
  assert.equal(points.length, 3);
  assert.ok(Math.abs(points[1][1] - points[0][1]) >= 0.39);
  assert.ok(Math.abs(points[2][0] - points[1][0]) >= 0.39);
  for (const point of points) {
    assert.equal(point.length, 2);
    assert.ok(point.every((coordinate) => coordinate >= 0 && coordinate <= 1));
  }
  assert.equal(document.activeElement, trigger);
});

test("FIND-013: mouse clicks still create normalized points", async () => {
  const modal = openModal();
  modal.canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 50, height: 50 });
  for (const [clientX, clientY] of [[10, 15], [40, 15], [25, 45]]) {
    modal.canvas.dispatch("click", { clientX, clientY });
  }
  assert.equal(modal.buttons[4].disabled, false);
  modal.buttons[4].dispatch("click");
  assert.deepEqual(
    JSON.parse(JSON.stringify(await modal.result)),
    [[0.2, 0.3], [0.8, 0.3], [0.5, 0.9]]
  );
});

test("FIND-013: ROI caller restores focus after rebuilding the opener", () => {
  assert.match(mainSource, /renderSelectedFiles\(\);\s*selectedFilesContainer\.querySelectorAll\("\.btn-region-select"\)\[index\]\?\.focus\(\);/);
});

test("FIND-013: undo and Escape preserve the existing cancel contract", async () => {
  const modal = openModal();
  assert.ok(modal.box.listeners.keydown, "dialog must handle Escape and keep focus inside");
  for (const key of ["Enter", "ArrowRight", "Enter", "ArrowDown", "Enter"]) {
    modal.canvas.dispatch("keydown", { key });
  }
  modal.buttons[0].dispatch("click");
  assert.equal(modal.buttons[4].disabled, true);
  modal.box.dispatch("keydown", { key: "Escape" });
  assert.equal(await modal.result, null);
  assert.equal(modal.document.activeElement, modal.trigger);
});

test("FIND-019: account content stays within the mobile main column", () => {
  const css = fs.readFileSync(path.join(root, "skin_cancer/webapp/static/css/admin-doctor-theme.css"), "utf8");
  const finalMobileRule = css.lastIndexOf("@media (max-width: 720px)");
  const sharedMainRule = css.lastIndexOf("margin-left: 258px");
  assert.ok(finalMobileRule > sharedMainRule, "mobile .main override must follow the shared desktop rule");
  assert.match(css.slice(finalMobileRule), /\.main\s*\{[^}]*margin-left:\s*0[^}]*width:\s*100%/s);
});

test("FIND-020: doctor history can shrink and keep wide table columns reachable", () => {
  const css = fs.readFileSync(path.join(root, "skin_cancer/webapp/static/css/style.css"), "utf8");
  assert.match(css, /\.history-page\s*\{[^}]*min-width:\s*0[^}]*width:\s*100%[^}]*box-sizing:\s*border-box/s);
  assert.match(css, /\.history-timeline\s*\{[^}]*overflow-x:\s*auto/s);
  assert.match(css, /@media\s*\(max-width:\s*720px\)[\s\S]*?\.history-table\s*\{[^}]*min-width:\s*680px/s);
});

test("FIND-020: doctor statistics chart grid can shrink below intrinsic chart width", () => {
  const css = fs.readFileSync(path.join(root, "skin_cancer/webapp/static/css/style.css"), "utf8");
  const mobileStats = css.slice(css.indexOf("@media (max-width: 560px)"));
  assert.match(mobileStats, /\.doctor-stats-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s);
});

test("FIND-021: mobile navigation wraps while keeping logout available", () => {
  const css = fs.readFileSync(path.join(root, "skin_cancer/webapp/static/css/style.css"), "utf8");
  const html = fs.readFileSync(path.join(root, "skin_cancer/webapp/templates/index.html"), "utf8");
  const patientCss = fs.readFileSync(path.join(root, "skin_cancer/webapp/static/css/patient.css"), "utf8");
  assert.match(css, /\.nav-inner\s*\{[^}]*flex-wrap:\s*wrap/s);
  assert.match(css, /\.hp-auth\s*\{[^}]*margin-left:\s*auto/s);
  assert.match(patientCss, /\.patient-case-code\s*\{[^}]*overflow-wrap:\s*anywhere/s);
  assert.match(html, /id="hpNavLogoutBtn"/);
});
