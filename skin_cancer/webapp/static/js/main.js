/* ============================================================
   DERMASCAN AI
   Frontend integration:
   Auth
   Patient Selector
   Temporary Patient
   Batch Upload
   AI Analysis
   Measurement
   PDF
   Email
   Homepage Slideshow
============================================================ */

const $ = (id) => document.getElementById(id);

// ============================================================
// DOM
// ============================================================

// ================= UPLOAD =================

const dropZone = $("dropZone");

const fileInput = $("imageInput");

const previewWrap = $("previewWrap");

const previewImg = $("previewImg");

const clearBtn = $("clearBtn");

const analyzeBtn = $("analyzeBtn");

const resetBtn = $("resetBtn");
// ================= DOCTOR REVIEW =================

const doctorDiagnosisSection = $("doctorDiagnosisSection");

const doctorClinicalNote = $("doctorClinicalNote");

const doctorConclusion = $("doctorConclusion");

const doctorRecommendation = $("doctorRecommendation");

const doctorReviewStatus = $("doctorReviewStatus");

const saveDoctorReviewBtn = $("saveDoctorReviewBtn");

// ================= PATIENT =================

const patientSelect = $("patientSelect");

const addTemporaryPatientBtn = $("addTemporaryPatientBtn");

const selectedPatientCard = $("selectedPatientCard");

const selectedPatientName = $("selectedPatientName");

const selectedPatientBadge = $("selectedPatientBadge");

const selectedPatientMeta = $("selectedPatientMeta");

const selectedPatientContact = $("selectedPatientContact");

const lesionLocationInput = $("lesionLocationInput");

// ================= TEMP PATIENT MODAL =================

const temporaryPatientModal = $("temporaryPatientModal");

const temporaryPatientBackdrop = $("temporaryPatientBackdrop");

const closeTemporaryPatientBtn = $("closeTemporaryPatientBtn");

const cancelTemporaryPatientBtn = $("cancelTemporaryPatientBtn");

const temporaryPatientForm = $("temporaryPatientForm");

const tempPatientFullName = $("tempPatientFullName");

const tempPatientDob = $("tempPatientDob");

const tempPatientGender = $("tempPatientGender");

const tempPatientPhone = $("tempPatientPhone");

const tempPatientEmail = $("tempPatientEmail");

const tempPatientAddress = $("tempPatientAddress");

// ================= BATCH =================

const selectedFilesContainer = $("selectedFilesContainer");

const batchStatus = $("batchStatus");

const batchStatusText = $("batchStatusText");

const batchItems = $("batchItems");

// ================= RESULT STATE =================

const emptyState = $("emptyState");

const loadingState = $("loadingState");

const resultsState = $("resultsState");

const errorState = $("errorState");

const errorText = $("errorText");

// ================= RESULT =================

const resultTag = $("resultTag");

const verdictCard = $("verdictCard");

const verdictIcon = $("verdictIcon");

const verdictTitle = $("verdictTitle");

const verdictFill = $("verdictFill");

const verdictValue = $("verdictValue");

const verdictNote = $("verdictNote");

const predBadge = $("predBadge");

const probsList = $("probsList");

// ================= INTERPRETATION =================

const interpCard = $("interpCard");

const severityBadge = $("severityBadge");

const severityNote = $("severityNote");

const interpHeadline = $("interpHeadline");

const interpSummary = $("interpSummary");

const interpDetail = $("interpDetail");

const interpActions = $("interpActions");

const interpConclusion = $("interpConclusion");

// ================= SERVER STATUS =================

const statusDot = $("statusDot");

const statusText = $("statusText");

// ================= AUTH =================

const loginEmail = $("loginEmail");

const loginPassword = $("loginPassword");

const loginBtn = $("loginBtn");

const logoutBtn = $("logoutBtn");

const authStatus = $("authStatus");

// ================= TOOLS =================

const measureBtn = $("measureBtn");

const exportPdfBtn = $("exportPdfBtn");

const exportExcelBtn = $("exportExcelBtn");

const downloadPdfBtn = $("downloadPdfBtn");

const sendEmailBtn = $("sendEmailBtn");

// ================= MEASUREMENT =================

const measurementResult = $("measurementResult");

const lesionArea = $("lesionArea");

const lesionPerimeter = $("lesionPerimeter");

const lesionRatio = $("lesionRatio");

const contourResult = $("contourResult");

const contourImg = $("contourImg");

// ================= REPORT =================

const reportStatus = $("reportStatus");

// ============================================================
// STATE
// ============================================================

let selectedFiles = [];

let currentUser = null;

let currentDoctorReview = null;

// ================= PATIENT STATE =================

let registeredPatients = [];

let selectedPatient = null;

let currentPatientSnapshot = null;

// ================= CASE STATE =================

let currentCaseId = null;

let currentBatchId = null;

let currentCaseImageId = null;

let currentAnalysisId = null;

let currentReportId = null;

// ============================================================
// VI CLASS NAME
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
// ICONS
// ============================================================

const ICON = {
  check: `
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
        >
            <path d="M20 6 9 17l-5-5"/>
        </svg>
        `,

  alert: `
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
        >
            <path d="M12 9v4M12 17h.01"/>
            <path
                d="
                    M10.3 3.3
                    a2 2 0 0 1 3.4 0
                    l7.6 13.2
                    a2 2 0 0 1-1.7 3
                    H4.4
                    a2 2 0 0 1-1.7-3
                    L10.3 3.3Z
                "
            />
        </svg>
        `,
};

// ============================================================
// GENERAL HELPERS
// ============================================================

async function responseJson(response) {
  return await response.json().catch(() => ({}));
}

function getErrorMessage(data, fallback) {
  return data.error || data.message || data.description || fallback;
}

async function getCsrfToken() {
  const response = await fetch("/api/auth/csrf", {
    credentials: "same-origin",
  });

  if (!response.ok) {
    throw new Error("Không lấy được CSRF token.");
  }

  const data = await response.json();

  return data.csrf_token;
}

function requireDoctor() {
  if (!currentUser) {
    throw new Error("Bạn cần đăng nhập trước.");
  }

  if (currentUser.role !== "DOCTOR" && currentUser.role !== "ADMIN") {
    throw new Error("Chỉ Doctor hoặc Admin " + "được sử dụng chức năng này.");
  }
}

// ============================================================
// PATIENT HELPERS
// ============================================================

function patientSnapshot(patient) {
  return {
    full_name: patient.full_name || "",

    date_of_birth: patient.date_of_birth || null,

    gender: patient.gender || null,

    phone: patient.phone || null,

    email: patient.email || null,

    address: patient.address || null,
  };
}

function patientDisplayDate(value) {
  if (!value) {
    return "";
  }

  const dateValue = String(value).slice(0, 10);

  const parts = dateValue.split("-");

  if (parts.length !== 3) {
    return value;
  }

  return `${parts[2]}/` + `${parts[1]}/` + `${parts[0]}`;
}

