import { isMobile, startCameraPreview, stopCameraStream, getPermissionInstructions } from '../ui/camera-recorder.js';

export function renderAnalyze() {
  return `
    <div class="section-label" style="margin-top:0.5rem">Fitness Former</div>
    <p style="color:var(--text-muted);font-size:0.75rem;margin-bottom:1rem">AI Form Coach</p>

    <div id="input-mode-wrap" style="margin-bottom:0.75rem">
      <div style="display:flex;gap:0.5rem">
        <div id="record-card" class="card" style="
          flex:1;
          border:2px solid var(--accent);
          text-align:center;
          cursor:pointer;
        ">
          <div style="font-size:2rem;margin-bottom:0.25rem">📷</div>
          <div style="color:var(--text);font-size:0.8rem;font-weight:700">Record</div>
          <div style="color:var(--text-muted);font-size:0.65rem;margin-top:2px">Use camera</div>
        </div>
        <div id="upload-card" class="card" style="
          flex:1;
          border:2px solid var(--border);
          text-align:center;
          cursor:pointer;
        ">
          <div style="font-size:2rem;margin-bottom:0.25rem">📁</div>
          <div style="color:var(--text);font-size:0.8rem;font-weight:700">Upload</div>
          <div style="color:var(--text-muted);font-size:0.65rem;margin-top:2px">From library</div>
        </div>
      </div>
      <input id="video-input" type="file" accept="video/*" style="display:none" />
      <input id="video-input-capture" type="file" accept="video/*" capture="environment" style="display:none" />
    </div>

    <div id="video-preview-wrap" style="display:none;margin-bottom:0.75rem">
      <video id="video-preview" style="width:100%;border-radius:var(--radius);background:#000" controls playsinline></video>
    </div>

    <div class="card" style="margin-bottom:0.75rem">
      <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem">
        <span style="font-size:1rem">🏃</span>
        <span style="color:var(--text-dim);font-size:0.75rem;flex:1">Exercise</span>
        <span id="exercise-detecting" style="font-size:0.6rem;color:var(--text-muted);display:none">Detecting…</span>
      </div>
      <select id="exercise-select" style="
        width:100%;
        background:var(--bg-input);
        border:1px solid var(--border);
        border-radius:4px;
        color:var(--text);
        padding:6px 8px;
        font-size:0.8rem;
      ">
        <option value="auto">Auto-detect</option>
        <option value="squat">Squat</option>
        <option value="deadlift">Deadlift</option>
        <option value="push-up">Push-up</option>
        <option value="bench-press">Bench Press</option>
      </select>
    </div>

    <div class="card" style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.75rem">
      <span style="font-size:1.1rem">🏋️</span>
      <span style="color:var(--text-dim);font-size:0.75rem;flex:1">Weight used</span>
      <div style="display:flex;align-items:center;gap:6px">
        <button id="weight-down" style="background:var(--bg-input);border:none;color:var(--text);width:28px;height:28px;border-radius:4px;font-size:1rem;cursor:pointer">−</button>
        <span id="weight-display" style="color:var(--text);font-weight:700;font-size:1rem;min-width:40px;text-align:center">135</span>
        <button id="weight-up" style="background:var(--bg-input);border:none;color:var(--text);width:28px;height:28px;border-radius:4px;font-size:1rem;cursor:pointer">+</button>
        <div style="display:flex;gap:2px">
          <button id="unit-lbs" style="background:var(--accent);border:none;color:#fff;padding:3px 6px;border-radius:3px;font-size:0.6rem;font-weight:700;cursor:pointer">lbs</button>
          <button id="unit-kg" style="background:var(--bg-input);border:none;color:var(--text-muted);padding:3px 6px;border-radius:3px;font-size:0.6rem;cursor:pointer">kg</button>
        </div>
      </div>
    </div>

    <button id="analyze-btn" class="btn-primary" disabled style="opacity:0.4">
      Analyze My Form
    </button>

    <p style="text-align:center;margin-top:0.75rem;font-size:0.65rem;color:var(--text-muted)">
      <a href="#" id="signin-link" style="color:var(--accent);text-decoration:none">Sign in</a>
      to save your history
    </p>
  `;
}

