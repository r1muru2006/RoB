/**
 * Bridge script (ISOLATED world).
 * Forwards postMessage from MAIN-world content.js to chrome.runtime,
 * since chrome.* APIs are unavailable in MAIN world.
 */

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const data = event.data;
  if (!data || data.source !== "rob-ui-bridge") return;

  if (data.type === "PERMISSION_DECISION") {
    chrome.runtime.sendMessage({
      type: "PERMISSION_DECISION",
      permissionType: data.permissionType,
      decision: data.decision,
      decisionTimeMs: data.decisionTimeMs,
      directoryName: data.directoryName,
    });
  }
});
