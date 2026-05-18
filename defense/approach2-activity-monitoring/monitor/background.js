chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    activityLog: [],
    apiCalls: [],
    alerts: [],
    totalApiCalls: 0,
    settings: {
      windowSize: 50,
      similarityThreshold: 0.7,
    },
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "API_CALL") {
    chrome.storage.local.get(["apiCalls", "totalApiCalls"], (data) => {
      const apiCalls = data.apiCalls || [];
      apiCalls.unshift({
        timestamp: new Date().toISOString(),
        url: sender.tab?.url || "unknown",
        tabId: sender.tab?.id,
        call: message.call,
      });
      if (apiCalls.length > 200) apiCalls.length = 200;

      chrome.storage.local.set({
        apiCalls,
        totalApiCalls: (data.totalApiCalls || 0) + 1,
      });
    });
  }

  if (message.type === "ACTIVITY_LOG") {
    chrome.storage.local.get(["activityLog", "totalApiCalls"], (data) => {
      const log = data.activityLog || [];
      log.push({
        timestamp: new Date().toISOString(),
        url: sender.tab?.url || "unknown",
        tabId: sender.tab?.id,
        calls: message.calls,
        analysis: message.analysis,
      });
      if (log.length > 500) log.splice(0, log.length - 500);

      chrome.storage.local.set({
        activityLog: log,
      });
    });
  }

  if (message.type === "RANSOMWARE_ALERT") {
    chrome.storage.local.get(["alerts"], (data) => {
      const alerts = data.alerts || [];
      alerts.unshift({
        timestamp: new Date().toISOString(),
        url: sender.tab?.url || "unknown",
        similarity: message.similarity,
        pattern: message.pattern,
        callCount: message.callCount,
      });
      if (alerts.length > 50) alerts.length = 50;
      chrome.storage.local.set({ alerts });
    });

    if (sender.tab?.id) {
      chrome.action.setBadgeText({ text: "!", tabId: sender.tab.id });
      chrome.action.setBadgeBackgroundColor({ color: "#e53e3e", tabId: sender.tab.id });
    }
  }
});
