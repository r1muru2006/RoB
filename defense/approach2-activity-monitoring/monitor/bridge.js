/**
 * Isolated-world bridge for the MAIN-world FSA hook.
 * Extension APIs are available here, so only validated monitor messages are
 * forwarded to the service worker.
 */
(() => {
  const ALLOWED_TYPES = new Set(["ACTIVITY_LOG", "RANSOMWARE_ALERT"]);

  function isPlainObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function sanitizeMessage(data) {
    if (!isPlainObject(data) || data.source !== "rob-activity-monitor") {
      return null;
    }

    if (!ALLOWED_TYPES.has(data.type)) {
      return null;
    }

    if (data.type === "ACTIVITY_LOG") {
      return {
        type: data.type,
        calls: Array.isArray(data.calls) ? data.calls.slice(-10).map(String) : [],
        analysis: isPlainObject(data.analysis) ? data.analysis : {},
      };
    }

    return {
      type: data.type,
      similarity: Number(data.similarity) || 0,
      pattern: isPlainObject(data.pattern) ? data.pattern : {},
      callCount: Number(data.callCount) || 0,
    };
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;

    const message = sanitizeMessage(event.data);
    if (!message) return;

    chrome.runtime.sendMessage(message).catch(() => {});
  });
})();
