/**
 * FSA API interceptor for enhanced permission dialogs.
 * Wraps showDirectoryPicker, showOpenFilePicker, showSaveFilePicker,
 * and FileSystemFileHandle.createWritable to show custom warning dialogs
 * before the native permission dialog.
 *
 * The original picker is invoked SYNCHRONOUSLY inside the Allow button's
 * click handler so it inherits transient user activation. Without this,
 * Chrome rejects the picker call (SecurityError: must be handling a user gesture)
 * because the original page click's activation has already expired by the
 * time the user reads and dismisses our custom dialog.
 */

(() => {
  const dialog = window.__RoBDialog;
  if (!dialog) return;

  const siteName = window.location.hostname || 'this website';
  const trackedDirs = new Map();

  function reportDecision(payload) {
    console.log('[RoB UI] reporting decision to bridge:', payload);
    window.postMessage({ source: 'rob-ui-bridge', ...payload }, '*');
  }

  async function wrapPicker(type, dirLabel, origPicker, options) {
    let pickerPromise = null;

    const result = await dialog.showDialog(type, siteName, dirLabel, null, () => {
      // Runs synchronously in the Allow button's click handler.
      // Calling the picker here preserves transient user activation.
      pickerPromise = origPicker(options);
      // Swallow rejection here so the dialog promise can settle cleanly;
      // we re-await below.
      pickerPromise.catch(() => {});
      return pickerPromise;
    });

    reportDecision({
      type: 'PERMISSION_DECISION',
      permissionType: type,
      decision: result.decision,
      decisionTimeMs: result.decisionTimeMs,
      directoryName: dirLabel,
    });

    if (result.decision === 'deny') {
      throw new DOMException('The user aborted a request.', 'AbortError');
    }

    return pickerPromise;
  }

  const origShowDirPicker = window.showDirectoryPicker;
  if (origShowDirPicker) {
    window.showDirectoryPicker = async function (options) {
      const handle = await wrapPicker(
        'read',
        'selected folder',
        (opts) => origShowDirPicker.call(window, opts),
        options
      );
      trackedDirs.set(handle.name, handle);
      return handle;
    };
  }

  const origShowOpenPicker = window.showOpenFilePicker;
  if (origShowOpenPicker) {
    window.showOpenFilePicker = async function (options) {
      return wrapPicker(
        'read',
        'selected files',
        (opts) => origShowOpenPicker.call(window, opts),
        options
      );
    };
  }

  const origShowSavePicker = window.showSaveFilePicker;
  if (origShowSavePicker) {
    window.showSaveFilePicker = async function (options) {
      return wrapPicker(
        'write',
        'selected file',
        (opts) => origShowSavePicker.call(window, opts),
        options
      );
    };
  }

  // For createWritable on a directory-derived handle, the native write
  // permission dialog is itself shown by Chrome and does not require a fresh
  // gesture in the same way as picker invocation. We can keep an async warning
  // here without breaking the activation chain.
  const origCreateWritable = FileSystemFileHandle.prototype.createWritable;
  const shownWriteWarnings = new Set();

  FileSystemFileHandle.prototype.createWritable = async function (options) {
    const fileName = this.name;

    let dirName = 'unknown directory';
    for (const [name] of trackedDirs) {
      dirName = name;
      break;
    }

    if (!shownWriteWarnings.has(dirName)) {
      shownWriteWarnings.add(dirName);

      const fileList = [`${dirName}/${fileName}`];

      try {
        for (const [, handle] of trackedDirs) {
          const entries = [];
          for await (const entry of handle.values()) {
            if (entry.kind === 'file') {
              entries.push(`${dirName}/${entry.name}`);
            }
            if (entries.length >= 10) break;
          }
          if (entries.length > 0) fileList.length = 0;
          fileList.push(...entries);
          break;
        }
      } catch (e) {}

      const result = await dialog.showDialog('write', siteName, dirName, fileList);

      reportDecision({
        type: 'PERMISSION_DECISION',
        permissionType: 'write',
        decision: result.decision,
        decisionTimeMs: result.decisionTimeMs,
        directoryName: dirName,
      });

      if (result.decision === 'deny') {
        shownWriteWarnings.delete(dirName);
        throw new DOMException('The user aborted a request.', 'NotAllowedError');
      }
    }

    return origCreateWritable.call(this, options);
  };

  console.log('[RoB Enhanced Permissions] Custom permission dialogs active');
})();