// ============================================================
// ANALYZE BUTTON STATE
// ============================================================

function syncAnalyzeButton() {
  const canUse =
    currentUser &&
    (currentUser.role === "DOCTOR" || currentUser.role === "ADMIN");

  analyzeBtn.disabled = !(
    canUse &&
    selectedPatient &&
    selectedFiles.length > 0
  );
}

// ============================================================
// SELECTED PATIENT CARD
// ============================================================

function renderSelectedPatient() {
  if (!selectedPatient || !selectedPatient.snapshot) {
    selectedPatientCard.hidden = true;

    currentPatientSnapshot = null;

    syncAnalyzeButton();

    return;
  }

  const data = selectedPatient.snapshot;

  currentPatientSnapshot = data;

  selectedPatientName.textContent = data.full_name || "Chưa có tên";

  if (selectedPatient.kind === "temporary") {
    selectedPatientBadge.textContent = "BỆNH NHÂN MỚI";

    selectedPatientBadge.classList.add("temporary");
  } else {
    selectedPatientBadge.textContent = "CÓ TÀI KHOẢN";

    selectedPatientBadge.classList.remove("temporary");
  }

  // ================= META =================

  const meta = [];

  if (data.date_of_birth) {
    meta.push(patientDisplayDate(data.date_of_birth));
  }

  if (data.gender) {
    meta.push(data.gender);
  }

  selectedPatientMeta.textContent = meta.length
    ? meta.join(" · ")
    : "Chưa có thông tin " + "ngày sinh / giới tính";

  // ================= CONTACT =================

  const contact = [];

  if (data.phone) {
    contact.push(data.phone);
  }

  if (data.email) {
    contact.push(data.email);
  }

  if (data.address) {
    contact.push(data.address);
  }

  selectedPatientContact.textContent = contact.length
    ? contact.join(" · ")
    : "Chưa có thông tin liên hệ";

  selectedPatientCard.hidden = false;

  syncAnalyzeButton();
}
//===========Hàm cuộn và forcus==========
function focusDoctorDiagnosis() {
  doctorDiagnosisSection.classList.add("needs-attention");

  doctorDiagnosisSection.scrollIntoView({
    behavior: "smooth",

    block: "center",
  });

  window.setTimeout(
    () => {
      doctorConclusion.focus({
        preventScroll: true,
      });
    },

    450,
  );

  window.setTimeout(
    () => {
      doctorDiagnosisSection.classList.remove("needs-attention");
    },

    2200,
  );
}

// ============================================================
// LOGGED OUT PATIENT STATE
// ============================================================

function resetPatientUiForLoggedOut() {
  registeredPatients = [];

  selectedPatient = null;

  currentPatientSnapshot = null;

  currentCaseId = null;

  patientSelect.innerHTML = `
        <option value="">
            Đăng nhập bác sĩ để tải danh sách
        </option>
        `;

  patientSelect.disabled = true;

  renderSelectedPatient();
}

// ============================================================
// LOAD PATIENTS
// ============================================================

async function loadPatients() {
  if (!currentUser || !["DOCTOR", "ADMIN"].includes(currentUser.role)) {
    resetPatientUiForLoggedOut();

    return;
  }

  try {
    const response = await fetch("/api/patients", {
      credentials: "same-origin",
    });

    const data = await responseJson(response);

    if (!response.ok) {
      throw new Error(
        getErrorMessage(data, "Không tải được " + "danh sách bệnh nhân."),
      );
    }

    registeredPatients = data.patients || [];

    patientSelect.innerHTML = "";

    const placeholder = document.createElement("option");

    placeholder.value = "";

    placeholder.textContent = "Chọn bệnh nhân...";

    patientSelect.append(placeholder);

    registeredPatients.forEach((patient) => {
      const option = document.createElement("option");

      option.value = String(patient.id);

      if (patient.email) {
        option.textContent = `${patient.full_name}` + ` · ${patient.email}`;
      } else {
        option.textContent = patient.full_name || `User #${patient.id}`;
      }

      patientSelect.append(option);
    });

    patientSelect.disabled = false;
  } catch (error) {
    console.error(error);

    registeredPatients = [];

    selectedPatient = null;

    currentPatientSnapshot = null;

    currentCaseId = null;

    patientSelect.innerHTML = `
            <option value="">
                Không tải được danh sách bệnh nhân
            </option>
            `;

    patientSelect.disabled = true;

    renderSelectedPatient();
  }
}

// ============================================================
// PATIENT SELECT CHANGE
// ============================================================

patientSelect.addEventListener("change", () => {
  const id = Number(patientSelect.value);

  const patient = registeredPatients.find((item) => item.id === id);

  // Khi đổi bệnh nhân,
  // Case cũ không được tái sử dụng.
  currentCaseId = null;

  currentBatchId = null;

  currentCaseImageId = null;

  currentAnalysisId = null;

  currentReportId = null;

  resetActionState();

  if (!patient) {
    selectedPatient = null;

    renderSelectedPatient();

    return;
  }

  selectedPatient = {
    kind: "account",

    patient_user_id: patient.id,

    snapshot: patientSnapshot(patient),
  };

  renderSelectedPatient();
});

// ============================================================
// TEMPORARY PATIENT MODAL
// ============================================================

function openTemporaryPatientModal() {
  try {
    requireDoctor();
  } catch (error) {
    alert(error.message);

    return;
  }

  temporaryPatientModal.classList.remove("hidden");

  window.setTimeout(() => {
    tempPatientFullName.focus();
  }, 0);
}

function closeTemporaryPatientModal() {
  temporaryPatientModal.classList.add("hidden");
}

addTemporaryPatientBtn.addEventListener("click", openTemporaryPatientModal);

closeTemporaryPatientBtn.addEventListener("click", closeTemporaryPatientModal);

cancelTemporaryPatientBtn.addEventListener("click", closeTemporaryPatientModal);

temporaryPatientBackdrop.addEventListener("click", closeTemporaryPatientModal);

// ESC closes modal

document.addEventListener("keydown", (event) => {
  if (
    event.key === "Escape" &&
    !temporaryPatientModal.classList.contains("hidden")
  ) {
    closeTemporaryPatientModal();
  }
});

// ============================================================
// SAVE TEMP PATIENT
// ============================================================

temporaryPatientForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const fullName = tempPatientFullName.value.trim();

  if (!fullName) {
    alert("Vui lòng nhập họ tên bệnh nhân.");

    return;
  }

  const email = tempPatientEmail.value.trim();

  const snapshot = {
    full_name: fullName,

    date_of_birth: tempPatientDob.value || null,

    gender: tempPatientGender.value || null,

    phone: tempPatientPhone.value.trim() || null,

    email: email || null,

    address: tempPatientAddress.value.trim() || null,
  };

  selectedPatient = {
    kind: "temporary",

    patient_user_id: null,

    snapshot,
  };

  // Case sẽ được tạo
  // khi người dùng bắt đầu upload.
  currentCaseId = null;

  currentBatchId = null;

  currentCaseImageId = null;

  currentAnalysisId = null;

  currentReportId = null;

  patientSelect.value = "";

  renderSelectedPatient();

  resetActionState();

  temporaryPatientForm.reset();

  closeTemporaryPatientModal();
});

