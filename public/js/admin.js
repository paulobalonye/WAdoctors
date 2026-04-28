import { apiRequest, byId, escapeHtml, formatDateTime, setStatus } from "./common.js";

const storageKeys = {
  adminId: "wadoctors_admin_id",
  adminToken: "wadoctors_admin_token",
  adminEmail: "wadoctors_admin_email"
};

let adminToken = localStorage.getItem(storageKeys.adminToken) || "";
let selectedCaseId = "";
let selectedCaseStatus = "";
let doctorsCache = [];
let casesCache = [];
let adminUsersCache = [];
let patientsCache = [];
const relayJobNames = new Set(["PATIENT_TO_WEBEX", "DOCTOR_TO_WHATSAPP"]);

const adminEmailInput = byId("adminEmailInput");
const adminPasswordInput = byId("adminPasswordInput");
const adminLoginBtn = byId("adminLoginBtn");
const clearAdminSessionBtn = byId("clearAdminSessionBtn");
const adminSignOutBtn = byId("adminSignOutBtn");
const adminStatusBar = byId("adminStatusBar");
const adminOverviewGrid = byId("adminOverviewGrid");
const refreshIntegrationStatusBtn = byId("refreshIntegrationStatusBtn");
const adminIntegrationSummaryGrid = byId("adminIntegrationSummaryGrid");
const adminIntegrationStatusBody = byId("adminIntegrationStatusBody");

const createDoctorEmail = byId("createDoctorEmail");
const createDoctorName = byId("createDoctorName");
const createDoctorPassword = byId("createDoctorPassword");
const createDoctorNpi = byId("createDoctorNpi");
const createDoctorState = byId("createDoctorState");
const createDoctorSpecialty = byId("createDoctorSpecialty");
const createDoctorWebexPersonId = byId("createDoctorWebexPersonId");
const createDoctorKyc = byId("createDoctorKyc");
const createDoctorActive = byId("createDoctorActive");
const createDoctorBtn = byId("createDoctorBtn");
const refreshDoctorsBtn = byId("refreshDoctorsBtn");
const adminDoctorsTableBody = byId("adminDoctorsTableBody");
const createAdminUserEmail = byId("createAdminUserEmail");
const createAdminUserName = byId("createAdminUserName");
const createAdminUserPassword = byId("createAdminUserPassword");
const createAdminUserBtn = byId("createAdminUserBtn");
const refreshAdminUsersBtn = byId("refreshAdminUsersBtn");
const adminUsersTableBody = byId("adminUsersTableBody");

const createPatientPhone = byId("createPatientPhone");
const createPatientName = byId("createPatientName");
const createPatientDob = byId("createPatientDob");
const createPatientEmail = byId("createPatientEmail");
const createPatientAddress = byId("createPatientAddress");
const createPatientEmergencyContactName = byId("createPatientEmergencyContactName");
const createPatientEmergencyContactPhone = byId("createPatientEmergencyContactPhone");
const createPatientInsuranceProvider = byId("createPatientInsuranceProvider");
const createPatientIdDocumentUrl = byId("createPatientIdDocumentUrl");
const createPatientBtn = byId("createPatientBtn");
const refreshPatientsBtn = byId("refreshPatientsBtn");
const adminPatientsTableBody = byId("adminPatientsTableBody");

const profile360EntityType = byId("profile360EntityType");
const profile360EntityId = byId("profile360EntityId");
const loadProfile360Btn = byId("loadProfile360Btn");
const adminProfile360Output = byId("adminProfile360Output");
const adminProfile360ActivityBody = byId("adminProfile360ActivityBody");

const adminCaseStatusFilter = byId("adminCaseStatusFilter");
const adminCaseLimit = byId("adminCaseLimit");
const adminCaseTriageSourceFilter = byId("adminCaseTriageSourceFilter");
const adminCaseTriageRouteFilter = byId("adminCaseTriageRouteFilter");
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
const refreshWebhookSummaryBtn = byId("refreshWebhookSummaryBtn");
const adminWebhookWindowHours = byId("adminWebhookWindowHours");
const adminWebhookSummaryGrid = byId("adminWebhookSummaryGrid");
const adminWebhookTableBody = byId("adminWebhookTableBody");
const refreshTriageSummaryBtn = byId("refreshTriageSummaryBtn");
const adminTriageWindowHours = byId("adminTriageWindowHours");
const adminTriageLimit = byId("adminTriageLimit");
const adminTriageSummaryGrid = byId("adminTriageSummaryGrid");
const adminTriageSourceBody = byId("adminTriageSourceBody");
const adminTriageRouteBody = byId("adminTriageRouteBody");
const adminTriageRedFlagsBody = byId("adminTriageRedFlagsBody");
const adminTriageEvalState = byId("adminTriageEvalState");
const adminTriageEvalMessage = byId("adminTriageEvalMessage");
const evaluateTriageBtn = byId("evaluateTriageBtn");
const adminTriageEvalResult = byId("adminTriageEvalResult");
const adminRelayFailedLimit = byId("adminRelayFailedLimit");
const adminRelayClearGraceSeconds = byId("adminRelayClearGraceSeconds");
const adminRelayCaseId = byId("adminRelayCaseId");
const adminRelayFailedName = byId("adminRelayFailedName");
const adminRelayInjectDirection = byId("adminRelayInjectDirection");
const refreshRelayHealthBtn = byId("refreshRelayHealthBtn");
const refreshRelayFailedJobsBtn = byId("refreshRelayFailedJobsBtn");
const retryRecentRelayFailedBtn = byId("retryRecentRelayFailedBtn");
const retryWebexRelayFailedBtn = byId("retryWebexRelayFailedBtn");
const retryWhatsAppRelayFailedBtn = byId("retryWhatsAppRelayFailedBtn");
const injectRelayFailureBtn = byId("injectRelayFailureBtn");
const clearRelayFailedBtn = byId("clearRelayFailedBtn");
const adminRelayHealthGrid = byId("adminRelayHealthGrid");
const adminRelayHealthNote = byId("adminRelayHealthNote");
const adminRelayAlerts = byId("adminRelayAlerts");
const adminRelayFailedJobsBody = byId("adminRelayFailedJobsBody");

adminEmailInput.value = localStorage.getItem(storageKeys.adminEmail) || "";
adminTriageEvalState.value = "OH";

if (!adminToken) {
  window.location.href = "/portal/admin-login.html";
}

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
  if (!adminToken) {
    throw new Error("Admin login required");
  }

  return {
    Authorization: `Bearer ${adminToken}`,
    "content-type": "application/json"
  };
}

function normalizeNullableInput(value) {
  if (value === null || value === undefined) {
    return undefined;
  }
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
}

function parseDateInputToIso(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return null;
  }

  const asDate = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(asDate.getTime())) {
    throw new Error("Invalid date format");
  }

  return asDate.toISOString();
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

