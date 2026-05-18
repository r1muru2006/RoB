/**
 * Bridge script (ISOLATED world).
 * Receives postMessage from MAIN-world content.js and forwards to chrome.runtime,
 * since chrome.* APIs are unavailable in MAIN world.
 */

console.log("[RoB Bridge] loaded (ISOLATED world)");

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function sanitizeAlert(data) {
  if (!data || data.source !== "rob-defender" || data.type !== "ROB_ALERT") {
    return null;
  }

  return {
    type: "ROB_ALERT",
    filename: String(data.filename || "unknown"),
    entropyChange: isFiniteNumber(data.entropyChange) ? data.entropyChange : 0,
    sizeChange: isFiniteNumber(data.sizeChange) ? data.sizeChange : 0,
    action: data.action === "blocked" ? "blocked" : "allowed_by_user",
  };
}

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const message = sanitizeAlert(event.data);
  if (!message) return;

  console.log("[RoB Bridge] received from MAIN world:", message);

  chrome.runtime
    .sendMessage(message)
    .then(() => console.log("[RoB Bridge] forwarded ROB_ALERT to background"))
    .catch((err) => console.error("[RoB Bridge] sendMessage error:", err));
});

chrome.storage.local.get(["settings"], (data) => {
  window.postMessage(
    { source: "rob-defender-bridge", type: "SETTINGS", settings: data.settings || {} },
    "*"
  );
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.settings) {
    window.postMessage(
      {
        source: "rob-defender-bridge",
        type: "SETTINGS",
        settings: changes.settings.newValue || {},
      },
      "*"
    );
  }
});
