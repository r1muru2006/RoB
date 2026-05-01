/**
 * Bridge script (ISOLATED world).
 * Forwards postMessage from MAIN-world content.js to chrome.runtime,
 * since chrome.* APIs are unavailable in MAIN world.
 */

console.log("[RoB UI Bridge] loaded (ISOLATED world)");

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const data = event.data;
  if (!data || data.source !== "rob-ui-bridge") return;

  console.log("[RoB UI Bridge] received from MAIN world:", data);

  if (data.type === "PERMISSION_DECISION") {
    // No callback — background doesn't sendResponse, so passing a callback
    // produces a spurious "port closed before response" error.
    chrome.runtime
      .sendMessage({
        type: "PERMISSION_DECISION",
        permissionType: data.permissionType,
        decision: data.decision,
        decisionTimeMs: data.decisionTimeMs,
        directoryName: data.directoryName,
      })
      .then(() => console.log("[RoB UI Bridge] forwarded PERMISSION_DECISION to background"))
      .catch((err) => console.error("[RoB UI Bridge] sendMessage error:", err));
  }
});