function renderIntegrationStatus(data) {
  if (!data || !data.summary) {
    adminIntegrationSummaryGrid.innerHTML = `<div class="muted">Integration status unavailable.</div>`;
    adminIntegrationStatusBody.innerHTML = `<tr><td colspan="4" class="muted">No integration data.</td></tr>`;
    return;
  }

  const summaryCards = [
    {
      label: "Integrations Ready",
      value: `${data.summary.readyCount ?? 0} / ${data.summary.total ?? 0}`,
      meta: "Current configuration health"
    },
    {
      label: "WhatsApp Bot",
      value: String(Boolean(data.whatsapp?.ready)),
      meta: "Inbound + outbound settings"
    },
    {
      label: "Webex Bridge",
      value: String(Boolean(data.webex?.ready)),
      meta: "Webhook + bot messaging settings"
    },
    {
      label: "AI Triage",
      value: String(Boolean(data.aiTriage?.ready)),
      meta: data.aiTriage?.enabled ? "OpenAI-assisted urgency scoring" : "Disabled"
    }
  ];

  adminIntegrationSummaryGrid.innerHTML = summaryCards
    .map((card) => {
      return `
        <div class="metric">
          <div class="k">${escapeHtml(card.label)}</div>
          <div class="v">${escapeHtml(card.value)}</div>
          <div class="muted">${escapeHtml(card.meta)}</div>
        </div>
      `;
    })
    .join("");

  const rows = [
    ["AI Triage", data.aiTriage],
    ["WhatsApp", data.whatsapp],
    ["Webex", data.webex],
    ["Stripe", data.stripe],
    ["Relay Queue", data.relay]
  ];

  adminIntegrationStatusBody.innerHTML = rows
    .map(([name, entry]) => {
      const missing = Array.isArray(entry?.missing) && entry.missing.length
        ? entry.missing.join(", ")
        : "-";
      const notes = Array.isArray(entry?.notes) && entry.notes.length
        ? entry.notes.join(", ")
        : "-";

      return `
        <tr>
          <td>${escapeHtml(String(name))}</td>
          <td>${escapeHtml(String(Boolean(entry?.ready)))}</td>
          <td>${escapeHtml(missing)}</td>
          <td>${escapeHtml(notes)}</td>
        </tr>
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
          <td>${escapeHtml(String(doctor.activeCaseLoad ?? 0))} / ${escapeHtml(String(doctor.maxConcurrentCases ?? 3))}</td>
          <td>
            <div class="btnrow">
              <button class="secondary doc-active-btn" data-doctor-id="${escapeHtml(doctor.id)}" data-next-active="${nextActive}">${activeBtn}</button>
              <button class="secondary doc-kyc-btn" data-doctor-id="${escapeHtml(doctor.id)}" data-kyc="APPROVED">Approve KYC</button>
              <button class="secondary doc-reset-btn" data-doctor-id="${escapeHtml(doctor.id)}">Reset Password</button>
              <button class="secondary doc-schedule-btn" data-doctor-id="${escapeHtml(doctor.id)}">Schedule</button>
              <button class="secondary doc-edit-btn" data-doctor-id="${escapeHtml(doctor.id)}">Edit</button>
              <button class="secondary doc-profile-btn" data-doctor-id="${escapeHtml(doctor.id)}">Profile360</button>
              <button class="warn doc-delete-btn" data-doctor-id="${escapeHtml(doctor.id)}">Delete</button>
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

  adminDoctorsTableBody.querySelectorAll(".doc-reset-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const doctorId = button.getAttribute("data-doctor-id");
      if (!doctorId) {
        return;
      }

      const nextPassword = prompt("Enter a new password for this doctor (min 8 chars):");
      if (!nextPassword) {
        return;
      }

      try {
        await apiRequest(`/api/v1/admin/doctors/${doctorId}/password`, {
          method: "PATCH",
          headers: authHeaders(),
          body: JSON.stringify({ password: nextPassword })
        });
        setStatus(adminStatusBar, "Doctor password reset.", "success");
      } catch (error) {
        setStatus(adminStatusBar, error.message || "Failed to reset doctor password", "error");
      }
    });
  });

  adminDoctorsTableBody.querySelectorAll(".doc-schedule-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const doctorId = button.getAttribute("data-doctor-id");
      if (!doctorId) {
        return;
      }

      const doctor = doctorsCache.find((item) => item.id === doctorId);
      if (!doctor) {
        return;
      }

      const defaultAvailability = JSON.stringify(doctor.availability || {}, null, 2);
      const availabilityText = prompt("Availability JSON", defaultAvailability);
      if (availabilityText === null) {
        return;
      }

      const maxText = prompt(
        "Max concurrent cases",
        String(doctor.maxConcurrentCases ?? 3)
      );
      if (maxText === null) {
        return;
      }

      let availability;
      try {
        availability = JSON.parse(availabilityText);
      } catch {
        setStatus(adminStatusBar, "Invalid availability JSON", "error");
        return;
      }

      const maxConcurrentCases = Number.parseInt(maxText, 10);
      if (!Number.isFinite(maxConcurrentCases) || maxConcurrentCases < 1 || maxConcurrentCases > 20) {
        setStatus(adminStatusBar, "Max concurrent must be between 1 and 20", "error");
        return;
      }

      try {
        await apiRequest(`/api/v1/admin/doctors/${doctorId}/schedule`, {
          method: "PATCH",
          headers: authHeaders(),
          body: JSON.stringify({ availability, maxConcurrentCases })
        });
        await loadDoctors();
        setStatus(adminStatusBar, "Doctor schedule updated.", "success");
      } catch (error) {
        setStatus(adminStatusBar, error.message || "Failed to update doctor schedule", "error");
      }
    });
  });

  adminDoctorsTableBody.querySelectorAll(".doc-edit-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const doctorId = button.getAttribute("data-doctor-id");
      const doctor = doctorsCache.find((item) => item.id === doctorId);
      if (!doctorId || !doctor) {
        return;
      }

      const fullName = prompt("Doctor full name", doctor.fullName || "");
      if (fullName === null) {
        return;
      }
      const email = prompt("Doctor email", doctor.email || "");
      if (email === null) {
        return;
      }
      const npiNumber = prompt("NPI number", doctor.npiNumber || "");
      if (npiNumber === null) {
        return;
      }
      const licenseState = prompt("License state (2 letters, blank clears)", doctor.licenseState || "");
      if (licenseState === null) {
        return;
      }
      const specialty = prompt("Specialty (blank clears)", doctor.specialty || "");
      if (specialty === null) {
        return;
      }
      const webexPersonId = prompt("Webex Person ID (blank clears)", doctor.webexPersonId || "");
      if (webexPersonId === null) {
        return;
      }

      try {
        await apiRequest(`/api/v1/admin/doctors/${doctorId}`, {
          method: "PATCH",
          headers: authHeaders(),
          body: JSON.stringify({
            fullName: fullName.trim(),
            email: email.trim(),
            npiNumber: npiNumber.trim(),
            licenseState: licenseState.trim() ? licenseState.trim().toUpperCase() : null,
            specialty: specialty.trim() ? specialty.trim() : null,
            webexPersonId: webexPersonId.trim() ? webexPersonId.trim() : null
          })
        });
        await loadDoctors();
        setStatus(adminStatusBar, "Doctor updated.", "success");
      } catch (error) {
        setStatus(adminStatusBar, error.message || "Failed to update doctor", "error");
      }
    });
  });

  adminDoctorsTableBody.querySelectorAll(".doc-profile-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const doctorId = button.getAttribute("data-doctor-id");
      if (!doctorId) {
        return;
      }

      try {
        await loadProfile360("DOCTOR", doctorId);
        setStatus(adminStatusBar, "Doctor Profile360 loaded.", "success");
      } catch (error) {
        setStatus(adminStatusBar, error.message || "Failed to load doctor Profile360", "error");
      }
    });
  });

  adminDoctorsTableBody.querySelectorAll(".doc-delete-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const doctorId = button.getAttribute("data-doctor-id");
      if (!doctorId) {
        return;
      }
      if (!confirm("Delete this doctor? This cannot be undone.")) {
        return;
      }

      try {
        await apiRequest(`/api/v1/admin/doctors/${doctorId}`, {
          method: "DELETE",
          headers: authHeaders()
        });
        await loadDoctors();
        setStatus(adminStatusBar, "Doctor deleted.", "success");
      } catch (error) {
        setStatus(adminStatusBar, error.message || "Failed to delete doctor", "error");
      }
    });
  });
}

function renderAdminUsers(users) {
  if (!users.length) {
    adminUsersTableBody.innerHTML = `<tr><td colspan="4" class="muted">No admin users found.</td></tr>`;
    return;
  }

  adminUsersTableBody.innerHTML = users
    .map((user) => {
      const nextActive = user.isActive ? "false" : "true";
      const activeLabel = user.isActive ? "Deactivate" : "Activate";
      return `
        <tr>
          <td>
            <div><strong>${escapeHtml(user.fullName || "-")}</strong></div>
            <div class="muted">${escapeHtml(user.email || "-")}</div>
            <div class="muted">${escapeHtml(user.id || "-")}</div>
          </td>
          <td>${escapeHtml(String(Boolean(user.isActive)))}</td>
          <td>${escapeHtml(formatDateTime(user.updatedAt || user.createdAt))}</td>
          <td>
            <div class="btnrow">
              <button class="secondary admin-user-toggle-btn" data-admin-user-id="${escapeHtml(user.id)}" data-next-active="${nextActive}">${activeLabel}</button>
              <button class="secondary admin-user-edit-btn" data-admin-user-id="${escapeHtml(user.id)}">Edit</button>
              <button class="secondary admin-user-reset-btn" data-admin-user-id="${escapeHtml(user.id)}">Reset Password</button>
              <button class="secondary admin-user-profile-btn" data-admin-user-id="${escapeHtml(user.id)}">Profile360</button>
              <button class="warn admin-user-delete-btn" data-admin-user-id="${escapeHtml(user.id)}">Delete</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  adminUsersTableBody.querySelectorAll(".admin-user-toggle-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const adminUserId = button.getAttribute("data-admin-user-id");
      const isActive = button.getAttribute("data-next-active") === "true";
      if (!adminUserId) {
        return;
      }

      try {
        await apiRequest(`/api/v1/admin/admin-users/${adminUserId}`, {
          method: "PATCH",
          headers: authHeaders(),
          body: JSON.stringify({ isActive })
        });
        await loadAdminUsers();
        setStatus(adminStatusBar, "Admin user status updated.", "success");
      } catch (error) {
        setStatus(adminStatusBar, error.message || "Failed to update admin user status", "error");
      }
    });
  });

  adminUsersTableBody.querySelectorAll(".admin-user-edit-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const adminUserId = button.getAttribute("data-admin-user-id");
      const user = adminUsersCache.find((item) => item.id === adminUserId);
      if (!adminUserId || !user) {
        return;
      }

      const fullName = prompt("Admin full name", user.fullName || "");
      if (fullName === null) {
        return;
      }
      const email = prompt("Admin email", user.email || "");
      if (email === null) {
        return;
      }

      try {
        await apiRequest(`/api/v1/admin/admin-users/${adminUserId}`, {
          method: "PATCH",
          headers: authHeaders(),
          body: JSON.stringify({
            fullName: fullName.trim(),
            email: email.trim()
          })
        });
        await loadAdminUsers();
        setStatus(adminStatusBar, "Admin user updated.", "success");
      } catch (error) {
        setStatus(adminStatusBar, error.message || "Failed to update admin user", "error");
      }
    });
  });

  adminUsersTableBody.querySelectorAll(".admin-user-reset-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const adminUserId = button.getAttribute("data-admin-user-id");
      if (!adminUserId) {
        return;
      }

      const password = prompt("Enter a new password (min 8 chars)");
      if (!password) {
        return;
      }

      try {
        await apiRequest(`/api/v1/admin/admin-users/${adminUserId}/password`, {
          method: "PATCH",
          headers: authHeaders(),
          body: JSON.stringify({ password })
        });
        setStatus(adminStatusBar, "Admin user password reset.", "success");
      } catch (error) {
        setStatus(adminStatusBar, error.message || "Failed to reset admin user password", "error");
      }
    });
  });

  adminUsersTableBody.querySelectorAll(".admin-user-profile-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const adminUserId = button.getAttribute("data-admin-user-id");
      if (!adminUserId) {
        return;
      }

      try {
        await loadProfile360("ADMIN_USER", adminUserId);
        setStatus(adminStatusBar, "Admin user Profile360 loaded.", "success");
      } catch (error) {
        setStatus(adminStatusBar, error.message || "Failed to load admin user Profile360", "error");
      }
    });
  });

  adminUsersTableBody.querySelectorAll(".admin-user-delete-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const adminUserId = button.getAttribute("data-admin-user-id");
      if (!adminUserId) {
        return;
      }
      if (!confirm("Delete this admin user? This cannot be undone.")) {
        return;
      }

      try {
        await apiRequest(`/api/v1/admin/admin-users/${adminUserId}`, {
          method: "DELETE",
          headers: authHeaders()
        });
        await loadAdminUsers();
        setStatus(adminStatusBar, "Admin user deleted.", "success");
      } catch (error) {
        setStatus(adminStatusBar, error.message || "Failed to delete admin user", "error");
      }
    });
  });
}

