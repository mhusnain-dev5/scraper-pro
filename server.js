// ============================================
// SCRAPER PRO - Backend Server
// Uses Google Gemini API (FREE forever)
// ============================================

const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

// ---- Health check ----
app.get('/', (req, res) => {
  res.json({ 
    status: '✅ ScraperPro Backend Running!',
    version: '2.0.0',
    ai: 'Google Gemini (Free)'
  });
});

// ---- AI Selector endpoint ----
app.post('/api/ai-selector', async (req, res) => {
  const { html, prompt } = req.body;

  if (!html || !prompt) {
    return res.status(400).json({ error: 'html and prompt are required' });
  }

  try {
    const aiPrompt = `You are a web scraping expert.
Analyze this HTML and find the best CSS selectors for: "${prompt}"

Rules:
- Return ONLY a valid JSON array
- No explanation, no markdown, no backticks
- Just the raw JSON array

Format:
[
  {"selector": ".price", "description": "Product prices", "count": 5},
  {"selector": ".title", "description": "Product titles", "count": 5}
]

HTML to analyze:
${html.substring(0, 8000)}`;

    const result = await model.generateContent(aiPrompt);
    const text = result.response.text();

    // Extract JSON from response
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) {
      return res.status(422).json({ 
        error: 'AI could not find selectors for this page' 
      });
    }

    const selectors = JSON.parse(match[0]);
    res.json({ selectors, source: 'gemini' });

  } catch (e) {
    console.error('AI Error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ---- Price check endpoint ----
app.post('/api/analyze-price', async (req, res) => {
  const { text, currency } = req.body;
  try {
    const result = await model.generateContent(
      `Extract the price number from this text: "${text}". 
       Return ONLY the number, no currency symbol, no text. 
       Example: 29.99`
    );
    const price = parseFloat(result.response.text().trim());
    res.json({ price: isNaN(price) ? null : price });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 ScraperPro Backend running on port ${PORT}`);
  console.log(`🤖 AI: Google Gemini Flash (Free)`);
  console.log(`✅ Ready!`);
});