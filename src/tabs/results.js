import { scoreBadgeHTML, scoreBarHTML } from '../ui/score-badge.js';
import { drawOverlay } from '../pose/overlay.js';

const EXERCISE_LABELS = {
  squat:           'Barbell Squat',
  deadlift:        'Deadlift',
  'bench-press':   'Bench Press',
  'push-up':       'Push-up',
};

const SEVERITY_COLOR = { error: 'var(--score-red)', warning: 'var(--score-amber)' };
const SEVERITY_ICON  = { error: '✗', warning: '~' };

function scoreColorVar(score) {
  if (score >= 75) return 'var(--score-green)';
  if (score >= 51) return 'var(--score-amber)';
  return 'var(--score-red)';
}

export function renderResults({ exercise, weight, unit, score, ruleResults }) {
  const label = EXERCISE_LABELS[exercise] ?? exercise;

  const issueRows = ruleResults.map(r => {
    if (r.pass) {
      return `<div style="background:#001a08;border-left:3px solid var(--score-green);padding:8px 10px;border-radius:0 var(--radius) var(--radius) 0;margin-bottom:0">
        <div style="color:var(--score-green);font-weight:700;font-size:0.7rem">✓ ${r.label}</div>
      </div>`;
    }
    const col = SEVERITY_COLOR[r.severity] ?? 'var(--score-red)';
    const icon = SEVERITY_ICON[r.severity] ?? '✗';
    return `<div style="background:#1a0800;border-left:3px solid ${col};padding:8px 10px;border-radius:0 var(--radius) var(--radius) 0;margin-bottom:0">
      <div style="color:${col};font-weight:700;font-size:0.7rem">${icon} ${r.label}</div>
      <div style="color:var(--text-muted);font-size:0.65rem;margin-top:3px">${r.cue}</div>
    </div>`;
  }).join('');

  return `
<style>
  .ff-results-body { display: flex; flex-direction: column; }
  .ff-results-main { display: flex; flex-direction: column; gap: 0; }
  .ff-video-wrap   { position: relative; background: #000; border-radius: var(--radius) var(--radius) 0 0; overflow: hidden; }
  .ff-score-strip  { background: #111; border-radius: 0 0 var(--radius) var(--radius);
                     padding: 6px 10px; display: flex; align-items: center; gap: 10px; }
  .ff-panel        { display: flex; flex-direction: column; margin-top: 4px; }
  .ff-panel-inner  { display: flex; flex-direction: column; gap: 4px; }

  @media (min-width: 700px) {
    .ff-results-main { flex-direction: row; align-items: stretch; }
    .ff-video-wrap   { flex: 1.2; border-radius: var(--radius) 0 0 var(--radius); }
    .ff-score-strip  { display: none; }
    .ff-panel        { flex: 1; margin-top: 0; min-width: 0; }
    .ff-panel-inner  { background: #111; border: 1px solid #1e1e1e;
                       border-left: none; border-radius: 0 var(--radius) var(--radius) 0;
                       padding: 12px; height: 100%; box-sizing: border-box; }
    .ff-score-desktop { display: flex !important; }
  }
  .ff-score-desktop { display: none; }
</style>

<div class="ff-results-body">
  <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;flex-wrap:wrap">
    <span style="font-weight:700;font-size:0.85rem">${label}</span>
    <span style="color:var(--text-muted);font-size:0.7rem">· ${weight} ${unit}</span>
    <span style="margin-left:auto">${scoreBadgeHTML(score)}</span>
  </div>

  <div class="ff-results-main">
    <div class="ff-video-wrap">
      <video id="result-video" style="width:100%;display:block" controls playsinline></video>
      <canvas id="overlay-canvas" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none"></canvas>
    </div>

    <div class="ff-score-strip">
      ${scoreBarHTML(score)}
    </div>

    <div class="ff-panel">
      <div class="ff-panel-inner">
        <div class="ff-score-desktop" style="flex-direction:column;gap:6px;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid #1e1e1e">
          <div style="display:flex;justify-content:space-between;align-items:baseline">
            <span style="font-size:0.6rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em">Form Score</span>
            <span style="font-size:1.5rem;font-weight:800;color:${scoreColorVar(score)};line-height:1">${score}</span>
          </div>
          <div style="margin-bottom:0">${scoreBarHTML(score)}</div>
        </div>
        ${issueRows}
      </div>
    </div>
  </div>

  <button class="btn-primary" id="analyze-another" style="margin-top:0.75rem">Analyze Another Video</button>
</div>
  `;
}

export function attachResultsListeners({ frames, ruleResults, exercise }) {
  const resultVideo = document.getElementById('result-video');
  const canvas      = document.getElementById('overlay-canvas');

  const videoSrc = sessionStorage.getItem('ff_video_src');
  if (videoSrc) {
    resultVideo.src = videoSrc;
  }

  resultVideo.addEventListener('timeupdate', () => {
    if (!frames.length) return;
    const ctx = canvas.getContext('2d');
    canvas.width  = resultVideo.videoWidth  || canvas.clientWidth;
    canvas.height = resultVideo.videoHeight || canvas.clientHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const fps = 30 / 10;
    const frameIdx = Math.min(Math.floor(resultVideo.currentTime * fps), frames.length - 1);
    drawOverlay(ctx, canvas.width, canvas.height, frames[frameIdx].image ?? frames[frameIdx], ruleResults, exercise);
  });

  document.getElementById('analyze-another').addEventListener('click', () => {
    import('../app.js').then(m => m.navigateTo('analyze'));
  });
}
