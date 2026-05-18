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

    renderApiCalls(apiCalls);

    if (alerts.length === 0) return;

    const bar = document.getElementById("statusBar");
    bar.className = "status danger";
    bar.textContent = `WARNING: ${alerts.length} ransomware pattern(s) detected!`;

    const container = document.getElementById("alertList");
    container.textContent = "";

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
);
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

document.addEventListener("DOMContentLoaded", () => {
  setupTabs();
  refresh();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local") refresh();
  });
});
