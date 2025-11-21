const express = require('express');
const mongoose = require('mongoose');
const app = express();

require('dotenv').config();

const port = process.env.PORT || 3000;
console.log("Server using port:", port);
app.use(express.json());  // for parsing application/json

app.listen(port, '0.0.0.0', () => {
  console.log(`Supp app running on http://0.0.0.0:${port}`);
});

app.get('/', (req, res) => {
  res.send('Up and Running');
});



app.post('/gpt', async (req, res) => {
  try {
    const prompt = req.body?.prompt;
    if (!prompt) return res.status(400).json({ ok: false, error: 'No prompt provided' });

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert nutritionist and supplement advisor. Provide accurate, evidence-based information about supplements, vitamins, minerals, nutrition, and health. Always prioritize safety and recommend consulting healthcare professionals for personalized medical advice. Keep responses concise, helpful, and focused on supplement-related topics.'
          },
          { role: 'user', content: prompt }
        ]
      })
    });

    if (!r.ok) return res.status(r.status).send(await r.text());
    const data = await r.json();
    const text = data.choices?.[0]?.message?.content ?? '';
    res.json({ ok: true, text });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/identify', async (req, res) => {
  try {
    console.log('[/identify] Request received');
    const { barcode } = req.body || {};
    const norm = normalizeBarcode(barcode?.raw, barcode?.symbology);
    if (!norm.valid) return res.status(400).json({ ok:false, error:'Invalid barcode' });

    console.log('[/identify] Fetching from OpenFoodFacts...');
    let doc = await fromOpenFoodFacts(norm.ean13 || norm.upcA);
    console.log('[/identify] OpenFoodFacts result:', doc ? 'Found' : 'Not found');

    let gptText = null;
    let rating = null;
    let scores = null;

    if (doc) {
      console.log('[/identify] Calling GPT for analysis...');
      const prompt = `
Analyze this supplement and provide detailed scores.

Name: ${doc.name || doc.product_name}
Brand: ${doc.brand || doc.brands}
Ingredients: ${doc.ingredientsText || doc.ingredients_text}
Nutritional info: ${JSON.stringify(doc.nutriments || {}, null, 2)}

Provide scores (0-100) for each category and an overall analysis.
Format your response EXACTLY as follows:
Overall Rating: [number 0-100]
Evidence-Based Effectiveness: [number 0-100]
Ingredient Quality & Purity: [number 0-100]
Safety & Side-Effect Risk: [number 0-100]
Value for Money: [number 0-100]
User Results & Satisfaction: [number 0-100]
Taste: [number 0-100]
Analysis: [2-3 sentence summary of the supplement]`;
      const gptResponse = await askGPT(prompt);

      // Extract all scores and analysis from GPT response
      const overallRatingMatch = gptResponse?.match(/Overall Rating:\s*(\d+(?:\.\d+)?)/i);
      const effectivenessMatch = gptResponse?.match(/Evidence-Based Effectiveness:\s*(\d+(?:\.\d+)?)/i);
      const qualityMatch = gptResponse?.match(/Ingredient Quality & Purity:\s*(\d+(?:\.\d+)?)/i);
      const safetyMatch = gptResponse?.match(/Safety & Side-Effect Risk:\s*(\d+(?:\.\d+)?)/i);
      const valueMatch = gptResponse?.match(/Value for Money:\s*(\d+(?:\.\d+)?)/i);
      const satisfactionMatch = gptResponse?.match(/User Results & Satisfaction:\s*(\d+(?:\.\d+)?)/i);
      const tasteMatch = gptResponse?.match(/Taste:\s*(\d+(?:\.\d+)?)/i);
      const analysisMatch = gptResponse?.match(/Analysis:\s*(.+)/is);

      rating = overallRatingMatch ? Math.round(parseFloat(overallRatingMatch[1])) : null;
      scores = {
        effectiveness: effectivenessMatch ? Math.round(parseFloat(effectivenessMatch[1])) : null,
        quality: qualityMatch ? Math.round(parseFloat(qualityMatch[1])) : null,
        safety: safetyMatch ? Math.round(parseFloat(safetyMatch[1])) : null,
        value: valueMatch ? Math.round(parseFloat(valueMatch[1])) : null,
        satisfaction: satisfactionMatch ? Math.round(parseFloat(satisfactionMatch[1])) : null,
        taste: tasteMatch ? Math.round(parseFloat(tasteMatch[1])) : null,
      };
      gptText = analysisMatch ? analysisMatch[1].trim() : gptResponse;
      console.log('[/identify] GPT analysis complete, rating:', rating, 'scores:', scores);
    }

    console.log('[/identify] Sending response');
    res.json({
      ok: true,
      normalized: norm,
      found: !!doc,
      doc: doc || null,
      analysis: gptText || 'No analysis available.',
      rating: rating,
      scores: doc ? scores : null,
    });
  } catch (e) {
    console.error('[/identify] Error:', e.message);
    res.status(500).json({ ok:false, error:e.message });
  }
});

// helper function that calls your GPT API with timeout
async function askGPT(prompt) {
  try {
    console.log('[askGPT] Starting GPT request...');

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a supplement analysis assistant. Be concise and factual. Provide one paragraph analysis. Rate this supplement on a scale of 0 to 100' },
          { role: 'user', content: prompt }
        ]
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!r.ok) {
      const errorText = await r.text();
      console.error('[askGPT] OpenAI API error:', r.status, errorText);
      return null;
    }

    const data = await r.json();
    console.log('[askGPT] GPT response received');
    return data.choices?.[0]?.message?.content ?? null;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('[askGPT] Request timed out after 15 seconds');
    } else {
      console.error('[askGPT] Error calling GPT:', error.message);
    }
    return null;
  }
}

function normalizeBarcode(raw, sym) {
  const s = String(raw||'').replace(/\D/g,'');
  let ean13=null, upcA=null, valid=false;
  if (sym==='upc-a' || (s.length===12 && !s.startsWith('0'))) {
    upcA=s; ean13='0'+s; valid=isValidEAN13(ean13);
  } else if (sym==='ean-13' || s.length===13) {
    ean13=s; valid=isValidEAN13(ean13); if (ean13.startsWith('0')) upcA=ean13.slice(1);
  }
  return { ean13, upcA, valid };
}
function isValidEAN13(code){
  if(!/^\d{13}$/.test(code)) return false;
  const ds=code.split('').map(Number); const chk=ds.pop();
  const sum=ds.reverse().reduce((a,d,i)=>a+d*(i%2===0?3:1),0);
  return ((10-(sum%10))%10)===chk;
}
async function fromOpenFoodFacts(code){
  const r = await fetch(`https://world.openfoodfacts.org/api/v0/product/${code}.json`);
  if(!r.ok) return null;
  const j = await r.json();
  console.log('OFF RAW >>>', JSON.stringify(j, null, 2)); 
  if(j.status!==1) return null;
  const p=j.product||{};
  return {
    barcode: code,
    name: p.product_name || p.generic_name || null,
    brand: (p.brands||'').split(',')[0]?.trim() || null,
    images: [p.image_front_url, p.image_url, p.image_small_url].filter(Boolean),
    ingredientsText: p.ingredients_text || null,
    panel: null,
    source: 'OFF'
  };

  mongoose.connect() 
}