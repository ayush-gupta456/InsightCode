const aiService = require("../services/ai.service")


const sanitize = require('sanitize-html');

function validateCode(code) {
    if (typeof code !== 'string' || code.length < 1 || code.length > 5000) {
        return false;
    }
    return true;
}

module.exports.getReview = async (req, res) => {
    const code = req.body.code;
    if (!validateCode(code)) {
        return res.status(400).json({ error: 'Valid code is required.' });
    }
    try {
        // Sanitize input
        const safeCode = sanitize(code, { allowedTags: [], allowedAttributes: {} });
        const response = await aiService.generateContent(safeCode);
        res.send(response);
    } catch (error) {
        console.error('Review error:', error);
        res.status(500).json({ error: 'Failed to generate code review.' });
    }
};

module.exports.getComplexity = async (req, res) => {
    const code = req.body.code;
    if (!validateCode(code)) {
        return res.status(400).json({ error: 'Valid code is required.' });
    }
    try {
        const safeCode = sanitize(code, { allowedTags: [], allowedAttributes: {} });
        const response = await aiService.generateComplexityAnalysis(safeCode);
        res.send(response);
    } catch (error) {
        console.error('Complexity error:', error);
        res.status(500).json({ error: 'Failed to analyze complexity.' });
    }
};

module.exports.debugCode = async (req, res) => {
    const code = req.body.code;
    if (!validateCode(code)) {
        return res.status(400).json({ error: 'Valid code is required.' });
    }
    try {
        const safeCode = sanitize(code, { allowedTags: [], allowedAttributes: {} });
        const response = await aiService.generateDebugOutput(safeCode);
        res.send(response);
    } catch (error) {
        console.error('Debug error:', error);
        res.status(500).json({ error: 'Failed to debug code.' });
    }
};