import { apiRequest, buildAuthHeaders, byId, escapeHtml, formatDateTime, setStatus } from "./common.js";

const storageKeys = {
  doctorId: "wadoctors_doctor_id",
  doctorToken: "wadoctors_doctor_token",
  doctorEmail: "wadoctors_doctor_email"
};

let doctorId = localStorage.getItem(storageKeys.doctorId) || "";
let doctorToken = localStorage.getItem(storageKeys.doctorToken) || "";
let selectedCaseId = "";
let casesCache = [];

const doctorEmailInput = byId("doctorEmailInput");
const doctorPasswordInput = byId("doctorPasswordInput");
const doctorLoginBtn = byId("doctorLoginBtn");
const doctorIdInput = byId("doctorIdInput");
const saveDoctorSessionBtn = byId("saveDoctorSessionBtn");
const clearDoctorSessionBtn = byId("clearDoctorSessionBtn");
const doctorStatusBar = byId("doctorStatusBar");
const doctorProfile = byId("doctorProfile");
const doctorCaseStatusFilter = byId("doctorCaseStatusFilter");
const doctorCaseTriageSourceFilter = byId("doctorCaseTriageSourceFilter");
const doctorCaseTriageRouteFilter = byId("doctorCaseTriageRouteFilter");
const refreshDoctorCasesBtn = byId("refreshDoctorCasesBtn");
const doctorCasesTableBody = byId("doctorCasesTableBody");
const selectedDoctorCaseMeta = byId("selectedDoctorCaseMeta");
const refreshDoctorMessagesBtn = byId("refreshDoctorMessagesBtn");
const doctorMessagesList = byId("doctorMessagesList");
const doctorMessageInput = byId("doctorMessageInput");
const sendDoctorMessageBtn = byId("sendDoctorMessageBtn");
const doctorCloseSummaryInput = byId("doctorCloseSummaryInput");
const closeDoctorCaseBtn = byId("closeDoctorCaseBtn");

doctorIdInput.value = doctorId;
doctorEmailInput.value = localStorage.getItem(storageKeys.doctorEmail) || "";

function parseCaseTriageTranscript(rawValue) {
  if (typeof rawValue !== "string" || !rawValue.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue);
    const source = parsed?.triageSource === "AI" ? "AI" : "HEURISTIC";
    const route = typeof parsed?.route === "string" ? parsed.route : "";
    const confidenceRaw = Number(parsed?.triageConfidence);
    const confidence = Number.isFinite(confidenceRaw)
      ? Math.min(Math.max(confidenceRaw, 0), 1)
      : null;
    const redFlags = Array.isArray(parsed?.triageRedFlags)
      ? parsed.triageRedFlags
          .map((item) => String(item || "").trim())
          .filter((item, index, arr) => item && arr.indexOf(item) === index)
      : [];

    return {
      source,
      route,
      confidence,
      redFlags
    };
  } catch {
    return null;
  }
}

function getCaseTriage(item) {
  const triage = item?.triage;
  if (triage && typeof triage === "object") {
    const source = triage.source === "AI" ? "AI" : "HEURISTIC";
    const route = typeof triage.route === "string" ? triage.route : "";
    const confidenceRaw = Number(triage.confidence);
    const confidence = Number.isFinite(confidenceRaw)
      ? Math.min(Math.max(confidenceRaw, 0), 1)
      : null;
    const redFlags = Array.isArray(triage.redFlags)
      ? triage.redFlags
          .map((value) => String(value || "").trim())
          .filter((value, index, arr) => value && arr.indexOf(value) === index)
      : [];

    return {
      source,
      route,
      confidence,
      redFlags,
      summary: typeof triage.summary === "string" ? triage.summary.trim() : ""
    };
  }

  const parsed = parseCaseTriageTranscript(item?.aiTranscript);
  if (!parsed) {
    return null;
  }

  return {
    ...parsed,
    summary: typeof item?.aiSummary === "string" ? item.aiSummary.trim() : ""
  };
}

function authHeaders() {
  if (doctorToken) {
    return {
      Authorization: `Bearer ${doctorToken}`,
      "content-type": "application/json"
    };
  }

  return buildAuthHeaders("DOCTOR", doctorId);
}

function renderDoctorProfile(data) {
  doctorProfile.innerHTML = `
    <div><strong>${escapeHtml(data.fullName || "-")}</strong></div>
    <div class="muted">${escapeHtml(data.email || "-")}</div>
    <div style="margin-top: 8px">
      <span class="badge">ID: ${escapeHtml(data.id)}</span>
      <span class="badge">KYC: ${escapeHtml(data.kycStatus || "-")}</span>
      <span class="badge">Active: ${escapeHtml(String(data.isActive))}</span>
    </div>
  `;
}