// ============================================================
// CREATE CASE AUTOMATICALLY
// ============================================================

async function ensureCurrentCase() {
  requireDoctor();

  if (currentCaseId) {
    return currentCaseId;
  }

  if (!selectedPatient) {
    throw new Error("Vui lòng chọn bệnh nhân " + "hoặc thêm bệnh nhân tạm.");
  }

  /*
   * Giao diện hiện tại chưa có
   * combobox chọn Doctor cho Admin.
   *
   * Workflow chính dùng tài khoản Doctor.
   */
  if (currentUser.role === "ADMIN") {
    throw new Error(
      "Để tạo ca từ giao diện này, " +
        "hãy đăng nhập bằng " +
        "tài khoản Doctor.",
    );
  }

  const payload = {
    lesion_location: lesionLocationInput.value.trim() || null,
  };

  if (selectedPatient.kind === "account") {
    payload.patient_user_id = selectedPatient.patient_user_id;
  } else {
    payload.temporary_patient = selectedPatient.snapshot;
  }

  const csrfToken = await getCsrfToken();

  const response = await fetch("/api/cases", {
    method: "POST",

    credentials: "same-origin",

    headers: {
      "Content-Type": "application/json",

      "X-CSRFToken": csrfToken,
    },

    body: JSON.stringify(payload),
  });

  const data = await responseJson(response);

  if (!response.ok) {
    throw new Error(getErrorMessage(data, "Không tạo được ca phân tích."));
  }

  currentCaseId = data.id;

  currentPatientSnapshot = data.patient_snapshot || selectedPatient.snapshot;

  return currentCaseId;
}

// ============================================================
// AUTH
// ============================================================

async function refreshAuthState() {
  try {
    const response = await fetch("/api/auth/me", {
      credentials: "same-origin",
    });

    if (!response.ok) {
      currentUser = null;

      authStatus.textContent = "Chưa đăng nhập";

      loginBtn.classList.remove("hidden");

      logoutBtn.classList.add("hidden");

      resetPatientUiForLoggedOut();

      syncAnalyzeButton();

      return;
    }

    const data = await response.json();

    currentUser = data.user || data;

    authStatus.textContent = `${
      currentUser.full_name || currentUser.email
    } · ${currentUser.role}`;

    loginBtn.classList.add("hidden");

    logoutBtn.classList.remove("hidden");

    if (currentUser.role === "DOCTOR" || currentUser.role === "ADMIN") {
      await loadPatients();
    } else {
      resetPatientUiForLoggedOut();
    }

    syncAnalyzeButton();
  } catch (error) {
    console.error(error);

    currentUser = null;

    authStatus.textContent = "Không kiểm tra được " + "phiên đăng nhập";

    resetPatientUiForLoggedOut();

    syncAnalyzeButton();
  }
}

// ============================================================
// LOGIN
// ============================================================

loginBtn.addEventListener("click", async () => {
  const email = loginEmail.value.trim();

  const password = loginPassword.value;

  if (!email || !password) {
    alert("Nhập email và mật khẩu.");

    return;
  }

  try {
    loginBtn.disabled = true;

    const csrfToken = await getCsrfToken();

    const response = await fetch("/api/auth/login", {
      method: "POST",

      credentials: "same-origin",

      headers: {
        "Content-Type": "application/json",

        "X-CSRFToken": csrfToken,
      },

      body: JSON.stringify({
        email,
        password,
      }),
    });

    const data = await responseJson(response);

    if (!response.ok) {
      throw new Error(getErrorMessage(data, "Đăng nhập thất bại."));
    }

    loginPassword.value = "";

    await refreshAuthState();
  } catch (error) {
    alert(error.message);
  } finally {
    loginBtn.disabled = false;
  }
});

// ============================================================
// LOGOUT
// ============================================================

logoutBtn.addEventListener("click", async () => {
  try {
    const csrfToken = await getCsrfToken();

    await fetch("/api/auth/logout", {
      method: "POST",

      credentials: "same-origin",

      headers: {
        "X-CSRFToken": csrfToken,
      },
    });
  } finally {
    currentUser = null;

    resetUpload();

    await refreshAuthState();
  }
});

// ============================================================
// SITE SETTINGS
// ============================================================

let siteSettings = null;

function setSiteText(id, value) {
  const node = $(id);

  if (node) {
    node.textContent = value || "";
  }
}

function setOptionalSiteLink(id, label, href) {
  const node = $(id);

  if (!node) {
    return;
  }

  const hasValue =
    typeof label === "string" &&
    label.trim() &&
    typeof href === "string" &&
    href.trim();

  node.classList.toggle("hidden", !hasValue);

  if (!hasValue) {
    node.removeAttribute("href");

    node.textContent = "";

    return;
  }

  node.textContent = label;

  node.setAttribute("href", href);
}

async function loadSiteSettings() {
  try {
    const response = await fetch("/api/site-settings");

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    siteSettings = await response.json();

    const siteName = siteSettings.site_name || "";

    const siteDescription = siteSettings.footer_description || "";

    document.title = siteName || "DermaScan AI";

    setSiteText("site-brand-name", siteName);

    setSiteText("site-brand-subtitle", siteDescription);

    setSiteText("homepage-site-title", siteName);

    setSiteText("homepage-site-description", siteDescription);

    setSiteText("site-footer-title", siteSettings.footer_title);

    setSiteText("site-footer-description", siteDescription);

    setSiteText("site-address", siteSettings.address);

    setSiteText("site-copyright", siteSettings.copyright_text);

    const homepage = $("homepage-site-name");

    if (homepage) {
      homepage.setAttribute("aria-label", siteName ? `Banner ${siteName}` : "");
    }

    const logo = $("site-logo");

    if (logo && siteSettings.logo_url) {
      logo.src = siteSettings.logo_url;

      logo.alt = siteName;

      logo.classList.remove("hidden");
    }

    const favicon = $("site-favicon");

    if (favicon && siteSettings.favicon_url) {
      favicon.href = siteSettings.favicon_url;
    }

    setOptionalSiteLink(
      "site-phone",
      siteSettings.phone,
      `tel:${siteSettings.phone || ""}`,
    );

    setOptionalSiteLink(
      "site-email",
      siteSettings.email,
      `mailto:${siteSettings.email || ""}`,
    );

    setOptionalSiteLink("site-facebook", "Facebook", siteSettings.facebook_url);
  } catch (error) {
    console.warn("Không thể tải site settings", error);
  }
}

// ============================================================
// HOMEPAGE SLIDES
// ============================================================

