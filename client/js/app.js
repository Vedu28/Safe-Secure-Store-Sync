import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { apiBaseUrl, firebaseConfig } from "./config.js";

const state = {
  authMode: "login",
  token: localStorage.getItem("backupToken"),
  user: null,
  currentView: "dashboard",
  currentFilesMode: "files",
  files: []
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
await setPersistence(auth, browserLocalPersistence);

const formatBytes = (bytes = 0) => {
  if (!bytes) return "0 MB";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index < 2 ? 0 : 1)} ${units[index]}`;
};

const formatDate = (date) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(date));

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const toast = (message, type = "info") => {
  const node = document.createElement("div");
  node.className = `toast ${type}`;
  node.textContent = message;
  $("#toastHost").appendChild(node);
  setTimeout(() => node.remove(), 4200);
};

const api = async (path, options = {}) => {
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (state.token) headers.set("Authorization", `Bearer ${state.token}`);

  const response = await fetch(`${apiBaseUrl}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Request failed");
  return data;
};

const setAuthMode = (mode) => {
  state.authMode = mode;
  $$(".auth-tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.authMode === mode));
  $("#authSubmit").textContent = mode === "signup" ? "Create account" : "Login";
  $("#passwordInput").autocomplete = mode === "signup" ? "new-password" : "current-password";
};

const completeBackendLogin = async (idToken, endpoint = "/auth/login") => {
  const data = await api(endpoint, {
    method: "POST",
    body: JSON.stringify({ idToken })
  });
  state.token = data.token;
  state.user = data.user;
  localStorage.setItem("backupToken", data.token);
  showApp();
  await refreshAll();
};

const handleAuthSubmit = async (event) => {
  event.preventDefault();
  const email = $("#emailInput").value.trim();
  const password = $("#passwordInput").value;

  try {
    const credential =
      state.authMode === "signup"
        ? await createUserWithEmailAndPassword(auth, email, password)
        : await signInWithEmailAndPassword(auth, email, password);

    if (state.authMode === "signup") {
      await sendEmailVerification(credential.user);
      toast("Verification email sent.");
    }

    const idToken = await credential.user.getIdToken();
    await completeBackendLogin(idToken, state.authMode === "signup" ? "/auth/signup" : "/auth/login");
  } catch (error) {
    toast(error.message, "error");
  }
};

const handleGoogleLogin = async () => {
  try {
    const credential = await signInWithPopup(auth, new GoogleAuthProvider());
    await completeBackendLogin(await credential.user.getIdToken(), "/auth/login");
  } catch (error) {
    toast(error.message, "error");
  }
};

const showApp = () => {
  $("#authView").classList.add("hidden");
  $("#appView").classList.remove("hidden");
};

const showAuth = () => {
  $("#appView").classList.add("hidden");
  $("#authView").classList.remove("hidden");
};

const refreshAll = async () => {
  await Promise.all([loadDashboard(), loadFiles(), loadAnalytics(), loadActivity()]);
  renderProfile();
};

const loadDashboard = async () => {
  const data = await api("/dashboard");
  state.user = data.user;
  renderStorage(data.storage);
  $("#welcomeTitle").textContent = `Welcome back${data.user.displayName ? `, ${data.user.displayName}` : ""}`;
  $("#totalFiles").textContent = data.storage.activeFiles;
  $("#storageUsed").textContent = formatBytes(data.storage.storageUsedBytes);
  $("#storageRemaining").textContent = formatBytes(data.storage.remainingBytes);
  $("#deletedFiles").textContent = data.storage.deletedFiles;
  renderMiniFiles("#recentUploads", data.recentUploads);
  renderActivity("#recentActivity", data.recentActivity);
};

const renderStorage = (storage) => {
  $("#storagePercent").textContent = `${Math.min(storage.usagePercent, 100)}%`;
  $("#storageBar").style.width = `${Math.min(storage.usagePercent, 100)}%`;
  $("#storageText").textContent = `${formatBytes(storage.storageUsedBytes)} of ${formatBytes(storage.quotaBytes)} used`;
};

const loadFiles = async () => {
  const params = new URLSearchParams();
  params.set("sort", $("#sortSelect").value);
  if ($("#typeFilter").value) params.set("type", $("#typeFilter").value);
  if ($("#searchInput").value.trim()) params.set("search", $("#searchInput").value.trim());
  if (state.currentFilesMode === "trash") params.set("trash", "true");
  if (state.currentFilesMode === "favorites") params.set("favorite", "true");

  const data = await api(`/files?${params.toString()}`);
  state.files = data.files;
  renderFiles();
};

const renderFiles = () => {
  const title = state.currentFilesMode === "trash" ? "Trash" : state.currentFilesMode === "favorites" ? "Favorites" : "My Files";
  $("#filePanelTitle").textContent = title;
  const tbody = $("#filesTable");
  tbody.innerHTML = "";

  if (!state.files.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="hint">No files found.</td></tr>`;
    return;
  }

  for (const file of state.files) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><span class="file-name">${escapeHtml(file.filename)}<small>${escapeHtml(file.originalName)}</small></span></td>
      <td>${escapeHtml(file.fileType)}</td>
      <td>${formatBytes(file.size)}</td>
      <td>${formatDate(file.updatedAt)}</td>
      <td>${file.downloadCount}</td>
      <td class="actions"></td>
    `;
    const actions = row.querySelector(".actions");
    addAction(actions, "Info", () => showDetails(file));
    if (!file.isDeleted) {
      addAction(actions, file.isFavorite ? "Unstar" : "Star", () => favoriteFile(file));
      addAction(actions, "Preview", () => previewFile(file));
      addAction(actions, "Download", () => downloadFile(file));
      addAction(actions, "Rename", () => renameFile(file));
      addAction(actions, "Trash", () => deleteFile(file));
    } else {
      addAction(actions, "Restore", () => restoreFile(file));
      addAction(actions, "Delete", () => permanentDelete(file), "danger");
    }
    tbody.appendChild(row);
  }
};

const addAction = (host, label, handler, tone = "") => {
  const button = document.createElement("button");
  button.className = `action-btn ${tone}`;
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", handler);
  host.appendChild(button);
};

const renderMiniFiles = (selector, files = []) => {
  const host = $(selector);
  host.classList.remove("skeleton");
  host.innerHTML = files.length
    ? files
        .map(
          (file) =>
            `<div class="mini-row"><strong>${escapeHtml(file.filename)}</strong><small>${formatBytes(file.size)} · ${escapeHtml(file.fileType)}</small></div>`
        )
        .join("")
    : `<div class="mini-row hint">No uploads yet.</div>`;
};

const renderActivity = (selector, logs = []) => {
  const host = $(selector);
  host.classList.remove("skeleton");
  host.innerHTML = logs.length
    ? logs.map((log) => `<div class="activity-row"><strong>${escapeHtml(log.message)}</strong><small>${formatDate(log.createdAt)}</small></div>`).join("")
    : `<div class="activity-row hint">No activity yet.</div>`;
};

const uploadFiles = (files) => {
  if (!files.length) return;
  const formData = new FormData();
  [...files].forEach((file) => formData.append("files", file));

  const row = document.createElement("div");
  row.className = "upload-row";
  row.innerHTML = `<span>${files.length} file(s) uploading</span><div class="progress"><span></span></div>`;
  $("#uploadQueue").prepend(row);
  const bar = row.querySelector(".progress span");

  const xhr = new XMLHttpRequest();
  xhr.open("POST", `${apiBaseUrl}/upload`);
  xhr.setRequestHeader("Authorization", `Bearer ${state.token}`);
  xhr.upload.addEventListener("progress", (event) => {
    if (event.lengthComputable) bar.style.width = `${Math.round((event.loaded / event.total) * 100)}%`;
  });
  xhr.onload = async () => {
    if (xhr.status >= 200 && xhr.status < 300) {
      bar.style.width = "100%";
      toast("Upload complete.");
      await refreshAll();
    } else {
      toast(JSON.parse(xhr.responseText || "{}").message || "Upload failed", "error");
    }
  };
  xhr.onerror = () => toast("Upload failed", "error");
  xhr.send(formData);
};

const favoriteFile = async (file) => {
  await api(`/favorite/${file._id}`, { method: "POST", body: JSON.stringify({ isFavorite: !file.isFavorite }) });
  await loadFiles();
};

const previewFile = async (file) => {
  try {
    const data = await api(`/preview/${file._id}`);
    window.open(data.url, "_blank", "noopener,noreferrer");
  } catch (error) {
    toast(error.message, "error");
  }
};

const downloadFile = async (file) => {
  const data = await api(`/download/${file._id}`);
  window.location.href = data.url;
  await loadFiles();
};

const renameFile = async (file) => {
  const filename = prompt("New file name", file.filename);
  if (!filename) return;
  await api(`/files/${file._id}`, { method: "PUT", body: JSON.stringify({ filename }) });
  await refreshAll();
};

const deleteFile = async (file) => {
  await api(`/files/${file._id}`, { method: "DELETE" });
  await refreshAll();
};

const restoreFile = async (file) => {
  await api(`/restore/${file._id}`, { method: "POST" });
  await refreshAll();
};

const permanentDelete = async (file) => {
  if (!confirm(`Permanently delete ${file.filename}?`)) return;
  await api(`/permanent/${file._id}`, { method: "DELETE" });
  await refreshAll();
};

const showDetails = (file) => {
  $("#modalTitle").textContent = file.filename;
  $("#modalBody").innerHTML = `
    <p><strong>Original:</strong> ${escapeHtml(file.originalName)}</p>
    <p><strong>Type:</strong> ${escapeHtml(file.mimeType)}</p>
    <p><strong>Size:</strong> ${formatBytes(file.size)}</p>
    <p><strong>Storage key:</strong> ${escapeHtml(file.storageKey)}</p>
    <p><strong>Uploaded:</strong> ${formatDate(file.createdAt)}</p>
    <p><strong>Downloads:</strong> ${file.downloadCount}</p>
  `;
  $("#detailsModal").showModal();
};

const loadAnalytics = async () => {
  const data = await api("/storage");
  renderBars("#typeChart", data.byType.map((item) => ({ label: item._id, value: item.bytes, display: formatBytes(item.bytes) })));
  renderBars(
    "#monthChart",
    data.uploadsByMonth.map((item) => ({
      label: `${item._id.year}-${String(item._id.month).padStart(2, "0")}`,
      value: item.count,
      display: `${item.count} files`
    }))
  );
};

const renderBars = (selector, rows) => {
  const host = $(selector);
  if (!rows.length) {
    host.innerHTML = `<div class="bar-row hint">No data yet.</div>`;
    return;
  }
  const max = Math.max(...rows.map((row) => row.value), 1);
  host.innerHTML = rows
    .map(
      (row) => `
      <div class="bar-row">
        <strong>${escapeHtml(row.label)}</strong>
        <span class="bar-track"><span style="width:${Math.max((row.value / max) * 100, 4)}%"></span></span>
        <small>${escapeHtml(row.display)}</small>
      </div>`
    )
    .join("");
};

const loadActivity = async () => {
  const data = await api("/activity");
  renderActivity("#activityLogList", data.logs);
};

const renderProfile = () => {
  const user = state.user || {};
  $("#profileName").textContent = user.displayName || "Backup user";
  $("#profileEmail").textContent = user.email || "";
  $("#profileVerified").textContent = user.emailVerified ? "Email verified" : "Email not verified";
  $("#profilePhoto").src = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || user.email || "User")}&background=1666d8&color=fff`;
};

const setView = async (view) => {
  state.currentView = view;
  $$(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === view));
  $$(".view-panel").forEach((panel) => panel.classList.remove("active"));

  if (["files", "favorites", "trash"].includes(view)) {
    state.currentFilesMode = view;
    $("#filesPanel").classList.add("active");
    await loadFiles();
  } else {
    $(`#${view}Panel`)?.classList.add("active");
  }
  $(".sidebar").classList.remove("open");
};

