(() => {
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const labels = {
    vi: { dashboard: "Dashboard Tổng Quan", accounts: "Quản Lý Tài Khoản", security: "Phiên Đăng Nhập & Bảo Mật", ai: "Quản Lý AI & Ca Khám", doctors: "Quản Lý Bác Sĩ & Duyệt", reports: "Thống Kê & Báo Cáo" },
    en: { dashboard: "Overview Dashboard", accounts: "Account Management", security: "Login Sessions & Security", ai: "AI & Case Management", doctors: "Doctors & Approvals", reports: "Statistics & Reports" },
  };
  const adminTranslations = {
    vi: {
      navLabel: "QUẢN TRỊ HỆ THỐNG", safe: "Hệ thống an toàn", encrypted: "Mã hóa đầu cuối · v2.4.0",
      portal: "AI · ADMIN PORTAL", admin: "Quản trị viên", logout: "Đăng xuất", dashboard: "DASHBOARD",
      welcome: "HỆ THỐNG ĐANG VẬN HÀNH", welcomeText: "Đây là tổng quan hoạt động hôm nay.",
      accounts: "TỔNG TÀI KHOẢN", cases: "CA KHÁM", analyses: "LƯỢT PHÂN TÍCH AI", doctors: "BÁC SĨ ĐANG HOẠT ĐỘNG",
      currentData: "Dữ liệu hiện tại", growth: "Tăng trưởng hệ thống", growthText: "Số ca khám và lượt phân tích từ cơ sở dữ liệu",
      recent: "Ca khám gần đây", live: "Cập nhật theo thời gian thực", viewAll: "Xem tất cả →",
      quick: "Truy cập nhanh", quickText: "Các tác vụ thường dùng", manageAccounts: "Quản lý tài khoản",
      manageAccountsText: "Thêm, sửa và phân quyền", approveDoctors: "Duyệt hồ sơ bác sĩ",
      approveDoctorsText: "3 hồ sơ đang chờ duyệt", exportReports: "Xuất báo cáo hệ thống", exportReportsText: "PDF hoặc Excel",
      aiEyebrow: "QUẢN TRỊ / AI OPERATIONS", aiTitle: "Quản lý AI & Ca khám", aiText: "Theo dõi Case, UploadBatch, Analysis và AnalysisResult.",
      flow: "Luồng phân tích", flowText: "Dữ liệu chi tiết Case và Analysis được lấy trực tiếp từ cơ sở dữ liệu.", openCases: "Mở danh sách ca khám",
    },
    en: {
      navLabel: "SYSTEM ADMINISTRATION", safe: "System secure", encrypted: "End-to-end encryption · v2.4.0",
      portal: "AI · ADMIN PORTAL", admin: "Administrator", logout: "Log out", dashboard: "DASHBOARD",
      welcome: "SYSTEM OPERATIONAL", welcomeText: "Here is today's activity overview.",
      accounts: "TOTAL ACCOUNTS", cases: "CASES", analyses: "AI ANALYSES", doctors: "ACTIVE DOCTORS",
      currentData: "Current data", growth: "System growth", growthText: "Cases and analyses from the database",
      recent: "Recent cases", live: "Updated in real time", viewAll: "View all →",
      quick: "Quick access", quickText: "Common tasks", manageAccounts: "Manage accounts",
      manageAccountsText: "Add, edit and assign permissions", approveDoctors: "Review doctor profiles",
      approveDoctorsText: "3 profiles awaiting approval", exportReports: "Export system report", exportReportsText: "PDF or Excel",
      aiEyebrow: "ADMIN / AI OPERATIONS", aiTitle: "AI & Case Management", aiText: "Monitor Case, UploadBatch, Analysis and AnalysisResult.",
      flow: "Analysis pipeline", flowText: "Detailed Case and Analysis data is read directly from the database.", openCases: "Open case list",
    },
  };
  const adminTextTranslations = {
    vi: {
      "Đang hoạt động": "Active", "Đã khóa": "Locked", "Chưa có dữ liệu ca khám.": "No case data yet.",
      "Chưa có kết quả phân tích.": "No analysis results yet.", "Không tìm thấy tài khoản phù hợp.": "No matching accounts found.",
      "Thay đổi trạng thái tài khoản này?": "Change this account's status?", "Khóa/mở khóa": "Lock/unlock",
      "Không thể tải dữ liệu.": "Unable to load data.", "Không lấy được CSRF token.": "Unable to get CSRF token.",
      "Cập nhật theo thời gian thực": "Updated in real time", "Đang chờ duyệt": "Awaiting approval",
      "PDF hoặc Excel": "PDF or Excel", "Trang chủ": "Home", "Chuyển giao diện sáng": "Switch to light mode",
      "Chuyển giao diện tối": "Switch to dark mode",
    },
    en: {
      "Active": "Đang hoạt động", "Locked": "Đã khóa", "No case data yet.": "Chưa có dữ liệu ca khám.",
      "No analysis results yet.": "Chưa có kết quả phân tích.", "No matching accounts found.": "Không tìm thấy tài khoản phù hợp.",
      "Change this account's status?": "Thay đổi trạng thái tài khoản này?", "Lock/unlock": "Khóa/mở khóa",
      "Unable to load data.": "Không thể tải dữ liệu.", "Unable to get CSRF token.": "Không lấy được CSRF token.",
      "Updated in real time": "Cập nhật theo thời gian thực", "Awaiting approval": "Đang chờ duyệt",
      "PDF or Excel": "PDF hoặc Excel", "Home": "Trang chủ", "Switch to light mode": "Chuyển giao diện sáng",
      "Switch to dark mode": "Chuyển giao diện tối",
    },
  };
  let csrfToken = "";
  let currentLanguage = "vi";
  let siteBrandName = "DermaScan AI";
  let siteBrandSubtitle = "Chỉ dùng cho mục đích nghiên cứu.";

  const setText = (selector, text) => {
    const element = $(selector);
    if (element) element.textContent = text;
  };

  const translateAdminText = (value) => {
    const dictionary = currentLanguage === "en" ? adminTextTranslations.vi : adminTextTranslations.en;
    return Object.prototype.hasOwnProperty.call(dictionary, value) ? dictionary[value] : value;
  };

  const applyAdminTextTranslations = () => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (!node.parentElement || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(node.parentElement.tagName)) continue;
      const trimmed = node.nodeValue.trim();
      const translated = translateAdminText(trimmed);
      if (trimmed && translated !== trimmed) node.nodeValue = node.nodeValue.replace(trimmed, translated);
    }
  };

  function applyLanguage(language) {
    currentLanguage = language === "en" ? "en" : "vi";
    const t = adminTranslations[currentLanguage];
    document.documentElement.lang = currentLanguage;
    setText(".nav-label", t.navLabel);
    setText("#admin-site-brand-name", siteBrandName);
    setText("#admin-site-brand-subtitle", siteBrandSubtitle);
    setText(".sidebar-foot b", t.safe);
    setText(".sidebar-foot small", t.encrypted);
    setText(".hp-user-meta small", t.admin);
    setText("#logout", t.logout);
    setText("#breadcrumb", t.dashboard);
    ["dashboard", "accounts", "security", "ai", "doctors", "reports"].forEach((name) => {
      const item = $(`.nav-item[data-module="${name}"] span:last-child`);
      if (item) item.textContent = labels[currentLanguage][name];
    });
    const welcomeLead = $(".welcome > div");
    if (welcomeLead) {
      const dot = welcomeLead.querySelector(".live-dot");
      welcomeLead.replaceChildren(dot, document.createTextNode(` ${t.welcome}`));
      const welcomeText = document.createElement("p");
      welcomeText.textContent = t.welcomeText;
      welcomeLead.append(welcomeText);
    }
    const statLabels = [t.accounts, t.cases, t.analyses, t.doctors];
    $$(".stat-head span").forEach((item, index) => { if (statLabels[index]) item.textContent = statLabels[index]; });
    $$(".stat-card small").forEach((item) => { item.textContent = t.currentData; });
    setText(".chart-panel h2", t.growth);
    setText(".chart-panel .panel-title p", t.growthText);
    setText(".lower .panel:first-child h2", t.recent);
    setText(".lower .panel:first-child .panel-title p", t.live);
    setText(".lower .panel:first-child .text-btn", t.viewAll);
    setText(".quick h2", t.quick);
    setText(".quick .panel-title p", t.quickText);
    const quickItems = [
      [t.manageAccounts, t.manageAccountsText],
      [t.approveDoctors, t.approveDoctorsText],
      [t.exportReports, t.exportReportsText],
    ];
    $$(".quick button").forEach((item, index) => {
      if (!quickItems[index]) return;
      const text = item.querySelector("span");
      if (text) {
        const title = text.querySelector("b");
        const description = text.querySelector("small");
        if (title) title.textContent = quickItems[index][0];
        if (description) description.textContent = quickItems[index][1];
      }
    });
    setText("#module-ai .eyebrow", t.aiEyebrow);
    setText("#module-ai h2", t.aiTitle);
    setText("#module-ai .module-heading > div > p:last-child", t.aiText);
    setText("#module-ai h3", t.flow);
    setText("#module-ai .empty-panel p", t.flowText);
    setText("#module-ai .empty-panel button", t.openCases);
    const activeModule = $(".module.active");
    const activeName = activeModule ? activeModule.id.replace("module-", "") : "dashboard";
    setText("#page-title", labels[currentLanguage][activeName]);
    setText("#breadcrumb", activeName.toUpperCase());
    $$(".admin-lang-item").forEach((item) => {
      const active = item.dataset.lang === currentLanguage;
      item.classList.toggle("active", active);
      item.classList.toggle("is-active", active);
      const languageName = item.querySelectorAll("span")[1];
      if (languageName) languageName.textContent = item.dataset.lang === "en" ? "English" : (currentLanguage === "en" ? "Vietnamese" : "Tiếng Việt");
    });
    setText("#admin-lang-label", currentLanguage.toUpperCase());
    applyAdminTextTranslations();
  }

  async function loadSiteLogo() {
    try {
      const response = await fetch("/api/site-settings", { credentials: "same-origin" });
      if (!response.ok) {
        throw new Error(`Không tải được cấu hình logo (HTTP ${response.status}).`);
      }
      const settings = await response.json();
      siteBrandName = settings.site_name || siteBrandName;
      siteBrandSubtitle = settings.footer_description || siteBrandSubtitle;
      setText("#admin-site-brand-name", siteBrandName);
      setText("#admin-site-brand-subtitle", siteBrandSubtitle);
      const brand = $(".admin-sidebar-brand");
      if (brand) brand.setAttribute("aria-label", `${siteBrandName} - Trang chủ`);
      const logo = $("#admin-site-logo");
      if (logo && settings.logo_url) {
        logo.src = settings.logo_url;
        logo.alt = siteBrandName;
        logo.classList.remove("hidden");
      }
    } catch (error) {
      console.warn("Không tải được logo tùy chỉnh; sử dụng logo mặc định.", error);
    }
  }

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
  const badge = (active) => `<span class="status-chip ${active ? "success" : "danger"}">${translateAdminText(active ? "Đang hoạt động" : "Đã khóa")}</span>`;
  const roleName = { ADMIN: "Admin", DOCTOR: "Doctor", USER: "User" };
  const csrfMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

  async function api(url, options = {}) {
    const method = (options.method || "GET").toUpperCase();
    if (csrfMethods.has(method) && !csrfToken) {
      const csrfResponse = await fetch("/api/auth/csrf", {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      const csrfData = await csrfResponse.json().catch(() => ({}));
      if (!csrfResponse.ok || !csrfData.csrf_token) {
        throw new Error("Không lấy được CSRF token.");
      }
      csrfToken = csrfData.csrf_token;
    }

    const headers = {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(csrfMethods.has(method) ? { "X-CSRFToken": csrfToken } : {}),
      ...(options.headers || {}),
    };
    const response = await fetch(url, {
      ...options,
      method,
      credentials: "same-origin",
      headers,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Không thể tải dữ liệu.");
    return data;
  }

  async function loadDashboard() {
    try {
      const data = await api("/api/admin/overview");
      Object.entries(data.counts).forEach(([key, value]) => { const element = $(`#stat-${key}`); if (element) element.textContent = Number(value).toLocaleString("vi-VN"); });
      renderGrowthChart(data.trends || []);
      renderAnalysisDistribution(data.analysis_distribution || []);
      const cases = $("#recent-cases");
      cases.innerHTML = data.recent_cases.length ? data.recent_cases.map((item) => `<tr><td><b>${escapeHtml(item.code)}</b></td><td>${escapeHtml(item.doctor)}</td><td>${escapeHtml(item.created_at)}</td><td><span class="status-chip ${item.status === "COMPLETED" ? "success" : "warning"}">${escapeHtml(item.status)}</span></td></tr>`).join("") : `<tr><td colspan="4" class="loading">${translateAdminText("Chưa có dữ liệu ca khám.")}</td></tr>`;
    } catch (error) { $("#recent-cases").innerHTML = `<tr><td colspan="4" class="loading">${escapeHtml(translateAdminText(error.message))}</td></tr>`; }
  }

  function renderGrowthChart(trends) {
    const labels = $("#chart-labels");
    const casesPath = $("#chart-cases-path");
    const analysesPath = $("#chart-analyses-path");
    const areaPath = $("#chart-area-path");
    if (!labels || !casesPath || !analysesPath || !areaPath || !trends.length) return;
    const max = Math.max(1, ...trends.flatMap((item) => [Number(item.cases || 0), Number(item.analyses || 0)]));
    const points = (key) => trends.map((item, index) => {
      const x = trends.length === 1 ? 350 : index * (700 / (trends.length - 1));
      const y = 190 - (Number(item[key] || 0) / max) * 165;
      return [x, y];
    });
    const path = (values) => values.map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    const cases = points("cases");
    const analyses = points("analyses");
    casesPath.setAttribute("d", path(cases));
    analysesPath.setAttribute("d", path(analyses));
    areaPath.setAttribute("d", `${path(cases)} L700,190 L0,190 Z`);
    labels.innerHTML = trends.map((item) => `<span>${escapeHtml(item.label)}</span>`).join("");
    $("#chart-max").textContent = max.toLocaleString("vi-VN");
    $("#chart-mid").textContent = Math.round(max / 2).toLocaleString("vi-VN");
  }

  function renderAnalysisDistribution(distribution) {
    const total = distribution.reduce((sum, item) => sum + Number(item.count || 0), 0);
    const donut = $("#analysis-donut");
    const legend = $("#analysis-legend");
    $("#analysis-total").textContent = total.toLocaleString("vi-VN");
    if (!distribution.length || !total) {
      donut.style.background = "conic-gradient(#e2e8f0 0 100%)";
      legend.innerHTML = `<span class="loading">${translateAdminText("Chưa có kết quả phân tích.")}</span>`;
      return;
    }
    let cursor = 0;
    const segments = [];
    distribution.forEach((item) => {
      const end = cursor + (Number(item.count || 0) / total * 100);
      segments.push(`${item.type === "benign" ? "var(--green)" : "var(--orange)"} ${cursor}% ${end}%`);
      cursor = end;
    });
    donut.style.background = `conic-gradient(${segments.join(", ")})`;
    legend.innerHTML = distribution.map((item) => `<span title="${escapeHtml(item.name)}"><i class="dot ${item.type === "benign" ? "green-dot" : "orange-dot"}"></i>${escapeHtml(item.label)}<b>${Number(item.percentage || 0).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%</b></span>`).join("");
  }

  async function loadUsers() {
    const params = new URLSearchParams({ search: $("#user-search").value, role: $("#role-filter").value });
    try {
      const data = await api(`/api/admin/users?${params}`);
      $("#users-table").innerHTML = data.users.length ? data.users.map((user) => `<tr><td><b>${escapeHtml(user.name)}</b><small style="display:block;color:var(--muted)">${escapeHtml(user.email)}</small></td><td><span class="role-badge">${roleName[user.role] || user.role}</span></td><td>${escapeHtml(user.created_at)}</td><td>${badge(user.active)}</td><td><button class="row-actions" data-toggle-user="${user.id}" title="${translateAdminText("Khóa/mở khóa")}">•••</button></td></tr>`).join("") : `<tr><td colspan="5" class="loading">${translateAdminText("Không tìm thấy tài khoản phù hợp.")}</td></tr>`;
    } catch (error) { $("#users-table").innerHTML = `<tr><td colspan="5" class="loading">${escapeHtml(translateAdminText(error.message))}</td></tr>`; }
  }

  function showModule(name) {
    $$(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.module === name));
    $$(".module").forEach((item) => item.classList.toggle("active", item.id === `module-${name}`));
    $("#page-title").textContent = labels[currentLanguage][name];
    $("#breadcrumb").textContent = name.toUpperCase();
    $("#sidebar").classList.remove("open");
    if (name === "accounts") loadUsers();
  }

  $$(".nav-item").forEach((item) => item.addEventListener("click", () => showModule(item.dataset.module)));
  $$("[data-jump]").forEach((item) => item.addEventListener("click", () => showModule(item.dataset.jump)));
  $("#mobile-menu").addEventListener("click", () => $("#sidebar").classList.toggle("open"));
  $("#collapse-sidebar").addEventListener("click", () => { $("#sidebar").classList.toggle("collapsed"); });
  $("#user-search").addEventListener("input", loadUsers); $("#role-filter").addEventListener("change", loadUsers);
  $("#users-table").addEventListener("click", async (event) => { const button = event.target.closest("[data-toggle-user]"); if (!button || !confirm("Thay đổi trạng thái tài khoản này?")) return; try { await api(`/api/admin/users/${button.dataset.toggleUser}/status`, { method: "PATCH" }); loadUsers(); } catch (error) { alert(error.message); } });
  $("#add-user").addEventListener("click", () => $("#user-modal").classList.add("open")); $("#close-modal").addEventListener("click", () => $("#user-modal").classList.remove("open")); $("#user-modal").addEventListener("click", (event) => { if (event.target.id === "user-modal") event.currentTarget.classList.remove("open"); });
  $("#user-form").addEventListener("submit", async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const message = $("#form-message"); try { await api("/api/admin/users", { method: "POST", body: JSON.stringify(Object.fromEntries(form)) }); event.currentTarget.reset(); $("#user-modal").classList.remove("open"); loadUsers(); } catch (error) { message.textContent = error.message; } });
  $("#logout").addEventListener("click", async () => {
    const clearClientSession = () => {
      ["dermascan_current_user", "currentUser"].forEach((key) => localStorage.removeItem(key));
      ["role", "user", "token", "access_token"].forEach((key) => sessionStorage.removeItem(key));
    };
    try {
      const data = await api("/api/auth/admin/logout", { method: "POST" });
      clearClientSession();
      window.location.replace(data.redirect_url || "/");
    } catch (error) {
      clearClientSession();
      alert(error.message);
      window.location.replace("/");
    }
  });
  const SHARED_THEME_KEY = "hpTheme";
  const SHARED_LANGUAGE_KEY = "hpLang";
  const root = document.documentElement;

  const syncThemeButton = () => {
    const dark = root.dataset.theme === "dark";
    $("#theme-toggle").querySelector(".theme-sun").classList.toggle("hidden", !dark);
    $("#theme-toggle").querySelector(".theme-moon").classList.toggle("hidden", dark);
    $("#theme-toggle").setAttribute("aria-label", dark ? "Chuyển giao diện sáng" : "Chuyển giao diện tối");
  };
  $("#theme-toggle").addEventListener("click", () => {
    const dark = root.dataset.theme !== "dark";
    root.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem(SHARED_THEME_KEY, dark ? "dark" : "light");
    syncThemeButton();
  });
  window.addEventListener("storage", (event) => {
    if (event.key === SHARED_THEME_KEY) {
      root.dataset.theme = event.newValue === "dark" ? "dark" : "light";
      syncThemeButton();
    }
    if (event.key === SHARED_LANGUAGE_KEY) {
      const language = event.newValue === "en" ? "en" : "vi";
      root.lang = language;
      $$(".admin-lang-item").forEach((item) => {
        const active = item.dataset.lang === language;
        item.classList.toggle("active", active);
        item.classList.toggle("is-active", active);
      });
      $("#admin-lang-label").textContent = language.toUpperCase();
      applyLanguage(language);
    }
  });
  const langButton = $("#admin-lang-button");
  const langMenu = $("#admin-lang-menu");
  langButton.addEventListener("click", (event) => {
    event.stopPropagation();
    const open = langMenu.classList.toggle("open");
    langMenu.classList.toggle("hidden", !open);
    langButton.setAttribute("aria-expanded", String(open));
  });
  $$(".admin-lang-item").forEach((button) => button.addEventListener("click", () => {
    const language = button.dataset.lang === "en" ? "en" : "vi";
    $$(".admin-lang-item").forEach((item) => item.classList.remove("active"));
    $$(".admin-lang-item").forEach((item) => item.classList.remove("is-active"));
    button.classList.add("active");
    button.classList.add("is-active");
    $("#admin-lang-label").textContent = language.toUpperCase();
    langMenu.classList.remove("open");
    langMenu.classList.add("hidden");
    langButton.setAttribute("aria-expanded", "false");
    document.documentElement.lang = language;
    localStorage.setItem(SHARED_LANGUAGE_KEY, language);
    applyLanguage(language);
  }));
  document.addEventListener("click", () => {
    langMenu.classList.remove("open");
    langMenu.classList.add("hidden");
    langButton.setAttribute("aria-expanded", "false");
  });
  $("#today").textContent = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "long", year: "numeric" }).format(new Date());
  const savedTheme = localStorage.getItem(SHARED_THEME_KEY);
  root.dataset.theme = savedTheme === "dark" ? "dark" : "light";
  const savedLang = localStorage.getItem(SHARED_LANGUAGE_KEY) === "en" ? "en" : "vi";
  const savedLangButton = $(`.admin-lang-item[data-lang="${savedLang}"]`);
  if (savedLangButton) savedLangButton.click();
  else applyLanguage(savedLang);
  syncThemeButton();
  loadSiteLogo();
  api("/api/auth/csrf").then((data) => { csrfToken = data.csrf_token; loadDashboard(); }).catch(() => loadDashboard());
})();
