const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../..");
const template = fs.readFileSync(path.join(root, "skin_cancer/webapp/templates/index.html"), "utf8");
const main = fs.readFileSync(path.join(root, "skin_cancer/webapp/static/js/main.js"), "utf8");
const dropdown = fs.readFileSync(path.join(root, "skin_cancer/webapp/static/js/patient_select_dropdown.js"), "utf8");

test("patientSelect keeps its native value source and uses the shared dropdown initializer", () => {
  assert.match(template, /<select id="patientSelect"[^>]*data-custom-dropdown[^>]*disabled>/);
  assert.match(template, /id="patientSelectLabel" for="patientSelect"/);
  assert.doesNotMatch(template, /id="patientSelect(?:Button|Value|Options)"/);
  assert.ok(template.indexOf("patient_select_dropdown.js") < template.indexOf("js/main.js"));
  assert.match(dropdown, /window\.CustomSelectDropdown = \{ enhance, refresh, refreshAll \}/);
});

test("patient loading refreshes the shared control without changing its native change contract", () => {
  assert.match(main, /async function loadPatients\(\)[\s\S]*?CustomSelectDropdown\?\.refresh\(patientSelect\)/);
  assert.match(main, /patientSelect\.addEventListener\("change"/);
  assert.match(main, /if \(!selectedPatient\)/);
  assert.match(main, /const payload = \{[\s\S]*lesion_location/);
});

test("doctor dynamic history options refresh the shared UI after preserving the selected value", () => {
  assert.match(main, /function populateHistoryPatients\(\)[\s\S]*select\.value = patients\.includes\(currentValue\) \? currentValue : "";[\s\S]*CustomSelectDropdown\?\.refresh\(select\)/);
});
