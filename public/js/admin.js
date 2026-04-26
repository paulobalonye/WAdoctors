import { apiRequest, buildAuthHeaders, byId, escapeHtml, formatDateTime, setStatus } from "./common.js";

const storageKey = "wadoctors_admin_id";
let adminId = localStorage.getItem(storageKey) || "";
let selectedCaseId = "";
let selectedCaseStatus = "";
let doctorsCache = [];
let casesCache = [];

const adminIdInput = byId("adminIdInput");
const saveAdminSessionBtn = byId("saveAdminSessionBtn");
const clearAdminSessionBtn = byId("clearAdminSessionBtn");
const adminStatusBar = byId("adminStatusBar");
const adminOverviewGrid = byId("adminOverviewGrid");

const createDoctorEmail = byId("createDoctorEmail");
const createDoctorName = byId("createDoctorName");
const createDoctorNpi = byId("createDoctorNpi");
const createDoctorState = byId("createDoctorState");
const createDoctorSpecialty = byId("createDoctorSpecialty");
const createDoctorWebexPersonId = byId("createDoctorWebexPersonId");
const createDoctorKyc = byId("createDoctorKyc");
const createDoctorActive = byId("createDoctorActive");
const createDoctorBtn = byId("createDoctorBtn");
const refreshDoctorsBtn = byId("refreshDoctorsBtn");
const adminDoctorsTableBody = byId("adminDoctorsTableBody");

const adminCaseStatusFilter = byId("adminCaseStatusFilter");
const adminCaseLimit = byId("adminCaseLimit");
const refreshAdminCasesBtn = byId("refreshAdminCasesBtn");
const adminCasesTableBody = byId("adminCasesTableBody");
const adminCaseStatusUpdate = byId("adminCaseStatusUpdate");
const adminCaseAssignDoctor = byId("adminCaseAssignDoctor");
const adminUpdateCaseStatusBtn = byId("adminUpdateCaseStatusBtn");
const adminAssignCaseBtn = byId("adminAssignCaseBtn");
const adminUnassignCaseBtn = byId("adminUnassignCaseBtn");
const adminSelectedCaseMeta = byId("adminSelectedCaseMeta");

const refreshAdminCaseMessagesBtn = byId("refreshAdminCaseMessagesBtn");
const adminCaseMessagesList = byId("adminCaseMessagesList");

const refreshWebhookEventsBtn = byId("refreshWebhookEventsBtn");
const adminWebhookTableBody = byId("adminWebhookTableBody");

adminIdInput.value = adminId;

function authHeaders() {
  return buildAuthHeaders("ADMIN", adminId);
}

function renderOverview(data) {
  const metrics = [
    ["Patients", data.patients ?? 0],
    ["Doctors", data.doctors ?? 0],
    ["Active Doctors", data.activeDoctors ?? 0],
    ["Total Cases", data.totalCases ?? 0],
    ["Open Cases", data.openCases ?? 0],
    ["Completed Cases", data.completedCases ?? 0]
  ];

  adminOverviewGrid.innerHTML = metrics
    .map(([k, v]) => {
      return `
        <div class="metric">
          <div class="k">${escapeHtml(k)}</div>
          <div class="v">${escapeHtml(String(v))}</div>
        </div>
      `;
    })
    .join("");
}

function renderDoctorOptions() {
  const options = [
    `<option value="">Select doctor</option>`,
    ...doctorsCache.map((doctor) => {
      return `<option value="${escapeHtml(doctor.id)}">${escapeHtml(`${doctor.fullName} (${doctor.id.slice(0, 8)})`)}</option>`;
    })
  ];
  adminCaseAssignDoctor.innerHTML = options.join("");
}

