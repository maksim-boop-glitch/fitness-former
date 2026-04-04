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

export function renderResults({ exercise, weight, unit, score, ruleResults }) {
  const label = EXERCISE_LABELS[exercise] ?? exercise;

  const issueRows = ruleResults.map(r => {
    if (r.pass) {
      return `<div style="background:#001a08;border-left:3px solid var(--score-green);padding:8px 10px;border-radius:0 var(--radius) var(--radius) 0;margin-bottom:4px">
        <div style="color:var(--score-green);font-weight:700;font-size:0.7rem">✓ ${r.label}</div>
      </div>`;
    }
    const col = SEVERITY_COLOR[r.severity] ?? 'var(--score-red)';
    const icon = SEVERITY_ICON[r.severity] ?? '✗';
    return `<div style="background:#1a0800;border-left:3px solid ${col};padding:8px 10px;border-radius:0 var(--radius) var(--radius) 0;margin-bottom:4px">
      <div style="color:${col};font-weight:700;font-size:0.7rem">${icon} ${r.label}</div>
      <div style="color:var(--text-muted);font-size:0.65rem;margin-top:3px">${r.cue}</div>
    </div>`;
  }).join('');

  return `
    <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.75rem;flex-wrap:wrap">
      <span style="font-weight:700;font-size:0.85rem">${label}</span>
      <span style="color:var(--text-muted);font-size:0.7rem">· ${weight} ${unit}</span>
      <span style="margin-left:auto">${scoreBadgeHTML(score)}</span>
    </div>

    ${scoreBarHTML(score)}

    <div style="position:relative;background:#000;border-radius:var(--radius);margin-bottom:0.75rem;overflow:hidden">
      <video id="result-video" style="width:100%;display:block" controls playsinline></video>
      <canvas id="overlay-canvas" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none"></canvas>
    </div>

    <div style="margin-bottom:1rem">${issueRows}</div>

    <button class="btn-primary" id="analyze-another">Analyze Another Video</button>
  `;
}

export function attachResultsListeners({ frames, ruleResults }) {
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
    drawOverlay(ctx, canvas.width, canvas.height, frames[frameIdx], ruleResults);
  });

  document.getElementById('analyze-another').addEventListener('click', () => {
    import('../app.js').then(m => m.navigateTo('analyze'));
  });
}
