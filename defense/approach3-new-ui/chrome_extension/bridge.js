/**
 * Bridge script (ISOLATED world).
 * Forwards postMessage from MAIN-world content.js to chrome.runtime,
 * since chrome.* APIs are unavailable in MAIN world.
 */

console.log("[RoB UI Bridge] loaded (ISOLATED world)");

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function sanitizeDecision(data) {
  if (!data || data.source !== "rob-ui-bridge" || data.type !== "PERMISSION_DECISION") {
    return null;
  }

  const permissionType = data.permissionType === "write" ? "write" : "read";
  const decision = data.decision === "deny" ? "deny" : "allow";

  return {
    type: "PERMISSION_DECISION",
    permissionType,
    decision,
    decisionTimeMs: isFiniteNumber(data.decisionTimeMs) ? data.decisionTimeMs : 0,
    directoryName: String(data.directoryName || "unknown"),
  };
}

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const message = sanitizeDecision(event.data);
  if (!message) return;

  console.log("[RoB UI Bridge] received from MAIN world:", message);

  chrome.runtime
    .sendMessage(message)
    .then(() => console.log("[RoB UI Bridge] forwarded PERMISSION_DECISION to background"))
    .catch((err) => console.error("[RoB UI Bridge] sendMessage error:", err));
});
