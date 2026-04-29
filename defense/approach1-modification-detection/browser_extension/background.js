chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    alerts: [],
    blockedCount: 0,
    allowedCount: 0,
    settings: {
      entropyThreshold: 3.0,
      sizeChangeThreshold: 0.05,
      autoBlock: false,
    },
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "ROB_ALERT") {
    chrome.storage.local.get(["alerts", "blockedCount"], (data) => {
      const alerts = data.alerts || [];
      alerts.unshift({
        timestamp: new Date().toISOString(),
        url: sender.tab?.url || "unknown",
        filename: message.filename,
        entropyChange: message.entropyChange,
        sizeChange: message.sizeChange,
        action: message.action,
      });
      if (alerts.length > 100) alerts.length = 100;

      const update = { alerts };
      if (message.action === "blocked") {
        update.blockedCount = (data.blockedCount || 0) + 1;
      }

      chrome.storage.local.set(update);
    });

    if (sender.tab?.id) {
      chrome.action.setBadgeText({ text: "!", tabId: sender.tab.id });
      chrome.action.setBadgeBackgroundColor({ color: "#e53e3e", tabId: sender.tab.id });
    }
  }

  if (message.type === "ROB_ALLOWED") {
    chrome.storage.local.get(["allowedCount"], (data) => {
      chrome.storage.local.set({ allowedCount: (data.allowedCount || 0) + 1 });
    });
  }
});
