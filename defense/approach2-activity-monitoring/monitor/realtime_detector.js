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

  function record(fnName) {
    callHistory.push({ fn: fnName, ts: Date.now() });
    if (callHistory.length > WINDOW_SIZE * 2) {
      callHistory.splice(0, callHistory.length - WINDOW_SIZE * 2);
    }
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

    const uniqueFiles = new Set();
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

      try {
        chrome.runtime?.sendMessage({
          type: "RANSOMWARE_ALERT",
          similarity,
          pattern: currentPattern,
          callCount: recentCalls.length,
        });
      } catch (e) {}

      window.postMessage(
        {
          source: "rob-activity-monitor",
          type: "ransomware-detected",
          similarity,
          callCount: recentCalls.length,
        },
        "*"
      );
    }

    try {
      chrome.runtime?.sendMessage({
        type: "ACTIVITY_LOG",
        calls: recentCalls.slice(-10),
        analysis: { similarity, getFileCount, isRansomwareLike },
      });
    } catch (e) {}
  }

  function throttledAnalysis() {
    const now = Date.now();
    if (now - lastAnalysisTime < ANALYSIS_INTERVAL) return;
    lastAnalysisTime = now;
    analyzeActivity();
  }

  function hookFunction(obj, name, displayName) {
    const orig = obj[name];
    if (!orig) return;
    obj[name] = function (...args) {
      record(displayName || name);
      return orig.apply(this, args);
    };
  }

  if (window.showDirectoryPicker) {
    hookFunction(window, "showDirectoryPicker");
  }
  if (window.showOpenFilePicker) {
    hookFunction(window, "showOpenFilePicker");
  }
  if (window.showSaveFilePicker) {
    hookFunction(window, "showSaveFilePicker");
  }

  if (typeof FileSystemFileHandle !== "undefined") {
    hookFunction(FileSystemFileHandle.prototype, "getFile");
    hookFunction(FileSystemFileHandle.prototype, "createWritable");
  }

  if (typeof FileSystemDirectoryHandle !== "undefined") {
    hookFunction(FileSystemDirectoryHandle.prototype, "getFileHandle");
    hookFunction(FileSystemDirectoryHandle.prototype, "getDirectoryHandle");
    hookFunction(FileSystemDirectoryHandle.prototype, "removeEntry");
    hookFunction(FileSystemDirectoryHandle.prototype, "resolve");
    hookFunction(FileSystemDirectoryHandle.prototype, "values");
    hookFunction(FileSystemDirectoryHandle.prototype, "keys");
    hookFunction(FileSystemDirectoryHandle.prototype, "entries");
  }

  if (typeof FileSystemWritableFileStream !== "undefined") {
    hookFunction(FileSystemWritableFileStream.prototype, "write");
    hookFunction(FileSystemWritableFileStream.prototype, "seek");
    hookFunction(FileSystemWritableFileStream.prototype, "truncate");
    hookFunction(FileSystemWritableFileStream.prototype, "close");
  }

  console.log("[RoB Activity Monitor] FSA API monitoring active");
})();
