function refresh() {
  chrome.storage.local.get(
    ["alerts", "blockedCount", "allowedCount", "settings"],
    (data) => {
      document.getElementById("blockedCount").textContent = data.blockedCount || 0;
      document.getElementById("allowedCount").textContent = data.allowedCount || 0;

      const settings = data.settings || {};
      const entInput = document.getElementById("entropyThreshold");
      const sizeInput = document.getElementById("sizeThreshold");
      if (document.activeElement !== entInput) {
        entInput.value = settings.entropyThreshold ?? 0.3;
      }
      if (document.activeElement !== sizeInput) {
        sizeInput.value = (settings.sizeChangeThreshold ?? 0.01) * 100;
      }

      renderAlerts(data.alerts || []);
    }
  );
}

document.addEventListener("DOMContentLoaded", () => {
  refresh();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local") refresh();
  });

  document.getElementById("saveSettings").addEventListener("click", () => {
    const entropyThreshold = parseFloat(
      document.getElementById("entropyThreshold").value
    );
    const sizeChangeThreshold =
      parseFloat(document.getElementById("sizeThreshold").value) / 100;

    chrome.storage.local.set({
      settings: { entropyThreshold, sizeChangeThreshold },
    });

    const btn = document.getElementById("saveSettings");
    btn.textContent = "Saved!";
    setTimeout(() => {
      btn.textContent = "Save Settings";
    }, 1500);
  });
});

function renderAlerts(alerts) {
  const container = document.getElementById("alertList");
  container.textContent = "";

  if (alerts.length === 0) {
    const empty = document.createElement("div");
    empty.className = "no-alerts";
    empty.textContent = "No alerts yet";
    container.appendChild(empty);
    return;
  }

  for (const alert of alerts.slice(0, 20)) {
    const item = document.createElement("div");
    item.className = alert.action === "blocked"
      ? "alert-item"
      : "alert-item allowed-alert";

    const actionText = alert.action === "blocked" ? "BLOCKED" : "ALLOWED BY USER";
    const filename = document.createElement("div");
    filename.className = "alert-filename";
    filename.textContent = `${alert.filename || "unknown"} - ${actionText}`;

    const details = document.createElement("div");
    details.className = "alert-details";
    const entropyChange = Number(alert.entropyChange) || 0;
    const sizeChange = Number(alert.sizeChange) || 0;
    details.textContent = `Entropy: +${entropyChange.toFixed(2)} | Size: ${(sizeChange * 100).toFixed(2)}%`;

    const time = document.createElement("div");
    time.className = "alert-time";
    time.textContent = `${new Date(alert.timestamp).toLocaleString()} | ${alert.url || "unknown"}`;

    item.append(filename, details, time);
    container.appendChild(item);
  }
}
