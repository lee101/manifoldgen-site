const fs = require('fs');
const path = require('path');

const FIXTURES = path.resolve(__dirname, '../../fixtures');
const CLIP = path.join(FIXTURES, 'motion-clip.mp4');
const SONG = path.join(FIXTURES, 'motion-song.wav');
const CDN = 'https://cdn.test';
const TINY_JPEG = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');

const MOTION_PAGES = [
  { slug: 'motion-fx', service: 'motion-fx', name: 'Motion FX', preset: null, price: '$0.30' },
  { slug: 'anime-fight-fx', service: 'motion-fx', name: 'Anime Fight FX', preset: 'anime-fight', price: '$0.30' },
  { slug: 'ki-aura-fx', service: 'motion-fx', name: 'Power Aura FX', preset: 'ki-aura', price: '$0.30' },
  { slug: 'lightning-fx', service: 'motion-fx', name: 'Lightning FX', preset: 'lightning', price: '$0.30' },
  { slug: 'fight-game-hud', service: 'motion-fx', name: 'Fight Game HUD', preset: 'game-hud', price: '$0.30' },
  { slug: 'motion-exaggerate-fx', service: 'motion-fx', name: 'Motion Exaggerate FX', preset: 'exaggerate', price: '$0.30' },
  { slug: 'afterimage-fx', service: 'motion-fx', name: 'Afterimage Echo FX', preset: 'echo', price: '$0.30' },
  { slug: 'fight-reel-reframe', service: 'motion-fx', name: 'Fight Reel Reframe', preset: 'anime-fight', aspect: '9:16', price: '$0.30' },
  { slug: 'beat-drop-fx', service: 'beat-drop', name: 'Beat Drop FX', preset: null, price: '$0.20' },
  { slug: 'motion-tracker', service: 'motion-track', name: 'Motion Tracker', preset: null, price: '$0.10' },
  { slug: 'motion-score', service: 'motion-score', name: 'Motion Score', preset: null, price: '$0.25' },
];

const STATS = {
  fighters: {
    1: { frames: 120, strikes: 4, impacts: 2, hits_taken: 1, avg_power: 1.1, top_speed: 3.44, best_combo: 2, active_seconds: 5 },
    2: { frames: 118, strikes: 3, impacts: 1, hits_taken: 2, avg_power: 0.8, top_speed: 2.1, best_combo: 1, active_seconds: 4.9 },
  },
  total_strikes: 7, total_impacts: 3, peak_intensity_t: 2.1, bpm: 84.7, most_active: '1',
};

const RESULTS = {
  'motion-fx': { video_url: `${CDN}/result.mp4`, poster_url: `${CDN}/poster.jpg`, tracks_count: 2, events_count: 7, bpm: 84.7, duration_seconds: 5, charged_usd: 0.3, seconds: 5, stats: STATS },
  'beat-drop': { video_url: `${CDN}/beat.mp4`, poster_url: `${CDN}/poster.jpg`, duration_seconds: 5, charged_usd: 0.2, seconds: 5 },
  'motion-track': {
    video_url: `${CDN}/preview.mp4`, preview_url: `${CDN}/preview.mp4`, guide_url: `${CDN}/guide.mp4`, tracks_url: `${CDN}/tracks.json`, signals_url: `${CDN}/signals.json`,
    poster_url: `${CDN}/poster.jpg`, tracks_count: 2, events_count: 7, bpm: 84.7, duration_seconds: 5, charged_usd: 0.1, seconds: 5, stats: STATS,
  },
  'motion-score': { video_url: `${CDN}/score.mp4`, audio_url: `${CDN}/score.wav`, cues_url: `${CDN}/cues.json`, poster_url: `${CDN}/poster.jpg`, tracks_count: 2, events_count: 14, bpm: 144, duration_seconds: 5, charged_usd: 0.25, music_prompt: '144 BPM martial arts action score, tense, building', seconds: 5 },
};

async function signIn(page) {
  await page.addInitScript(() => {
    localStorage.setItem('userData', JSON.stringify({ api_key: 'test-key', credits: 100, credit_price_usd: 0.01 }));
    try { Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }); } catch { /* keep native */ }
  });
}

async function mockBackend(page, { service = 'motion-fx', jobStatuses = ['queued', 'processing', 'completed'], failWith = '' } = {}) {
  const calls = { service: [], presign: [], uploads: [], polls: 0 };
  await page.route('**/api/auth/session', (route) => route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/studio/assets/presign', async (route) => {
    const body = route.request().postDataJSON();
    calls.presign.push(body);
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ upload_url: `https://upload.test/put/${encodeURIComponent(body.filename)}`, public_url: `${CDN}/${encodeURIComponent(body.filename)}` }),
    });
  });
  await page.route('https://upload.test/put/**', async (route) => {
    calls.uploads.push(route.request().url());
    await route.fulfill({ status: 200, body: '' });
  });
  await page.route('**/api/service', async (route) => {
    calls.service.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ result: { job_id: 'job-1', status: 'queued' } }) });
  });
  await page.route('**/api/video-jobs/job-1', async (route) => {
    const status = jobStatuses[Math.min(calls.polls, jobStatuses.length - 1)];
    calls.polls += 1;
    const job = status === 'completed' ? { status, result: RESULTS[service] }
      : status === 'failed' ? { status, error: failWith || 'The job failed; you were not charged' } : { status, result: { stage: status } };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ job }) });
  });
  await page.route(`${CDN}/**`, async (route) => {
    const url = route.request().url();
    if (/\.mp4(\?|$)/.test(url)) return route.fulfill({ status: 200, contentType: 'video/mp4', body: fs.readFileSync(CLIP) });
    if (/\.jpg(\?|$)/.test(url)) return route.fulfill({ status: 200, contentType: 'image/jpeg', body: TINY_JPEG });
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.route('https://manifoldgenstatic.manifoldgen.com/**', (route) => {
    const url = route.request().url();
    if (/\.mp4(\?|$)/.test(url)) return route.fulfill({ status: 200, contentType: 'video/mp4', body: fs.readFileSync(CLIP) });
    if (/\.jpg(\?|$)/.test(url)) return route.fulfill({ status: 200, contentType: 'image/jpeg', body: TINY_JPEG });
    return route.fulfill({ status: 204, body: '' });
  });
  return calls;
}

async function upload(page, testId, file) {
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByTestId(testId).click()]);
  await chooser.setFiles(file);
}

async function addClip(page) {
  await upload(page, 'video-drop', CLIP);
  await page.getByTestId('video-drop').filter({ hasText: 'click to replace' }).waitFor();
}

async function runToResult(page, { audio = false } = {}) {
  await addClip(page);
  if (audio) {
    await upload(page, 'audio-drop', SONG);
    await page.getByTestId('audio-drop').filter({ hasText: 'motion-song.wav' }).waitFor();
  }
  await page.getByTestId('production-run').click();
  await page.getByTestId('share-row').waitFor({ timeout: 30_000 });
}

module.exports = { STATS, CDN, CLIP, SONG, MOTION_PAGES, RESULTS, signIn, mockBackend, upload, addClip, runToResult };
