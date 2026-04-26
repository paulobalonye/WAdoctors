import { apiRequest, buildAuthHeaders, byId, escapeHtml, formatDateTime, setStatus } from "./common.js";

const storageKey = "wadoctors_doctor_id";
let doctorId = localStorage.getItem(storageKey) || "";
let selectedCaseId = "";
let casesCache = [];

const doctorIdInput = byId("doctorIdInput");
const saveDoctorSessionBtn = byId("saveDoctorSessionBtn");
const clearDoctorSessionBtn = byId("clearDoctorSessionBtn");
const doctorStatusBar = byId("doctorStatusBar");
const doctorProfile = byId("doctorProfile");
const doctorCaseStatusFilter = byId("doctorCaseStatusFilter");
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

function authHeaders() {
  return buildAuthHeaders("DOCTOR", doctorId);
}

function renderDoctorProfile(data) {
  doctorProfile.innerHTML = `
    <div><strong>${escapeHtml(data.fullName || "-")}</strong></div>
    <div class="muted">${escapeHtml(data.email || "-")}</div>
    <div style="margin-top: 8px">
      <span class="badge">ID: ${escapeHtml(data.id)}</span>
      <span class="badge">KYC: ${escapeHtml(data.kycStatus)}</span>
      <span class="badge">Active: ${escapeHtml(String(data.isActive))}</span>
    </div>
  `;
}

function renderCases(cases) {
  if (!cases.length) {
    doctorCasesTableBody.innerHTML = `<tr><td colspan="5" class="muted">No cases found.</td></tr>`;
    return;
  }

  doctorCasesTableBody.innerHTML = cases
    .map((item) => {
      const activeClass = item.id === selectedCaseId ? "active" : "";
      return `
        <tr class="click-row ${activeClass}" data-case-id="${escapeHtml(item.id)}">
          <td><span class="badge">${escapeHtml(item.id.slice(0, 8))}</span></td>
          <td>${escapeHtml(item.status)}</td>
          <td>${escapeHtml(item.patient?.fullName || item.patient?.whatsappPhone || "-")}</td>
          <td>${escapeHtml(item.urgencyScore ?? "-")}</td>
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

  selectedDoctorCaseMeta.innerHTML = `
    <span class="badge">Case ${escapeHtml(selected.id)}</span>
    <span class="badge">Status ${escapeHtml(selected.status)}</span>
    <span class="badge">Patient ${escapeHtml(selected.patient?.fullName || selected.patient?.whatsappPhone || "-")}</span>
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

async function loadDoctorProfile() {
  if (!doctorId) {
    return;
  }
  const profile = await apiRequest("/api/v1/doctor/me", {
    headers: authHeaders()
  });
  renderDoctorProfile(profile);
}

async function loadCases() {
  if (!doctorId) {
    return;
  }

  const status = doctorCaseStatusFilter.value;
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const data = await apiRequest(`/api/v1/doctor/cases${query}`, {
    headers: authHeaders()
  });

  casesCache = data;
  if (selectedCaseId && !casesCache.some((item) => item.id === selectedCaseId)) {
    selectedCaseId = "";
  }
  renderCases(casesCache);
  updateSelectedCaseMeta();
}

async function loadMessages() {
  if (!doctorId || !selectedCaseId) {
    doctorMessagesList.innerHTML = `<div class="muted">Select a case to view messages.</div>`;
    return;
  }

  const messages = await apiRequest(`/api/v1/doctor/cases/${selectedCaseId}/messages`, {
    headers: authHeaders()
  });
  renderMessages(messages);
}

async function sendMessage() {
  if (!doctorId || !selectedCaseId) {
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
  if (!doctorId || !selectedCaseId) {
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
  if (!doctorId) {
    setStatus(doctorStatusBar, "Enter Doctor ID to begin.", "error");
    doctorProfile.textContent = "No profile loaded.";
    doctorCasesTableBody.innerHTML = "";
    doctorMessagesList.innerHTML = "";
    return;
  }

  setStatus(doctorStatusBar, "Loading doctor workspace...");
  await loadDoctorProfile();
  await loadCases();
  await loadMessages();
  setStatus(doctorStatusBar, "Doctor portal synced.", "success");
}

saveDoctorSessionBtn.addEventListener("click", async () => {
  try {
    doctorId = doctorIdInput.value.trim();
    if (!doctorId) {
      throw new Error("Doctor ID is required");
    }
    localStorage.setItem(storageKey, doctorId);
    await refreshAll();
  } catch (error) {
    setStatus(doctorStatusBar, error.message || "Unable to save doctor session", "error");
  }
});

clearDoctorSessionBtn.addEventListener("click", () => {
  doctorId = "";
  selectedCaseId = "";
  casesCache = [];
  localStorage.removeItem(storageKey);
  doctorIdInput.value = "";
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

refreshAll().catch((error) => {
  setStatus(doctorStatusBar, error.message || "Unable to initialize doctor portal", "error");
});