export function attachAnalyzeListeners() {
  let weight = 135;
  let unit = 'lbs';
  let videoFile = null;

  const weightDisplay     = document.getElementById('weight-display');
  const analyzeBtn        = document.getElementById('analyze-btn');
  const videoInput        = document.getElementById('video-input');
  const videoCaptureInput = document.getElementById('video-input-capture');
  const previewWrap       = document.getElementById('video-preview-wrap');
  const previewEl         = document.getElementById('video-preview');
  const exerciseSelect    = document.getElementById('exercise-select');
  const exerciseDetecting = document.getElementById('exercise-detecting');
  const inputModeWrap     = document.getElementById('input-mode-wrap');

  if (!weightDisplay || !exerciseSelect || !exerciseDetecting) return;

  // ── Weight controls ──────────────────────────────────────────────
  document.getElementById('weight-up').addEventListener('click', () => {
    weight += unit === 'lbs' ? 5 : 2.5;
    weightDisplay.textContent = unit === 'lbs' ? weight : weight.toFixed(1);
  });

  document.getElementById('weight-down').addEventListener('click', () => {
    weight = Math.max(0, weight - (unit === 'lbs' ? 5 : 2.5));
    weightDisplay.textContent = unit === 'lbs' ? weight : weight.toFixed(1);
  });

  document.getElementById('unit-lbs').addEventListener('click', () => {
    unit = 'lbs';
    document.getElementById('unit-lbs').style.background = 'var(--accent)';
    document.getElementById('unit-lbs').style.color = '#fff';
    document.getElementById('unit-kg').style.background = 'var(--bg-input)';
    document.getElementById('unit-kg').style.color = 'var(--text-muted)';
  });

  document.getElementById('unit-kg').addEventListener('click', () => {
    unit = 'kg';
    document.getElementById('unit-kg').style.background = 'var(--accent)';
    document.getElementById('unit-kg').style.color = '#fff';
    document.getElementById('unit-lbs').style.background = 'var(--bg-input)';
    document.getElementById('unit-lbs').style.color = 'var(--text-muted)';
  });

  // ── Shared file handler ──────────────────────────────────────────
  function handleVideoFile(file) {
    if (!file) return;
    videoFile = file;
    if (previewEl.src?.startsWith('blob:')) URL.revokeObjectURL(previewEl.src);
    const src = URL.createObjectURL(file);
    previewEl.src = src;
    sessionStorage.setItem('ff_video_src', src);
    previewWrap.style.display = 'block';
    analyzeBtn.disabled = false;
    analyzeBtn.style.opacity = '1';

    // Attempt vision-based exercise detection in the background
    exerciseDetecting.style.display = 'inline';
    exerciseSelect.value = 'auto';
    import('../engine/vision-detect.js').then(async ({ detectExerciseViaVision }) => {
      try {
        await new Promise(resolve => {
          if (previewEl.readyState >= 1) { resolve(); return; }
          previewEl.addEventListener('loadedmetadata', resolve, { once: true });
        });
        const detected = await detectExerciseViaVision(previewEl);
        if (detected && exerciseSelect.value === 'auto') {
          exerciseSelect.value = detected;
        }
      } catch {
        // vision detection is optional — silently ignore failures
      } finally {
        exerciseDetecting.style.display = 'none';
      }
    }).catch(() => {
      exerciseDetecting.style.display = 'none';
    });
  }

  videoInput.addEventListener('change', e => handleVideoFile(e.target.files[0]));
  videoCaptureInput.addEventListener('change', e => {
    removeMobileHint();
    handleVideoFile(e.target.files[0]);
  });

  // ── Mobile hint helpers ──────────────────────────────────────────
  let hintTimeout = null;

  function showMobileHint() {
    removeMobileHint();
    const hint = document.createElement('div');
    hint.id = 'camera-mobile-hint';
    hint.style.cssText = `
      background:var(--bg-card);
      border:1px solid var(--border);
      border-radius:var(--radius);
      padding:0.6rem 0.75rem;
      font-size:0.7rem;
      color:var(--text-muted);
      margin-top:0.5rem;
      display:flex;
      align-items:flex-start;
      gap:0.5rem;
    `;
    hint.innerHTML = `
      <span style="flex:1">📱 If the camera didn't open, check Settings → Privacy → Camera and allow access for your browser.</span>
      <button id="camera-hint-close" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1rem;line-height:1;padding:0">×</button>
    `;
    inputModeWrap.appendChild(hint);
    document.getElementById('camera-hint-close').addEventListener('click', removeMobileHint);
    hintTimeout = setTimeout(removeMobileHint, 6000);
  }

  function removeMobileHint() {
    clearTimeout(hintTimeout);
    const hint = document.getElementById('camera-mobile-hint');
    if (hint) hint.remove();
  }

  // ── Permission error card ────────────────────────────────────────
  function showPermissionError(err) {
    const existing = document.getElementById('camera-permission-error');
    if (existing) existing.remove();

    const isNoCamera = err && err.name === 'NotFoundError';
    let content;

    if (isNoCamera) {
      content = `
        <div style="color:var(--score-red);font-size:0.8rem;font-weight:700;margin-bottom:0.5rem">📷 No camera found</div>
        <div style="font-size:0.75rem;color:var(--text-muted)">Use Upload instead.</div>
        <div style="margin-top:0.75rem">
          <button id="perm-upload" style="background:var(--bg-input);border:1px solid var(--border);border-radius:4px;padding:4px 12px;font-size:0.75rem;color:var(--text);cursor:pointer">Upload instead</button>
        </div>
      `;
    } else {
      const { browser, steps } = getPermissionInstructions();
      const stepsHtml = steps.map((s, i) => `<div>${i + 1}. ${s}</div>`).join('');
      content = `
        <div style="color:var(--score-red);font-size:0.8rem;font-weight:700;margin-bottom:0.5rem">🚫 Camera blocked in ${browser}</div>
        <div style="font-size:0.75rem;color:var(--text-muted);line-height:1.6;margin-bottom:0.75rem">${stepsHtml}</div>
        <div style="display:flex;gap:0.5rem">
          <button id="perm-retry" style="background:var(--score-red);border:none;border-radius:4px;padding:4px 12px;font-size:0.75rem;color:#fff;cursor:pointer">Try again</button>
          <button id="perm-upload" style="background:var(--bg-input);border:1px solid var(--border);border-radius:4px;padding:4px 12px;font-size:0.75rem;color:var(--text);cursor:pointer">Upload instead</button>
        </div>
      `;
    }

    const card = document.createElement('div');
    card.id = 'camera-permission-error';
    card.style.cssText = `
      background:var(--bg-card);
      border:1px solid var(--score-red);
      border-radius:var(--radius);
      padding:0.75rem;
      margin-top:0.5rem;
    `;
    card.innerHTML = content;
    inputModeWrap.appendChild(card);

    const retryBtn = document.getElementById('perm-retry');
    if (retryBtn) {
      retryBtn.addEventListener('click', async () => {
        card.remove();
        await handleRecordDesktop();
      });
    }
    document.getElementById('perm-upload').addEventListener('click', () => {
      card.remove();
      videoInput.click();
    });
  }

  // ── Desktop recording ────────────────────────────────────────────
  async function handleRecordDesktop() {
    try {
      const recorder = await startCameraPreview(inputModeWrap);
      recorder.onFile(file => {
        handleVideoFile(file);
      });
    } catch (err) {
      showPermissionError(err);
    }
  }

  // ── Card click handlers ──────────────────────────────────────────
  document.getElementById('record-card').addEventListener('click', async () => {
    if (isMobile()) {
      videoCaptureInput.click();
      showMobileHint();
    } else {
      await handleRecordDesktop();
    }
  });

  document.getElementById('upload-card').addEventListener('click', () => {
    videoInput.click();
  });

  // ── Analyze button ───────────────────────────────────────────────
  analyzeBtn.addEventListener('click', async () => {
    if (!videoFile) return;
    stopCameraStream();
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = 'Analyzing...';

    const selectedExercise = exerciseSelect.value === 'auto' ? null : exerciseSelect.value;

    try {
      const { runAnalysis } = await import('../engine/analysis-runner.js');
      const result = await runAnalysis(previewEl, weight, unit, selectedExercise);

      const { renderResults, attachResultsListeners } = await import('./results.js');
      document.getElementById('tab-content').innerHTML = renderResults(result);
      attachResultsListeners(result);
    } catch (err) {
      console.error('Analysis failed:', err);
      analyzeBtn.disabled = false;
      analyzeBtn.style.opacity = '1';
      analyzeBtn.textContent = 'Analyze My Form';
      const existing = document.getElementById('analyze-error');
      if (existing) existing.remove();
      const errorEl = document.createElement('p');
      errorEl.id = 'analyze-error';
      errorEl.style.cssText = 'color:var(--score-red);font-size:0.7rem;text-align:center;margin-top:0.5rem';
      errorEl.textContent = err.message === 'No pose frames detected'
        ? 'No pose detected — make sure your full body is visible in the video.'
        : 'Analysis failed — try a shorter video or check your connection.';
      analyzeBtn.after(errorEl);
    }
  });
}
