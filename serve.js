const express = require('express');
const app = express();
const jsQR = require('jsqr');
const sharp = require('sharp');

require('dotenv').config();

const port = process.env.PORT || 3000;
console.log("Server using port:", port);
app.use(express.json({ limit: '50mb' }));  // for parsing application/json with larger payloads
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ===== INPUT VALIDATION & SECURITY MIDDLEWARE =====

// Rate limiting store (in-memory, replace with Redis for production)
const rateLimitStore = new Map();

// Rate limiting middleware
function rateLimit(maxRequests = 60, windowMs = 60000) {
  return (req, res, next) => {
    const clientIp = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const key = `${clientIp}:${req.path}`;

    if (!rateLimitStore.has(key)) {
      rateLimitStore.set(key, []);
    }

    const requests = rateLimitStore.get(key);
    // Remove old requests outside the window
    const validRequests = requests.filter(timestamp => now - timestamp < windowMs);

    if (validRequests.length >= maxRequests) {
      return res.status(429).json({
        ok: false,
        error: 'Too many requests. Please try again later.'
      });
    }

    validRequests.push(now);
    rateLimitStore.set(key, validRequests);

    // Cleanup old entries periodically
    if (Math.random() < 0.01) { // 1% chance on each request
      cleanupRateLimitStore(windowMs * 2);
    }

    next();
  };
}

function cleanupRateLimitStore(maxAge) {
  const now = Date.now();
  for (const [key, requests] of rateLimitStore.entries()) {
    const validRequests = requests.filter(timestamp => now - timestamp < maxAge);
    if (validRequests.length === 0) {
      rateLimitStore.delete(key);
    } else {
      rateLimitStore.set(key, validRequests);
    }
  }
}

// Input sanitization helpers
function sanitizeString(input, maxLength = 1000) {
  if (typeof input !== 'string') return '';
  return input
    .trim()
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
    .substring(0, maxLength);
}

function validateBase64Image(base64String) {
  if (typeof base64String !== 'string') return false;

  // Remove data URI prefix if present
  const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');

  // Check if it's valid base64
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
  if (!base64Regex.test(base64Data)) return false;

  // Check length (max 50MB when decoded)
  const sizeInBytes = (base64Data.length * 3) / 4;
  const maxSizeBytes = 50 * 1024 * 1024; // 50MB
  if (sizeInBytes > maxSizeBytes) return false;

  return true;
}

function validateBarcode(barcode) {
  if (!barcode || typeof barcode !== 'object') return false;

  // Validate raw barcode
  if (!barcode.raw || typeof barcode.raw !== 'string') return false;
  const sanitizedRaw = barcode.raw.trim();
  if (sanitizedRaw.length === 0 || sanitizedRaw.length > 50) return false;

  // Barcode should contain only digits, letters, and basic symbols
  if (!/^[A-Za-z0-9\-_]+$/.test(sanitizedRaw)) return false;

  // Validate symbology if present
  if (barcode.symbology) {
    if (typeof barcode.symbology !== 'string') return false;
    const validSymbologies = ['upc-a', 'ean-13', 'ean-8', 'code-128', 'code-39', 'unknown'];
    if (!validSymbologies.includes(barcode.symbology.toLowerCase())) return false;
  }

  return true;
}

app.listen(port, '0.0.0.0', () => {
  console.log(`Supp app running on http://0.0.0.0:${port}`);
});

app.get('/', (req, res) => {
  res.send('Up and Running');
});