const bindEvents = () => {
  $$(".auth-tab").forEach((tab) => tab.addEventListener("click", () => setAuthMode(tab.dataset.authMode)));
  $("#authForm").addEventListener("submit", handleAuthSubmit);
  $("#googleBtn").addEventListener("click", handleGoogleLogin);
  $("#forgotBtn").addEventListener("click", async () => {
    const email = $("#emailInput").value.trim();
    if (!email) return toast("Enter your email first.", "error");
    await sendPasswordResetEmail(auth, email);
    toast("Password reset email sent.");
  });
  $("#logoutBtn").addEventListener("click", async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch (_error) {
      // Logout should still clear local state even if the API call is unavailable.
    }
    await signOut(auth);
    localStorage.removeItem("backupToken");
    state.token = null;
    showAuth();
  });
  $$(".nav-item").forEach((item) => item.addEventListener("click", () => setView(item.dataset.view)));
  $("#uploadNavBtn").addEventListener("click", () => setView("files"));
  $("#sidebarToggle").addEventListener("click", () => $(".sidebar").classList.toggle("open"));
  $("#themeBtn").addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("theme", next);
  });
  $("#searchInput").addEventListener("input", () => {
    clearTimeout(window.searchTimer);
    window.searchTimer = setTimeout(loadFiles, 300);
  });
  $("#sortSelect").addEventListener("change", loadFiles);
  $("#typeFilter").addEventListener("change", loadFiles);
  $("#fileInput").addEventListener("change", (event) => uploadFiles(event.target.files));
  $("#dropzone").addEventListener("click", () => $("#fileInput").click());
  $("#dropzone").addEventListener("dragover", (event) => {
    event.preventDefault();
    $("#dropzone").classList.add("dragging");
  });
  $("#dropzone").addEventListener("dragleave", () => $("#dropzone").classList.remove("dragging"));
  $("#dropzone").addEventListener("drop", (event) => {
    event.preventDefault();
    $("#dropzone").classList.remove("dragging");
    uploadFiles(event.dataTransfer.files);
  });
};

document.documentElement.dataset.theme = localStorage.getItem("theme") || "light";
bindEvents();

onAuthStateChanged(auth, async (firebaseUser) => {
  if (!firebaseUser) {
    if (!state.token) showAuth();
    return;
  }
  try {
    await completeBackendLogin(await firebaseUser.getIdToken(), "/auth/login");
  } catch (error) {
    toast(error.message, "error");
    showAuth();
  }
});
