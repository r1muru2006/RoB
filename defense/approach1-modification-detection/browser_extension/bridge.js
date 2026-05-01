/**
 * Bridge script (ISOLATED world).
 * Receives postMessage from MAIN-world content.js and forwards to chrome.runtime,
 * since chrome.* APIs are unavailable in MAIN world.
 */

console.log("[RoB Bridge] loaded (ISOLATED world)");

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const data = event.data;
  if (!data || data.source !== "rob-defender") return;

  console.log("[RoB Bridge] received from MAIN world:", data);

  if (data.type === "ROB_ALERT") {
    chrome.runtime
      .sendMessage({
        type: "ROB_ALERT",
        filename: data.filename,
        entropyChange: data.entropyChange,
        sizeChange: data.sizeChange,
        action: data.action,
      })
      .then(() => console.log("[RoB Bridge] forwarded ROB_ALERT to background"))
      .catch((err) => console.error("[RoB Bridge] sendMessage error:", err));
  }
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
