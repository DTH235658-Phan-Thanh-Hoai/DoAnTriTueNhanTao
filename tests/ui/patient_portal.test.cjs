const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const patientScript = fs.readFileSync(
  path.resolve(__dirname, "../../skin_cancer/webapp/static/js/patient.js"),
  "utf8"
);

function makeCase(analyses = []) {
  return {
    id: 1,
    case_code: "SYNTHETIC-CASE",
    created_at: null,
    status: "COMPLETED",
    analyses,
    reviews: [],
    reports: [],
  };
}

function completedResult(binaryResult, overrides = {}) {
  const result = {
    ...(binaryResult === undefined ? {} : { binary_result: binaryResult }),
    ...(binaryResult === 0 || binaryResult === 1
      ? { binary_probability: binaryResult === 1 ? 0.88 : 0.12 }
      : {}),
    predicted_class: binaryResult === 1 ? "mel" : "nv",
    predicted_probability: 0.8,
    ...overrides,
  };
  return {
    status: "COMPLETED",
    results: [result],
  };
}

async function renderCase(caseResponse, { ok = true } = {}) {
  const elements = new Map();
  let currentCase = caseResponse;
  const makeElement = () => ({
    textContent: "",
    innerHTML: "",
    value: "",
    dataset: {},
    className: "",
    classList: { add() {}, remove() {}, toggle() {} },
    style: { removeProperty() {} },
    addEventListener() {},
    getAttribute() { return null; },
  });
  let onReady;
  const document = {
    readyState: "loading",
    body: { style: {} },
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, makeElement());
      return elements.get(id);
    },
    querySelectorAll() { return []; },
    addEventListener(type, callback) {
      if (type === "DOMContentLoaded") onReady = callback;
    },
  };
  const window = {};
  const fetch = async (url) => {
    if (url === "/api/auth/csrf") {
      return { ok: true, json: async () => ({ csrf_token: "synthetic-csrf" }) };
    }
    return { ok, json: async () => currentCase };
  };

  vm.runInNewContext(patientScript, {
    document,
    window,
    fetch,
    console: { warn() {}, error() {} },
    setTimeout,
    Date,
  });
  onReady();
  await window.openCaseDetailModal(caseResponse?.id || 1);
  return {
    html: elements.get("patientDetailContent").innerHTML,
    window,
    elements,
    setCase(value) { currentCase = value; },
  };
}

function assertNeutral(html) {
  assert.match(html, /class="patient-ai-badge neutral"/);
  assert.match(html, /Kết quả nhị phân: Chưa có kết quả nhị phân/);
  assert.match(html, /Chưa có kết quả đa lớp/);
  assert.doesNotMatch(html, /class="patient-ai-badge (?:benign|malignant)"/);
  assert.doesNotMatch(html, /Kết quả kiểm tra AI chưa ghi nhận tổn thương nguy hiểm/);
}

function assertBinaryMissing(html) {
  assert.match(html, /Kết quả nhị phân: Chưa có kết quả nhị phân/);
  assert.doesNotMatch(html, /patient-ai-badge (?:benign|malignant)/);
}

test("TC-001: ca không có analysis hiển thị AI trung tính", async () => {
  assertNeutral((await renderCase(makeCase())).html);
});

test("TC-002: analysis PENDING không tạo kết luận", async () => {
  assertNeutral((await renderCase(makeCase([{ status: "PENDING", results: [] }]))).html);
});

test("TC-003: analysis PROCESSING không tạo kết luận", async () => {
  assertNeutral((await renderCase(makeCase([{ status: "PROCESSING", results: [] }]))).html);
});

test("TC-004: analysis FAILED hiển thị trung tính", async () => {
  assertNeutral((await renderCase(makeCase([{ status: "FAILED", results: [] }]))).html);
});

test("TC-005: analysis COMPLETED nhưng results rỗng không tạo kết luận", async () => {
  assertNeutral((await renderCase(makeCase([{ status: "COMPLETED", results: [] }]))).html);
});

test("TC-006: binary_result null không mặc định lành tính", async () => {
  assertBinaryMissing((await renderCase(makeCase([completedResult(null)]))).html);
});

test("TC-007: thiếu binary_result không mặc định lành tính", async () => {
  assertBinaryMissing((await renderCase(makeCase([completedResult(undefined)]))).html);
});

test("TC-008: binary_result ngoài 0/1 hoặc sai kiểu bị từ chối", async () => {
  for (const value of [2, -1, "0", true]) {
    assertBinaryMissing((await renderCase(makeCase([completedResult(value)]))).html);
  }
});

test("TC-009: binary_result 0 hợp lệ giữ nhãn lành tính", async () => {
  const html = (await renderCase(makeCase([completedResult(0)]))).html;
  assert.match(html, /class="patient-ai-badge benign"/);
  assert.match(html, /Không ghi nhận dấu hiệu ác tính/);
});

test("TC-010: binary_result 1 hợp lệ giữ nhãn ác tính", async () => {
  const html = (await renderCase(makeCase([completedResult(1)]))).html;
  assert.match(html, /class="patient-ai-badge malignant"/);
  assert.match(html, /88\.0%/);
  assert.match(html, /Nghi ngờ ác tính/);
});

test("TC-011: probability thiếu hoặc không hợp lệ không render xác suất sai", async () => {
  for (const value of [undefined, null, NaN, Infinity, -0.1, 1.1, "0.5"]) {
    const html = (await renderCase(makeCase([completedResult(0, {
      predicted_probability: value,
    })]))).html;
    assert.doesNotMatch(html, /NaN%|Infinity%|110\.0%/);
    assert.doesNotMatch(html, /Độ tin cậy:/);
  }
  const zeroProbability = (await renderCase(makeCase([completedResult(0, {
    predicted_probability: 0,
  })]))).html;
  assert.match(zeroProbability, /0\.0%/);
});

