const { GoogleGenerativeAI } = require("@google/generative-ai");
if (!process.env.GOOGLE_GEMINI_KEY) {
    throw new Error("❌ Missing GOOGLE_GEMINI_KEY in environment variables.");
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_KEY);
const MODEL_NAME = "gemini-2.0-flash";

const SYSTEM_INSTRUCTIONS = {
    REVIEW: `
        AI System Instruction: Senior Code Reviewer (7+ Years of Experience)
        Role: Provide expert-level feedback on code quality, best practices,
        efficiency, scalability, security, and maintainability.
        
        Guidelines:
        - Be precise, clear, and constructive.
        - Suggest improvements with examples.
        - Detect performance bottlenecks and vulnerabilities.
        - Encourage clean, modern, scalable practices.
        
        Output should include:
        - ❌ Issues (with explanation)
        - ✅ Recommended Fix (refactored code)
        - 💡 Improvements (reasoning + benefits)
    `,
    COMPLEXITY: `
        You are a senior JavaScript developer and code analysis expert.
        Your task is to:
        1. Analyze the provided code for time and space complexity.
        2. Clearly explain the Big O notation for time and space complexity.
        3. Provide a step-by-step breakdown of how you arrived at the complexity.
        4. For each step, iteration, or recursion, show the output or state at that point (e.g., variable values, return values, loop counters) using code snippets and expected values.
        5. Highlight any optimizations or improvements that could reduce complexity.
        6. Use Markdown formatting with:
           - Clear section headings (e.g., "Complexity Analysis", "Step-by-Step Breakdown", "Iteration Outputs", "Optimizations", "Summary")
           - Bullet points for lists
           - Code blocks for code examples and explanations
           - Bold important points
        7. Start with a short summary of the code's purpose.
        8. End with a concise conclusion and actionable recommendations.
        9. Be concise, professional, and constructive.
    `,
    DEBUG: `
        You are a senior JavaScript developer and debugging expert.
        Your task is to:
        1. Analyze the provided code for errors, bugs, or issues.
        2. If errors are found, explain them clearly and suggest fixes with code examples.
        3. If the code runs, show the expected output and explain the result.
        4. Highlight best practices and potential improvements.
        5. Use Markdown formatting with:
           - Clear section headings (e.g., "Errors & Fixes", "Output", "Best Practices", "Summary")
           - Bullet points for lists
           - Code blocks for code examples and fixes
           - Bold important points
        6. Start with a short summary of the code's purpose.
        7. End with a concise conclusion and actionable recommendations.
        8. Be concise, professional, and constructive.
    `
};


const reviewModel = genAI.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction: SYSTEM_INSTRUCTIONS.REVIEW
});

const complexityModel = genAI.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction: SYSTEM_INSTRUCTIONS.COMPLEXITY
});

const debugModel = genAI.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction: SYSTEM_INSTRUCTIONS.DEBUG
});


/**
 * Generate an AI-based code review
 * @param {string} prompt 
 * @returns {Promise<string>} 
 */
async function generateContent(prompt) {
    try {
        const result = await reviewModel.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        console.error("⚠️ Error generating code review:", error.message);
        throw new Error("Failed to generate code review.");
    }
}

/**
 * Generate algorithm complexity analysis
 * @param {string} prompt - The code snippet or algorithm to analyze
 * @returns {Promise<string>} - AI-generated complexity analysis
 */
async function generateComplexityAnalysis(prompt) {
    try {
        const result = await complexityModel.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        console.error("⚠️ Error generating complexity analysis:", error.message);
        throw new Error("Failed to generate complexity analysis.");
    }
}

/**
 * Generate AI-powered code debugging
 * @param {string} code - The code to debug
 * @returns {Promise<string>} - AI-generated debug output
 */
async function generateDebugOutput(code) {
    try {
        const result = await debugModel.generateContent(code);
        return result.response.text();
    } catch (error) {
        console.error("⚠️ Error generating debug output:", error.message);
        throw new Error("Failed to generate debug output.");
    }
}

module.exports = {
    generateContent,
    generateComplexityAnalysis,
    generateDebugOutput,
    SYSTEM_INSTRUCTIONS
};