const homepageCarousel = document.querySelector(
  '[data-testid="homepage-carousel"]',
);

const homepageTrack = $("homepage-carousel-track");

const homepageEmpty = $("homepage-empty");

const homepagePrev = $("homepage-slide-prev");

const homepageNext = $("homepage-slide-next");

const homepageIndicators = $("homepage-slide-indicators");

let homepageSlides = [];

let homepageIndex = 0;

let homepageTimer = null;

let homepageTransitioning = false;

// Slide tự chuyển sau 5 giây

const HOMEPAGE_INTERVAL_MS = 5000;

// Thời gian hiệu ứng swipe + fade

const HOMEPAGE_TRANSITION_MS = 760;

// ============================================================
// SLIDESHOW TIMER
// ============================================================

function stopHomepageTimer() {
  if (!homepageTimer) {
    return;
  }

  window.clearTimeout(homepageTimer);

  homepageTimer = null;
}

function homepageCanAutoplay() {
  return (
    homepageSlides.length > 1 && !homepageTransitioning && !document.hidden
  );
}

function restartHomepageTimer() {
  stopHomepageTimer();

  if (!homepageCanAutoplay()) {
    return;
  }

  homepageTimer = window.setTimeout(
    () => {
      void showHomepageSlide(homepageIndex + 1, "next");
    },

    HOMEPAGE_INTERVAL_MS,
  );
}

// ============================================================
// PRELOAD SLIDE IMAGE
// ============================================================

async function prepareHomepageImage(index) {
  if (!homepageSlides.length) {
    return;
  }

  const normalizedIndex =
    (index + homepageSlides.length) % homepageSlides.length;

  const slide = homepageTrack.children[normalizedIndex];

  if (!slide) {
    return;
  }

  const image = slide.querySelector(".homepage-slide-image");

  if (!image) {
    return;
  }

  if (image.complete && image.naturalWidth > 0) {
    if (typeof image.decode === "function") {
      try {
        await image.decode();
      } catch {
        // Không khóa slideshow.
      }
    }

    return;
  }

  await new Promise((resolve) => {
    let finished = false;

    const done = () => {
      if (finished) {
        return;
      }

      finished = true;

      image.removeEventListener("load", done);

      image.removeEventListener("error", done);

      resolve();
    };

    image.addEventListener("load", done, {
      once: true,
    });

    image.addEventListener("error", done, {
      once: true,
    });

    window.setTimeout(done, 1500);
  });
}

// ============================================================
// SLIDESHOW MOTION HELPERS
// ============================================================

function clearHomepageMotion(slide) {
  if (!slide) {
    return;
  }

  slide.classList.remove(
    "is-leaving-next",
    "is-leaving-prev",
    "is-pre-enter-next",
    "is-pre-enter-prev",
  );
}

function updateHomepageIndicators() {
  Array.from(homepageIndicators.children).forEach((indicator, index) => {
    const active = index === homepageIndex;

    indicator.classList.toggle("is-active", active);

    indicator.setAttribute("aria-current", active ? "true" : "false");
  });
}

// ============================================================
// SHOW SLIDE
// ============================================================

async function showHomepageSlide(requestedIndex, direction = "next") {
  if (!homepageSlides.length) {
    return;
  }

  if (homepageTransitioning) {
    return;
  }

  const nextIndex =
    (requestedIndex + homepageSlides.length) % homepageSlides.length;

  if (nextIndex === homepageIndex) {
    restartHomepageTimer();

    return;
  }

  stopHomepageTimer();

  homepageTransitioning = true;

  await prepareHomepageImage(nextIndex);

  const oldIndex = homepageIndex;

  const oldSlide = homepageTrack.children[oldIndex];

  const nextSlide = homepageTrack.children[nextIndex];

  if (!nextSlide) {
    homepageTransitioning = false;

    restartHomepageTimer();

    return;
  }

  const isPrevious = direction === "prev";

  const incomingClass = isPrevious ? "is-pre-enter-prev" : "is-pre-enter-next";

  const outgoingClass = isPrevious ? "is-leaving-prev" : "is-leaving-next";

  clearHomepageMotion(oldSlide);

  clearHomepageMotion(nextSlide);

  // ================= PREPARE NEW SLIDE =================

  nextSlide.classList.remove("is-active");

  nextSlide.classList.add(incomingClass);

  nextSlide.setAttribute("aria-hidden", "false");

  /*
   * Force reflow.
   * Browser phải ghi nhận vị trí bắt đầu
   * trước khi chuyển về x = 0.
   */
  void nextSlide.offsetWidth;

  // ================= ANIMATE =================

  window.requestAnimationFrame(() => {
    if (oldSlide) {
      oldSlide.classList.remove("is-active");

      oldSlide.classList.add(outgoingClass);

      oldSlide.setAttribute("aria-hidden", "true");
    }

    nextSlide.classList.remove(incomingClass);

    nextSlide.classList.add("is-active");

    homepageIndex = nextIndex;

    updateHomepageIndicators();
  });

  // ================= PRELOAD FOLLOWING =================

  const preloadIndex = isPrevious
    ? (nextIndex - 1 + homepageSlides.length) % homepageSlides.length
    : (nextIndex + 1) % homepageSlides.length;

  void prepareHomepageImage(preloadIndex);

  // ================= CLEANUP =================

  window.setTimeout(
    () => {
      clearHomepageMotion(oldSlide);

      clearHomepageMotion(nextSlide);

      homepageTransitioning = false;

      restartHomepageTimer();
    },

    HOMEPAGE_TRANSITION_MS + 40,
  );
}

// ============================================================
// RENDER HOMEPAGE SLIDES
// ============================================================

