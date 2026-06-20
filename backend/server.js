// backend/server.js (mis à jour pour parser JSON de Mistral)
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { generateStory } = require('../lib/mistral');
const { enqueueJob } = require('../worker/worker-queue');

const DATA_DIR = path.resolve(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const app = express();
app.use(bodyParser.json());
app.use(express.static(path.resolve(__dirname, '..', 'public')));

app.post('/api/stories', async (req, res) => {
  try {
    const { title, prompt, language = 'fr', duration = parseInt(process.env.DEFAULT_DURATION || '60') } = req.body;
    if (!prompt && !title) return res.status(400).json({ error: 'title or prompt required' });

    const userPrompt = prompt || `Écris une histoire courte en français pour TikTok (durée ~${duration}s) à partir du titre: ${title}`;

    const generated = await generateStory(userPrompt, { language, duration });
    const id = uuidv4();

    // Normalize generated response into story object
    const story = {
      id,
      title: title || (generated.title || 'Histoire Sentinel'),
      prompt: userPrompt,
      generatedRaw: generated.raw || null,
      scenes: Array.isArray(generated.scenes) ? generated.scenes : ([]),
      summary: generated.summary || '',
      tiktok_caption: generated.tiktok_caption || '',
      hashtags: generated.hashtags || [],
      status: 'generated',
      createdAt: new Date().toISOString()
    };

    // If generated had raw text but no scenes, store raw text as single-scene fallback
    if ((!story.scenes || story.scenes.length === 0) && (typeof generated === 'string' || generated.raw)) {
      const text = (typeof generated === 'string') ? generated : generated.raw;
      story.generatedRaw = text;
      // naive split into sentences
      const sentences = (text || '').split(/[\.!\?]\s+/).filter(Boolean);
      const scenesCount = Math.min(6, Math.max(1, Math.ceil((duration)/10)));
      const per = Math.ceil(sentences.length / scenesCount) || 1;
      const scenes = [];
      for (let i = 0; i < scenesCount; i++) {
        const slice = sentences.slice(i*per, (i+1)*per).join('. ');
        scenes.push({ id: i+1, text: slice || sentences.slice(0,1).join('. '), duration_sec: Math.floor(duration/scenesCount), visual_instructions: '' });
      }
      story.scenes = scenes;
    } else {
      // Ensure each scene has duration_sec and id
      story.scenes = story.scenes.map((s, idx) => ({
        id: s.id || idx+1,
        text: s.text || s.dialogue || '',
        duration_sec: s.duration_sec || Math.floor(duration / Math.max(1, story.scenes.length)),
        visual_instructions: s.visual_instructions || ''
      }));
    }

    fs.writeFileSync(path.join(DATA_DIR, `${id}.json`), JSON.stringify(story, null, 2));
    return res.json({ story });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'generation failed', details: err.message });
  }
});

app.post('/api/stories/:id/render', async (req, res) => {
  const id = req.params.id;
  const file = path.join(DATA_DIR, `${id}.json`);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'story not found' });
  const story = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const job = enqueueJob(story);
  // update story status quickly
  story.status = 'queued';
  fs.writeFileSync(file, JSON.stringify(story, null, 2));
  return res.json({ jobId: job.id, status: job.status });
});

app.get('/api/stories/:id/status', (req, res) => {
  const id = req.params.id;
  const file = path.join(DATA_DIR, `${id}.json`);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'story not found' });
  const story = JSON.parse(fs.readFileSync(file, 'utf-8'));
  return res.json({ story });
});

app.get('/api/stories/:id/video', (req, res) => {
  const id = req.params.id;
  const mp4 = path.join(DATA_DIR, `${id}.mp4`);
  if (!fs.existsSync(mp4)) return res.status(404).json({ error: 'video not found' });
  res.sendFile(mp4);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Sentinel API running on http://localhost:${PORT}`));
