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

    // Pre-load stealth WASM module so the lab run starts promptly after selection.
    window.__$r.ready().catch(e => console.warn("Background init failed, will retry on use.", e));
});