function renderDoctors(doctors) {
  if (!doctors.length) {
    adminDoctorsTableBody.innerHTML = `<tr><td colspan="6" class="muted">No doctors found.</td></tr>`;
    return;
  }

  adminDoctorsTableBody.innerHTML = doctors
    .map((doctor) => {
      const activeBtn = doctor.isActive ? "Deactivate" : "Activate";
      const nextActive = doctor.isActive ? "false" : "true";
      return `
        <tr>
          <td>
            <div><strong>${escapeHtml(doctor.fullName)}</strong></div>
            <div class="muted">${escapeHtml(doctor.email)}</div>
            <div class="muted">${escapeHtml(doctor.id)}</div>
          </td>
          <td>${escapeHtml(doctor.licenseState || "-")}</td>
          <td>${escapeHtml(doctor.kycStatus)}</td>
          <td>${escapeHtml(String(doctor.isActive))}</td>
          <td>${escapeHtml(String(doctor.activeCaseLoad ?? 0))}</td>
          <td>
            <div class="btnrow">
              <button class="secondary doc-active-btn" data-doctor-id="${escapeHtml(doctor.id)}" data-next-active="${nextActive}">${activeBtn}</button>
              <button class="secondary doc-kyc-btn" data-doctor-id="${escapeHtml(doctor.id)}" data-kyc="APPROVED">Approve KYC</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  adminDoctorsTableBody.querySelectorAll(".doc-active-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const doctorId = button.getAttribute("data-doctor-id");
      const nextActive = button.getAttribute("data-next-active") === "true";
      if (!doctorId) {
        return;
      }
      try {
        await apiRequest(`/api/v1/admin/doctors/${doctorId}/active`, {
          method: "PATCH",
          headers: authHeaders(),
          body: JSON.stringify({ isActive: nextActive })
        });
        await loadDoctors();
        setStatus(adminStatusBar, "Doctor active status updated.", "success");
      } catch (error) {
        setStatus(adminStatusBar, error.message || "Failed to update doctor active flag", "error");
      }
    });
  });

  adminDoctorsTableBody.querySelectorAll(".doc-kyc-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const doctorId = button.getAttribute("data-doctor-id");
      const nextKyc = button.getAttribute("data-kyc");
      if (!doctorId || !nextKyc) {
        return;
      }
      try {
        await apiRequest(`/api/v1/admin/doctors/${doctorId}/kyc`, {
          method: "PATCH",
          headers: authHeaders(),
          body: JSON.stringify({ kycStatus: nextKyc })
        });
        await loadDoctors();
        setStatus(adminStatusBar, "Doctor KYC updated.", "success");
      } catch (error) {
        setStatus(adminStatusBar, error.message || "Failed to update doctor KYC", "error");
      }
    });
  });
}

function renderCases(cases) {
  if (!cases.length) {
    adminCasesTableBody.innerHTML = `<tr><td colspan="6" class="muted">No cases found.</td></tr>`;
    return;
  }

  adminCasesTableBody.innerHTML = cases
    .map((item) => {
      const activeClass = item.id === selectedCaseId ? "active" : "";
      return `
        <tr class="click-row ${activeClass}" data-case-id="${escapeHtml(item.id)}" data-case-status="${escapeHtml(item.status)}">
          <td><span class="badge">${escapeHtml(item.id.slice(0, 8))}</span></td>
          <td>${escapeHtml(item.status)}</td>
          <td>${escapeHtml(item.patient?.fullName || item.patient?.whatsappPhone || "-")}</td>
          <td>${escapeHtml(item.assignedDoctor?.fullName || "-")}</td>
          <td>${escapeHtml(item.urgencyScore ?? "-")}</td>
          <td>${escapeHtml(formatDateTime(item.createdAt))}</td>
        </tr>
      `;
    })
    .join("");

  adminCasesTableBody.querySelectorAll("tr[data-case-id]").forEach((row) => {
    row.addEventListener("click", async () => {
      selectedCaseId = row.getAttribute("data-case-id") || "";
      selectedCaseStatus = row.getAttribute("data-case-status") || "";
      adminCaseStatusUpdate.value = selectedCaseStatus || "NEW";
      renderCases(casesCache);
      renderSelectedCaseMeta();
      await loadCaseMessages();
    });
  });
}

function renderSelectedCaseMeta() {
  if (!selectedCaseId) {
    adminSelectedCaseMeta.textContent = "Select a case row to manage it.";
    return;
  }
  adminSelectedCaseMeta.innerHTML = `
    <span class="badge">Case ${escapeHtml(selectedCaseId)}</span>
    <span class="badge">Status ${escapeHtml(selectedCaseStatus || "-")}</span>
  `;
}

function renderCaseMessages(messages) {
  if (!messages.length) {
    adminCaseMessagesList.innerHTML = `<div class="muted">No case messages.</div>`;
    return;
  }

  adminCaseMessagesList.innerHTML = messages
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

function renderWebhookEvents(events) {
  if (!events.length) {
    adminWebhookTableBody.innerHTML = `<tr><td colspan="3" class="muted">No webhook events.</td></tr>`;
    return;
  }

  adminWebhookTableBody.innerHTML = events
    .map((event) => {
      return `
        <tr>
          <td>${escapeHtml(event.provider)}</td>
          <td>${escapeHtml(event.externalId)}</td>
          <td>${escapeHtml(formatDateTime(event.receivedAt))}</td>
        </tr>
      `;
    })
    .join("");
}

async function loadOverview() {
  const data = await apiRequest("/api/v1/admin/overview", { headers: authHeaders() });
  renderOverview(data);
}

async function loadDoctors() {
  doctorsCache = await apiRequest("/api/v1/admin/doctors", { headers: authHeaders() });
  renderDoctors(doctorsCache);
  renderDoctorOptions();
}

async function loadCases() {
  const status = adminCaseStatusFilter.value;
  const limit = adminCaseLimit.value.trim() || "100";
  const query = new URLSearchParams();
  if (status) {
    query.set("status", status);
  }
  query.set("limit", limit);

  const data = await apiRequest(`/api/v1/admin/cases?${query.toString()}`, { headers: authHeaders() });
  casesCache = data;
  if (selectedCaseId && !casesCache.some((item) => item.id === selectedCaseId)) {
    selectedCaseId = "";
    selectedCaseStatus = "";
  }
  renderCases(casesCache);
  renderSelectedCaseMeta();
}

async function loadCaseMessages() {
  if (!selectedCaseId) {
    adminCaseMessagesList.innerHTML = `<div class="muted">Select a case to view messages.</div>`;
    return;
  }
  const data = await apiRequest(`/api/v1/admin/cases/${selectedCaseId}/messages`, { headers: authHeaders() });
  renderCaseMessages(data);
}

async function loadWebhookEvents() {
  const data = await apiRequest("/api/v1/admin/webhooks?limit=50", { headers: authHeaders() });
  renderWebhookEvents(data);
}

async function createDoctor() {
  const body = {
    email: createDoctorEmail.value.trim(),
    fullName: createDoctorName.value.trim(),
    npiNumber: createDoctorNpi.value.trim(),
    licenseState: createDoctorState.value.trim().toUpperCase() || undefined,
    specialty: createDoctorSpecialty.value.trim() || undefined,
    webexPersonId: createDoctorWebexPersonId.value.trim() || undefined,
    isActive: createDoctorActive.value === "true",
    kycStatus: createDoctorKyc.value
  };

  await apiRequest("/api/v1/admin/doctors", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body)
  });

  createDoctorEmail.value = "";
  createDoctorName.value = "";
  createDoctorNpi.value = "";
  createDoctorState.value = "";
  createDoctorSpecialty.value = "";
  createDoctorWebexPersonId.value = "";
}

async function updateSelectedCaseStatus() {
  if (!selectedCaseId) {
    throw new Error("Select a case first");
  }
  const status = adminCaseStatusUpdate.value;
  await apiRequest(`/api/v1/admin/cases/${selectedCaseId}/status`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ status })
  });
}

async function assignSelectedCase(doctorId) {
  if (!selectedCaseId) {
    throw new Error("Select a case first");
  }
  await apiRequest(`/api/v1/admin/cases/${selectedCaseId}/assign`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ doctorId })
  });
}

async function refreshAll() {
  if (!adminId) {
    setStatus(adminStatusBar, "Enter Admin ID to begin.", "error");
    return;
  }

  setStatus(adminStatusBar, "Loading admin workspace...");
  await loadOverview();
  await loadDoctors();
  await loadCases();
  await loadCaseMessages();
  await loadWebhookEvents();
  setStatus(adminStatusBar, "Admin portal synced.", "success");
}

saveAdminSessionBtn.addEventListener("click", async () => {
  try {
    adminId = adminIdInput.value.trim();
    if (!adminId) {
      throw new Error("Admin ID is required");
    }
    localStorage.setItem(storageKey, adminId);
    await refreshAll();
  } catch (error) {
    setStatus(adminStatusBar, error.message || "Failed to set admin session", "error");
  }
});

clearAdminSessionBtn.addEventListener("click", () => {
  adminId = "";
  selectedCaseId = "";
  selectedCaseStatus = "";
  localStorage.removeItem(storageKey);
  adminIdInput.value = "";
  adminOverviewGrid.innerHTML = "";
  adminDoctorsTableBody.innerHTML = "";
  adminCasesTableBody.innerHTML = "";
  adminCaseMessagesList.innerHTML = "";
  adminWebhookTableBody.innerHTML = "";
  setStatus(adminStatusBar, "Admin session cleared.");
});

createDoctorBtn.addEventListener("click", async () => {
  try {
    await createDoctor();
    await loadDoctors();
    setStatus(adminStatusBar, "Doctor created.", "success");
  } catch (error) {
    setStatus(adminStatusBar, error.message || "Failed to create doctor", "error");
  }
});

refreshDoctorsBtn.addEventListener("click", async () => {
  try {
    await loadDoctors();
    setStatus(adminStatusBar, "Doctors refreshed.", "success");
  } catch (error) {
    setStatus(adminStatusBar, error.message || "Failed to refresh doctors", "error");
  }
});

refreshAdminCasesBtn.addEventListener("click", async () => {
  try {
    await loadCases();
    setStatus(adminStatusBar, "Cases refreshed.", "success");
  } catch (error) {
    setStatus(adminStatusBar, error.message || "Failed to refresh cases", "error");
  }
});

adminUpdateCaseStatusBtn.addEventListener("click", async () => {
  try {
    await updateSelectedCaseStatus();
    await loadCases();
    await loadCaseMessages();
    setStatus(adminStatusBar, "Case status updated.", "success");
  } catch (error) {
    setStatus(adminStatusBar, error.message || "Failed to update case status", "error");
  }
});

adminAssignCaseBtn.addEventListener("click", async () => {
  try {
    const doctorId = adminCaseAssignDoctor.value || null;
    if (!doctorId) {
      throw new Error("Choose a doctor to assign");
    }
    await assignSelectedCase(doctorId);
    await loadCases();
    setStatus(adminStatusBar, "Case assigned.", "success");
  } catch (error) {
    setStatus(adminStatusBar, error.message || "Failed to assign case", "error");
  }
});

adminUnassignCaseBtn.addEventListener("click", async () => {
  try {
    await assignSelectedCase(null);
    await loadCases();
    setStatus(adminStatusBar, "Case unassigned.", "success");
  } catch (error) {
    setStatus(adminStatusBar, error.message || "Failed to unassign case", "error");
  }
});

refreshAdminCaseMessagesBtn.addEventListener("click", async () => {
  try {
    await loadCaseMessages();
    setStatus(adminStatusBar, "Messages refreshed.", "success");
  } catch (error) {
    setStatus(adminStatusBar, error.message || "Failed to refresh messages", "error");
  }
});

refreshWebhookEventsBtn.addEventListener("click", async () => {
  try {
    await loadWebhookEvents();
    setStatus(adminStatusBar, "Webhook log refreshed.", "success");
  } catch (error) {
    setStatus(adminStatusBar, error.message || "Failed to refresh webhook log", "error");
  }
});

adminCaseStatusFilter.addEventListener("change", async () => {
  try {
    await loadCases();
  } catch (error) {
    setStatus(adminStatusBar, error.message || "Failed to apply case filter", "error");
  }
});

refreshAll().catch((error) => {
  setStatus(adminStatusBar, error.message || "Unable to initialize admin portal", "error");
});
