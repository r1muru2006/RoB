/**
 * Entropy and file size change detection logic.
 * Runs in MAIN world to access FSA API objects directly.
 */

const RoBDetector = (() => {
  // ---------------------------------------------------------------------------
  // Reference data from paper §6.1 (USENIX Security 2023, RoB).
  //
  // Methodology: 500K benign + 500K malicious modifications on 5000 files
  // across 5 file types from the dataset in [31]; details in Appendix C.
  //
  // Entropy change (Δ entropy, original vs modified):
  //   Benign modifications (across txt, xlsx, jpeg, docx): ≈ 0.05 on average
  //   Malicious (AES-style encryption):
  //     txt   ≈ 3.50
  //     jpeg  ≈ 0.60
  //     docx  ≈ 0.60
  //     xlsx  ≈ 0.10
  //     pdf   ≈ 0.10
  //   Rationale: encrypted bytes look uniformly random, so entropy of low-
  //   entropy formats (txt) jumps massively; already-compressed formats
  //   (jpeg, xlsx zip, pdf flate streams) have high baseline entropy, so
  //   encryption only nudges entropy up slightly.
  //
  // File size change (|new − orig| / orig):
  //   Benign modifications (txt, xlsx, jpeg, docx): ≈ 15% (≈ 300 KB) avg
  //   Malicious (encryption preserves data length):
  //     txt   ≈ 0.002 %
  //     docx  ≈ 0.012 %
  //     pdf   ≈ 0.006 %
  //     xlsx  ≈ 0.06  %
  //     jpeg  ≈ 0.14  %
  //   Rationale: AES-GCM only adds a fixed nonce+tag overhead (≈ 28 bytes),
  //   so the relative size delta is tiny on real files. Benign edits
  //   (adding/removing content) shift size by a much larger fraction.
  //
  // Detection rule: flag a write as malicious when
  //   entropy_change  >  ENTROPY_THRESHOLDS[ext]   AND
  //   size_change     <  SIZE_THRESHOLDS[ext]
  // Each threshold is set between the benign and malicious averages above
  // (closer to the malicious side, biased toward catching attacks).
  // ---------------------------------------------------------------------------

  const ENTROPY_THRESHOLDS = {
    // Plain-text-like: benign Δ ≈ 0.05, encryption Δ ≈ 3.5 → wide gap, 1.0
    txt:  1.0,
    md:   1.0,
    csv:  1.0,
    json: 1.0,
    html: 1.0,
    // Mid-entropy formats: benign Δ ≈ 0.05, encryption Δ ≈ 0.60 → 0.3
    docx: 0.3,
    jpeg: 0.3,
    jpg:  0.3,
    png:  0.3,
    // High baseline entropy formats: benign Δ ≈ 0.05, encryption Δ ≈ 0.10
    // → narrow gap, 0.08 is the best the entropy feature can do alone.
    xlsx: 0.08,
    pdf:  0.08,
  };

  const SIZE_THRESHOLDS = {
    // Benign size Δ ≈ 15%, encryption ≤ 0.14% across all types →
    // a ~1% cutoff cleanly separates the two distributions.
    txt:  0.01,   // 1%   (encryption avg 0.002%)
    md:   0.01,
    csv:  0.01,
    json: 0.01,
    html: 0.01,
    docx: 0.01,   // 1%   (encryption avg 0.012%)
    xlsx: 0.01,   // 1%   (encryption avg 0.06%)
    pdf:  0.01,   // 1%   (encryption avg 0.006%)
    jpeg: 0.02,   // 2%   (encryption avg 0.14% — bumped to 2% for safety)
    jpg:  0.02,
    png:  0.02,
  };

  function getExtension(filename) {
    if (!filename) return "";
    const idx = filename.lastIndexOf(".");
    return idx === -1 ? "" : filename.slice(idx + 1).toLowerCase();
  }

  function entropyThresholdFor(filename, defaultThreshold) {
    const ext = getExtension(filename);
    if (ext in ENTROPY_THRESHOLDS) return ENTROPY_THRESHOLDS[ext];
    return defaultThreshold;
  }

  function sizeThresholdFor(filename, defaultThreshold) {
    const ext = getExtension(filename);
    if (ext in SIZE_THRESHOLDS) return SIZE_THRESHOLDS[ext];
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
    const absoluteSizeChange = Math.abs(modSize - origSize);
    const sizeChange = origSize > 0 ? Math.abs(modSize - origSize) / origSize : 0;

    return {
      origEntropy,
      modEntropy,
      entropyChange,
      origSize,
      modSize,
      absoluteSizeChange,
      sizeChange,
    };
  }

  function isMalicious(analysis, thresholds = {}, filename = "") {
    const defaultEntropy = thresholds.entropyThreshold ?? 0.3;
    const defaultSize = thresholds.sizeChangeThreshold ?? 0.01;
    const fixedOverheadBytes = thresholds.fixedOverheadBytes ?? 512;
    const entropyThreshold = entropyThresholdFor(filename, defaultEntropy);
    const sizeThreshold = sizeThresholdFor(filename, defaultSize);
    const sizeLooksLikeEncryption =
      analysis.sizeChange < sizeThreshold ||
      analysis.absoluteSizeChange <= fixedOverheadBytes;

    return (
      analysis.entropyChange > entropyThreshold &&
      sizeLooksLikeEncryption
    );
  }

  return {
    shannonEntropy,
    analyzeModification,
    isMalicious,
    entropyThresholdFor,
    sizeThresholdFor,
    ENTROPY_THRESHOLDS,
    SIZE_THRESHOLDS,
  };
})();

if (typeof window !== "undefined") {
  window.__RoBDetector = RoBDetector;
}
