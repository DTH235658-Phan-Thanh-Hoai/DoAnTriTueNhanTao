const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../..");
const html = fs.readFileSync(path.join(root, "skin_cancer/webapp/templates/index.html"), "utf8");

test("doctor header keeps avatar, readable name and role, and logout at mobile widths", () => {
  assert.match(html, /id="hpUserPill"[\s\S]*id="hpUserAvatar"[\s\S]*id="hpUserName"[\s\S]*id="hpUserRole"[\s\S]*id="hpNavLogoutBtn"/);
  assert.doesNotMatch(html, /@media\s*\(max-width:\s*720px\)[\s\S]{0,800}\.hp-user-meta\s*\{\s*display:\s*none/);
  assert.match(html, /\.hp-user-meta\s*\{\s*display:\s*flex;\s*min-width:\s*0;\s*max-width:\s*clamp\(/);
  assert.match(html, /\.hp-user-meta\s+strong[\s\S]{0,180}text-overflow:\s*ellipsis/);
});
