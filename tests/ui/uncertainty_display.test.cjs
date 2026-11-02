const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(
  path.resolve(__dirname, "../../skin_cancer/webapp/static/js/main.js"),
  "utf8"
);

function presentationHelper() {
  const match = source.match(/function safeInterpretationForDisplay\([\s\S]*?(?=function renderResults\()/);
  assert.ok(match, "main.js must define the uncertainty presentation guard");
  const context = {};
  vm.runInNewContext(`${match[0]}; this.guard = safeInterpretationForDisplay;`, context);
  return context.guard;
}

test("FIND-018: uncertain completed results suppress categorical reassurance", () => {
  const guard = presentationHelper();
  const result = guard({
    severity: "normal",
    severity_label: "LÀNH TÍNH",
    severity_note: "Không đáng lo ngại",
    headline: "Không phát hiện dấu hiệu ung thư rõ ràng",
    summary: "Kết quả khả quan, không có nguy cơ ung thư.",
    detail: "Thông tin khẳng định an toàn.",
    conclusion: "Không có nguy cơ.",
    actions: [],
  }, true);
  const copy = JSON.stringify(result);
  assert.match(copy, /chưa đủ chắc chắn/i);
  assert.match(copy, /bác sĩ/i);
  assert.doesNotMatch(copy, /không đáng lo|không có nguy cơ|không phát hiện dấu hiệu ung thư rõ ràng|kết quả khả quan/i);
});

test("FIND-018: certain valid result preserves its existing interpretation", () => {
  const guard = presentationHelper();
  const interpretation = { severity: "warning", headline: "Nội dung hiện có" };
  assert.deepEqual(guard(interpretation, false), interpretation);
});

test("FIND-018: missing interpretation remains absent", () => {
  const guard = presentationHelper();
  assert.equal(guard(null, true), null);
});

test("FIND-017: direct analysis detects class and binary disagreement including AK", () => {
  const match = source.match(/function hasAiOutputDisagreement\([\s\S]*?(?=function renderResults\()/);
  assert.ok(match, "main.js must compare the independent output heads");
  const context = {};
  vm.runInNewContext(`${match[0]}; this.disagrees = hasAiOutputDisagreement;`, context);
  const compare = context.disagrees;
  const binaryClasses = ["MEL", "BCC", "SCC", "AK", "AKIEC"];
  assert.equal(compare({ prediction: 0 }, { pred_class: "MEL", malignant_list: binaryClasses }), true);
  assert.equal(compare({ prediction: 1 }, { pred_class: "NV", malignant_list: binaryClasses }), true);
  assert.equal(compare({ prediction: 0 }, { pred_class: "NV", malignant_list: binaryClasses }), false);
  assert.equal(compare({ prediction: 1 }, { pred_class: "AK", malignant_list: binaryClasses }), false);
  assert.equal(compare({ prediction: 0 }, { pred_class: null, malignant_list: binaryClasses }), false);
});

test("FIND-017: doctor history labels both heads and pairs their probabilities", () => {
  const match = source.match(/function formatDoctorHistoryResult\([\s\S]*?(?=function renderResults\()/);
  assert.ok(match, "main.js must format the independent heads in doctor history");
  const context = {};
  vm.runInNewContext(`${match[0]}; this.format = formatDoctorHistoryResult;`, context);
  const result = context.format({
    diagnosis: "MEL",
    confidence: 89.6,
    binary_result: "benign",
    binary_probability: 0.12,
  });
  assert.match(result, /đa lớp: MEL/i);
  assert.match(result, /nhị phân: không ghi nhận dấu hiệu ác tính/i);
  assert.match(result, /xác suất ác tính \(nhị phân\): 12\.0%/i);
  assert.match(context.format({ diagnosis: "MEL", confidence: 89.6, binary_result: null }), /nhị phân: chưa có dữ liệu/i);
});
