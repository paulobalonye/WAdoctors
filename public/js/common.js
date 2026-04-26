export function formatDateTime(value) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleString();
}

export function byId(id) {
  const node = document.getElementById(id);
  if (!node) {
    throw new Error(`Missing element: ${id}`);
  }
  return node;
}

export function setStatus(node, message, tone = "neutral") {
  node.textContent = message;
  node.classList.remove("error", "success");
  if (tone === "error") {
    node.classList.add("error");
  }
  if (tone === "success") {
    node.classList.add("success");
  }
}

export async function apiRequest(path, options = {}) {
  const response = await fetch(path, options);
  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const message = typeof payload === "object" && payload && "error" in payload
      ? payload.error
      : `Request failed (${response.status})`;
    throw new Error(message);
  }

  return payload;
}

export function buildAuthHeaders(role, userId) {
  return {
    "x-user-role": role,
    "x-user-id": userId,
    "content-type": "application/json"
  };
}

export function escapeHtml(text) {
  const value = `${text ?? ""}`;
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
