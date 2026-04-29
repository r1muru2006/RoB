document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get(
    ["alerts", "blockedCount", "allowedCount", "settings"],
    (data) => {
      document.getElementById("blockedCount").textContent = data.blockedCount || 0;
      document.getElementById("allowedCount").textContent = data.allowedCount || 0;

      const settings = data.settings || {};
      document.getElementById("entropyThreshold").value = settings.entropyThreshold || 3.0;
      document.getElementById("sizeThreshold").value =
        (settings.sizeChangeThreshold || 0.05) * 100;

      renderAlerts(data.alerts || []);
    }
  );

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

  if (alerts.length === 0) {
    container.innerHTML = '<div class="no-alerts">No alerts yet</div>';
    return;
  }

  container.innerHTML = alerts
    .slice(0, 20)
    .map((alert) => {
      const cssClass =
        alert.action === "blocked" ? "" : " allowed-alert";
      const actionText =
        alert.action === "blocked" ? "BLOCKED" : "ALLOWED BY USER";
      const time = new Date(alert.timestamp).toLocaleString();
      return `
      <div class="alert-item${cssClass}">
        <div class="alert-filename">${escapeHtml(alert.filename)} - ${actionText}</div>
        <div class="alert-details">
          Entropy: +${alert.entropyChange.toFixed(2)} | Size: ${(alert.sizeChange * 100).toFixed(2)}%
        </div>
        <div class="alert-time">${time} | ${escapeHtml(alert.url)}</div>
      </div>
    `;
    })
    .join("");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