test("TC-012: nhiều analysis không chọn kết quả cũ khi thứ tự API không được bảo đảm", async () => {
  const previousCompleted = completedResult(0);
  for (const status of ["PENDING", "PROCESSING", "FAILED"]) {
    const unfinished = { status, results: [] };
    assertNeutral((await renderCase(makeCase([previousCompleted, unfinished]))).html);
    assertNeutral((await renderCase(makeCase([unfinished, previousCompleted]))).html);
  }
  assertNeutral((await renderCase(makeCase([
    { status: "COMPLETED", results: [] },
    { ...completedResult(1), status: "UNKNOWN" },
  ]))).html);
  const completedHistory = (await renderCase(makeCase([
    completedResult(0),
    completedResult(1),
  ]))).html;
  assert.match(completedHistory, /class="patient-ai-badge malignant"/);
});

test("TC-013: chuyển từ ca có kết quả sang ca thiếu dữ liệu không giữ kết luận cũ", async () => {
  const first = makeCase([completedResult(1)]);
  const second = makeCase([]);
  const rendered = await renderCase(first);
  rendered.setCase(second);
  await rendered.window.openCaseDetailModal(second.id);
  const html = rendered.elements.get("patientDetailContent").innerHTML;
  assertNeutral(html);
});

test("TC-014: API lỗi không tạo kết luận AI", async () => {
  const rendered = await renderCase(makeCase(), { ok: false });
  assert.doesNotMatch(rendered.html, /patient-ai-badge (?:benign|malignant)/);
  assertNeutral((await renderCase(makeCase({}))).html);
  assert.doesNotMatch((await renderCase(null)).html, /patient-ai-badge (?:benign|malignant)/);
});

test("TC-015: mở lại modal lấy trạng thái mới thay cho kết quả cũ", async () => {
  const rendered = await renderCase(makeCase([{ status: "PENDING", results: [] }]));
  rendered.window.closeCaseDetailModal();
  rendered.setCase(makeCase([completedResult(0)]));
  await rendered.window.openCaseDetailModal(1);
  assert.match(rendered.elements.get("patientDetailContent").innerHTML,
    /class="patient-ai-badge benign"/);
});

test("FIND-017: discordant heads render separate labels and paired probabilities", async () => {
  const html = (await renderCase(makeCase([completedResult(0, {
    predicted_class: "mel", predicted_probability: 0.896, binary_probability: 0.12,
  })]))).html;
  assert.match(html, /Kết quả nhị phân/);
  assert.match(html, /12\.0%/);
  assert.match(html, /Dự đoán đa lớp/);
  assert.match(html, /Melanoma/);
  assert.match(html, /89\.6%/);
  assert.match(html, /không khớp nhau|bất đồng/i);
  assert.match(html, /class="patient-ai-badge neutral"/);
});

test("FIND-017: AK is treated as malignant by the independent mismatch warning", async () => {
  const html = (await renderCase(makeCase([completedResult(0, {
    predicted_class: "AK", predicted_probability: 0.62, binary_probability: 0.14,
  })]))).html;
  assert.match(html, /Hai đầu ra AI không khớp nhau/);
  assert.match(html, /class="patient-ai-badge neutral"/);
});

test("FIND-017: invalid binary probability is omitted", async () => {
  for (const value of [null, NaN, Infinity, -0.1, 1.1, "0.5"]) {
    const html = (await renderCase(makeCase([completedResult(0, {
      binary_probability: value,
    })]))).html;
    assert.doesNotMatch(html, /Xác suất nhị phân: (?:NaN|Infinity|110\.0|-10\.0)/);
  }
});

test("FIND-018: persisted uncertain analysis is neutral in the patient case detail", async () => {
  const html = (await renderCase(makeCase([completedResult(0, {
    uncertainty: { is_uncertain: true },
    predicted_class: "bkl",
    predicted_probability: 0.342,
  })]))).html;
  assert.match(html, /Kết quả AI được đánh dấu chưa chắc chắn/);
  assert.match(html, /class="patient-ai-badge neutral"/);
  assert.doesNotMatch(html, /Không đáng lo ngại|Không có nguy cơ ung thư/);
});

test("FIND-017: malignant binary and non-MEL class remain distinct", async () => {
  const html = (await renderCase(makeCase([completedResult(1, {
    predicted_class: "nv", predicted_probability: 0.73, binary_probability: 0.91,
  })]))).html;
  assert.match(html, /91\.0%/);
  assert.match(html, /73\.0%/);
  assert.match(html, /Kết quả nhị phân/);
  assert.match(html, /Dự đoán đa lớp/);
});

test("FIND-017: missing head is not inferred from the other", async () => {
  const noBinary = (await renderCase(makeCase([completedResult(undefined, {
    predicted_class: "mel", predicted_probability: 0.8,
  })]))).html;
  assert.match(noBinary, /Kết quả nhị phân: Chưa có kết quả nhị phân/);
  assert.match(noBinary, /Melanoma/);
  const noClass = (await renderCase(makeCase([completedResult(0, {
    predicted_class: null, predicted_probability: null,
  })]))).html;
  assert.match(noClass, /Không ghi nhận dấu hiệu ác tính/);
  assert.match(noClass, /Chưa có kết quả đa lớp/);
});
