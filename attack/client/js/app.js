/**
 * App Module
 * Binds the lab UI elements to the encryption simulation modules.
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

    // Pre-load Wasm module so the lab run starts promptly after selection.
    AESModule.loadWasm().catch(e => console.warn("Background Wasm load failed, will retry on click.", e));
});