app.post('/gpt', rateLimit(20, 60000), async (req, res) => {
  try {
    // Validate input
    const prompt = req.body?.prompt;
    if (!prompt) {
      return res.status(400).json({ ok: false, error: 'No prompt provided' });
    }

    // Type check and sanitize
    if (typeof prompt !== 'string') {
      return res.status(400).json({ ok: false, error: 'Prompt must be a string' });
    }

    const sanitizedPrompt = sanitizeString(prompt, 5000);

    if (sanitizedPrompt.length < 3) {
      return res.status(400).json({ ok: false, error: 'Prompt must be at least 3 characters' });
    }

    if (sanitizedPrompt.length > 5000) {
      return res.status(400).json({ ok: false, error: 'Prompt exceeds maximum length of 5000 characters' });
    }

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
          { role: 'user', content: sanitizedPrompt }
        ]
      })
    });

    if (!r.ok) return res.status(r.status).send(await r.text());
    const data = await r.json();
    const text = data.choices?.[0]?.message?.content ?? '';
    res.json({ ok: true, text });
  } catch (e) {
    console.error('[/gpt] Error:', e.message);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

app.post('/scan-image', rateLimit(30, 60000), async (req, res) => {
  try {
    console.log('[/scan-image] Request received');
    const { imageUri } = req.body || {};

    // Validate image URI presence
    if (!imageUri) {
      return res.status(400).json({ ok: false, error: 'No image provided' });
    }

    // Type check
    if (typeof imageUri !== 'string') {
      return res.status(400).json({ ok: false, error: 'Image URI must be a string' });
    }

    // Validate base64 image
    if (!validateBase64Image(imageUri)) {
      return res.status(400).json({ ok: false, error: 'Invalid image format or size' });
    }

    console.log('[/scan-image] Processing image...');

    // Remove data URI prefix if present
    const base64Data = imageUri.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    // Convert image to raw pixel data using sharp
    const { data, info } = await sharp(imageBuffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    console.log('[/scan-image] Image dimensions:', info.width, 'x', info.height);

    // Validate image dimensions
    if (info.width > 10000 || info.height > 10000) {
      return res.status(400).json({ ok: false, error: 'Image dimensions too large' });
    }

    // Convert to Uint8ClampedArray for jsQR
    const imageData = new Uint8ClampedArray(data.buffer);

    // Try to scan barcode
    const code = jsQR(imageData, info.width, info.height);

    if (!code) {
      console.log('[/scan-image] No barcode found in image');
      return res.json({ ok: true, found: false, message: 'No barcode detected in image' });
    }

    console.log('[/scan-image] Barcode found:', code.data);

    // Return the barcode data
    res.json({
      ok: true,
      found: true,
      barcode: {
        raw: code.data,
        symbology: 'unknown' // jsQR doesn't provide symbology info
      }
    });

  } catch (e) {
    console.error('[/scan-image] Error:', e.message);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

app.post('/identify', rateLimit(30, 60000), async (req, res) => {
  try {
    console.log('[/identify] Request received');
    const { barcode } = req.body || {};

    // Validate barcode object
    if (!validateBarcode(barcode)) {
      return res.status(400).json({ ok: false, error: 'Invalid barcode format' });
    }

    const norm = normalizeBarcode(barcode?.raw, barcode?.symbology);
    if (!norm.valid) {
      return res.status(400).json({ ok: false, error: 'Invalid barcode - failed checksum validation' });
    }

    console.log('[/identify] Fetching from OpenFoodFacts...');
    let doc = await fromOpenFoodFacts(norm.ean13 || norm.upcA);
    console.log('[/identify] OpenFoodFacts result:', doc ? 'Found' : 'Not found');

    let gptText = null;
    let rating = null;
    let scores = null;

    if (doc) {
      console.log('[/identify] Calling GPT for analysis...');

      // Sanitize data before including in prompt to prevent injection
      const safeName = sanitizeString(doc.name || doc.product_name || 'Unknown', 200);
      const safeBrand = sanitizeString(doc.brand || doc.brands || 'Unknown', 200);
      const safeIngredients = sanitizeString(doc.ingredientsText || doc.ingredients_text || 'Not available', 2000);

      // Sanitize nutriments object
      const safeNutriments = {};
      if (doc.nutriments && typeof doc.nutriments === 'object') {
        for (const [key, value] of Object.entries(doc.nutriments)) {
          if (typeof key === 'string' && key.length < 100) {
            const safeKey = sanitizeString(key, 100);
            if (typeof value === 'number' || typeof value === 'string') {
              safeNutriments[safeKey] = value;
            }
          }
        }
      }

      const prompt = `
Analyze this supplement and provide detailed scores.

Name: ${safeName}
Brand: ${safeBrand}
Ingredients: ${safeIngredients}
Nutritional info: ${JSON.stringify(safeNutriments, null, 2)}

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
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

// helper function that calls your GPT API with timeout
async function askGPT(prompt) {
  try {
    // Validate and sanitize prompt
    if (typeof prompt !== 'string') {
      console.error('[askGPT] Invalid prompt type:', typeof prompt);
      return null;
    }

    const sanitizedPrompt = sanitizeString(prompt, 10000);

    if (sanitizedPrompt.length === 0) {
      console.error('[askGPT] Empty prompt after sanitization');
      return null;
    }

    console.log('[askGPT] Starting GPT request...');

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

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
          { role: 'user', content: sanitizedPrompt }
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
      console.error('[askGPT] Request timed out after 30 seconds');
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
}