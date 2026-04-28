import { apiRequest, byId, setStatus } from "./common.js";

const storageKeys = {
  adminId: "wadoctors_admin_id",
  adminToken: "wadoctors_admin_token",
  adminEmail: "wadoctors_admin_email"
};

const adminEmailInput = byId("adminEmailInput");
const adminPasswordInput = byId("adminPasswordInput");
const adminLoginBtn = byId("adminLoginBtn");
const adminStatusBar = byId("adminStatusBar");

function gotoAdminPortal() {
  window.location.href = "/portal/admin.html";
}

if (localStorage.getItem(storageKeys.adminToken)) {
  gotoAdminPortal();
}

adminEmailInput.value = localStorage.getItem(storageKeys.adminEmail) || "";
localStorage.removeItem(storageKeys.adminId);

adminLoginBtn.addEventListener("click", async () => {
  try {
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

    localStorage.setItem(storageKeys.adminToken, response.token);
    localStorage.setItem(storageKeys.adminId, response.user.id);
    localStorage.setItem(storageKeys.adminEmail, email);
    gotoAdminPortal();
  } catch (error) {
    setStatus(adminStatusBar, error.message || "Admin login failed", "error");
  }
});
