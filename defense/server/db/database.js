const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'victims.json');

/**
 * Ensures the DB file exists.
 */
function initDB() {
    if (!fs.existsSync(DB_FILE)) {
        fs.writeFileSync(DB_FILE, JSON.stringify([]));
    }
}

/**
 * Saves a new victim to the database.
 * @param {Object} victim 
 */
function saveVictim(victim) {
    const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    data.push(victim);
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

/**
 * Retrieves a victim by ID.
 * @param {string} id 
 * @returns {Object|null}
 */
function getVictim(id) {
    if (!fs.existsSync(DB_FILE)) return null;
    const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    return data.find(v => v.id === id) || null;
}

/**
 * Updates a victim's status
 * @param {string} id 
 * @param {Object} updates 
 */
function updateVictim(id, updates) {
    const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    const index = data.findIndex(v => v.id === id);
    if (index !== -1) {
        data[index] = { ...data[index], ...updates };
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    }
}

// Initialize on load
initDB();

module.exports = { saveVictim, getVictim, updateVictim };
