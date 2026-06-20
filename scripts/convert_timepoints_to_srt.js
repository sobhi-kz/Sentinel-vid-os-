// scripts/convert_timepoints_to_srt.js
const fs = require('fs');
const path = require('path');

function fmt(ms) {
  const hours = Math.floor(ms / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  const millis = ms % 1000;
  return `${String(hours).padStart(2,'0')}:${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')},${String(millis).padStart(3,'0')}`;
}

function main() {
  const [,, tpFile, scenesFile, outFile] = process.argv;
  if (!tpFile || !scenesFile || !outFile) {
    console.error('Usage: node convert_timepoints_to_srt.js timepoints.json scenes.json out.srt');
    process.exit(2);
  }
  const tps = JSON.parse(fs.readFileSync(tpFile));
  const scenes = JSON.parse(fs.readFileSync(scenesFile));

  const startsMap = {};
  for (const tp of tps) {
    const m = tp.name.match(/scene[_-]?(\d+)/i);
    if (m) {
      startsMap[Number(m[1])] = Number(tp.time);
    }
  }

  let fallbackTime = 0;
  for (const s of scenes) {
    if (startsMap[s.id] === undefined) {
      startsMap[s.id] = fallbackTime;
    }
    fallbackTime = startsMap[s.id] + (s.duration_sec || 10);
  }

  const entries = [];
  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i];
    const startSec = startsMap[s.id];
    let endSec = startSec + (s.duration_sec || 10);
    if (startsMap[scenes[i+1]?.id] !== undefined) endSec = startsMap[scenes[i+1].id];
    const startMs = Math.round(startSec * 1000);
    const endMs = Math.round(endSec * 1000);
    const text = s.text.replace(/\s+/g,' ').trim();
    entries.push({ startMs, endMs, text });
  }

  const lines = [];
  entries.forEach((e, idx) => {
    lines.push(String(idx+1));
    lines.push(`${fmt(e.startMs)} --> ${fmt(e.endMs)}`);
    const max = 42;
    const parts = [];
    for (let i=0;i<e.text.length;i+=max) parts.push(e.text.slice(i, i+max));
    lines.push(...parts);
    lines.push(''); 
  });

  fs.writeFileSync(outFile, lines.join('\n'), 'utf-8');
  console.log('Wrote SRT to', outFile);
}

if (require.main === module) main();
