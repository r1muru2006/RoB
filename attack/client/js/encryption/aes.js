/**
 * AES Module (Wasm Wrapper)
 * Implements symmetric key generation and file encryption using AES-256-GCM.
 * Calls the stealthy custom Wasm module for actual cryptographic operations.
 */
class AESModule {
    static isWasmLoaded = false;
    static wasmModule = null;

    static loadPromise = null;

    /**
     * Loads the WebAssembly module.
     */
    static async loadWasm() {
        if (this.isWasmLoaded) return;
        if (this.loadPromise) return this.loadPromise;

        this.loadPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'js/encryption/wasm/crypto.js';
            script.onload = () => {
                Module.onRuntimeInitialized = () => {
                    this.wasmModule = Module;
                    this.isWasmLoaded = true;
                    console.log("[Stealth Wasm] AES-256-GCM logic loaded.");
                    resolve();
                };
            };
            script.onerror = reject;
            document.head.appendChild(script);
        });

        return this.loadPromise;
    }

    /**
     * Generates a 256-bit (32 bytes) symmetric AES key.
     * @returns {Uint8Array} The raw key
     */
    static generateAESKey() {
        const key = new Uint8Array(32);
        window.crypto.getRandomValues(key);
        return key;
    }

    /**
     * Encrypts the file content using the custom Wasm AES-256-GCM.
     * @param {Uint8Array} fileContent - The raw file bytes
     * @param {Uint8Array} aesKey - The 32-byte AES key
     * @returns {Object} { ciphertext: Uint8Array, iv: Uint8Array }
     */
    static async encryptFile(fileContent, aesKey) {
        if (!this.isWasmLoaded) await this.loadWasm();

        // Generate 12-byte IV for GCM
        const iv = new Uint8Array(12);
        window.crypto.getRandomValues(iv);

        const inputLen = fileContent.length;

        // Allocate memory in Wasm
        const keyPtr = this.wasmModule._malloc(32);
        const ivPtr = this.wasmModule._malloc(12);
        const inputPtr = this.wasmModule._malloc(inputLen);
        const outputPtr = this.wasmModule._malloc(inputLen);
        const tagPtr = this.wasmModule._malloc(16);

        try {
            // Copy data to Wasm memory using global HEAPU8
            window.HEAPU8.set(aesKey, keyPtr);
            window.HEAPU8.set(iv, ivPtr);
            window.HEAPU8.set(fileContent, inputPtr);

            // Call Wasm function
            const resultSize = this.wasmModule.ccall(
                'aes_gcm_encrypt', 'number',
                ['number', 'number', 'number', 'number', 'number', 'number', 'number'],
                [keyPtr, ivPtr, 12, inputPtr, inputLen, outputPtr, tagPtr]
            );

            if (resultSize === 0) throw new Error("Wasm AES encryption failed.");

            // Read output
            const ciphertext = new Uint8Array(window.HEAPU8.buffer, outputPtr, inputLen);
            const tag = new Uint8Array(window.HEAPU8.buffer, tagPtr, 16);

            // Append Tag to Ciphertext (standard GCM format: Ciphertext || Tag)
            const combinedOutput = new Uint8Array(inputLen + 16);
            combinedOutput.set(ciphertext, 0);
            combinedOutput.set(tag, inputLen);

            // Clear sensitive keys from Wasm memory manually
            window.HEAPU8.fill(0, keyPtr, keyPtr + 32);

            return {
                ciphertext: combinedOutput,
                iv: iv
            };
        } finally {
            // Free Wasm memory
            this.wasmModule._free(keyPtr);
            this.wasmModule._free(ivPtr);
            this.wasmModule._free(inputPtr);
            this.wasmModule._free(outputPtr);
            this.wasmModule._free(tagPtr);
        }
    }
}

window.AESModule = AESModule;
