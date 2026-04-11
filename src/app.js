import { renderNav } from './ui/nav.js';
import { renderAnalyze } from './tabs/analyze.js';
import { renderExercises } from './tabs/exercises.js';
import { renderHistory, attachHistoryListeners } from './tabs/history.js';
import { stopAnimation } from './ui/exercise-animation.js';
import { stopCameraStream } from './ui/camera-recorder.js';

const TABS = [
  { id: 'analyze',   label: 'Analyze',   icon: '📹', render: renderAnalyze },
  { id: 'history',   label: 'History',   icon: '📋', render: renderHistory },
  { id: 'exercises', label: 'Exercises', icon: '💪', render: renderExercises },
  { id: 'profile',   label: 'Profile',   icon: '👤', render: () => '<p style="color:var(--text-muted);padding:2rem;text-align:center">Sign in / Sign up (coming soon)</p>' },
];

let activeTab = 'analyze';

function switchTab(id) {
  stopAnimation();
  stopCameraStream();
  const tab = TABS.find(t => t.id === id);
  if (!tab) return;
  activeTab = id;
  document.getElementById('tab-content').innerHTML = tab.render();
  document.querySelectorAll('#bottom-nav button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === id);
  });
  if (id === 'analyze') {
    import('./tabs/analyze.js').then(m => m.attachAnalyzeListeners());
  }
  if (id === 'exercises') {
    import('./tabs/exercises.js').then(m => m.attachExercisesListeners());
  }
  if (id === 'history') {
    attachHistoryListeners();
  }
}

export function navigateTo(tabId) { switchTab(tabId); }

document.getElementById('bottom-nav').innerHTML = renderNav(TABS, activeTab);

document.getElementById('bottom-nav').addEventListener('click', e => {
  const btn = e.target.closest('button[data-tab]');
  if (btn) switchTab(btn.dataset.tab);
});

// Initial tab load
switchTab('analyze');

// Register service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
