/**
 * Entropy and file size change detection logic.
 * Runs in MAIN world to access FSA API objects directly.
 */

const RoBDetector = (() => {
  // Per-file-type entropy thresholds derived from paper §6.1 Table.
  // Benign mods average ~0.05 entropy change across all types.
  // Malicious encryption averages: txt 3.5, docx 0.60, jpeg 0.60, xlsx 0.10, pdf 0.10.
  // Threshold = midpoint biased toward malicious side.
  const ENTROPY_THRESHOLDS = {
    txt:  1.0,
    md:   1.0,
    csv:  1.0,
    json: 1.0,
    html: 1.0,
    docx: 0.3,
    jpeg: 0.3,
    jpg:  0.3,
    png:  0.3,
    xlsx: 0.08,
    pdf:  0.08,
  };

  function getExtension(filename) {
    if (!filename) return "";
    const idx = filename.lastIndexOf(".");
    return idx === -1 ? "" : filename.slice(idx + 1).toLowerCase();
  }

  function thresholdFor(filename, defaultThreshold) {
    const ext = getExtension(filename);
    if (ext in ENTROPY_THRESHOLDS) return ENTROPY_THRESHOLDS[ext];
    return defaultThreshold;
  }

  function shannonEntropy(data) {
    if (!data || data.byteLength === 0) return 0;

    const bytes = new Uint8Array(data);
    const freq = new Array(256).fill(0);
    for (let i = 0; i < bytes.length; i++) {
      freq[bytes[i]]++;
    }

    let entropy = 0;
    const len = bytes.length;
    for (let i = 0; i < 256; i++) {
      if (freq[i] > 0) {
        const p = freq[i] / len;
        entropy -= p * Math.log2(p);
      }
    }
    return entropy;
  }

  function analyzeModification(originalData, modifiedData) {
    const origEntropy = shannonEntropy(originalData);
    const modEntropy = shannonEntropy(modifiedData);
    const entropyChange = modEntropy - origEntropy;

    const origSize = originalData.byteLength;
    const modSize = modifiedData.byteLength;
    const sizeChange = origSize > 0 ? Math.abs(modSize - origSize) / origSize : 0;

    return { origEntropy, modEntropy, entropyChange, origSize, modSize, sizeChange };
  }

  function isMalicious(analysis, thresholds = {}, filename = "") {
    const defaultEntropy = thresholds.entropyThreshold ?? 0.3;
    const sizeChangeThreshold = thresholds.sizeChangeThreshold ?? 0.05;
    const entropyThreshold = thresholdFor(filename, defaultEntropy);

    return (
      analysis.entropyChange > entropyThreshold &&
      analysis.sizeChange < sizeChangeThreshold
    );
  }

  return {
    shannonEntropy,
    analyzeModification,
    isMalicious,
    thresholdFor,
    ENTROPY_THRESHOLDS,
  };
})();

if (typeof window !== "undefined") {
  window.__RoBDetector = RoBDetector;
}