function renderHomepageSlides(slides) {
  stopHomepageTimer();

  homepageSlides = Array.isArray(slides) ? slides : [];

  homepageIndex = 0;

  homepageTransitioning = false;

  homepageTrack.textContent = "";

  homepageIndicators.textContent = "";

  // ================= NO SLIDES =================

  if (homepageSlides.length === 0) {
    homepageCarousel.classList.add("is-empty");

    homepageEmpty.classList.remove("hidden");

    homepagePrev.classList.add("hidden");

    homepageNext.classList.add("hidden");

    return;
  }

  // ================= HAS SLIDES =================

  homepageCarousel.classList.remove("is-empty");

  homepageEmpty.classList.add("hidden");

  const hasMultiple = homepageSlides.length > 1;

  homepagePrev.classList.toggle("hidden", !hasMultiple);

  homepageNext.classList.toggle("hidden", !hasMultiple);

  homepageSlides.forEach((slide, position) => {
    // ================= ARTICLE =================

    const article = document.createElement("article");

    article.className = "homepage-slide";

    article.setAttribute("aria-hidden", "true");

    // ================= IMAGE =================

    const image = document.createElement("img");

    image.className = "homepage-slide-image";

    image.src = slide.image_url;

    image.alt = slide.title || "";

    // Tải trước các slide để hạn chế khựng.

    image.loading = "eager";

    image.decoding = "async";

    if (position === 0) {
      image.fetchPriority = "high";
    }

    image.addEventListener(
      "error",
      () => {
        article.classList.add("image-error");
      },
      {
        once: true,
      },
    );

    // ================= CONTENT =================

    const content = document.createElement("div");

    content.className = "homepage-slide-content";

    const title = document.createElement("h1");

    title.className = "homepage-slide-title";

    title.textContent = slide.title || "";

    const subtitle = document.createElement("p");

    subtitle.className = "homepage-slide-subtitle";

    subtitle.textContent = slide.subtitle || "";

    content.append(title, subtitle);

    // ================= OPTIONAL CTA =================

    if (slide.button_text && slide.button_url) {
      const button = document.createElement("a");

      button.className = "homepage-slide-button";

      button.href = slide.button_url;

      button.textContent = slide.button_text;

      content.append(button);
    }

    article.append(image, content);

    homepageTrack.append(article);

    // ================= DOT =================

    const indicator = document.createElement("button");

    indicator.type = "button";

    indicator.className = "homepage-slide-indicator";

    indicator.setAttribute("aria-label", `Banner ${position + 1}`);

    indicator.setAttribute("aria-current", "false");

    indicator.addEventListener("click", () => {
      if (homepageTransitioning) {
        return;
      }

      if (position === homepageIndex) {
        restartHomepageTimer();

        return;
      }

      const direction = position > homepageIndex ? "next" : "prev";

      void showHomepageSlide(position, direction);
    });

    homepageIndicators.append(indicator);
  });

  // ================= INITIAL =================

  const firstSlide = homepageTrack.children[0];

  const firstIndicator = homepageIndicators.children[0];

  if (firstSlide) {
    firstSlide.classList.add("is-active");

    firstSlide.setAttribute("aria-hidden", "false");
  }

  if (firstIndicator) {
    firstIndicator.classList.add("is-active");

    firstIndicator.setAttribute("aria-current", "true");
  }

  // Decode slide thứ 2 sớm.

  if (homepageSlides.length > 1) {
    void prepareHomepageImage(1);
  }

  restartHomepageTimer();
}

// ============================================================
// LOAD SLIDES FROM DATABASE
// ============================================================

async function loadHomepageSlides() {
  try {
    const response = await fetch("/api/slides/active", {
      credentials: "same-origin",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    renderHomepageSlides(data.slides);
  } catch (error) {
    console.warn("Không thể tải banner", error);

    renderHomepageSlides([]);
  }
}

// ============================================================
// SLIDE PREVIOUS
// ============================================================

homepagePrev.addEventListener("click", () => {
  if (homepageTransitioning) {
    return;
  }

  void showHomepageSlide(homepageIndex - 1, "prev");
});

// ============================================================
// SLIDE NEXT
// ============================================================

homepageNext.addEventListener("click", () => {
  if (homepageTransitioning) {
    return;
  }

  void showHomepageSlide(homepageIndex + 1, "next");
});

// ============================================================
// PAGE VISIBILITY
// ============================================================

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stopHomepageTimer();
  } else {
    restartHomepageTimer();
  }
});

// ============================================================
// HEALTH CHECK
// ============================================================

fetch("/health")
  .then((response) => response.json())

  .then((data) => {
    statusDot.classList.add("online");

    statusText.textContent =
      data.device === "cuda" ? "GPU sẵn sàng" : "Chế độ CPU";
  })

  .catch(() => {
    statusDot.classList.add("offline");

    statusText.textContent = "Mất kết nối";
  });

// ============================================================
// FILE VALIDATION
// ============================================================

function validateSelectedFile(file) {
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

  if (!allowedTypes.includes(file.type)) {
    return `${file.name}: ` + "không đúng định dạng.";
  }

  if (file.size > 10 * 1024 * 1024) {
    return `${file.name}: ` + "vượt quá 10 MB.";
  }

  return null;
}

// ============================================================
// SELECT FILES
// ============================================================

function setSelectedFiles(files) {
  const list = Array.from(files);

  if (list.length > 20) {
    showError("Chỉ được chọn tối đa 20 ảnh.");

    return;
  }

  const errors = [];

  const valid = [];

  list.forEach((file) => {
    const error = validateSelectedFile(file);

    if (error) {
      errors.push(error);
    } else {
      valid.push(file);
    }
  });

  selectedFiles = valid;

  // Case cũ không nên tái sử dụng
  // khi người dùng chọn batch mới.

  currentCaseId = null;

  currentBatchId = null;

  currentCaseImageId = null;

  currentAnalysisId = null;

  currentReportId = null;

  resetActionState();

  renderSelectedFiles();

  if (selectedFiles.length) {
    showPreview(selectedFiles[0]);

    syncAnalyzeButton();
  } else {
    resetUpload();
  }

  if (errors.length) {
    alert(errors.join("\n"));
  }
}

// ============================================================
// RENDER SELECTED FILES
// ============================================================

function renderSelectedFiles() {
  selectedFilesContainer.innerHTML = "";

  if (selectedFiles.length === 0) {
    syncAnalyzeButton();

    return;
  }

  const title = document.createElement("div");

  title.className = "selected-files-title";

  title.textContent = `${selectedFiles.length} ảnh đã chọn`;

  selectedFilesContainer.append(title);

  selectedFiles.forEach((file, index) => {
    const row = document.createElement("div");

    row.className = "selected-file-row";

    const name = document.createElement("span");

    name.textContent = file.name;

    const remove = document.createElement("button");

    remove.type = "button";

    remove.textContent = "×";

    remove.title = "Xóa ảnh này";

    remove.addEventListener("click", () => {
      selectedFiles.splice(index, 1);

      currentCaseId = null;

      renderSelectedFiles();

      if (selectedFiles.length) {
        showPreview(selectedFiles[0]);

        syncAnalyzeButton();
      } else {
        resetUpload();
      }
    });

    row.append(name, remove);

    selectedFilesContainer.append(row);
  });
}

// ============================================================
// PREVIEW
// ============================================================

function showPreview(file) {
  const reader = new FileReader();

  reader.onload = (event) => {
    previewImg.src = event.target.result;

    previewWrap.classList.remove("hidden");

    dropZone.classList.add("hidden");
  };

  reader.readAsDataURL(file);
}

// ============================================================
// DROPZONE
// ============================================================

dropZone.addEventListener("click", () => {
  fileInput.click();
});

["dragenter", "dragover"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();

    dropZone.classList.add("dragover");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();

    dropZone.classList.remove("dragover");
  });
});

dropZone.addEventListener("drop", (event) => {
  setSelectedFiles(event.dataTransfer.files);
});

fileInput.addEventListener("change", (event) => {
  setSelectedFiles(event.target.files);
});

clearBtn.addEventListener("click", resetUpload);

resetBtn.addEventListener("click", resetUpload);

