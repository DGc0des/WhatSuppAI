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
        model: 'gpt-4o-mini', // or 'gpt-4.1-mini'
        messages: [
          { role: 'system', content: 'You are a concise, helpful assistant.' },
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
    const { barcode } = req.body || {};
    const norm = normalizeBarcode(barcode?.raw, barcode?.symbology);
    if (!norm.valid) return res.status(400).json({ ok:false, error:'Invalid barcode' });

    let doc = await fromOpenFoodFacts(norm.ean13 || norm.upcA);
    // fallback logic here...

    let gptText = null;
    if (doc) {
  const prompt = `
Analyze this supplement for safety, effectiveness, and common usage.

Name: ${doc.name || doc.product_name}
Brand: ${doc.brand || doc.brands}
Ingredients: ${doc.ingredientsText || doc.ingredients_text}
Nutritional info: ${JSON.stringify(doc.nutriments || {}, null, 2)}`;
  gptText = await askGPT(prompt);
}

    res.json({
      ok: true,
      normalized: norm,
      found: !!doc,
      doc: doc || null,
      analysis: gptText || 'No analysis available.',
    });
  } catch (e) {
    res.status(500).json({ ok:false, error:e.message });
  }
});

// helper function that calls your GPT API
async function askGPT(prompt) {
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
    })
  });
  const data = await r.json();
  return data.choices?.[0]?.message?.content ?? null;
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