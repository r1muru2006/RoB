const crypto = require('crypto');

/**
 * Generates an RSA-2048 key pair.
 * @returns {Object} { publicKey, privateKey } in PEM format
 */
function generateRSAKeyPair() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
            type: 'spki',
            format: 'pem'
        },
        privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem'
        }
    });

    return { publicKey, privateKey };
}

module.exports = { generateRSAKeyPair };