// ============================================================
// BATCH UPLOAD
// ============================================================

async function uploadBatch() {
  requireDoctor();

  if (selectedFiles.length === 0) {
    throw new Error("Chưa chọn ảnh.");
  }

  if (!selectedPatient) {
    throw new Error("Vui lòng chọn bệnh nhân.");
  }

  // Tự tạo Case tại đây.

  currentCaseId = await ensureCurrentCase();

  const formData = new FormData();

  selectedFiles.forEach((file) => {
    formData.append("images", file);
  });

  const csrfToken = await getCsrfToken();

  const response = await fetch(`/api/cases/${currentCaseId}/upload-batch`, {
    method: "POST",

    credentials: "same-origin",

    headers: {
      "X-CSRFToken": csrfToken,
    },

    body: formData,
  });

  const data = await responseJson(response);

  if (!response.ok) {
    throw new Error(getErrorMessage(data, "Batch Upload thất bại."));
  }

  currentBatchId = data.batch_id;

  exportExcelBtn.disabled = false;

  batchStatus.hidden = false;

  batchStatusText.textContent =
    `Batch #${data.batch_id}: ` +
    `${data.success_count} thành công, ` +
    `${data.failed_count} lỗi.`;

  renderBatchItems(data.items || []);

  return data;
}

// ============================================================
// RENDER BATCH
// ============================================================

function renderBatchItems(items) {
  batchItems.innerHTML = "";

  if (!items.length) {
    return;
  }

  const heading = document.createElement("h4");

  heading.textContent = "Tất cả ảnh";

  batchItems.append(heading);

  items.forEach((item) => {
    const row = document.createElement("div");

    row.className = "batch-item";

    const info = document.createElement("div");

    const name = document.createElement("strong");

    name.textContent = item.original_filename || item.filename || "Ảnh";

    const status = document.createElement("small");

    status.textContent =
      item.status === "UPLOADED"
        ? `ID ảnh: ` + `${item.case_image_id}`
        : item.error_message || "Upload lỗi";

    info.append(name, status);

    row.append(info);

    if (item.status === "UPLOADED" && item.case_image_id) {
      const button = document.createElement("button");

      button.type = "button";

      button.className = "workflow-small-btn primary";

      button.textContent = "Phân tích";

      button.addEventListener("click", () => {
        void analyzeCaseImage(item.case_image_id);
      });

      row.append(button);
    }

    batchItems.append(row);
  });
}

// ============================================================
// MAIN ANALYZE BUTTON
// ============================================================

analyzeBtn.addEventListener("click", async () => {
  try {
    requireDoctor();

    if (!selectedPatient) {
      throw new Error("Vui lòng chọn bệnh nhân " + "trước khi phân tích.");
    }

    emptyState.classList.add("hidden");

    resultsState.classList.add("hidden");

    errorState.classList.add("hidden");

    loadingState.classList.remove("hidden");

    analyzeBtn.disabled = true;

    analyzeBtn.textContent = "Đang tải ảnh...";

    const batch = await uploadBatch();

    const first = (batch.items || []).find(
      (item) => item.status === "UPLOADED" && item.case_image_id,
    );

    if (!first) {
      throw new Error("Batch không có ảnh hợp lệ.");
    }

    analyzeBtn.textContent = "Đang phân tích...";

    await analyzeCaseImage(first.case_image_id);

    resetBtn.classList.remove("hidden");

    analyzeBtn.textContent = "Batch đã tải lên";
  } catch (error) {
    loadingState.classList.add("hidden");

    showError(error.message);

    analyzeBtn.textContent = "Tải lên & phân tích ảnh đầu tiên";

    syncAnalyzeButton();
  }
});

// ============================================================
// ANALYZE CASE IMAGE
// ============================================================

async function analyzeCaseImage(caseImageId) {
  requireDoctor();

  currentCaseImageId = caseImageId;

  currentAnalysisId = null;

  currentReportId = null;

  resetActionState();

  exportExcelBtn.disabled = !currentBatchId;

  emptyState.classList.add("hidden");

  resultsState.classList.add("hidden");

  errorState.classList.add("hidden");

  loadingState.classList.remove("hidden");

  try {
    const csrfToken = await getCsrfToken();

    const response = await fetch(`/api/case-images/${caseImageId}/analyze`, {
      method: "POST",

      credentials: "same-origin",

      headers: {
        "X-CSRFToken": csrfToken,
      },
    });

    const data = await responseJson(response);

    if (!response.ok) {
      throw new Error(getErrorMessage(data, "Phân tích AI thất bại."));
    }

    currentAnalysisId = data.analysis_id;

    saveDoctorReviewBtn.disabled = false;

    await loadDoctorReview();

    currentCaseId = data.case_id || currentCaseId;

    loadingState.classList.add("hidden");

    resultsState.classList.remove("hidden");

    renderResults(data);

    measureBtn.disabled = false;

    exportPdfBtn.disabled = false;
  } catch (error) {
    loadingState.classList.add("hidden");

    showError(error.message);

    throw error;
  }
}

// ============================================================
// DOCTOR REVIEW
// ============================================================

function clearDoctorReviewForm() {
  currentDoctorReview = null;

  doctorClinicalNote.value = "";

  doctorConclusion.value = "";

  doctorRecommendation.value = "";

  doctorReviewStatus.textContent = "Chưa lưu";

  doctorReviewStatus.classList.remove("saved");

  doctorReviewStatus.classList.add("unsaved");

  saveDoctorReviewBtn.disabled = !currentAnalysisId;
}

function renderDoctorReview(review) {
  currentDoctorReview = review || null;

  if (!review) {
    clearDoctorReviewForm();

    return;
  }

  doctorClinicalNote.value = review.clinical_note || "";

  doctorConclusion.value = review.doctor_conclusion || "";

  doctorRecommendation.value = review.recommendation || "";

  doctorReviewStatus.textContent =
    review.review_status === "REVIEWED" ? "Đã lưu" : "Bản nháp";

  doctorReviewStatus.classList.remove("unsaved");

  doctorReviewStatus.classList.add("saved");

  saveDoctorReviewBtn.disabled = false;
}

// ============================================================
// LOAD DOCTOR REVIEW
// ============================================================

async function loadDoctorReview() {
  if (!currentAnalysisId) {
    clearDoctorReviewForm();

    return null;
  }

  const response = await fetch(`/api/analyses/${currentAnalysisId}/review`, {
    credentials: "same-origin",
  });

  const data = await responseJson(response);

  if (!response.ok) {
    throw new Error(getErrorMessage(data, "Không tải được chẩn đoán bác sĩ."));
  }

  renderDoctorReview(data.review);

  return data.review;
}

// ============================================================
// DIRTY REVIEW
// ============================================================

