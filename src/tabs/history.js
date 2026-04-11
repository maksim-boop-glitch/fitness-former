import { loadSessions } from '../storage.js';

const EXERCISE_LABELS = {
  squat:         'Barbell Squat',
  deadlift:      'Deadlift',
  'bench-press': 'Bench Press',
  'push-up':     'Push-up',
};

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function scoreColor(score) {
  if (score >= 75) return '#00cc44';
  if (score >= 51) return '#cc8800';
  return '#cc2200';
}

function formatWeight(weight, unit) {
  return weight === 0 ? 'Bodyweight' : `${weight} ${unit}`;
}

function formatDate(iso) {
  const d = new Date(iso);
  return isNaN(d) ? '—' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function renderDots(ruleResults) {
  return ruleResults.slice(0, 3).map(r => {
    const col = r.pass ? '#00cc44' : (r.severity === 'error' ? '#cc2200' : '#cc8800');
    return `<span style="width:7px;height:7px;border-radius:50%;background:${col};display:inline-block"></span>`;
  }).join('');
}

function renderRuleRows(ruleResults) {
  return ruleResults.map(r => {
    const col  = r.pass ? '#00cc44' : (r.severity === 'error' ? '#cc2200' : '#cc8800');
    const bg   = r.pass ? '#001a08' : (r.severity === 'error' ? '#1a0000' : '#1a0c00');
    const icon = r.pass ? '✓' : (r.severity === 'error' ? '✗' : '~');
    return `
      <div style="background:${bg};border-left:3px solid ${col};padding:5px 8px;border-radius:0 4px 4px 0;margin-bottom:3px">
        <div style="color:${col};font-size:0.65rem;font-weight:700">${icon} ${esc(r.label)}</div>
        ${!r.pass ? `<div style="color:var(--text-muted);font-size:0.6rem;margin-top:1px">${esc(r.cue)}</div>` : ''}
      </div>`;
  }).join('');
}

function renderSessionCard(s, i) {
  const col   = scoreColor(s.score);
  const label = EXERCISE_LABELS[s.exercise] ?? s.exercise;
  return `
    <div style="background:var(--bg-card);border-radius:var(--radius);overflow:hidden">
      <div class="ff-history-card" data-idx="${i}"
           style="padding:10px;display:flex;align-items:center;gap:10px;cursor:pointer">
        <div style="width:38px;height:38px;border-radius:50%;background:#111;
                    border:2.5px solid ${col};display:flex;align-items:center;
                    justify-content:center;flex-shrink:0">
          <span style="font-size:0.65rem;font-weight:800;color:${col}">${Number(s.score)}</span>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:0.75rem;font-weight:700;color:var(--text)">${esc(label)}</div>
          <div style="font-size:0.6rem;color:var(--text-muted)">
            ${esc(formatWeight(s.weight, s.unit))} · ${esc(formatDate(s.date))}
          </div>
        </div>
        <div style="display:flex;gap:3px;align-items:center">${renderDots(s.ruleResults ?? [])}</div>
        <span class="ff-chevron" style="color:#444;font-size:0.8rem;transition:transform .2s">›</span>
      </div>
      <div class="ff-history-detail" id="ff-detail-${i}"
           style="display:none;padding:0 10px 10px">
        ${renderRuleRows(s.ruleResults ?? [])}
      </div>
    </div>`;
}

export function renderHistory() {
  const sessions = loadSessions();
  if (sessions.length === 0) {
    return `<p style="color:var(--text-muted);padding:2rem;text-align:center;font-size:0.8rem">
      No analyses yet.<br>Record a video to get started.
    </p>`;
  }
  return `
    <div style="padding:0.75rem;display:flex;flex-direction:column;gap:0.5rem">
      ${sessions.map((s, i) => renderSessionCard(s, i)).join('')}
    </div>`;
}

export function attachHistoryListeners() {
  document.querySelectorAll('.ff-history-card').forEach(card => {
    card.addEventListener('click', () => {
      const i      = card.dataset.idx;
      const detail = document.getElementById(`ff-detail-${i}`);
      const isOpen = detail.style.display !== 'none';

      // Collapse all
      document.querySelectorAll('.ff-history-detail').forEach(d => { d.style.display = 'none'; });
      document.querySelectorAll('.ff-chevron').forEach(c => { c.textContent = '›'; c.style.transform = ''; });

      if (!isOpen) {
        detail.style.display = 'block';
        card.querySelector('.ff-chevron').style.transform = 'rotate(90deg)';
      }
    });
  });
}
