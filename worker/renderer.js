// worker/renderer.js (mis à jour pour timepoints -> srt, et mise à jour story status)
const fs = require('fs');
const path = require('path');
const { synthesizeScene } = require('../lib/tts');
const { spawnSync } = require('child_process');
const puppeteer = require('puppeteer');

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const RENDER_TMP = path.resolve(__dirname, '..', 'tmp');
if (!fs.existsSync(RENDER_TMP)) fs.mkdirSync(RENDER_TMP, { recursive: true });

async function renderSceneToFrames(sceneText, outFramesDir, duration = 10, fps = 30) {
  if (!fs.existsSync(outFramesDir)) fs.mkdirSync(outFramesDir, { recursive: true });

  const htmlPath = path.resolve(__dirname, '..', 'renderer', 'scene.html');
  const url = 'file://' + htmlPath + `?text=${encodeURIComponent(sceneText)}&duration=${duration}&fps=${fps}`;

  const browser = await puppeteer.launch({ args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: parseInt(process.env.VIDEO_WIDTH || '1080'), height: parseInt(process.env.VIDEO_HEIGHT || '1920') });
  await page.goto(url);
  await page.waitForFunction('window.__SENTINEL_READY === true', { timeout: 30000 });

  const totalFrames = duration * fps;
  for (let i = 0; i < totalFrames; i++) {
    const filename = path.join(outFramesDir, `frame_${String(i).padStart(5,'0')}.png`);
    await page.screenshot({ path: filename });
    await page.evaluate((i, fps) => {
      if (window.advanceFrame) window.advanceFrame(1 / fps);
    }, i, fps);
  }

  await browser.close();
}

function framesToVideo(framesDir, audioPath, outVideoPath, fps = 30) {
  const cmd = [
    '-y',
    '-r', String(fps),
    '-f', 'image2',
    '-i', path.join(framesDir, 'frame_%05d.png'),
    '-i', audioPath,
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-vf', `scale=${process.env.VIDEO_WIDTH || 1080}:${process.env.VIDEO_HEIGHT || 1920}`,
    '-c:a', 'aac',
    '-b:a', '128k',
    '-shortest',
    outVideoPath
  ];
  const res = spawnSync('ffmpeg', cmd, { stdio: 'inherit' });
  if (res.status !== 0) throw new Error('ffmpeg failed when encoding video');
}

async function renderStory(storyId) {
  const storyFile = path.join(DATA_DIR, `${storyId}.json`);
  if (!fs.existsSync(storyFile)) throw new Error('story not found');
  const story = JSON.parse(fs.readFileSync(storyFile, 'utf-8'));

  const scenes = story.scenes && story.scenes.length ? story.scenes : [{ id:1, text: story.generatedRaw || story.prompt || 'Une histoire', duration_sec: parseInt(process.env.DEFAULT_DURATION||60) }];
  const clips = [];
  const timepointsAll = [];

  for (const scene of scenes) {
    const sceneId = `s${scene.id}`;
    const audioPath = path.join(RENDER_TMP, `${storyId}_${sceneId}.mp3`);
    console.log('Synthesize scene', scene.id);
    const ssml = `<speak><mark name="scene${scene.id}"/>${escapeForSSML(scene.text)}</speak>`;
    const ttsResult = await synthesizeScene(ssml, audioPath, true);
    if (Array.isArray(ttsResult.timepoints) && ttsResult.timepoints.length > 0) {
      ttsResult.timepoints.forEach(tp => {
        timepointsAll.push({ name: tp.name, time: tp.time });
      });
    } else {
      timepointsAll.push({ name: `scene${scene.id}`, time: null });
    }

    const framesDir = path.join(RENDER_TMP, `${storyId}_${sceneId}_frames`);
    await renderSceneToFrames(scene.text, framesDir, scene.duration_sec || 10, 30);

    const clipPath = path.join(RENDER_TMP, `${storyId}_${sceneId}.mp4`);
    framesToVideo(framesDir, audioPath, clipPath, 30);
    clips.push(clipPath);
  }

  const tpFile = path.join(RENDER_TMP, `${storyId}_timepoints.json`);
  fs.writeFileSync(tpFile, JSON.stringify(timepointsAll, null, 2));

  const scenesForSrt = scenes.map(s => ({ id: s.id, duration_sec: s.duration_sec || 10, text: s.text }));
  const scenesFile = path.join(RENDER_TMP, `${storyId}_scenes.json`);
  fs.writeFileSync(scenesFile, JSON.stringify(scenesForSrt, null, 2));

  const srtOut = path.join(DATA_DIR, `${storyId}.srt`);
  const converter = path.join(__dirname, '..', 'scripts', 'convert_timepoints_to_srt.js');
  const hasNull = timepointsAll.some(t => t.time === null || t.time === undefined);
  if (hasNull) {
    let cursor = 0;
    const simple = scenesForSrt.map(s => {
      const name = `scene${s.id}`;
      const t = cursor;
      cursor += s.duration_sec;
      return { name, time: t };
    });
    fs.writeFileSync(tpFile, JSON.stringify(simple, null, 2));
  }
  const res = spawnSync(process.execPath, [converter, tpFile, scenesFile, srtOut], { stdio: 'inherit' });
  if (res.status !== 0) console.warn('SRT conversion returned non-zero code');

  const listFile = path.join(RENDER_TMP, `${storyId}_clips.txt`);
  fs.writeFileSync(listFile, clips.map(p => `file '${p.replace(/'/g,"'\\''")}'`).join('\n'));
  const outMp4 = path.join(DATA_DIR, `${storyId}.mp4`);
  const concatCmd = ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', outMp4];
  const concatRes = spawnSync('ffmpeg', concatCmd, { stdio: 'inherit' });
  if (concatRes.status !== 0) throw new Error('ffmpeg concat failed');

  story.status = 'rendered';
  story.video = `${storyId}.mp4`;
  story.srt = `${storyId}.srt`;
  fs.writeFileSync(storyFile, JSON.stringify(story, null, 2));

  console.log('Rendered video at', outMp4);
  return outMp4;
}

function escapeForSSML(text) {
  if (!text) return '';
  return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

if (require.main === module) {
  const arg = process.argv[2];
  if (arg === '--test') {
    (async () => {
      const testText = 'Bonjour, ceci est un test. Voici la deuxième phrase du test. Fin du test.';
      const tmpId = 'test_story';
      const story = { id: tmpId, scenes: [ { id:1, text: testText, duration_sec: 10 } ] };
      const file = path.join(DATA_DIR, `${tmpId}.json`);
      fs.writeFileSync(file, JSON.stringify(story, null, 2));
      await renderStory(tmpId);
      process.exit(0);
    })().catch(err => { console.error(err); process.exit(1); });
  } else if (arg) {
    (async () => {
      try {
        await renderStory(arg);
        process.exit(0);
      } catch (err) {
        console.error(err);
        process.exit(2);
      }
    })();
  } else {
    console.error('Usage: node renderer.js <storyId>  OR --test');
    process.exit(1);
  }
}
