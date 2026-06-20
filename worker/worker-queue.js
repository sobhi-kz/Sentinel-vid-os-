// worker/worker-queue.js
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR = path.resolve(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const jobs = new Map();

function enqueueJob(story) {
  const id = uuidv4();
  const job = { id, storyId: story.id, status: 'queued', createdAt: new Date().toISOString() };
  jobs.set(id, job);

  process.nextTick(() => {
    runRenderJob(id, story).catch(err => {
      console.error('Render job failed', err);
      job.status = 'failed';
      job.error = err.message;
      jobs.set(id, job);
    });
  });

  return job;
}

async function runRenderJob(jobId, story) {
  const job = jobs.get(jobId);
  job.status = 'running';
  jobs.set(jobId, job);

  const storyFile = path.join(DATA_DIR, `${story.id}.json`);
  fs.writeFileSync(storyFile, JSON.stringify(story, null, 2));

  const renderer = spawn(process.execPath, [path.join(__dirname, 'renderer.js'), story.id], { stdio: 'inherit' });

  await new Promise((resolve, reject) => {
    renderer.on('exit', code => {
      if (code === 0) resolve();
      else reject(new Error(`renderer exited ${code}`));
    });
  });

  job.status = 'done';
  jobs.set(jobId, job);
}

module.exports = { enqueueJob, jobs };