function renderCases(cases) {
  if (!cases.length) {
    doctorCasesTableBody.innerHTML = `<tr><td colspan="7" class="muted">No cases found.</td></tr>`;
    return;
  }

  doctorCasesTableBody.innerHTML = cases
    .map((item) => {
      const activeClass = item.id === selectedCaseId ? "active" : "";
      const triage = getCaseTriage(item);
      return `
        <tr class="click-row ${activeClass}" data-case-id="${escapeHtml(item.id)}">
          <td><span class="badge">${escapeHtml(item.id.slice(0, 8))}</span></td>
          <td>${escapeHtml(item.status)}</td>
          <td>${escapeHtml(item.patient?.fullName || item.patient?.whatsappPhone || "-")}</td>
          <td>${escapeHtml(item.urgencyScore ?? "-")}</td>
          <td>${escapeHtml(triage?.source || "-")}</td>
          <td>${escapeHtml(triage?.route || "-")}</td>
          <td>${escapeHtml(formatDateTime(item.createdAt))}</td>
        </tr>
      `;
    })
    .join("");

  doctorCasesTableBody.querySelectorAll("tr[data-case-id]").forEach((row) => {
    row.addEventListener("click", () => {
      selectedCaseId = row.getAttribute("data-case-id") || "";
      renderCases(casesCache);
      updateSelectedCaseMeta();
      loadMessages();
    });
  });
}

function updateSelectedCaseMeta() {
  if (!selectedCaseId) {
    selectedDoctorCaseMeta.textContent = "Select a case to view messages.";
    return;
  }

  const selected = casesCache.find((item) => item.id === selectedCaseId);
  if (!selected) {
    selectedDoctorCaseMeta.textContent = `Selected case: ${selectedCaseId}`;
    return;
  }

  const triage = getCaseTriage(selected);
  const confidenceBadge = triage && triage.confidence !== null
    ? `${Math.round(triage.confidence * 100)}%`
    : "-";
  const summaryText = String(triage?.summary || selected.aiSummary || "").trim();
  const redFlags = triage?.redFlags?.length ? triage.redFlags.join(", ") : "";

  selectedDoctorCaseMeta.innerHTML = `
    <span class="badge">Case ${escapeHtml(selected.id)}</span>
    <span class="badge">Status ${escapeHtml(selected.status)}</span>
    <span class="badge">Patient ${escapeHtml(selected.patient?.fullName || selected.patient?.whatsappPhone || "-")}</span>
    <span class="badge">Triage ${escapeHtml(triage?.source || "HEURISTIC")}</span>
    <span class="badge">Route ${escapeHtml(triage?.route || "-")}</span>
    <span class="badge">Confidence ${escapeHtml(confidenceBadge)}</span>
    ${summaryText ? `<div class="muted" style="margin-top: 8px">${escapeHtml(summaryText)}</div>` : ""}
    ${redFlags ? `<div class="muted" style="margin-top: 4px">Red flags: ${escapeHtml(redFlags)}</div>` : ""}
  `;
}

function renderMessages(messages) {
  if (!messages.length) {
    doctorMessagesList.innerHTML = `<div class="muted">No messages yet.</div>`;
    return;
  }

  doctorMessagesList.innerHTML = messages
    .map((item) => {
      return `
        <div class="message-item">
          <div class="meta">${escapeHtml(item.senderType)} · ${escapeHtml(item.platform)} · ${escapeHtml(formatDateTime(item.createdAt))}</div>
          <div>${escapeHtml(item.content || "")}</div>
        </div>
      `;
    })
    .join("");
}

async function loginDoctor() {
  const email = doctorEmailInput.value.trim().toLowerCase();
  const password = doctorPasswordInput.value;

  if (!email || !password) {
    throw new Error("Email and password are required");
  }

  const response = await apiRequest("/api/v1/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      role: "DOCTOR",
      email,
      password
    })
  });

  doctorToken = response.token;
  doctorId = response.user.id;
  localStorage.setItem(storageKeys.doctorToken, doctorToken);
  localStorage.setItem(storageKeys.doctorId, doctorId);
  localStorage.setItem(storageKeys.doctorEmail, email);
  doctorPasswordInput.value = "";
  doctorIdInput.value = doctorId;
}

async function loadDoctorProfile() {
  if (!doctorId && !doctorToken) {
    return;
  }

  const profile = await apiRequest("/api/v1/doctor/me", {
    headers: authHeaders()
  });
  renderDoctorProfile(profile);
}

async function loadCases() {
  if (!doctorId && !doctorToken) {
    return;
  }

  const status = doctorCaseStatusFilter.value;
  const triageSource = doctorCaseTriageSourceFilter.value;
  const triageRoute = doctorCaseTriageRouteFilter.value;
  const query = new URLSearchParams();
  if (status) {
    query.set("status", status);
  }
  if (triageSource) {
    query.set("triageSource", triageSource);
  }
  if (triageRoute) {
    query.set("triageRoute", triageRoute);
  }

  const data = await apiRequest(`/api/v1/doctor/cases?${query.toString()}`, {
    headers: authHeaders()
  });

  casesCache = Array.isArray(data) ? data : [];
  if (selectedCaseId && !casesCache.some((item) => item.id === selectedCaseId)) {
    selectedCaseId = "";
  }
  renderCases(casesCache);
  updateSelectedCaseMeta();
}

