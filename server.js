const express = require('express');
const cors = require('cors');
const Groq = require('groq-sdk');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

app.get('/', (req, res) => {
  res.json({ 
    status: 'ScraperPro Backend Running!',
    ai: 'Groq Llama (Free)',
    version: '2.0.0'
  });
});

app.post('/api/ai-selector', async (req, res) => {
  const { html, prompt } = req.body;
  if (!html || !prompt) {
    return res.status(400).json({ error: 'html and prompt required' });
  }
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [{
        role: 'user',
        content: `You are a web scraping expert.
Analyze this HTML and find CSS selectors for: "${prompt}"
Return ONLY a valid JSON array, no explanation, no markdown, no backticks:
[{"selector": ".class", "description": "what it selects", "count": 5}]
HTML: ${html.substring(0, 6000)}`
      }],
      temperature: 0.1,
      max_tokens: 500
    });

    const text = completion.choices[0]?.message?.content || '';
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return res.status(422).json({ error: 'AI could not find selectors' });
    
    const selectors = JSON.parse(match[0]);
    res.json({ selectors, source: 'groq-llama3' });
  } catch (e) {
    console.error('Error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/analyze-price', async (req, res) => {
  const { text } = req.body;
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [{
        role: 'user',
        content: `Extract price number from: "${text}". Return ONLY the number. Example: 29.99`
      }],
      max_tokens: 20
    });
    const price = parseFloat(completion.choices[0]?.message?.content?.trim());
    res.json({ price: isNaN(price) ? null : price });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`ScraperPro running on port ${PORT}`);
  console.log(`AI: Groq Llama3 (Free - 14400 req/day)`);
  console.log(`Ready!`);
});
