chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    decisions: [],
    stats: {
      readAllowed: 0,
      readDenied: 0,
      writeAllowed: 0,
      writeDenied: 0,
    },
  });
});

async function handleDecision(message, sender) {
  const data = await chrome.storage.local.get(["decisions", "stats"]);
  const decisions = data.decisions || [];
  const stats = data.stats || {
    readAllowed: 0, readDenied: 0,
    writeAllowed: 0, writeDenied: 0,
  };

  decisions.unshift({
    timestamp: new Date().toISOString(),
    url: sender.tab?.url || "unknown",
    permissionType: message.permissionType,
    decision: message.decision,
    decisionTimeMs: message.decisionTimeMs,
    directoryName: message.directoryName,
  });
  if (decisions.length > 200) decisions.length = 200;

  const key = `${message.permissionType}${message.decision === "allow" ? "Allowed" : "Denied"}`;
  if (stats[key] !== undefined) stats[key]++;

  await chrome.storage.local.set({ decisions, stats });
  console.log("[RoB UI BG] persisted decision; new stats:", stats);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("[RoB UI BG] received message:", message);
  if (message.type === "PERMISSION_DECISION") {
    handleDecision(message, sender)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => {
        console.error("[RoB UI BG] handleDecision error:", err);
        sendResponse({ ok: false, error: String(err) });
      });
    return true; // keep the message channel open for async sendResponse
  }
  return false;
});
