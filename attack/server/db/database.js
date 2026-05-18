const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_FILE = process.env.ROB_DB_FILE || path.join(__dirname, 'victims.json');

function initDB() {
    if (!fs.existsSync(DB_FILE)) {
        fs.writeFileSync(DB_FILE, JSON.stringify([]));
    }
}

function atomicWrite(filePath, data) {
    const tmpPath = filePath + '.' + crypto.randomBytes(6).toString('hex') + '.tmp';
    fs.writeFileSync(tmpPath, data);
    fs.renameSync(tmpPath, filePath);
}

function saveVictim(victim) {
    const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    data.push(victim);
    atomicWrite(DB_FILE, JSON.stringify(data, null, 2));
}

function getVictim(id) {
    if (!fs.existsSync(DB_FILE)) return null;
    const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    return data.find(v => v.id === id) || null;
}

function updateVictim(id, updates) {
    const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    const index = data.findIndex(v => v.id === id);
    if (index !== -1) {
        data[index] = { ...data[index], ...updates };
        atomicWrite(DB_FILE, JSON.stringify(data, null, 2));
    }
}

initDB();

module.exports = { saveVictim, getVictim, updateVictim };
