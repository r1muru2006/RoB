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

// Middleware
app.use(cors({
    origin(origin, callback) {
        if (!origin || LOCAL_DEMO_ORIGINS.has(origin)) {
            return callback(null, true);
        }
        return callback(new Error('CORS origin is not allowed for this local demo'));
    }
}));
app.use(express.json()); // Parse JSON bodies
app.use(express.static('public')); // Serve static assets for ransom page

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
