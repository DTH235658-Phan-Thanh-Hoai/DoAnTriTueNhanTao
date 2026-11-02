const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../..");
const html = fs.readFileSync(
  path.join(root, "skin_cancer/webapp/templates/admin.html"),
  "utf8"
);
const css = fs.readFileSync(
  path.join(root, "skin_cancer/webapp/static/css/admin-doctor-theme.css"),
  "utf8"
);

test("FIND-019: mobile admin header wraps actions so logout stays in the viewport", () => {
  assert.ok(/class="hp-auth top-actions"[\s\S]*?id="logout"/.test(html));
  assert.ok(
    /@media\s*\(max-width:\s*620px\)[\s\S]*?\.topbar\s*\{[^}]*flex-wrap:\s*wrap;/.test(css),
    "the mobile topbar must wrap onto a new line"
  );
  assert.ok(
    /@media\s*\(max-width:\s*620px\)[\s\S]*?\.topbar \.top-actions\s*\{[^}]*flex-wrap:\s*wrap;/.test(css),
    "the mobile account actions must wrap instead of widening the page"
  );
});
