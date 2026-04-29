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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "PERMISSION_DECISION") {
    chrome.storage.local.get(["decisions", "stats"], (data) => {
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

      chrome.storage.local.set({ decisions, stats });
    });
  }
});
