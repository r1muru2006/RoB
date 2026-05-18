function defaultState() {
  return {
    activityLog: [],
    apiCalls: [],
    alerts: [],
    totalApiCalls: 0,
    settings: {
      windowSize: 50,
      similarityThreshold: 0.7,
    },
  };
}

let storageQueue = Promise.resolve();

function enqueueStorageUpdate(updateFn) {
  storageQueue = storageQueue.then(updateFn, updateFn);
  return storageQueue;
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set(defaultState());
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "API_CALL") {
    enqueueStorageUpdate(async () => {
      const data = await chrome.storage.local.get(["apiCalls", "totalApiCalls"]);
      const apiCalls = data.apiCalls || [];
      apiCalls.unshift({
        timestamp: new Date().toISOString(),
        url: sender.tab?.url || "unknown",
        tabId: sender.tab?.id,
        call: message.call,
      });
      if (apiCalls.length > 200) apiCalls.length = 200;

      await chrome.storage.local.set({
        apiCalls,
        totalApiCalls: (data.totalApiCalls || 0) + 1,
      });
    });
  }

  if (message.type === "ACTIVITY_LOG") {
    enqueueStorageUpdate(async () => {
      const data = await chrome.storage.local.get(["activityLog"]);
      const log = data.activityLog || [];
      log.push({
        timestamp: new Date().toISOString(),
        url: sender.tab?.url || "unknown",
        tabId: sender.tab?.id,
        calls: message.calls,
        analysis: message.analysis,
      });
      if (log.length > 500) log.splice(0, log.length - 500);

      await chrome.storage.local.set({ activityLog: log });
    });
  }

  if (message.type === "RANSOMWARE_ALERT") {
    enqueueStorageUpdate(async () => {
      const data = await chrome.storage.local.get(["alerts"]);
      const alerts = data.alerts || [];
      alerts.unshift({
        timestamp: new Date().toISOString(),
        url: sender.tab?.url || "unknown",
        similarity: message.similarity,
        pattern: message.pattern,
        callCount: message.callCount,
      });
      if (alerts.length > 50) alerts.length = 50;
      await chrome.storage.local.set({ alerts });
    });

    if (sender.tab?.id) {
      chrome.action.setBadgeText({ text: "!", tabId: sender.tab.id });
      chrome.action.setBadgeBackgroundColor({ color: "#e53e3e", tabId: sender.tab.id });
    }
  }

  if (message.type === "CLEAR_ACTIVITY_MONITOR") {
    enqueueStorageUpdate(async () => {
      const data = await chrome.storage.local.get(["settings"]);
      await chrome.storage.local.set({
        ...defaultState(),
        settings: data.settings || defaultState().settings,
      });
      await chrome.action.setBadgeText({ text: "" });
    })
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }

  return false;
});
