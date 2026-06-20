const fetch = require('node-fetch');

const MISTRAL_API_URL = process.env.MISTRAL_API_URL || 'https://api.mistral.ai/v1/generate';
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;

function tryParseJSONMaybe(text) {
  if (!text || typeof text !== 'string') return null;
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const maybe = text.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(maybe);
    } catch (e) {
      // fallthrough
    }
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

async function generateStory(prompt, opts = {}) {
  if (!MISTRAL_API_KEY) throw new Error('MISTRAL_API_KEY not set in env');

  const body = {
    input: prompt,
    temperature: 0.7,
    max_output_tokens: 800
  };

  const res = await fetch(MISTRAL_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${MISTRAL_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Mistral API error: ${res.status} ${text}`);
  }
  const data = await res.json();

  const collectedTexts = [];

  function collectStrings(obj) {
    if (!obj) return;
    if (typeof obj === 'string') collectedTexts.push(obj);
    else if (Array.isArray(obj)) obj.forEach(collectStrings);
    else if (typeof obj === 'object') Object.values(obj).forEach(collectStrings);
  }
  collectStrings(data);

  for (const t of collectedTexts) {
    const parsed = tryParseJSONMaybe(t);
    if (parsed) return parsed;
  }

  const fallback = collectedTexts.join('\n') || JSON.stringify(data);
  return { raw: fallback };
}

module.exports = { generateStory };