function renderPatients(patients) {
  if (!patients.length) {
    adminPatientsTableBody.innerHTML = `<tr><td colspan="4" class="muted">No patients found.</td></tr>`;
    return;
  }

  adminPatientsTableBody.innerHTML = patients
    .map((patient) => {
      return `
        <tr>
          <td>
            <div><strong>${escapeHtml(patient.fullName || "-")}</strong></div>
            <div class="muted">${escapeHtml(patient.id || "-")}</div>
          </td>
          <td>
            <div>${escapeHtml(patient.whatsappPhone || "-")}</div>
            <div class="muted">${escapeHtml(patient.email || "-")}</div>
          </td>
          <td>${escapeHtml(formatDateTime(patient.updatedAt || patient.createdAt))}</td>
          <td>
            <div class="btnrow">
              <button class="secondary patient-edit-btn" data-patient-id="${escapeHtml(patient.id)}">Edit</button>
              <button class="secondary patient-profile-btn" data-patient-id="${escapeHtml(patient.id)}">Profile360</button>
              <button class="warn patient-delete-btn" data-patient-id="${escapeHtml(patient.id)}">Delete</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  adminPatientsTableBody.querySelectorAll(".patient-edit-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const patientId = button.getAttribute("data-patient-id");
      const patient = patientsCache.find((item) => item.id === patientId);
      if (!patientId || !patient) {
        return;
      }

      const fullName = prompt("Patient full name", patient.fullName || "");
      if (fullName === null) {
        return;
      }
      const whatsappPhone = prompt("WhatsApp phone", patient.whatsappPhone || "");
      if (whatsappPhone === null) {
        return;
      }
      const email = prompt("Email (blank clears)", patient.email || "");
      if (email === null) {
        return;
      }
      const address = prompt("Address (blank clears)", patient.address || "");
      if (address === null) {
        return;
      }
      const emergencyContactName = prompt(
        "Emergency contact name (blank clears)",
        patient.emergencyContactName || ""
      );
      if (emergencyContactName === null) {
        return;
      }
      const emergencyContactPhone = prompt(
        "Emergency contact phone (blank clears)",
        patient.emergencyContactPhone || ""
      );
      if (emergencyContactPhone === null) {
        return;
      }
      const insuranceProvider = prompt("Insurance provider (blank clears)", patient.insuranceProvider || "");
      if (insuranceProvider === null) {
        return;
      }
      const idDocumentUrl = prompt("ID document URL (blank clears)", patient.idDocumentUrl || "");
      if (idDocumentUrl === null) {
        return;
      }

      try {
        await apiRequest(`/api/v1/admin/patients/${patientId}`, {
          method: "PATCH",
          headers: authHeaders(),
          body: JSON.stringify({
            fullName: fullName.trim(),
            whatsappPhone: whatsappPhone.trim(),
            email: normalizeNullableInput(email),
            address: normalizeNullableInput(address),
            emergencyContactName: normalizeNullableInput(emergencyContactName),
            emergencyContactPhone: normalizeNullableInput(emergencyContactPhone),
            insuranceProvider: normalizeNullableInput(insuranceProvider),
            idDocumentUrl: normalizeNullableInput(idDocumentUrl)
          })
        });
        await loadPatients();
        setStatus(adminStatusBar, "Patient updated.", "success");
      } catch (error) {
        setStatus(adminStatusBar, error.message || "Failed to update patient", "error");
      }
    });
  });

  adminPatientsTableBody.querySelectorAll(".patient-profile-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const patientId = button.getAttribute("data-patient-id");
      if (!patientId) {
        return;
      }

      try {
        await loadProfile360("PATIENT", patientId);
        setStatus(adminStatusBar, "Patient Profile360 loaded.", "success");
      } catch (error) {
        setStatus(adminStatusBar, error.message || "Failed to load patient Profile360", "error");
      }
    });
  });

  adminPatientsTableBody.querySelectorAll(".patient-delete-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const patientId = button.getAttribute("data-patient-id");
      if (!patientId) {
        return;
      }
      if (!confirm("Delete this patient? This cannot be undone.")) {
        return;
      }

      try {
        await apiRequest(`/api/v1/admin/patients/${patientId}`, {
          method: "DELETE",
          headers: authHeaders()
        });
        await loadPatients();
        setStatus(adminStatusBar, "Patient deleted.", "success");
      } catch (error) {
        setStatus(adminStatusBar, error.message || "Failed to delete patient", "error");
      }
    });
  });
}

function renderProfile360(data) {
  if (!data || !data.profile) {
    adminProfile360Output.innerHTML = "Profile360 data unavailable.";
    adminProfile360ActivityBody.innerHTML = `<tr><td colspan="3" class="muted">No activity available.</td></tr>`;
    return;
  }

  const metrics = data.metrics && typeof data.metrics === "object"
    ? Object.entries(data.metrics)
        .map(([key, value]) => `<span class="badge">${escapeHtml(`${key}: ${value}`)}</span>`)
        .join(" ")
    : `<span class="badge">No metrics</span>`;

  adminProfile360Output.innerHTML = `
    <div><strong>${escapeHtml(String(data.entityType || "-"))}</strong></div>
    <div class="muted">${escapeHtml(String(data.profile.id || "-"))}</div>
    <div style="margin-top: 6px">${metrics}</div>
  `;

  const items = Array.isArray(data.recentCases)
    ? data.recentCases.map((item) => ({
        activity: `Case ${item.id || "-"}`,
        context: item.status || "-",
        when: item.createdAt || item.updatedAt || null
      }))
    : Array.isArray(data.recentAudit)
      ? data.recentAudit.map((item) => ({
          activity: `${item.tableName || "-"} ${item.action || "-"}`,
          context: item.recordId || "-",
          when: item.createdAt || null
        }))
      : [];

  adminProfile360ActivityBody.innerHTML = items.length
    ? items
        .map(
          (item) => `
            <tr>
              <td>${escapeHtml(String(item.activity || "-"))}</td>
              <td>${escapeHtml(String(item.context || "-"))}</td>
              <td>${escapeHtml(formatDateTime(item.when))}</td>
            </tr>
          `
        )
        .join("")
    : `<tr><td colspan="3" class="muted">No activity available.</td></tr>`;
}

function renderCases(cases) {
  if (!cases.length) {
    adminCasesTableBody.innerHTML = `<tr><td colspan="8" class="muted">No cases found.</td></tr>`;
    return;
  }

  adminCasesTableBody.innerHTML = cases
    .map((item) => {
      const activeClass = item.id === selectedCaseId ? "active" : "";
      const triage = getCaseTriage(item);
      return `
        <tr class="click-row ${activeClass}" data-case-id="${escapeHtml(item.id)}" data-case-status="${escapeHtml(item.status)}">
          <td><span class="badge">${escapeHtml(item.id.slice(0, 8))}</span></td>
          <td>${escapeHtml(item.status)}</td>
          <td>${escapeHtml(item.patient?.fullName || item.patient?.whatsappPhone || "-")}</td>
          <td>${escapeHtml(item.assignedDoctor?.fullName || "-")}</td>
          <td>${escapeHtml(item.urgencyScore ?? "-")}</td>
          <td>${escapeHtml(triage?.source || "-")}</td>
          <td>${escapeHtml(triage?.route || "-")}</td>
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
  const selected = casesCache.find((item) => item.id === selectedCaseId);
  if (!selected) {
    adminSelectedCaseMeta.innerHTML = `
      <span class="badge">Case ${escapeHtml(selectedCaseId)}</span>
      <span class="badge">Status ${escapeHtml(selectedCaseStatus || "-")}</span>
    `;
    return;
  }

  const triage = getCaseTriage(selected);
  const confidenceBadge = triage && triage.confidence !== null
    ? `${Math.round(triage.confidence * 100)}%`
    : "-";
  const summaryText = String(triage?.summary || selected.aiSummary || "").trim();
  const redFlags = triage?.redFlags?.length ? triage.redFlags.join(", ") : "";

  adminSelectedCaseMeta.innerHTML = `
    <span class="badge">Case ${escapeHtml(selected.id)}</span>
    <span class="badge">Status ${escapeHtml(selected.status || "-")}</span>
    <span class="badge">Patient ${escapeHtml(selected.patient?.fullName || selected.patient?.whatsappPhone || "-")}</span>
    <span class="badge">Doctor ${escapeHtml(selected.assignedDoctor?.fullName || "-")}</span>
    <span class="badge">Triage ${escapeHtml(triage?.source || "HEURISTIC")}</span>
    <span class="badge">Route ${escapeHtml(triage?.route || "-")}</span>
    <span class="badge">Confidence ${escapeHtml(confidenceBadge)}</span>
    ${summaryText ? `<div class="muted" style="margin-top: 8px">${escapeHtml(summaryText)}</div>` : ""}
    ${redFlags ? `<div class="muted" style="margin-top: 4px">Red flags: ${escapeHtml(redFlags)}</div>` : ""}
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

function renderWebhookSummary(summary) {
  if (!summary || !Array.isArray(summary.providers)) {
    adminWebhookSummaryGrid.innerHTML = `<div class="muted">Webhook summary unavailable.</div>`;
    return;
  }

  const cards = [
    {
      label: "Total Webhook Events",
      value: String(summary.totalEvents ?? 0),
      meta: "All time"
    },
    {
      label: `Events Last ${summary.windowHours ?? 24}h`,
      value: String(summary.eventsLastWindow ?? 0),
      meta: "Rolling window"
    },
    {
      label: "Providers",
      value: String(summary.providers.length),
      meta: "Distinct sources"
    },
    ...summary.providers.map((item) => ({
      label: item.provider.toUpperCase(),
      value: `${item.eventsLastWindow} / ${item.totalEvents}`,
      meta: item.lastReceivedAt
        ? `Last: ${formatDateTime(item.lastReceivedAt)}`
        : "Last: -"
    }))
  ];

  adminWebhookSummaryGrid.innerHTML = cards
    .map((card) => {
      return `
        <div class="metric">
          <div class="k">${escapeHtml(card.label)}</div>
          <div class="v">${escapeHtml(card.value)}</div>
          <div class="muted">${escapeHtml(card.meta)}</div>
        </div>
      `;
    })
    .join("");
}

function renderTriageSummary(summary) {
  if (!summary || typeof summary !== "object") {
    adminTriageSummaryGrid.innerHTML = `<div class="muted">Triage summary unavailable.</div>`;
    adminTriageSourceBody.innerHTML = `<tr><td colspan="2" class="muted">No data.</td></tr>`;
    adminTriageRouteBody.innerHTML = `<tr><td colspan="2" class="muted">No data.</td></tr>`;
    adminTriageRedFlagsBody.innerHTML = `<tr><td colspan="2" class="muted">No data.</td></tr>`;
    return;
  }

  const aiCount = Number(summary.sourceCounts?.AI ?? 0);
  const heuristicCount = Number(summary.sourceCounts?.HEURISTIC ?? 0);
  const triagedTotal = aiCount + heuristicCount;
  const aiShare = triagedTotal > 0 ? `${Math.round((aiCount / triagedTotal) * 100)}%` : "0%";
  const confidence = summary.confidenceBands || {};

  const cards = [
    {
      label: "Cases in Window",
      value: String(summary.totalCases ?? 0),
      meta: `Window ${summary.windowHours ?? 24}h`
    },
    {
      label: "Cases with Triage",
      value: String(summary.withTriage ?? 0),
      meta: `Without triage: ${summary.withoutTriage ?? 0}`
    },
    {
      label: "AI Triage Share",
      value: aiShare,
      meta: `${aiCount} AI / ${heuristicCount} heuristic`
    },
    {
      label: "Confidence Bands",
      value: `H${confidence.HIGH ?? 0} M${confidence.MEDIUM ?? 0} L${confidence.LOW ?? 0}`,
      meta: `Unknown: ${confidence.UNKNOWN ?? 0}`
    }
  ];

  adminTriageSummaryGrid.innerHTML = cards
    .map((card) => {
      return `
        <div class="metric">
          <div class="k">${escapeHtml(card.label)}</div>
          <div class="v">${escapeHtml(card.value)}</div>
          <div class="muted">${escapeHtml(card.meta)}</div>
        </div>
      `;
    })
    .join("");

  const sourceRows = [
    { source: "AI", count: aiCount },
    { source: "HEURISTIC", count: heuristicCount }
  ];
  adminTriageSourceBody.innerHTML = sourceRows
    .map((row) => `<tr><td>${escapeHtml(row.source)}</td><td>${escapeHtml(String(row.count))}</td></tr>`)
    .join("");

  const routeRows = Array.isArray(summary.routeCounts) ? summary.routeCounts : [];
  adminTriageRouteBody.innerHTML = routeRows.length
    ? routeRows
        .map(
          (row) =>
            `<tr><td>${escapeHtml(String(row.route || "-"))}</td><td>${escapeHtml(String(row.count ?? 0))}</td></tr>`
        )
        .join("")
    : `<tr><td colspan="2" class="muted">No route data.</td></tr>`;

  const redFlagRows = Array.isArray(summary.topRedFlags) ? summary.topRedFlags : [];
  adminTriageRedFlagsBody.innerHTML = redFlagRows.length
    ? redFlagRows
        .map(
          (row) =>
            `<tr><td>${escapeHtml(String(row.flag || "-"))}</td><td>${escapeHtml(String(row.count ?? 0))}</td></tr>`
        )
        .join("")
    : `<tr><td colspan="2" class="muted">No red flags recorded.</td></tr>`;
}

function renderTriageEvaluation(result) {
  if (!result || !result.triage) {
    adminTriageEvalResult.textContent = "Triage evaluation unavailable.";
    return;
  }

  const triage = result.triage;
  const confidence = Number.isFinite(Number(triage.confidence))
    ? `${Math.round(Number(triage.confidence) * 100)}%`
    : "-";
  const redFlags = Array.isArray(triage.redFlags) && triage.redFlags.length
    ? triage.redFlags.join(", ")
    : "-";
  const transitions = Array.isArray(result.transitions) ? result.transitions : [];
  const transitionText = transitions.length
    ? transitions
        .map((item) => `${item.from || "-"} -> ${item.to || "-"} (${item.reason || "-"})`)
        .join(" | ")
    : "-";

  adminTriageEvalResult.innerHTML = `
    <span class="badge">Source ${escapeHtml(String(triage.source || "-"))}</span>
    <span class="badge">Route ${escapeHtml(String(triage.route || "-"))}</span>
    <span class="badge">Urgency ${escapeHtml(String(triage.urgencyScore ?? "-"))}</span>
    <span class="badge">Baseline ${escapeHtml(String(triage.baselineUrgency ?? "-"))}</span>
    <span class="badge">Confidence ${escapeHtml(confidence)}</span>
    <span class="badge">Final Status ${escapeHtml(String(result.finalStatus || "-"))}</span>
    <div class="muted" style="margin-top: 8px">${escapeHtml(String(triage.summary || "-"))}</div>
    <div class="muted" style="margin-top: 4px">Red flags: ${escapeHtml(redFlags)}</div>
    <div class="muted" style="margin-top: 4px">Transitions: ${escapeHtml(transitionText)}</div>
  `;
}

function getRelayFailedLimit(fallback = 20, max = 50) {
  const failedLimit = Number.parseInt(adminRelayFailedLimit.value, 10);
  if (!Number.isFinite(failedLimit) || failedLimit < 1) {
    return fallback;
  }
  return Math.min(failedLimit, max);
}

function getRelayClearGraceSeconds(fallback = 300) {
  const graceSeconds = Number.parseInt(adminRelayClearGraceSeconds.value, 10);
  if (!Number.isFinite(graceSeconds) || graceSeconds < 0) {
    return fallback;
  }
  return Math.min(graceSeconds, 604800);
}

function getRelayCaseId() {
  return adminRelayCaseId.value.trim();
}

function getRelayFailedNameFilter() {
  const name = adminRelayFailedName.value.trim().toUpperCase();
  return relayJobNames.has(name) ? name : undefined;
}

function normalizeRelayAlertSeverity(value) {
  if (value === "critical") {
    return "critical";
  }
  if (value === "warning") {
    return "warning";
  }
  return "ok";
}

function renderRelayHealth(health) {
  if (!health || !health.counts) {
    adminRelayHealthGrid.innerHTML = `<div class="muted">Relay health unavailable.</div>`;
    adminRelayHealthNote.textContent = "Unable to load relay health.";
    adminRelayAlerts.innerHTML = `<div class="muted">No relay alert data available.</div>`;
    return;
  }

  const alertState = normalizeRelayAlertSeverity(health.alertState);
  const oldestFailedAgeMinutes =
    Number.isFinite(Number(health.oldestFailedAgeMinutes)) && Number(health.oldestFailedAgeMinutes) >= 0
      ? String(Math.floor(Number(health.oldestFailedAgeMinutes)))
      : "-";

  const cards = [
    {
      label: "Dispatch Mode",
      value: String(health.dispatchMode || "-"),
      meta: "inline or queue"
    },
    {
      label: "Queue Enabled",
      value: String(Boolean(health.queueEnabled)),
      meta: "Based on dispatch mode"
    },
    {
      label: "Queue Reachable",
      value: String(Boolean(health.queueReachable)),
      meta: health.redisConfigured ? "Redis configured" : "Redis not configured"
    },
    {
      label: "Pending Jobs",
      value: String(health.counts.totalPending ?? 0),
      meta: "waiting + active + delayed"
    },
    {
      label: "Failed Jobs",
      value: String(health.counts.failed ?? 0),
      meta: "Current failed set"
    },
    {
      label: "Completed Jobs",
      value: String(health.counts.completed ?? 0),
      meta: "Current completed set"
    },
    {
      label: "Alert State",
      value: alertState.toUpperCase(),
      meta: "ok, warning, or critical"
    },
    {
      label: "Oldest Failed (min)",
      value: oldestFailedAgeMinutes,
      meta: "Age of oldest failed relay job"
    }
  ];

  adminRelayHealthGrid.innerHTML = cards
    .map((card) => {
      return `
        <div class="metric">
          <div class="k">${escapeHtml(card.label)}</div>
          <div class="v">${escapeHtml(card.value)}</div>
          <div class="muted">${escapeHtml(card.meta)}</div>
        </div>
      `;
    })
    .join("");

  const alerts = Array.isArray(health.alerts) ? health.alerts : [];
  if (!alerts.length) {
    adminRelayHealthNote.textContent = health.reason || "No active queue alerts.";
    adminRelayAlerts.innerHTML = `<div class="muted">No active queue alerts.</div>`;
    return;
  }

  adminRelayHealthNote.textContent = `${alerts.length} active relay queue alert(s).`;
  adminRelayAlerts.innerHTML = alerts
    .map((alert) => {
      const severity = normalizeRelayAlertSeverity(alert?.severity);
      return `
        <div class="relay-alert-item ${escapeHtml(severity)}">
          <span class="badge ${escapeHtml(severity)}">${escapeHtml(String(severity).toUpperCase())}</span>
          <span>${escapeHtml(String(alert?.message || "Relay queue alert"))}</span>
        </div>
      `;
    })
    .join("");
}

function renderRelayFailedJobs(data) {
  if (!data || !Array.isArray(data.jobs)) {
    adminRelayFailedJobsBody.innerHTML =
      `<tr><td colspan="7" class="muted">Failed relay jobs unavailable.</td></tr>`;
    return;
  }

  if (!data.ok) {
    adminRelayFailedJobsBody.innerHTML = `
      <tr>
        <td colspan="7" class="muted">${escapeHtml(data.reason || "Relay queue unavailable.")}</td>
      </tr>
    `;
    return;
  }

  if (!data.jobs.length) {
    adminRelayFailedJobsBody.innerHTML =
      `<tr><td colspan="7" class="muted">No failed relay jobs for current filters.</td></tr>`;
    return;
  }

  adminRelayFailedJobsBody.innerHTML = data.jobs
    .map((job) => {
      const retryDisabled = !job.jobId || job.jobId === "unknown";
      return `
        <tr>
          <td>${escapeHtml(job.jobId || "unknown")}</td>
          <td>${escapeHtml(job.name || "-")}</td>
          <td>${escapeHtml(job.caseId || "-")}</td>
          <td>${escapeHtml(String(job.attemptsMade ?? 0))}</td>
          <td>${escapeHtml(formatDateTime(job.failedAt))}</td>
          <td>${escapeHtml(job.failedReason || "-")}</td>
          <td>
            <button class="secondary relay-retry-btn" data-job-id="${escapeHtml(job.jobId || "")}" ${retryDisabled ? "disabled" : ""}>Retry</button>
          </td>
        </tr>
      `;
    })
    .join("");

  adminRelayFailedJobsBody.querySelectorAll(".relay-retry-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const jobId = button.getAttribute("data-job-id") || "";
      if (!jobId) {
        return;
      }

      try {
        const result = await retryRelayFailedJob(jobId);
        await refreshRelayDashboard();
        setStatus(
          adminStatusBar,
          result.ok
            ? `Retried relay job ${jobId}.`
            : result.reason || `Unable to retry relay job ${jobId}.`,
          result.ok ? "success" : "error"
        );
      } catch (error) {
        setStatus(adminStatusBar, error.message || "Failed to retry relay job", "error");
      }
    });
  });
}

async function loginAdmin() {
  const email = adminEmailInput.value.trim().toLowerCase();
  const password = adminPasswordInput.value;
  if (!email || !password) {
    throw new Error("Email and password are required");
  }

  const response = await apiRequest("/api/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      role: "ADMIN",
      email,
      password
    })
  });

  adminToken = response.token;
  localStorage.setItem(storageKeys.adminToken, adminToken);
  localStorage.setItem(storageKeys.adminId, response.user.id);
  localStorage.setItem(storageKeys.adminEmail, email);
  adminPasswordInput.value = "";
}

async function loadOverview() {
  const data = await apiRequest("/api/v1/admin/overview", { headers: authHeaders() });
  renderOverview(data);
}

async function loadIntegrationStatus() {
  const data = await apiRequest("/api/v1/admin/integrations/status", { headers: authHeaders() });
  renderIntegrationStatus(data);
}

async function loadDoctors() {
  doctorsCache = await apiRequest("/api/v1/admin/doctors", { headers: authHeaders() });
  renderDoctors(doctorsCache);
  renderDoctorOptions();
}

async function loadAdminUsers() {
  adminUsersCache = await apiRequest("/api/v1/admin/admin-users", { headers: authHeaders() });
  renderAdminUsers(adminUsersCache);
}

async function loadPatients() {
  patientsCache = await apiRequest("/api/v1/admin/patients?limit=200", { headers: authHeaders() });
  renderPatients(patientsCache);
}

async function loadProfile360(entityType, entityId) {
  const normalizedEntityType = String(entityType || "").trim().toUpperCase();
  const normalizedEntityId = String(entityId || "").trim();
  if (!normalizedEntityType || !normalizedEntityId) {
    throw new Error("Entity type and entity ID are required");
  }

  profile360EntityType.value = normalizedEntityType;
  profile360EntityId.value = normalizedEntityId;

  const data = await apiRequest(
    `/api/v1/admin/profile360/${encodeURIComponent(normalizedEntityType)}/${encodeURIComponent(normalizedEntityId)}`,
    { headers: authHeaders() }
  );
  renderProfile360(data);
  return data;
}

async function loadCases() {
  const status = adminCaseStatusFilter.value;
  const limit = adminCaseLimit.value.trim() || "100";
  const triageSource = adminCaseTriageSourceFilter.value;
  const triageRoute = adminCaseTriageRouteFilter.value;
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

async function loadWebhookSummary() {
  const windowHours = Number.parseInt(adminWebhookWindowHours.value, 10);
  const normalizedWindowHours =
    Number.isFinite(windowHours) && windowHours >= 1 && windowHours <= 168 ? windowHours : 24;

  const data = await apiRequest(
    `/api/v1/admin/webhooks/summary?windowHours=${encodeURIComponent(String(normalizedWindowHours))}`,
    { headers: authHeaders() }
  );
  renderWebhookSummary(data);
}

async function loadTriageSummary() {
  const windowHours = Number.parseInt(adminTriageWindowHours.value, 10);
  const normalizedWindowHours =
    Number.isFinite(windowHours) && windowHours >= 1 && windowHours <= 168 ? windowHours : 24;
  const limit = Number.parseInt(adminTriageLimit.value, 10);
  const normalizedLimit = Number.isFinite(limit) && limit >= 1 && limit <= 200 ? limit : 100;

  const data = await apiRequest(
    `/api/v1/admin/triage/summary?windowHours=${encodeURIComponent(String(normalizedWindowHours))}&limit=${encodeURIComponent(String(normalizedLimit))}`,
    { headers: authHeaders() }
  );
  renderTriageSummary(data);
}

async function evaluateTriage() {
  const messageText = adminTriageEvalMessage.value.trim();
  if (!messageText) {
    throw new Error("Sample patient message is required");
  }

  const patientState = adminTriageEvalState.value.trim().toUpperCase();
  const data = await apiRequest("/api/v1/admin/triage/evaluate", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      messageText,
      ...(patientState ? { patientState } : {})
    })
  });
  renderTriageEvaluation(data);
}

async function loadRelayHealth() {
  const normalizedFailedLimit = getRelayFailedLimit(20, 50);

  const data = await apiRequest(
    `/api/v1/admin/relay/health?failedLimit=${encodeURIComponent(String(normalizedFailedLimit))}`,
    { headers: authHeaders() }
  );
  renderRelayHealth(data);
}

async function loadRelayFailedJobs() {
  const query = new URLSearchParams({
    limit: String(getRelayFailedLimit(20, 50))
  });

  const caseId = getRelayCaseId();
  if (caseId) {
    query.set("caseId", caseId);
  }

  const name = getRelayFailedNameFilter();
  if (name) {
    query.set("name", name);
  }

  const data = await apiRequest(`/api/v1/admin/relay/failed?${query.toString()}`, {
    headers: authHeaders()
  });
  renderRelayFailedJobs(data);
}

async function refreshRelayDashboard() {
  await loadRelayHealth();
  await loadRelayFailedJobs();
}

async function retryRelayFailedJob(jobId) {
  return apiRequest(`/api/v1/admin/relay/failed/${encodeURIComponent(jobId)}/retry`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({})
  });
}

async function retryRecentRelayFailedJobs() {
  const normalizedFailedLimit = getRelayFailedLimit(20, 50);
  const caseId = getRelayCaseId();

  return apiRequest("/api/v1/admin/relay/failed/retry", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      limit: normalizedFailedLimit,
      ...(caseId ? { caseId } : {})
    })
  });
}

async function retryRecentWebexRelayFailedJobs() {
  const normalizedFailedLimit = getRelayFailedLimit(20, 50);
  const caseId = getRelayCaseId();

  return apiRequest("/api/v1/admin/relay/failed/retry-webex", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      limit: normalizedFailedLimit,
      ...(caseId ? { caseId } : {})
    })
  });
}

async function retryRecentWhatsAppRelayFailedJobs() {
  const normalizedFailedLimit = getRelayFailedLimit(20, 50);
  const caseId = getRelayCaseId();

  return apiRequest("/api/v1/admin/relay/failed/retry-whatsapp", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      limit: normalizedFailedLimit,
      ...(caseId ? { caseId } : {})
    })
  });
}

async function clearRelayFailedJobs() {
  const normalizedFailedLimit = getRelayFailedLimit(100, 200);
  const normalizedGraceSeconds = getRelayClearGraceSeconds(300);

  return apiRequest("/api/v1/admin/relay/failed/clear", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      limit: normalizedFailedLimit,
      graceSeconds: normalizedGraceSeconds
    })
  });
}

async function injectRelayFailure() {
  const direction = adminRelayInjectDirection.value;
  const caseId = getRelayCaseId();

  return apiRequest("/api/v1/admin/relay/dev/inject-failure", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      direction,
      ...(caseId ? { caseId } : {})
    })
  });
}

async function createDoctor() {
  const body = {
    email: createDoctorEmail.value.trim(),
    fullName: createDoctorName.value.trim(),
    password: createDoctorPassword.value,
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
  createDoctorPassword.value = "";
  createDoctorNpi.value = "";
  createDoctorState.value = "";
  createDoctorSpecialty.value = "";
  createDoctorWebexPersonId.value = "";
}

async function createAdminUser() {
  const body = {
    email: createAdminUserEmail.value.trim(),
    fullName: createAdminUserName.value.trim(),
    password: createAdminUserPassword.value
  };

  await apiRequest("/api/v1/admin/admin-users", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body)
  });

  createAdminUserEmail.value = "";
  createAdminUserName.value = "";
  createAdminUserPassword.value = "";
}

async function createPatient() {
  const dateOfBirth = createPatientDob.value.trim()
    ? parseDateInputToIso(createPatientDob.value)
    : null;

  const body = {
    whatsappPhone: createPatientPhone.value.trim(),
    fullName: createPatientName.value.trim(),
    dateOfBirth,
    email: normalizeNullableInput(createPatientEmail.value),
    address: normalizeNullableInput(createPatientAddress.value),
    emergencyContactName: normalizeNullableInput(createPatientEmergencyContactName.value),
    emergencyContactPhone: normalizeNullableInput(createPatientEmergencyContactPhone.value),
    insuranceProvider: normalizeNullableInput(createPatientInsuranceProvider.value),
    idDocumentUrl: normalizeNullableInput(createPatientIdDocumentUrl.value)
  };

  await apiRequest("/api/v1/admin/patients", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body)
  });

  createPatientPhone.value = "";
  createPatientName.value = "";
  createPatientDob.value = "";
  createPatientEmail.value = "";
  createPatientAddress.value = "";
  createPatientEmergencyContactName.value = "";
  createPatientEmergencyContactPhone.value = "";
  createPatientInsuranceProvider.value = "";
  createPatientIdDocumentUrl.value = "";
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
  if (!adminToken) {
    setStatus(adminStatusBar, "Login to begin.", "error");
    return;
  }

  setStatus(adminStatusBar, "Loading admin workspace...");
  await loadOverview();
  await loadIntegrationStatus();
  await loadDoctors();
  await loadAdminUsers();
  await loadPatients();
  await loadCases();
  await loadCaseMessages();
  await loadWebhookSummary();
  await loadTriageSummary();
  await loadWebhookEvents();
  await refreshRelayDashboard();
  setStatus(adminStatusBar, "Admin portal authenticated.", "success");
}

adminLoginBtn.addEventListener("click", async () => {
  try {
    await loginAdmin();
    await refreshAll();
  } catch (error) {
    setStatus(adminStatusBar, error.message || "Admin login failed", "error");
  }
});

clearAdminSessionBtn.addEventListener("click", () => {
  adminToken = "";
  selectedCaseId = "";
  selectedCaseStatus = "";
  localStorage.removeItem(storageKeys.adminId);
  localStorage.removeItem(storageKeys.adminToken);
  adminPasswordInput.value = "";
  adminOverviewGrid.innerHTML = "";
  adminIntegrationSummaryGrid.innerHTML = "";
  adminIntegrationStatusBody.innerHTML = "";
  adminDoctorsTableBody.innerHTML = "";
  adminUsersTableBody.innerHTML = "";
  adminPatientsTableBody.innerHTML = "";
  adminProfile360Output.innerHTML = "Select a doctor, patient, or admin user to load Profile360.";
  adminProfile360ActivityBody.innerHTML = "";
  adminCasesTableBody.innerHTML = "";
  adminCaseMessagesList.innerHTML = "";
  adminWebhookTableBody.innerHTML = "";
  adminWebhookSummaryGrid.innerHTML = "";
  adminTriageSummaryGrid.innerHTML = "";
  adminTriageSourceBody.innerHTML = "";
  adminTriageRouteBody.innerHTML = "";
  adminTriageRedFlagsBody.innerHTML = "";
  adminTriageEvalResult.textContent = "";
  adminTriageEvalState.value = "OH";
  adminTriageEvalMessage.value = "";
  adminRelayHealthGrid.innerHTML = "";
  adminRelayHealthNote.textContent = "";
  adminRelayAlerts.innerHTML = "";
  adminRelayFailedJobsBody.innerHTML = "";
  adminCaseTriageSourceFilter.value = "";
  adminCaseTriageRouteFilter.value = "";
  adminRelayCaseId.value = "";
  adminRelayFailedName.value = "";
  adminRelayInjectDirection.value = "PATIENT_TO_WEBEX";
  doctorsCache = [];
  casesCache = [];
  adminUsersCache = [];
  patientsCache = [];
  setStatus(adminStatusBar, "Admin session cleared.");
  window.location.href = "/portal/admin-login.html";
});

adminSignOutBtn.addEventListener("click", () => {
  adminToken = "";
  selectedCaseId = "";
  selectedCaseStatus = "";
  localStorage.removeItem(storageKeys.adminId);
  localStorage.removeItem(storageKeys.adminToken);
  window.location.href = "/portal/admin-login.html";
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

createAdminUserBtn.addEventListener("click", async () => {
  try {
    await createAdminUser();
    await loadAdminUsers();
    setStatus(adminStatusBar, "Admin user created.", "success");
  } catch (error) {
    setStatus(adminStatusBar, error.message || "Failed to create admin user", "error");
  }
});

createPatientBtn.addEventListener("click", async () => {
  try {
    await createPatient();
    await loadPatients();
    setStatus(adminStatusBar, "Patient created.", "success");
  } catch (error) {
    setStatus(adminStatusBar, error.message || "Failed to create patient", "error");
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

refreshAdminUsersBtn.addEventListener("click", async () => {
  try {
    await loadAdminUsers();
    setStatus(adminStatusBar, "Admin users refreshed.", "success");
  } catch (error) {
    setStatus(adminStatusBar, error.message || "Failed to refresh admin users", "error");
  }
});

refreshPatientsBtn.addEventListener("click", async () => {
  try {
    await loadPatients();
    setStatus(adminStatusBar, "Patients refreshed.", "success");
  } catch (error) {
    setStatus(adminStatusBar, error.message || "Failed to refresh patients", "error");
  }
});

loadProfile360Btn.addEventListener("click", async () => {
  try {
    await loadProfile360(profile360EntityType.value, profile360EntityId.value);
    setStatus(adminStatusBar, "Profile360 loaded.", "success");
  } catch (error) {
    setStatus(adminStatusBar, error.message || "Failed to load Profile360", "error");
  }
});

refreshIntegrationStatusBtn.addEventListener("click", async () => {
  try {
    await loadIntegrationStatus();
    setStatus(adminStatusBar, "Integration status refreshed.", "success");
  } catch (error) {
    setStatus(adminStatusBar, error.message || "Failed to refresh integration status", "error");
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

refreshWebhookSummaryBtn.addEventListener("click", async () => {
  try {
    await loadWebhookSummary();
    setStatus(adminStatusBar, "Webhook summary refreshed.", "success");
  } catch (error) {
    setStatus(adminStatusBar, error.message || "Failed to refresh webhook summary", "error");
  }
});

refreshTriageSummaryBtn.addEventListener("click", async () => {
  try {
    await loadTriageSummary();
    setStatus(adminStatusBar, "Triage summary refreshed.", "success");
  } catch (error) {
    setStatus(adminStatusBar, error.message || "Failed to refresh triage summary", "error");
  }
});

evaluateTriageBtn.addEventListener("click", async () => {
  try {
    await evaluateTriage();
    setStatus(adminStatusBar, "Triage evaluation complete.", "success");
  } catch (error) {
    setStatus(adminStatusBar, error.message || "Failed to evaluate triage", "error");
  }
});

refreshRelayHealthBtn.addEventListener("click", async () => {
  try {
    await refreshRelayDashboard();
    setStatus(adminStatusBar, "Relay dashboard refreshed.", "success");
  } catch (error) {
    setStatus(adminStatusBar, error.message || "Failed to refresh relay dashboard", "error");
  }
});

refreshRelayFailedJobsBtn.addEventListener("click", async () => {
  try {
    await loadRelayFailedJobs();
    setStatus(adminStatusBar, "Failed relay jobs refreshed.", "success");
  } catch (error) {
    setStatus(adminStatusBar, error.message || "Failed to refresh failed relay jobs", "error");
  }
});

retryRecentRelayFailedBtn.addEventListener("click", async () => {
  try {
    const result = await retryRecentRelayFailedJobs();
    await refreshRelayDashboard();
    setStatus(
      adminStatusBar,
      result.ok
        ? `Retried ${result.retried ?? 0} failed relay jobs (${result.failed ?? 0} failed).`
        : result.reason || `Retried ${result.retried ?? 0} failed relay jobs (${result.failed ?? 0} failed).`,
      result.ok ? "success" : "error"
    );
  } catch (error) {
    setStatus(adminStatusBar, error.message || "Failed to retry recent relay jobs", "error");
  }
});

retryWebexRelayFailedBtn.addEventListener("click", async () => {
  try {
    const result = await retryRecentWebexRelayFailedJobs();
    await refreshRelayDashboard();
    setStatus(
      adminStatusBar,
      result.ok
        ? `Retried ${result.retried ?? 0} Webex relay jobs (${result.failed ?? 0} failed).`
        : result.reason || `Retried ${result.retried ?? 0} Webex relay jobs (${result.failed ?? 0} failed).`,
      result.ok ? "success" : "error"
    );
  } catch (error) {
    setStatus(adminStatusBar, error.message || "Failed to retry Webex relay jobs", "error");
  }
});

retryWhatsAppRelayFailedBtn.addEventListener("click", async () => {
  try {
    const result = await retryRecentWhatsAppRelayFailedJobs();
    await refreshRelayDashboard();
    setStatus(
      adminStatusBar,
      result.ok
        ? `Retried ${result.retried ?? 0} WhatsApp relay jobs (${result.failed ?? 0} failed).`
        : result.reason || `Retried ${result.retried ?? 0} WhatsApp relay jobs (${result.failed ?? 0} failed).`,
      result.ok ? "success" : "error"
    );
  } catch (error) {
    setStatus(adminStatusBar, error.message || "Failed to retry WhatsApp relay jobs", "error");
  }
});

injectRelayFailureBtn.addEventListener("click", async () => {
  try {
    const result = await injectRelayFailure();
    await refreshRelayDashboard();
    setStatus(
      adminStatusBar,
      result.ok
        ? `Injected failed relay job ${result.jobId || ""} (${result.direction || ""}).`
        : result.reason || "Unable to inject relay failure job.",
      result.ok ? "success" : "error"
    );
  } catch (error) {
    setStatus(adminStatusBar, error.message || "Failed to inject relay failure", "error");
  }
});

clearRelayFailedBtn.addEventListener("click", async () => {
  try {
    const result = await clearRelayFailedJobs();
    await refreshRelayDashboard();
    setStatus(
      adminStatusBar,
      result.ok
        ? `Cleared ${result.removedCount ?? 0} failed relay jobs.`
        : result.reason || `Cleared ${result.removedCount ?? 0} failed relay jobs.`,
      result.ok ? "success" : "error"
    );
  } catch (error) {
    setStatus(adminStatusBar, error.message || "Failed to clear failed relay jobs", "error");
  }
});

adminCaseStatusFilter.addEventListener("change", async () => {
  try {
    await loadCases();
  } catch (error) {
    setStatus(adminStatusBar, error.message || "Failed to apply case filter", "error");
  }
});

adminCaseTriageSourceFilter.addEventListener("change", async () => {
  try {
    await loadCases();
  } catch (error) {
    setStatus(adminStatusBar, error.message || "Failed to apply triage source filter", "error");
  }
});

adminCaseTriageRouteFilter.addEventListener("change", async () => {
  try {
    await loadCases();
  } catch (error) {
    setStatus(adminStatusBar, error.message || "Failed to apply triage route filter", "error");
  }
});

adminRelayFailedName.addEventListener("change", async () => {
  try {
    await loadRelayFailedJobs();
  } catch (error) {
    setStatus(adminStatusBar, error.message || "Failed to apply relay failed filter", "error");
  }
});

refreshAll().catch((error) => {
  setStatus(adminStatusBar, error.message || "Unable to initialize admin portal", "error");
});