[doctorClinicalNote, doctorConclusion, doctorRecommendation].forEach(
  (field) => {
    field.addEventListener("input", () => {
      doctorReviewStatus.textContent = "Chưa lưu";

      doctorReviewStatus.classList.remove("saved");

      doctorReviewStatus.classList.add("unsaved");
    });
  },
);

// ============================================================
// SAVE REVIEW
// ============================================================

saveDoctorReviewBtn.addEventListener("click", async () => {
  if (!currentAnalysisId) {
    alert("Chưa có kết quả phân tích.");

    return;
  }

  const conclusion = doctorConclusion.value.trim();

  if (!conclusion) {
    alert("Vui lòng nhập chẩn đoán của bác sĩ.");

    focusDoctorDiagnosis();

    return;
  }

  try {
    requireDoctor();

    saveDoctorReviewBtn.disabled = true;

    saveDoctorReviewBtn.textContent = "Đang lưu...";

    const csrfToken = await getCsrfToken();

    const response = await fetch(`/api/analyses/${currentAnalysisId}/review`, {
      method: "POST",

      credentials: "same-origin",

      headers: {
        "Content-Type": "application/json",

        "X-CSRFToken": csrfToken,
      },

      body: JSON.stringify({
        clinical_note: doctorClinicalNote.value.trim(),

        doctor_conclusion: conclusion,

        recommendation: doctorRecommendation.value.trim(),
      }),
    });

    const data = await responseJson(response);

    if (!response.ok) {
      throw new Error(getErrorMessage(data, "Không lưu được chẩn đoán."));
    }

    renderDoctorReview(data.review);

    doctorReviewStatus.textContent = "Đã lưu";
  } catch (error) {
    alert(error.message);
  } finally {
    saveDoctorReviewBtn.disabled = false;

    saveDoctorReviewBtn.textContent = "Lưu chẩn đoán";
  }
});

// ============================================================
// MEASUREMENT
// ============================================================

measureBtn.addEventListener("click", async () => {
  if (!currentAnalysisId) {
    alert("Chưa có Analysis.");

    return;
  }

  try {
    requireDoctor();

    measureBtn.disabled = true;

    measureBtn.textContent = "Đang đo...";

    const csrfToken = await getCsrfToken();

    const response = await fetch(`/api/analyses/${currentAnalysisId}/measure`, {
      method: "POST",

      credentials: "same-origin",

      headers: {
        "X-CSRFToken": csrfToken,
      },
    });

    const data = await responseJson(response);

    if (!response.ok) {
      throw new Error(getErrorMessage(data, "Đo tổn thương thất bại."));
    }

    if (data.status !== "COMPLETED") {
      throw new Error(data.error_message || "Không tìm được contour phù hợp.");
    }

    lesionArea.textContent = Number(data.lesion_area_px).toFixed(2);

    lesionPerimeter.textContent = Number(data.lesion_perimeter_px).toFixed(2);

    lesionRatio.textContent = (Number(data.lesion_ratio) * 100).toFixed(2);

    measurementResult.hidden = false;

    // ================= CONTOUR =================

    if (data.contour_url) {
      contourImg.src = data.contour_url + `?t=${Date.now()}`;

      contourImg.onload = () => {
        contourResult.hidden = false;
      };

      contourImg.onerror = () => {
        console.error("Không tải được ảnh contour:", data.contour_url);

        contourResult.hidden = true;
      };
    } else {
      contourImg.removeAttribute("src");

      contourResult.hidden = true;
    }

    measureBtn.textContent = "Đã đo tổn thương";
  } catch (error) {
    alert(error.message);

    measureBtn.disabled = false;

    measureBtn.textContent = "Đo tổn thương";
  }
});

// ============================================================
// EXPORT PDF
// ============================================================

exportPdfBtn.addEventListener("click", async () => {
  if (!currentCaseId || !currentAnalysisId) {
    alert("Chưa có Case hoặc Analysis.");
    return;
  }

  try {
    requireDoctor();

    exportPdfBtn.disabled = true;

    exportPdfBtn.textContent = "Đang tạo PDF...";

    const csrfToken = await getCsrfToken();

    const response = await fetch(`/api/cases/${currentCaseId}/reports`, {
      method: "POST",

      credentials: "same-origin",

      headers: {
        "Content-Type": "application/json",

        "X-CSRFToken": csrfToken,
      },

      body: JSON.stringify({
        analysis_id: currentAnalysisId,
      }),
    });

    const data = await responseJson(response);

    if (!response.ok) {
      throw new Error(getErrorMessage(data, "Không tạo được PDF."));
    }

    currentReportId = data.id;

    downloadPdfBtn.disabled = false;

    sendEmailBtn.disabled = false;

    reportStatus.hidden = false;

    reportStatus.textContent = `Đã tạo báo cáo v${data.report_version}.`;

    exportPdfBtn.textContent = "Tạo phiên bản PDF mới";
  } catch (error) {
    alert(error.message);
  } finally {
    exportPdfBtn.disabled = false;
  }
});

// ============================================================
// EXPORT BATCH ANALYSIS EXCEL
// ============================================================

