/* ============================================================
   DERMASCAN AI - CLIENT LOGIC (Tiếng Việt)
============================================================ */

const $ = (id) => document.getElementById(id);

const dropZone = $("dropZone");
const fileInput = $("fileInput");
const previewWrap = $("previewWrap");
const previewImg = $("previewImg");
const clearBtn = $("clearBtn");
const analyzeBtn = $("analyzeBtn");
const resetBtn = $("resetBtn");

const emptyState = $("emptyState");
const loadingState = $("loadingState");
const resultsState = $("resultsState");
const errorState = $("errorState");
const errorText = $("errorText");
const resultTag = $("resultTag");

const verdictCard = $("verdictCard");
const verdictIcon = $("verdictIcon");
const verdictTitle = $("verdictTitle");
const verdictFill = $("verdictFill");
const verdictValue = $("verdictValue");
const verdictNote = $("verdictNote");
const predBadge = $("predBadge");
const probsList = $("probsList");

const interpCard = $("interpCard");
const severityBadge = $("severityBadge");
const severityNote = $("severityNote");
const interpHeadline = $("interpHeadline");
const interpSummary = $("interpSummary");
const interpDetail = $("interpDetail");
const interpActions = $("interpActions");
const interpConclusion = $("interpConclusion");

const statusDot = $("statusDot");
const statusText = $("statusText");

let currentFile = null;

// ============================================================
// Tên tiếng Việt cho các lớp (fallback nếu backend chưa gửi)
// ============================================================
const CLASS_NAME_VI = {
    MEL: "U hắc tố",
    NV: "Nốt ruồi",
    BCC: "UT tế bào đáy",
    AK: "Dày sừng ánh sáng",
    BKL: "Dày sừng lành",
    DF: "U xơ da",
    VASC: "Tổn thương mạch",
    SCC: "UT tế bào vảy",
};

// ============================================================
// SVG icons
// ============================================================
const ICON = {
    check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`,
    alert: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.3a2 2 0 0 1 3.4 0l7.6 13.2a2 2 0 0 1-1.7 3H4.4a2 2 0 0 1-1.7-3L10.3 3.3Z"/></svg>`,
};

// ============================================================
// Health check
// ============================================================
fetch("/health")
    .then((r) => r.json())
    .then((d) => {
        statusDot.classList.add("online");
        statusText.textContent = d.device === "cuda" ? "GPU sẵn sàng" : "Chế độ CPU";
    })
    .catch(() => {
        statusDot.classList.add("offline");
        statusText.textContent = "Mất kết nối";
    });

// ============================================================
// Drag & drop
// ============================================================
dropZone.addEventListener("click", () => fileInput.click());

["dragenter", "dragover"].forEach((evt) =>
    dropZone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropZone.classList.add("dragover");
    }),
);

["dragleave", "drop"].forEach((evt) =>
    dropZone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropZone.classList.remove("dragover");
    }),
);

dropZone.addEventListener("drop", (e) => {
    const files = e.dataTransfer.files;
    if (files.length) handleFile(files[0]);
});

fileInput.addEventListener("change", (e) => {
    if (e.target.files.length) handleFile(e.target.files[0]);
});

clearBtn.addEventListener("click", resetUpload);
resetBtn.addEventListener("click", resetUpload);

// ============================================================
// File handling
// ============================================================
function handleFile(file) {
    if (!file.type.startsWith("image/")) {
        showError("Vui lòng chọn file ảnh (JPG, PNG, WEBP).");
        return;
    }
    if (file.size > 10 * 1024 * 1024) {
        showError("Kích thước ảnh vượt quá 10 MB.");
        return;
    }

    currentFile = file;
    const reader = new FileReader();

    reader.onload = (e) => {
        previewImg.src = e.target.result;
        previewWrap.classList.remove("hidden");
        dropZone.classList.add("hidden");
        analyzeBtn.disabled = false;
        resetBtn.classList.add("hidden");

        resultsState.classList.add("hidden");
        errorState.classList.add("hidden");
        emptyState.classList.remove("hidden");
        resultTag.style.display = "none";
    };

    reader.readAsDataURL(file);
}

function resetUpload() {
    currentFile = null;
    fileInput.value = "";
    previewImg.src = "";
    previewWrap.classList.add("hidden");
    dropZone.classList.remove("hidden");
    analyzeBtn.disabled = true;
    resetBtn.classList.add("hidden");
    resultsState.classList.add("hidden");
    errorState.classList.add("hidden");
    emptyState.classList.remove("hidden");
    resultTag.style.display = "none";
}

