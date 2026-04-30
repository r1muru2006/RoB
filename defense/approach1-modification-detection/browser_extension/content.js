/**
 * FSA API hooking script for malicious modification detection.
 * Hooks showDirectoryPicker, createWritable, and write to intercept
 * file modifications and analyze them for ransomware-like patterns.
 *
 * Runs in MAIN world (same JS context as the page).
 */

(() => {
  const detector = window.__RoBDetector;
  if (!detector) return;

  const fileCache = new Map();
  let monitoredDir = null;
  let currentSettings = { entropyThreshold: 3.0, sizeChangeThreshold: 0.05 };

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const d = event.data;
    if (d && d.source === "rob-defender-bridge" && d.type === "SETTINGS") {
      currentSettings = {
        entropyThreshold: d.settings.entropyThreshold ?? 3.0,
        sizeChangeThreshold: d.settings.sizeChangeThreshold ?? 0.05,
      };
    }
  });

  function reportAlert(payload) {
    console.log("[RoB Defender] posting alert to bridge:", payload);
    window.postMessage({ source: "rob-defender", ...payload }, "*");
  }

  const origShowDirectoryPicker = window.showDirectoryPicker;
  if (origShowDirectoryPicker) {
    window.showDirectoryPicker = async function (...args) {
      const handle = await origShowDirectoryPicker.apply(this, args);
      monitoredDir = handle.name;
      console.log("[RoB Defender] Directory picker opened:", handle.name);
      return handle;
    };
  }

  const origGetFile = FileSystemFileHandle.prototype.getFile;
  FileSystemFileHandle.prototype.getFile = async function (...args) {
    const file = await origGetFile.apply(this, args);

    try {
      const clone = file.slice();
      const buffer = await clone.arrayBuffer();
      fileCache.set(this.name, buffer);
      console.log(`[RoB Defender] cached original "${this.name}" (${buffer.byteLength} bytes)`);
    } catch (e) {
      console.warn("[RoB Defender] failed to cache original:", e);
    }

    return file;
  };

  const origCreateWritable = FileSystemFileHandle.prototype.createWritable;
  FileSystemFileHandle.prototype.createWritable = async function (...args) {
    const writable = await origCreateWritable.apply(this, args);
    const fileName = this.name;
    const fileHandle = this;

    const origWrite = writable.write.bind(writable);
    const origClose = writable.close.bind(writable);

    let lastWrittenBuffer = null;
    let blocked = false;

    writable.write = async function (data) {
      console.log(`[RoB Defender] write() intercepted on "${fileName}"`);

      async function toBuffer(d) {
        if (d == null) return null;
        if (typeof d === "string") {
          return new TextEncoder().encode(d).buffer;
        }
        if (d instanceof Blob) {
          return await d.arrayBuffer();
        }
        if (d instanceof ArrayBuffer) {
          return d;
        }
        if (ArrayBuffer.isView(d)) {
          return d.buffer.slice(d.byteOffset, d.byteOffset + d.byteLength);
        }
        return null;
      }

      let writeBuffer = null;
      if (typeof data === "object" && data !== null && !(data instanceof Blob) &&
          !(data instanceof ArrayBuffer) && !ArrayBuffer.isView(data) &&
          "type" in data) {
        // WriteParams { type: "write" | "seek" | "truncate", data?, position?, size? }
        if (data.type === "write" && data.data !== undefined) {
          writeBuffer = await toBuffer(data.data);
        }
        // "seek" and "truncate" are not data writes — skip analysis
      } else {
        writeBuffer = await toBuffer(data);
      }

      if (!writeBuffer) {
        console.warn(`[RoB Defender] write data unrecognized type for "${fileName}"`);
      } else if (!fileCache.has(fileName)) {
        console.warn(`[RoB Defender] no cached original for "${fileName}" — getFile() was never called, cannot detect`);
      }

      if (writeBuffer && fileCache.has(fileName)) {
        const originalData = fileCache.get(fileName);
        const analysis = detector.analyzeModification(originalData, writeBuffer);
        const malicious = detector.isMalicious(analysis, currentSettings);
        console.log(
          `[RoB Defender] analyzed "${fileName}": entropy_change=${analysis.entropyChange.toFixed(3)} size_change=${(analysis.sizeChange * 100).toFixed(2)}% → malicious=${malicious}`
        );

        if (malicious) {
          console.warn(
            `[RoB Defender] MALICIOUS modification detected on "${fileName}"!`,
            `Entropy change: ${analysis.entropyChange.toFixed(4)},`,
            `Size change: ${(analysis.sizeChange * 100).toFixed(4)}%`
          );

          const userChoice = confirm(
            `[RoB Defender] WARNING!\n\n` +
              `Potentially malicious modification detected on "${fileName}".\n\n` +
              `Entropy change: ${analysis.entropyChange.toFixed(2)} (threshold: ${currentSettings.entropyThreshold})\n` +
              `Size change: ${(analysis.sizeChange * 100).toFixed(2)}% (threshold: ${(currentSettings.sizeChangeThreshold * 100).toFixed(0)}%)\n\n` +
              `This pattern is consistent with ransomware encryption.\n\n` +
              `Click OK to BLOCK the write, or Cancel to allow it.`
          );

          if (userChoice) {
            blocked = true;
            reportAlert({
              type: "ROB_ALERT",
              filename: fileName,
              entropyChange: analysis.entropyChange,
              sizeChange: analysis.sizeChange,
              action: "blocked",
            });
            throw new DOMException("Write blocked by RoB Defender", "NotAllowedError");
          }

          reportAlert({
            type: "ROB_ALERT",
            filename: fileName,
            entropyChange: analysis.entropyChange,
            sizeChange: analysis.sizeChange,
            action: "allowed_by_user",
          });
        }
      }

      if (writeBuffer) {
        lastWrittenBuffer = writeBuffer;
      }
      return origWrite(data);
    };

    writable.close = async function () {
      const result = await origClose();
      if (!blocked && lastWrittenBuffer) {
        // The just-written content becomes the new "original" for subsequent
        // modification comparisons, so we don't lose detection on the 2nd save.
        fileCache.set(fileName, lastWrittenBuffer);
        console.log(`[RoB Defender] cache refreshed for "${fileName}" (${lastWrittenBuffer.byteLength} bytes)`);
      }
      return result;
    };

    return writable;
  };

  console.log("[RoB Defender] FSA API hooks installed - monitoring for malicious modifications");
})();
