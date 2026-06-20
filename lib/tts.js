const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

async function synthesizeGoogleWithTimepoints(ssmlText, outPath) {
  const TextToSpeechClient = require('@google-cloud/text-to-speech').TextToSpeechClient;
  const client = new TextToSpeechClient();
  const request = {
    input: { ssml: ssmlText },
    voice: { languageCode: 'fr-FR', ssmlGender: 'NEUTRAL' },
    audioConfig: { audioEncoding: 'MP3', speakingRate: 1.0 },
    enableTimePointing: ['SSML_MARK']
  };

  const [response] = await client.synthesizeSpeech(request);
  if (!response || !response.audioContent) throw new Error('Google TTS returned no audio');
  fs.writeFileSync(outPath, response.audioContent, 'binary');
  const timepoints = response.timepoints || response.time_points || response.timepointsResult || [];
  const normalized = Array.isArray(timepoints) ? timepoints.map(tp => {
    if (tp.markName && tp.timeSeconds) return { name: tp.markName, time: Number(tp.timeSeconds) };
    if (tp.name && tp.time) return { name: tp.name, time: Number(tp.time) };
    const keys = Object.keys(tp);
    return { name: tp.markName || tp.name || keys[0], time: Number(tp.timeSeconds || tp.time || tp[keys[0]]) || 0 };
  }) : [];
  return { audioPath: outPath, timepoints: normalized };
}

function synthesizeCoqui(text, outPath) {
  try {
    const res = spawnSync('tts', ['--text', text, '--out_path', outPath], { stdio: 'inherit' });
    if (res.status !== 0) throw new Error('Coqui TTS failed');
    return { audioPath: outPath, timepoints: [] };
  } catch (err) {
    throw new Error('Coqui TTS not available. Install via pip: pip install TTS');
  }
}

async function synthesizeScene(ssmlOrText, outPath, useSSML = true) {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      return await synthesizeGoogleWithTimepoints(ssmlOrText, outPath);
    } catch (err) {
      console.warn('Google TTS failed, falling back to Coqui:', err.message);
    }
  }
  return synthesizeCoqui(useSSML ? ssmlOrText.replace(/<[^>]*>/g,'') : ssmlOrText, outPath);
}

module.exports = { synthesizeScene };
