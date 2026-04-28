import { apiRequest, byId, setStatus } from "./common.js";

const storageKeys = {
  doctorId: "wadoctors_doctor_id",
  doctorToken: "wadoctors_doctor_token",
  doctorEmail: "wadoctors_doctor_email"
};

const doctorEmailInput = byId("doctorEmailInput");
const doctorPasswordInput = byId("doctorPasswordInput");
const doctorLoginBtn = byId("doctorLoginBtn");
const doctorIdInput = byId("doctorIdInput");
const saveDoctorSessionBtn = byId("saveDoctorSessionBtn");
const doctorStatusBar = byId("doctorStatusBar");

function gotoDoctorPortal() {
  window.location.href = "/portal/doctor.html";
}

if (localStorage.getItem(storageKeys.doctorToken) || localStorage.getItem(storageKeys.doctorId)) {
  gotoDoctorPortal();
}

doctorEmailInput.value = localStorage.getItem(storageKeys.doctorEmail) || "";
doctorIdInput.value = localStorage.getItem(storageKeys.doctorId) || "";

doctorLoginBtn.addEventListener("click", async () => {
  try {
    const email = doctorEmailInput.value.trim().toLowerCase();
    const password = doctorPasswordInput.value;
    if (!email || !password) {
      throw new Error("Email and password are required");
    }

    const response = await apiRequest("/api/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        role: "DOCTOR",
        email,
        password
      })
    });

    localStorage.setItem(storageKeys.doctorToken, response.token);
    localStorage.setItem(storageKeys.doctorId, response.user.id);
    localStorage.setItem(storageKeys.doctorEmail, email);
    gotoDoctorPortal();
  } catch (error) {
    setStatus(doctorStatusBar, error.message || "Doctor login failed", "error");
  }
});

saveDoctorSessionBtn.addEventListener("click", () => {
  const doctorId = doctorIdInput.value.trim();
  if (!doctorId) {
    setStatus(doctorStatusBar, "Doctor ID is required", "error");
    return;
  }

  localStorage.removeItem(storageKeys.doctorToken);
  localStorage.setItem(storageKeys.doctorId, doctorId);
  gotoDoctorPortal();
});
