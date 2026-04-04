import { MUSCLE_GROUPS, exercisesByMuscle, EXERCISES } from '../data/exercise-library.js';

let selectedMuscle = 'Chest';

export function renderExercises() {
  return `
    <div class="section-label" style="margin-top:0.5rem">Exercises</div>

    <div style="background:var(--bg-card);border-radius:var(--radius);padding:8px 12px;margin-bottom:0.75rem;display:flex;align-items:center;gap:6px">
      <span style="color:var(--text-muted)">🔍</span>
      <input id="exercise-search" placeholder="Search muscle or exercise…"
        style="background:none;border:none;outline:none;color:var(--text);font-size:0.8rem;flex:1" />
    </div>

    <div id="muscle-pills" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:0.75rem">
      ${MUSCLE_GROUPS.map(m => `
        <button data-muscle="${m}" style="
          background:${m === selectedMuscle ? 'var(--accent)' : 'var(--bg-card)'};
          color:${m === selectedMuscle ? '#fff' : 'var(--text-muted)'};
          border:none;border-radius:16px;padding:5px 12px;font-size:0.7rem;cursor:pointer">
          ${m}
        </button>
      `).join('')}
    </div>

    <div id="exercise-list">
      ${renderExerciseList(selectedMuscle)}
    </div>

    <div id="exercise-detail" style="display:none"></div>
  `;
}

function equipmentIcon(eq) {
  const map = { barbell: '🏋️', bodyweight: '💪', cable: '🔗', machine: '⚙️', dumbbell: '🥊', kettlebell: '🔔' };
  return map[eq] ?? '💪';
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function renderExerciseList(muscleOrItems) {
  const items = typeof muscleOrItems === 'string'
    ? exercisesByMuscle(muscleOrItems)
    : muscleOrItems;
  return items.map(ex => `
    <div class="card" data-exercise-id="${ex.id}" style="display:flex;align-items:center;gap:0.75rem;cursor:pointer;margin-bottom:6px">
      <div style="background:#2a1a0a;border-radius:6px;width:40px;height:40px;display:flex;align-items:center;justify-content:center;font-size:1.3rem;flex-shrink:0">
        ${equipmentIcon(ex.equipment)}
      </div>
      <div style="flex:1">
        <div style="font-weight:700;font-size:0.8rem">${ex.name}</div>
        <div style="color:var(--text-muted);font-size:0.65rem">${capitalize(ex.equipment)} · ${ex.muscle}</div>
        <div style="color:var(--accent);font-size:0.65rem;margin-top:2px">Form guide →</div>
      </div>
    </div>
  `).join('');
}

function renderExerciseDetail(ex) {
  return `
    <button id="back-to-list" style="background:none;border:none;color:var(--accent);font-size:0.8rem;cursor:pointer;margin-bottom:0.75rem">← Back</button>
    <div class="card">
      <div style="font-weight:700;font-size:0.95rem;margin-bottom:2px">${ex.name}</div>
      <div style="color:var(--text-muted);font-size:0.65rem;margin-bottom:0.75rem">${capitalize(ex.equipment)} · ${ex.muscle}</div>
      <div style="background:#000;border-radius:6px;height:140px;display:flex;align-items:center;justify-content:center;margin-bottom:0.75rem">
        <span style="color:#333;font-size:0.7rem">[ Form guide video ]</span>
      </div>
      <div style="font-size:0.65rem;color:var(--accent);font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px">Key cues</div>
      <ul style="padding-left:1rem;color:var(--text-dim);font-size:0.7rem;line-height:1.8">
        ${ex.cues.map(c => `<li>${c}</li>`).join('')}
      </ul>
      <button class="btn-primary" id="analyze-this-exercise" style="margin-top:1rem">
        Record &amp; Analyze This Exercise
      </button>
    </div>
  `;
}

export function attachExercisesListeners() {
  // Muscle pill switching
  document.getElementById('muscle-pills').addEventListener('click', e => {
    const btn = e.target.closest('[data-muscle]');
    if (!btn) return;
    selectedMuscle = btn.dataset.muscle;
    document.getElementById('exercise-list').innerHTML = renderExerciseList(selectedMuscle);
    document.querySelectorAll('#muscle-pills button').forEach(b => {
      const active = b.dataset.muscle === selectedMuscle;
      b.style.background = active ? 'var(--accent)' : 'var(--bg-card)';
      b.style.color = active ? '#fff' : 'var(--text-muted)';
    });
    attachCardListeners();
  });

  // Search
  document.getElementById('exercise-search').addEventListener('input', e => {
    const q = e.target.value.toLowerCase().trim();
    const filtered = q
      ? EXERCISES.filter(ex => ex.name.toLowerCase().includes(q) || ex.muscle.toLowerCase().includes(q))
      : exercisesByMuscle(selectedMuscle);
    document.getElementById('exercise-list').innerHTML = renderExerciseList(filtered);
    attachCardListeners();
  });

  attachCardListeners();
}

function attachCardListeners() {
  document.getElementById('exercise-list').addEventListener('click', e => {
    const card = e.target.closest('[data-exercise-id]');
    if (!card) return;
    const ex = EXERCISES.find(x => x.id === card.dataset.exerciseId);
    if (!ex) return;
    document.getElementById('exercise-list').style.display = 'none';
    const detail = document.getElementById('exercise-detail');
    detail.style.display = 'block';
    detail.innerHTML = renderExerciseDetail(ex);

    document.getElementById('back-to-list').addEventListener('click', () => {
      detail.style.display = 'none';
      document.getElementById('exercise-list').style.display = 'block';
    });

    document.getElementById('analyze-this-exercise').addEventListener('click', () => {
      import('../app.js').then(m => m.navigateTo('analyze'));
    });
  }, { once: true });
}
