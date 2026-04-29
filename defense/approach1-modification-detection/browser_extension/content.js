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
    } catch (e) {
      // silently continue if caching fails
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

    let pendingData = null;
    let blocked = false;

    writable.write = async function (data) {
      let writeBuffer;
      if (data instanceof Blob) {
        writeBuffer = await data.arrayBuffer();
      } else if (data instanceof ArrayBuffer) {
        writeBuffer = data;
      } else if (ArrayBuffer.isView(data)) {
        writeBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
      } else if (typeof data === "object" && data.type === "write" && data.data) {
        if (data.data instanceof Blob) {
          writeBuffer = await data.data.arrayBuffer();
        } else if (data.data instanceof ArrayBuffer) {
          writeBuffer = data.data;
        }
      }

      if (writeBuffer && fileCache.has(fileName)) {
        const originalData = fileCache.get(fileName);
        const analysis = detector.analyzeModification(originalData, writeBuffer);
        const malicious = detector.isMalicious(analysis);

        if (malicious) {
          console.warn(
            `[RoB Defender] MALICIOUS modification detected on "${fileName}"!`,
            `Entropy change: ${analysis.entropyChange.toFixed(4)},`,
            `Size change: ${(analysis.sizeChange * 100).toFixed(4)}%`
          );

          window.postMessage(
            {
              source: "rob-defender",
              type: "malicious-detected",
              filename: fileName,
              entropyChange: analysis.entropyChange,
              sizeChange: analysis.sizeChange,
            },
            "*"
          );

          const userChoice = confirm(
            `[RoB Defender] WARNING!\n\n` +
              `Potentially malicious modification detected on "${fileName}".\n\n` +
              `Entropy change: ${analysis.entropyChange.toFixed(2)} (threshold: 3.0)\n` +
              `Size change: ${(analysis.sizeChange * 100).toFixed(2)}% (threshold: 5%)\n\n` +
              `This pattern is consistent with ransomware encryption.\n\n` +
              `Click OK to BLOCK the write, or Cancel to allow it.`
          );

          if (userChoice) {
            blocked = true;
            try {
              chrome.runtime?.sendMessage({
                type: "ROB_ALERT",
                filename: fileName,
                entropyChange: analysis.entropyChange,
                sizeChange: analysis.sizeChange,
                action: "blocked",
              });
            } catch (e) {}
            throw new DOMException("Write blocked by RoB Defender", "NotAllowedError");
          }

          try {
            chrome.runtime?.sendMessage({
              type: "ROB_ALERT",
              filename: fileName,
              entropyChange: analysis.entropyChange,
              sizeChange: analysis.sizeChange,
              action: "allowed_by_user",
            });
          } catch (e) {}
        }
      }

      return origWrite(data);
    };

    writable.close = async function () {
      if (!blocked) {
        fileCache.delete(fileName);
      }
      return origClose();
    };

    return writable;
  };

  console.log("[RoB Defender] FSA API hooks installed - monitoring for malicious modifications");
})();
