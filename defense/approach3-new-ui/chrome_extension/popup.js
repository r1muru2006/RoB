function refresh() {
  chrome.storage.local.get(["decisions", "stats"], (data) => {
    const stats = data.stats || {};
    document.getElementById("readAllowed").textContent = stats.readAllowed || 0;
    document.getElementById("readDenied").textContent = stats.readDenied || 0;
    document.getElementById("writeAllowed").textContent = stats.writeAllowed || 0;
    document.getElementById("writeDenied").textContent = stats.writeDenied || 0;

    renderDecisions(data.decisions || []);
  });
}

function renderDecisions(decisions) {
  const container = document.getElementById("decisionList");
  container.textContent = "";

  if (decisions.length === 0) {
    const empty = document.createElement("div");
    empty.className = "no-data";
    empty.textContent = "No permission decisions recorded yet";
    container.appendChild(empty);
    return;
  }

  for (const decision of decisions.slice(0, 15)) {
    const item = document.createElement("div");
    item.className = "decision-item";

    const left = document.createElement("div");
    left.className = "left";

    const type = document.createElement("strong");
    type.textContent = decision.permissionType === "write" ? "Write" : "Read";

    const directory = document.createTextNode(` ${decision.directoryName || ""} `);

    const timeBadge = document.createElement("span");
    timeBadge.className = "time-badge";
    const time = new Date(decision.timestamp).toLocaleTimeString();
    const duration = decision.decisionTimeMs
      ? ` (${(decision.decisionTimeMs / 1000).toFixed(1)}s)`
      : "";
    timeBadge.textContent = `${time}${duration}`;

    const badge = document.createElement("span");
    const allowed = decision.decision === "allow";
    badge.className = allowed ? "badge badge-allow" : "badge badge-deny";
    badge.textContent = allowed ? "allowed" : "denied";

    left.append(type, directory, timeBadge);
    item.append(left, badge);
    container.appendChild(item);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  refresh();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local") refresh();
  });
});
