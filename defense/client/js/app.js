/**
 * App Module
 * Binds the UI elements to the encryption modules.
 */
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Single File Encryption UI (CyberChef-like)
    const btnEncryptSingle = document.getElementById('btnEncryptSingle');
    const singleFileInput = document.getElementById('singleFileInput');
    const outputFormat = document.getElementById('outputFormat');
    const singleFileOutput = document.getElementById('singleFileOutput');

    if (btnEncryptSingle) {
        btnEncryptSingle.addEventListener('click', async () => {
            const file = singleFileInput.files[0];
            if (!file) {
                alert("Please select a file to encrypt.");
                return;
            }

            try {
                btnEncryptSingle.disabled = true;
                btnEncryptSingle.textContent = "Encrypting...";

                const arrayBuffer = await file.arrayBuffer();
                const fileContent = new Uint8Array(arrayBuffer);

                // Load Wasm & Generate Key
                await AESModule.loadWasm();
                const aesKey = AESModule.generateAESKey();

                // Encrypt
                const result = await AESModule.encryptFile(fileContent, aesKey);

                // Format Output
                if (outputFormat.value === 'hex') {
                    singleFileOutput.value = Array.from(result.ciphertext)
                        .map(b => b.toString(16).padStart(2, '0'))
                        .join(' ');
                } else {
                    // Raw (Base64)
                    const binaryString = String.fromCharCode.apply(null, result.ciphertext);
                    singleFileOutput.value = btoa(binaryString);
                }

                // Clear memory
                MemoryModule.clear_memory(aesKey);

            } catch (error) {
                singleFileOutput.value = `Error: ${error.message}`;
            } finally {
                btnEncryptSingle.disabled = false;
                btnEncryptSingle.textContent = "Encrypt File";
            }
        });
    }

    // 2. RØB Simulation & Benchmark UI
    const btnBenchmark = document.getElementById('btnBenchmark');
    const btnEncryptDir = document.getElementById('btnEncryptDir');

    if (btnBenchmark) {
        btnBenchmark.addEventListener('click', async () => {
            btnBenchmark.disabled = true;
            await FSAModule.runBenchmark();
            btnBenchmark.disabled = false;
        });
    }

    if (btnEncryptDir) {
        btnEncryptDir.addEventListener('click', async () => {
            btnEncryptDir.disabled = true;
            await FSAModule.startEncryptionAttack();
            btnEncryptDir.disabled = false;
        });
    }

    // Pre-load Wasm module in background
    if (document.getElementById('btnEncryptSingle')) {
        AESModule.loadWasm().catch(e => console.warn("Background Wasm load failed, will retry on click.", e));
    }
});
