function defaultState(settings = {}) {
  return {
    alerts: [],
    recentEvents: [],
    blockedCount: 0,
    allowedCount: 0,
    observedCount: 0,
    analyzedCount: 0,
    settings: {
      entropyThreshold: 0.3,
      sizeChangeThreshold: 0.01,
      autoBlock: false,
      ...settings,
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

async function handleAlert(message, sender) {
  const data = await chrome.storage.local.get([
    "alerts",
    "blockedCount",
    "allowedCount",
  ]);

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
  } else if (message.action === "allowed_by_user") {
    update.allowedCount = (data.allowedCount || 0) + 1;
  }

  await chrome.storage.local.set(update);
  console.log("[RoB BG] persisted alert; counters:", {
    blocked: update.blockedCount ?? data.blockedCount ?? 0,
    allowed: update.allowedCount ?? data.allowedCount ?? 0,
  });

  if (sender.tab?.id) {
    chrome.action.setBadgeText({ text: "!", tabId: sender.tab.id });
    chrome.action.setBadgeBackgroundColor({
      color: "#e53e3e",
      tabId: sender.tab.id,
    });
  }
}

async function handleEvent(message, sender) {
  const data = await chrome.storage.local.get([
    "recentEvents",
    "observedCount",
    "analyzedCount",
  ]);

  const recentEvents = data.recentEvents || [];
  recentEvents.unshift({
    timestamp: new Date().toISOString(),
    url: sender.tab?.url || "unknown",
    event: message.event,
    filename: message.filename,
    directoryName: message.directoryName,
    size: message.size,
    entropyChange: message.entropyChange,
    sizeChange: message.sizeChange,
    absoluteSizeChange: message.absoluteSizeChange,
    malicious: message.malicious,
  });
  if (recentEvents.length > 100) recentEvents.length = 100;

  const update = { recentEvents };
  if (["file_cached", "write_intercepted", "write_no_cache"].includes(message.event)) {
    update.observedCount = (data.observedCount || 0) + 1;
  }
  if (message.event === "write_analyzed") {
    update.analyzedCount = (data.analyzedCount || 0) + 1;
  }

  await chrome.storage.local.set(update);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("[RoB BG] received message:", message);
  if (message.type === "ROB_EVENT") {
    enqueueStorageUpdate(() => handleEvent(message, sender))
      .then(() => sendResponse({ ok: true }))
      .catch((err) => {
        console.error("[RoB BG] handleEvent error:", err);
        sendResponse({ ok: false, error: String(err) });
      });
    return true;
  }

  if (message.type === "ROB_ALERT") {
    enqueueStorageUpdate(() => handleAlert(message, sender))
      .then(() => sendResponse({ ok: true }))
      .catch((err) => {
        console.error("[RoB BG] handleAlert error:", err);
        sendResponse({ ok: false, error: String(err) });
      });
    return true; // keep the message channel open for async sendResponse
  }

  if (message.type === "CLEAR_ROB_DEFENDER") {
    enqueueStorageUpdate(async () => {
      const data = await chrome.storage.local.get(["settings"]);
      await chrome.storage.local.set(defaultState(data.settings || {}));
      await chrome.action.setBadgeText({ text: "" });
    })
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }

  return false;
});
