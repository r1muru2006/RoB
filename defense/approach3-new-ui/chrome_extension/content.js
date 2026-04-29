/**
 * FSA API interceptor for enhanced permission dialogs.
 * Wraps showDirectoryPicker and showOpenFilePicker to show
 * custom warning dialogs before the native permission dialog.
 */

(() => {
  const dialog = window.__RoBDialog;
  if (!dialog) return;

  const siteName = window.location.hostname || 'this website';
  const trackedDirs = new Map();

  const origShowDirPicker = window.showDirectoryPicker;
  if (origShowDirPicker) {
    window.showDirectoryPicker = async function (options) {
      const result = await dialog.showDialog('read', siteName, 'selected folder', null);

      try {
        chrome.runtime?.sendMessage({
          type: 'PERMISSION_DECISION',
          permissionType: 'read',
          decision: result.decision,
          decisionTimeMs: result.decisionTimeMs,
          directoryName: 'selected folder',
        });
      } catch (e) {}

      if (result.decision === 'deny') {
        throw new DOMException('The user aborted a request.', 'AbortError');
      }

      const handle = await origShowDirPicker.call(this, options);
      trackedDirs.set(handle.name, handle);
      return handle;
    };
  }

  const origShowOpenPicker = window.showOpenFilePicker;
  if (origShowOpenPicker) {
    window.showOpenFilePicker = async function (options) {
      const result = await dialog.showDialog('read', siteName, 'selected files', null);

      try {
        chrome.runtime?.sendMessage({
          type: 'PERMISSION_DECISION',
          permissionType: 'read',
          decision: result.decision,
          decisionTimeMs: result.decisionTimeMs,
          directoryName: 'selected files',
        });
      } catch (e) {}

      if (result.decision === 'deny') {
        throw new DOMException('The user aborted a request.', 'AbortError');
      }

      return origShowOpenPicker.call(this, options);
    };
  }

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

      try {
        chrome.runtime?.sendMessage({
          type: 'PERMISSION_DECISION',
          permissionType: 'write',
          decision: result.decision,
          decisionTimeMs: result.decisionTimeMs,
          directoryName: dirName,
        });
      } catch (e) {}

      if (result.decision === 'deny') {
        shownWriteWarnings.delete(dirName);
        throw new DOMException('The user aborted a request.', 'NotAllowedError');
      }
    }

    return origCreateWritable.call(this, options);
  };

  console.log('[RoB Enhanced Permissions] Custom permission dialogs active');
})();
