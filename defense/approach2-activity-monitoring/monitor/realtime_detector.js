/**
 * Real-time FSA API activity monitor.
 * Hooks FSA API calls, builds 2-gram frequency vectors in a sliding window,
 * and compares them against known malicious patterns.
 */

(() => {
  const WINDOW_SIZE = 50;
  const SIMILARITY_THRESHOLD = 0.7;

  const MALICIOUS_PATTERN = {
    "getFile -> createWritable": 0.25,
    "createWritable -> write": 0.25,
    "write -> close": 0.25,
    "close -> getFile": 0.25,
  };

  const callHistory = [];
  let lastAnalysisTime = 0;
  const ANALYSIS_INTERVAL = 2000;
  const HOOKED = Symbol.for("rob.activityMonitorHooked");
  let retryCount = 0;

  function sendToExtension(message) {
    window.postMessage(
      {
        source: "rob-activity-monitor",
        ...message,
      },
      "*"
    );
  }

  function record(fnName) {
    callHistory.push({ fn: fnName, ts: Date.now() });
    if (callHistory.length > WINDOW_SIZE * 2) {
      callHistory.splice(0, callHistory.length - WINDOW_SIZE * 2);
    }
    sendToExtension({
      type: "API_CALL",
      call: fnName,
    });
    throttledAnalysis();
  }

  function computeNgrams(calls, n) {
    const freq = {};
    let total = 0;
    for (let i = 0; i <= calls.length - n; i++) {
      const gram = calls.slice(i, i + n).join(" -> ");
      freq[gram] = (freq[gram] || 0) + 1;
      total++;
    }
    if (total > 0) {
      for (const key in freq) freq[key] /= total;
    }
    return freq;
  }

  function cosineSimilarity(vecA, vecB) {
    const allKeys = new Set([...Object.keys(vecA), ...Object.keys(vecB)]);
    let dot = 0, magA = 0, magB = 0;
    for (const key of allKeys) {
      const a = vecA[key] || 0;
      const b = vecB[key] || 0;
      dot += a * b;
      magA += a * a;
      magB += b * b;
    }
    if (magA === 0 || magB === 0) return 0;
    return dot / (Math.sqrt(magA) * Math.sqrt(magB));
  }

  function analyzeActivity() {
    const recentCalls = callHistory.slice(-WINDOW_SIZE).map((c) => c.fn);
    if (recentCalls.length < 10) return;

    const currentPattern = computeNgrams(recentCalls, 2);
    const similarity = cosineSimilarity(currentPattern, MALICIOUS_PATTERN);

    let getFileCount = 0;
    for (const call of recentCalls) {
      if (call === "getFile") getFileCount++;
    }

    const isRansomwareLike =
      similarity > SIMILARITY_THRESHOLD && getFileCount > 5;

    if (isRansomwareLike) {
      console.warn(
        `[RoB Activity Monitor] RANSOMWARE PATTERN DETECTED!\n` +
        `Similarity to RoB: ${(similarity * 100).toFixed(1)}%\n` +
        `Recent API calls: ${recentCalls.length}\n` +
        `getFile calls: ${getFileCount}`
      );

      sendToExtension({
        type: "RANSOMWARE_ALERT",
        similarity,
        pattern: currentPattern,
        callCount: recentCalls.length,
      });
    }

    sendToExtension({
      type: "ACTIVITY_LOG",
      calls: recentCalls.slice(-10),
      analysis: { similarity, getFileCount, isRansomwareLike },
    });
  }

  function throttledAnalysis() {
    const now = Date.now();
    if (now - lastAnalysisTime < ANALYSIS_INTERVAL) return;
    lastAnalysisTime = now;
    analyzeActivity();
  }

  function hookFunction(obj, name, displayName) {
    if (!obj) return false;
    const orig = obj[name];
    if (!orig || orig[HOOKED]) return Boolean(orig);

    obj[name] = function (...args) {
      record(displayName || name);
      return orig.apply(this, args);
    };
    obj[name][HOOKED] = true;
    return true;
  }

  function installHooks() {
    let installed = 0;

    if (hookFunction(window, "showDirectoryPicker")) installed++;
    if (hookFunction(window, "showOpenFilePicker")) installed++;
    if (hookFunction(window, "showSaveFilePicker")) installed++;

    if (typeof FileSystemFileHandle !== "undefined") {
      if (hookFunction(FileSystemFileHandle.prototype, "getFile")) installed++;
      if (hookFunction(FileSystemFileHandle.prototype, "createWritable")) installed++;
    }

    if (typeof FileSystemDirectoryHandle !== "undefined") {
      if (hookFunction(FileSystemDirectoryHandle.prototype, "getFileHandle")) installed++;
      if (hookFunction(FileSystemDirectoryHandle.prototype, "getDirectoryHandle")) installed++;
      if (hookFunction(FileSystemDirectoryHandle.prototype, "removeEntry")) installed++;
      if (hookFunction(FileSystemDirectoryHandle.prototype, "resolve")) installed++;
      if (hookFunction(FileSystemDirectoryHandle.prototype, "values")) installed++;
      if (hookFunction(FileSystemDirectoryHandle.prototype, "keys")) installed++;
      if (hookFunction(FileSystemDirectoryHandle.prototype, "entries")) installed++;
    }

    if (typeof FileSystemWritableFileStream !== "undefined") {
      if (hookFunction(FileSystemWritableFileStream.prototype, "write")) installed++;
      if (hookFunction(FileSystemWritableFileStream.prototype, "seek")) installed++;
      if (hookFunction(FileSystemWritableFileStream.prototype, "truncate")) installed++;
      if (hookFunction(FileSystemWritableFileStream.prototype, "close")) installed++;
    }

    if (installed > 0) {
      console.log(`[RoB Activity Monitor] hooks installed/verified: ${installed}`);
    }

    return installed;
  }

  installHooks();
  const retryTimer = window.setInterval(() => {
    retryCount++;
    const installed = installHooks();
    if (installed >= 10 || retryCount >= 80) {
      window.clearInterval(retryTimer);
    }
  }, 250);

  console.log("[RoB Activity Monitor] FSA API monitoring active");
})();
