/**
 * Entropy and file size change detection logic.
 * Runs in MAIN world to access FSA API objects directly.
 */

const RoBDetector = (() => {
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

  function isMalicious(analysis, thresholds = {}) {
    const entropyThreshold = thresholds.entropyThreshold || 3.0;
    const sizeChangeThreshold = thresholds.sizeChangeThreshold || 0.05;

    return (
      analysis.entropyChange > entropyThreshold && analysis.sizeChange < sizeChangeThreshold
    );
  }

  return { shannonEntropy, analyzeModification, isMalicious };
})();

if (typeof window !== "undefined") {
  window.__RoBDetector = RoBDetector;
}
