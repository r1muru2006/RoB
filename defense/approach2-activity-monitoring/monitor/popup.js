function refresh() {
  chrome.storage.local.get(
    ["alerts", "apiCalls", "totalApiCalls", "activityLog"],
    (data) => {
      const alerts = data.alerts || [];
      const apiCalls = data.apiCalls || [];
      const total = data.totalApiCalls || 0;
      const log = data.activityLog || [];

      document.getElementById("totalCalls").textContent = total;
      document.getElementById("alertCount").textContent = alerts.length;
      document.getElementById("tabCount").textContent = log.length;

      renderAlerts(alerts);
      renderApiCalls(apiCalls);
    }
  );
}

function renderAlerts(alerts) {
  const bar = document.getElementById("statusBar");
  const container = document.getElementById("alertList");
  container.textContent = "";

  if (alerts.length === 0) {
    bar.className = "status safe";
    bar.textContent = "Monitoring active - No threats detected";

    const empty = document.createElement("div");
    empty.className = "no-alerts";
    empty.textContent = "No ransomware patterns detected";
    container.appendChild(empty);
    return;
  }

  bar.className = "status danger";
  bar.textContent = `WARNING: ${alerts.length} ransomware pattern(s) detected!`;

  for (const alert of alerts.slice(0, 10)) {
    const item = document.createElement("div");
    item.className = "alert-item";

    const title = document.createElement("div");
    title.className = "title";
    const similarity = Number(alert.similarity) || 0;
    title.textContent = `Ransomware Pattern Detected (${(similarity * 100).toFixed(1)}% match)`;

    const url = document.createElement("div");
    url.className = "detail";
    url.textContent = alert.url || "unknown";

    const detail = document.createElement("div");
    detail.className = "detail";
    const time = new Date(alert.timestamp).toLocaleString();
    const callCount = Number(alert.callCount) || 0;
    detail.textContent = `${time} | ${callCount} API calls in window`;

    item.append(title, url, detail);
    container.appendChild(item);
  }
}

function renderApiCalls(apiCalls) {
  const container = document.getElementById("callList");
  container.textContent = "";

  if (apiCalls.length === 0) {
    const empty = document.createElement("div");
    empty.className = "no-alerts";
    empty.textContent = "No API calls recorded yet";
    container.appendChild(empty);
    return;
  }

  for (const call of apiCalls.slice(0, 80)) {
    const item = document.createElement("div");
    item.className = "call-item";

    const name = document.createElement("div");
    name.className = "call-name";
    name.textContent = call.call || "unknown";

    const meta = document.createElement("div");
    meta.className = "call-meta";
    const time = new Date(call.timestamp).toLocaleTimeString();
    meta.title = call.url || "unknown";
    meta.textContent = `${time} | ${shortUrl(call.url)}`;

    item.append(name, meta);
    container.appendChild(item);
  }
}

function shortUrl(url) {
  if (!url || url === "unknown") return "unknown";
  try {
    const parsed = new URL(url);
    return parsed.host || url;
  } catch (e) {
    return url;
  }
}

function setupTabs() {
  const buttons = document.querySelectorAll(".tab-button");
  for (const button of buttons) {
    button.addEventListener("click", () => {
      for (const other of buttons) {
        other.classList.toggle("active", other === button);
        document.getElementById(other.dataset.panel).hidden = other !== button;
      }
    });
  }
}

function setupActions() {
  document.getElementById("clearData").addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "CLEAR_ACTIVITY_MONITOR" }, () => {
      refresh();
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupTabs();
  setupActions();
  refresh();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local") refresh();
  });
});