// ============================================================
// Analyze
// ============================================================
analyzeBtn.addEventListener("click", async () => {
    if (!currentFile) return;

    emptyState.classList.add("hidden");
    resultsState.classList.add("hidden");
    errorState.classList.add("hidden");
    loadingState.classList.remove("hidden");
    analyzeBtn.disabled = true;

    const formData = new FormData();
    formData.append("image", currentFile);

    try {
        const resp = await fetch("/predict", { method: "POST", body: formData });

        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err.error || `Lỗi máy chủ: HTTP ${resp.status}`);
        }

        const data = await resp.json();
        if (!data.success) throw new Error(data.error || "Lỗi không xác định");

        loadingState.classList.add("hidden");
        resultsState.classList.remove("hidden");
        resetBtn.classList.remove("hidden");

        renderResults(data);
    } catch (err) {
        console.error(err);
        loadingState.classList.add("hidden");
        showError(err.message || "Không thể phân tích ảnh. Vui lòng thử lại.");
    } finally {
        analyzeBtn.disabled = false;
    }
});

// ============================================================
// Render
// ============================================================
function renderResults(data) {
    const { binary, multiclass, interpretation, gradcam, original } = data;
    const isMalignant = binary.prediction === 1;

    // ---- Verdict card ----
    verdictCard.classList.remove("benign", "malignant");
    verdictCard.classList.add(isMalignant ? "malignant" : "benign");

    verdictIcon.innerHTML = isMalignant ? ICON.alert : ICON.check;
    verdictTitle.textContent = binary.label_vi;

    const pct = (binary.prob_malignant * 100).toFixed(1);
    verdictValue.textContent = `${pct}%`;
    verdictFill.style.width = "0%";
    setTimeout(() => {
        verdictFill.style.width = `${pct}%`;
    }, 80);

    verdictNote.textContent = isMalignant
        ? `Mô hình nhận diện đặc điểm nghi ngờ ác tính (độ tin cậy ${binary.confidence_pct}%).`
        : `Mô hình không phát hiện đặc điểm ác tính (độ tin cậy ${binary.confidence_pct}%).`;

    // ---- Panel tag ----
    resultTag.style.display = "inline-block";
    resultTag.textContent = isMalignant ? "ÁC TÍNH" : "LÀNH TÍNH";
    resultTag.className = "panel-tag" + (isMalignant ? " malignant" : "");

    // ---- Interpretation ----
    if (interpretation) {
        interpCard.dataset.severity = interpretation.severity;

        severityBadge.className = "severity-badge " + interpretation.severity;
        severityBadge.textContent = interpretation.severity_label;
        severityNote.textContent = "· " + interpretation.severity_note;

        interpHeadline.textContent = interpretation.headline;
        interpSummary.textContent = interpretation.summary;
        interpDetail.textContent = interpretation.detail;

        interpActions.innerHTML = "";
        interpretation.actions.forEach((action) => {
            const li = document.createElement("li");
            li.textContent = action;
            interpActions.appendChild(li);
        });

        interpConclusion.textContent = interpretation.conclusion;
    }

    // ---- Pred badge ----
    const predClass = multiclass.pred_class;
    const predNameVi = CLASS_NAME_VI[predClass] || predClass;
    predBadge.textContent = `${predNameVi} · ${predClass}`;
    predBadge.className = "pred-badge" + (multiclass.malignant_list.includes(predClass) ? " malignant" : "");

    // ---- Probabilities ----
    probsList.innerHTML = "";
    const entries = Object.entries(multiclass.probs).sort((a, b) => b[1] - a[1]);

    entries.forEach(([cls, prob]) => {
        const isMalig = multiclass.malignant_list.includes(cls);
        const p = (prob * 100).toFixed(1);
        const nameVi = CLASS_NAME_VI[cls] || cls;

        const row = document.createElement("div");
        row.className = "prob-row" + (cls === predClass ? " top-pred" : "") + (isMalig ? " malignant" : "");

        row.innerHTML = `
      <span class="prob-label" title="${nameVi}">${cls}</span>
      <div class="prob-bar-wrap">
        <div class="prob-bar ${isMalig ? "malignant" : "benign"}"></div>
      </div>
      <span class="prob-value">${p}%</span>
    `;

        probsList.appendChild(row);

        const bar = row.querySelector(".prob-bar");
        setTimeout(() => {
            bar.style.width = `${p}%`;
        }, 120);
    });

    // ---- Grad-CAM ----
    $("origImg").src = `data:image/jpeg;base64,${original}`;
    $("camImg").src = `data:image/png;base64,${gradcam}`;
}

// ============================================================
// Error
// ============================================================
function showError(msg) {
    errorText.textContent = msg;
    errorState.classList.remove("hidden");
    resultsState.classList.add("hidden");
    loadingState.classList.add("hidden");
    emptyState.classList.add("hidden");
}