async function loadMessages() {
  if ((!doctorId && !doctorToken) || !selectedCaseId) {
    doctorMessagesList.innerHTML = `<div class="muted">Select a case to view messages.</div>`;
    return;
  }

  const messages = await apiRequest(`/api/v1/doctor/cases/${selectedCaseId}/messages`, {
    headers: authHeaders()
  });
  renderMessages(messages);
}

async function sendMessage() {
  if ((!doctorId && !doctorToken) || !selectedCaseId) {
    throw new Error("Select a case first");
  }

  const text = doctorMessageInput.value.trim();
  if (!text) {
    throw new Error("Message cannot be empty");
  }

  await apiRequest(`/api/v1/doctor/cases/${selectedCaseId}/messages`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ text })
  });

  doctorMessageInput.value = "";
  await loadMessages();
  await loadCases();
}

async function closeCase() {
  if ((!doctorId && !doctorToken) || !selectedCaseId) {
    throw new Error("Select a case first");
  }

  const summary = doctorCloseSummaryInput.value.trim();
  await apiRequest(`/api/v1/doctor/cases/${selectedCaseId}/close`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ summary })
  });

  doctorCloseSummaryInput.value = "";
  await loadCases();
  await loadMessages();
}

async function refreshAll() {
  if (!doctorToken && !doctorId) {
    setStatus(doctorStatusBar, "Login or enter Doctor ID to begin.", "error");
    doctorProfile.textContent = "No profile loaded.";
    doctorCasesTableBody.innerHTML = "";
    doctorMessagesList.innerHTML = "";
    return;
  }

  setStatus(doctorStatusBar, "Loading doctor workspace...");
  await loadDoctorProfile();
  await loadCases();
  await loadMessages();
  setStatus(doctorStatusBar, doctorToken ? "Doctor portal authenticated." : "Doctor portal synced (dev mode).", "success");
}

doctorLoginBtn.addEventListener("click", async () => {
  try {
    await loginDoctor();
    await refreshAll();
  } catch (error) {
    setStatus(doctorStatusBar, error.message || "Doctor login failed", "error");
  }
});

saveDoctorSessionBtn.addEventListener("click", async () => {
  try {
    doctorId = doctorIdInput.value.trim();
    if (!doctorId) {
      throw new Error("Doctor ID is required");
    }
    doctorToken = "";
    localStorage.removeItem(storageKeys.doctorToken);
    localStorage.setItem(storageKeys.doctorId, doctorId);
    await refreshAll();
  } catch (error) {
    setStatus(doctorStatusBar, error.message || "Unable to save doctor session", "error");
  }
});

clearDoctorSessionBtn.addEventListener("click", () => {
  doctorId = "";
  doctorToken = "";
  selectedCaseId = "";
  casesCache = [];
  localStorage.removeItem(storageKeys.doctorId);
  localStorage.removeItem(storageKeys.doctorToken);
  doctorIdInput.value = "";
  doctorPasswordInput.value = "";
  doctorCaseTriageSourceFilter.value = "";
  doctorCaseTriageRouteFilter.value = "";
  doctorProfile.textContent = "No profile loaded.";
  doctorCasesTableBody.innerHTML = "";
  doctorMessagesList.innerHTML = "";
  setStatus(doctorStatusBar, "Doctor session cleared.");
});

refreshDoctorCasesBtn.addEventListener("click", async () => {
  try {
    await loadCases();
    setStatus(doctorStatusBar, "Cases refreshed.", "success");
  } catch (error) {
    setStatus(doctorStatusBar, error.message || "Failed to refresh cases", "error");
  }
});

refreshDoctorMessagesBtn.addEventListener("click", async () => {
  try {
    await loadMessages();
    setStatus(doctorStatusBar, "Messages refreshed.", "success");
  } catch (error) {
    setStatus(doctorStatusBar, error.message || "Failed to refresh messages", "error");
  }
});

sendDoctorMessageBtn.addEventListener("click", async () => {
  try {
    await sendMessage();
    setStatus(doctorStatusBar, "Message sent.", "success");
  } catch (error) {
    setStatus(doctorStatusBar, error.message || "Failed to send message", "error");
  }
});

closeDoctorCaseBtn.addEventListener("click", async () => {
  try {
    await closeCase();
    setStatus(doctorStatusBar, "Case closed.", "success");
  } catch (error) {
    setStatus(doctorStatusBar, error.message || "Failed to close case", "error");
  }
});

doctorCaseStatusFilter.addEventListener("change", async () => {
  try {
    await loadCases();
  } catch (error) {
    setStatus(doctorStatusBar, error.message || "Failed to apply filter", "error");
  }
});

doctorCaseTriageSourceFilter.addEventListener("change", async () => {
  try {
    await loadCases();
  } catch (error) {
    setStatus(doctorStatusBar, error.message || "Failed to apply triage filter", "error");
  }
});

doctorCaseTriageRouteFilter.addEventListener("change", async () => {
  try {
    await loadCases();
  } catch (error) {
    setStatus(doctorStatusBar, error.message || "Failed to apply triage route filter", "error");
  }
});

refreshAll().catch((error) => {
  setStatus(doctorStatusBar, error.message || "Unable to initialize doctor portal", "error");
});
