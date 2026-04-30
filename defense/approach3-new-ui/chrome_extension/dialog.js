/**
 * Dialog rendering and interaction logic for enhanced permission dialogs.
 * Creates and manages the custom permission warning overlays.
 *
 * IMPORTANT: showDialog accepts an optional `onAllow` callback that is invoked
 * SYNCHRONOUSLY in the Allow button's click handler. This is required so that
 * the FSA picker call inherits the click's transient user activation —
 * otherwise Chrome rejects the picker call with a SecurityError.
 */

const RoBDialog = (() => {

  function createReadDialog(siteName, directoryName) {
    return `
      <div class="rob-permission-overlay" id="robPermissionOverlay">
        <div class="rob-permission-dialog">
          <div class="rob-dialog-header">
            <h2 class="rob-dialog-title">Let site view files?</h2>
          </div>
          <div class="rob-dialog-body">
            <div class="rob-warning-box">
              <div class="rob-warning-icon">&#9888;&#65039;</div>
              <div class="rob-warning-text">
                <strong>Warning!</strong> ${esc(siteName)} will be able to read all files in
                <strong>${esc(directoryName)}</strong>
                <span class="rob-danger-highlight">and its subdirectories</span>
                until you close all tabs for this site.
              </div>
            </div>
            <div class="rob-danger-message">
              ${esc(siteName)} <strong>might attempt to steal your sensitive information</strong>.
            </div>
            <div class="rob-links">
              <a href="https://developer.chrome.com/articles/file-system-access/" target="_blank">Get more information</a>
              on the possible risks. Does this website look suspicious?
              <a href="https://safebrowsing.google.com/safebrowsing/report_phish/" target="_blank">Report it here</a>.
            </div>
          </div>
          <div class="rob-dialog-footer">
            <button class="rob-btn rob-btn-cancel" id="robBtnCancel">Cancel</button>
            <button class="rob-btn rob-btn-allow" id="robBtnAllow">View files</button>
          </div>
        </div>
      </div>
    `;
  }

  function createWriteDialog(siteName, directoryName, fileList) {
    const filesHtml = fileList && fileList.length > 0
      ? `<div class="rob-file-list">
           <ul>${fileList.map(f => `<li>${esc(f)}</li>`).join('')}</ul>
         </div>`
      : '';

    const toggleHtml = fileList && fileList.length > 0
      ? `<button class="rob-file-list-toggle" id="robToggleFiles">See the impacted files...</button>`
      : '';

    return `
      <div class="rob-permission-overlay" id="robPermissionOverlay">
        <div class="rob-permission-dialog">
          <div class="rob-dialog-header">
            <h2 class="rob-dialog-title">Save changes to <strong>${esc(directoryName)}</strong>?</h2>
          </div>
          <div class="rob-dialog-body">
            <div class="rob-warning-box">
              <div class="rob-warning-icon">&#9888;&#65039;</div>
              <div class="rob-warning-text">
                <strong>Warning!</strong> ${esc(siteName)} will be able to edit
                <strong>${esc(directoryName)}</strong>
                <span class="rob-danger-highlight">and its subdirectories</span>
                until you close all tabs for this site.
              </div>
            </div>
            <div class="rob-danger-message">
              The changes made by ${esc(siteName)} can cause
              <strong>permanent loss of your local data</strong>.
              ${toggleHtml}
            </div>
            ${filesHtml}
            <div class="rob-links">
              <a href="https://developer.chrome.com/articles/file-system-access/" target="_blank">Get more information</a>
              on the possible risks. Does this website look suspicious?
              <a href="https://safebrowsing.google.com/safebrowsing/report_phish/" target="_blank">Report it here</a>.
            </div>
          </div>
          <div class="rob-dialog-footer">
            <button class="rob-btn rob-btn-cancel" id="robBtnCancel">Cancel</button>
            <button class="rob-btn rob-btn-allow" id="robBtnAllow">Save changes</button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * @param {string} type - 'read' or 'write'
   * @param {string} siteName
   * @param {string} directoryName
   * @param {string[]|null} fileList
   * @param {Function} [onAllow] - synchronous callback invoked from the Allow
   *   button's click handler. Its return value (or thrown error) is forwarded
   *   to the resolved promise as `result.allowResult` / rejection.
   */
  function showDialog(type, siteName, directoryName, fileList, onAllow) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      const html = type === 'read'
        ? createReadDialog(siteName, directoryName)
        : createWriteDialog(siteName, directoryName, fileList);

      const container = document.createElement('div');
      container.innerHTML = html;
      document.body.appendChild(container);

      const overlay = container.querySelector('#robPermissionOverlay');
      const cancelBtn = container.querySelector('#robBtnCancel');
      const allowBtn = container.querySelector('#robBtnAllow');
      const toggleBtn = container.querySelector('#robToggleFiles');
      const fileListEl = container.querySelector('.rob-file-list');

      if (fileListEl) fileListEl.style.display = 'none';

      if (toggleBtn && fileListEl) {
        toggleBtn.addEventListener('click', () => {
          const visible = fileListEl.style.display !== 'none';
          fileListEl.style.display = visible ? 'none' : 'block';
          toggleBtn.textContent = visible ? 'See the impacted files...' : 'Hide file list';
        });
      }

      function finalize(decision, allowResult, error) {
        const elapsed = Date.now() - startTime;
        container.remove();
        if (error) {
          reject(error);
        } else {
          resolve({ decision, decisionTimeMs: elapsed, allowResult });
        }
      }

      cancelBtn.addEventListener('click', () => finalize('deny'));

      allowBtn.addEventListener('click', () => {
        let allowResult;
        if (typeof onAllow === 'function') {
          try {
            allowResult = onAllow();
          } catch (err) {
            finalize('allow', undefined, err);
            return;
          }
        }
        finalize('allow', allowResult);
      });

      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) finalize('deny');
      });
    });
  }

  function esc(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  return { showDialog };
})();

if (typeof window !== 'undefined') {
  window.__RoBDialog = RoBDialog;
}
