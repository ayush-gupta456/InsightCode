const express = require('express');
const aiRoutes = require('./routes/ai.routes');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// Security middlewares
app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Limit JSON payload size
app.use(express.json({ limit: '10kb' }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 30, // limit each IP to 30 requests per minute
});
app.use(limiter);

app.get('/', (req, res) => {
    res.send('Server is running');
});

app.use('/ai', aiRoutes);

// Error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
});

module.exports = app;