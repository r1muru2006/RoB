const express = require('express');
const cors = require('cors');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Allow frontend to fetch API
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
