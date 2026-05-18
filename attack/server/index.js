const express = require('express');
const cors = require('cors');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

const LOCAL_DEMO_ORIGINS = new Set([
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'null'
]);

// Security headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy',
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'"
    );
    next();
});

// Middleware
app.use(cors({
    origin(origin, callback) {
        if (!origin || LOCAL_DEMO_ORIGINS.has(origin)) {
            return callback(null, true);
        }
        return callback(new Error('CORS origin is not allowed for this local demo'));
    }
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.static('public'));

// Mount API routes
app.use('/api', apiRoutes);

// Root route
app.get('/', (req, res) => {
    res.send("Backend server is running.");
});

// Start Server
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`[RØB Backend] Server running on http://localhost:${PORT}`);
    });
}

module.exports = app; // For testing