exportExcelBtn.addEventListener("click", async () => {
  if (!currentBatchId) {
    return;
  }

  try {
    requireDoctor();
    exportExcelBtn.disabled = true;
    exportExcelBtn.textContent = "Đang tạo Excel...";

    const response = await fetch(
      `/api/upload-batches/${currentBatchId}/analysis.xlsx`,
      { credentials: "same-origin" },
    );
    if (!response.ok) {
      const data = await responseJson(response);
      throw new Error(getErrorMessage(data, "Không tạo được file Excel."));
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `DermaScan_Batch_${currentBatchId}.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    alert(error.message);
  } finally {
    exportExcelBtn.disabled = !currentBatchId;
    exportExcelBtn.textContent = "Xuất Excel";
  }
});

// ============================================================
// DOWNLOAD PDF
// ============================================================

downloadPdfBtn.addEventListener("click", () => {
  if (!currentReportId) {
    return;
  }

  window.location.href = `/api/reports/${currentReportId}/download`;
});

// ============================================================
// SEND EMAIL
// ============================================================

sendEmailBtn.addEventListener("click", async () => {
  if (!currentReportId) {
    alert("Hãy tạo PDF trước.");

    return;
  }

  const defaultPatientEmail =
    currentPatientSnapshot && currentPatientSnapshot.email
      ? currentPatientSnapshot.email
      : "";

  const recipient = window.prompt("Email người nhận:", defaultPatientEmail);

  if (recipient === null) {
    return;
  }

  /*
   * Bệnh nhân tạm không có tài khoản.
   * Nếu không có email snapshot,
   * backend cũng không thể fallback case.patient.email.
   */
  if (
    selectedPatient &&
    selectedPatient.kind === "temporary" &&
    !recipient.trim()
  ) {
    alert("Bệnh nhân tạm chưa có email. " + "Vui lòng nhập email người nhận.");

    return;
  }

  const subject = window.prompt(
    "Tiêu đề email:",
    "Kết quả phân tích tổn thương da",
  );

  if (subject === null) {
    return;
  }

  try {
    requireDoctor();

    sendEmailBtn.disabled = true;

    sendEmailBtn.textContent = "Đang gửi...";

    const csrfToken = await getCsrfToken();

    const body = {};

    if (recipient.trim()) {
      body.recipient_email = recipient.trim();
    }

    if (subject.trim()) {
      body.subject = subject.trim();
    }

    const response = await fetch(`/api/reports/${currentReportId}/email`, {
      method: "POST",

      credentials: "same-origin",

      headers: {
        "Content-Type": "application/json",

        "X-CSRFToken": csrfToken,
      },

      body: JSON.stringify(body),
    });

    const data = await responseJson(response);

    if (!response.ok) {
      throw new Error(getErrorMessage(data, "Gửi email thất bại."));
    }

    alert(`Email đã gửi tới ${data.recipient_email}`);
  } catch (error) {
    alert(error.message);
  } finally {
    sendEmailBtn.disabled = false;

    sendEmailBtn.textContent = "Gửi Email";
  }
});

// ============================================================
// RESULT RENDER
// ============================================================

function renderResults(data) {
  const {
    binary,

    multiclass,

    interpretation,

    gradcam,

    original,
  } = data;

  const isMalignant = binary.prediction === 1;

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
    ? "Mô hình nhận diện đặc điểm " +
      "nghi ngờ ác tính " +
      `(độ tin cậy ` +
      `${binary.confidence_pct}%).`
    : "Mô hình không phát hiện " +
      "đặc điểm ác tính " +
      `(độ tin cậy ` +
      `${binary.confidence_pct}%).`;

  // ================= TAG =================

  resultTag.style.display = "inline-block";

  resultTag.textContent = isMalignant ? "ÁC TÍNH" : "LÀNH TÍNH";

  resultTag.className = "panel-tag" + (isMalignant ? " malignant" : "");

  // ========================================================
  // INTERPRETATION
  // ========================================================

  if (interpretation) {
    interpCard.dataset.severity = interpretation.severity;

    severityBadge.className = "severity-badge " + interpretation.severity;

    severityBadge.textContent = interpretation.severity_label;

    severityNote.textContent = "· " + interpretation.severity_note;

    interpHeadline.textContent = interpretation.headline;

    interpSummary.textContent = interpretation.summary;

    interpDetail.textContent = interpretation.detail;

    interpActions.innerHTML = "";

    (interpretation.actions || []).forEach((action) => {
      const li = document.createElement("li");

      li.textContent = action;

      interpActions.appendChild(li);
    });

    interpConclusion.textContent = interpretation.conclusion;
  }

  // ========================================================
  // MULTICLASS
  // ========================================================

  const predClass = multiclass.pred_class;

  const predNameVi = CLASS_NAME_VI[predClass] || predClass;

  predBadge.textContent = `${predNameVi} · ${predClass}`;

  predBadge.className =
    "pred-badge" +
    (multiclass.malignant_list.includes(predClass) ? " malignant" : "");

  probsList.innerHTML = "";

  const entries = Object.entries(multiclass.probs).sort((a, b) => b[1] - a[1]);

  entries.forEach(([cls, prob]) => {
    const isMalig = multiclass.malignant_list.includes(cls);

    const probability = (prob * 100).toFixed(1);

    const row = document.createElement("div");

    row.className =
      "prob-row" +
      (cls === predClass ? " top-pred" : "") +
      (isMalig ? " malignant" : "");

    row.innerHTML = `
                <span class="prob-label">
                    ${cls}
                </span>

                <div class="prob-bar-wrap">

                    <div
                        class="
                            prob-bar
                            ${isMalig ? "malignant" : "benign"}
                        "
                    ></div>

                </div>

                <span class="prob-value">
                    ${probability}%
                </span>
                `;

    probsList.appendChild(row);

    const bar = row.querySelector(".prob-bar");

    setTimeout(() => {
      bar.style.width = `${probability}%`;
    }, 100);
  });

  // ========================================================
  // IMAGES
  // ========================================================

  $("origImg").src = `data:image/jpeg;base64,${original}`;

  $("camImg").src = `data:image/png;base64,${gradcam}`;
}

// ============================================================
// RESET ACTION STATE
// ============================================================

function resetActionState() {
  measureBtn.disabled = true;

  exportPdfBtn.disabled = true;

  exportExcelBtn.disabled = true;

  downloadPdfBtn.disabled = true;

  sendEmailBtn.disabled = true;

  measureBtn.textContent = "Đo tổn thương";

  exportPdfBtn.textContent = "Xuất PDF";

  measurementResult.hidden = true;

  reportStatus.hidden = true;

  lesionArea.textContent = "--";

  lesionPerimeter.textContent = "--";

  lesionRatio.textContent = "--";

  if (contourResult) {
    contourResult.hidden = true;
  }

  if (contourImg) {
    contourImg.removeAttribute("src");
  }

  clearDoctorReviewForm();
}

// ============================================================
// RESET UPLOAD
// ============================================================

function resetUpload() {
  selectedFiles = [];

  /*
   * Khi chọn Batch khác:
   * tạo Case mới khi upload lại.
   *
   * Nhưng KHÔNG bỏ bệnh nhân đã chọn.
   */
  currentCaseId = null;

  currentBatchId = null;

  currentCaseImageId = null;

  currentAnalysisId = null;

  currentReportId = null;

  fileInput.value = "";

  previewImg.src = "";

  previewWrap.classList.add("hidden");

  dropZone.classList.remove("hidden");

  selectedFilesContainer.innerHTML = "";

  batchItems.innerHTML = "";

  batchStatus.hidden = true;

  batchStatusText.textContent = "";

  analyzeBtn.textContent = "Tải lên & phân tích ảnh đầu tiên";

  resetBtn.classList.add("hidden");

  resultsState.classList.add("hidden");

  loadingState.classList.add("hidden");

  errorState.classList.add("hidden");

  emptyState.classList.remove("hidden");

  resultTag.style.display = "none";

  resetActionState();

  syncAnalyzeButton();

  clearDoctorReviewForm();

  currentDoctorReview = null;

  doctorClinicalNote.value = "";

  doctorConclusion.value = "";

  doctorRecommendation.value = "";

  doctorReviewStatus.textContent = "Chưa lưu";

  doctorReviewStatus.classList.remove("saved");

  doctorReviewStatus.classList.add("unsaved");

  saveDoctorReviewBtn.disabled = true;
}

// ============================================================
// ERROR
// ============================================================

function showError(message) {
  errorText.textContent = message;

  errorState.classList.remove("hidden");

  resultsState.classList.add("hidden");

  loadingState.classList.add("hidden");

  emptyState.classList.add("hidden");
}

// ============================================================
// START
// ============================================================

loadSiteSettings();

loadHomepageSlides();

refreshAuthState();

resetActionState();

syncAnalyzeButton();
