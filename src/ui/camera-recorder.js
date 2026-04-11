// src/ui/camera-recorder.js

let stream = null;

export function isMobile() {
  return navigator.maxTouchPoints > 0;
}

export function getPermissionInstructions() {
  const ua = navigator.userAgent;
  if (/Chrome/.test(ua) && !/Edg/.test(ua)) {
    return {
      browser: 'Chrome',
      steps: ['Click 🔒 in the address bar', 'Set Camera → Allow', 'Reload the page'],
    };
  }
  if (/Edg/.test(ua)) {
    return {
      browser: 'Edge',
      steps: ['Click 🔒 in the address bar', 'Set Camera → Allow', 'Reload the page'],
    };
  }
  if (/Firefox/.test(ua)) {
    return {
      browser: 'Firefox',
      steps: ['Click the camera icon in the address bar', 'Choose "Allow"'],
    };
  }
  if (/Safari/.test(ua) && !/Chrome/.test(ua)) {
    return {
      browser: 'Safari',
      steps: [
        'Open System Settings → Privacy & Security → Camera',
        'Enable for your browser',
        'Reload the page',
      ],
    };
  }
  return {
    browser: 'your browser',
    steps: ['Open browser settings', 'Find Camera permissions', 'Allow this site'],
  };
}

export function stopCameraStream() {
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
}

/**
 * Replaces container.innerHTML with a live camera preview UI.
 * Calls getUserMedia({ video: true, audio: false }).
 * Returns { onFile(callback), cancel() }.
 *   - onFile callback receives a File object when recording stops.
 *   - cancel() stops the stream and restores container.innerHTML to empty string.
 * Throws if permission is denied or device not found.
 */
export async function startCameraPreview(container) {
  stopCameraStream();

  stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });

  const mimeType = MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : 'video/mp4';
  const ext = mimeType === 'video/webm' ? 'webm' : 'mp4';

  const savedHTML = container.innerHTML;
  container.innerHTML = `
    <div id="camera-preview-wrap" style="
      position:relative;
      background:#000;
      border-radius:var(--radius);
      overflow:hidden;
      margin-bottom:0.75rem;
    ">
      <video id="camera-live" muted playsinline style="width:100%;display:block"></video>
      <div id="camera-timer" style="
        display:none;
        position:absolute;
        top:8px;
        right:8px;
        background:rgba(0,0,0,0.7);
        border-radius:4px;
        padding:2px 8px;
        font-size:0.75rem;
        color:#fff;
        font-weight:700;
      ">
        <span id="camera-rec-dot" style="color:#cc2200">● </span><span id="camera-time">0:00</span>
      </div>
      <div style="
        position:absolute;
        bottom:12px;
        left:0;
        right:0;
        display:flex;
        justify-content:center;
      ">
        <button id="camera-record-btn" style="
          width:48px;
          height:48px;
          border-radius:50%;
          background:#cc2200;
          border:3px solid #fff;
          cursor:pointer;
          display:flex;
          align-items:center;
          justify-content:center;
        ">
          <div id="camera-record-icon" style="
            width:16px;
            height:16px;
            border-radius:50%;
            background:#fff;
          "></div>
        </button>
      </div>
    </div>
    <div style="text-align:center;margin-bottom:0.75rem">
      <a id="camera-cancel" href="#" style="color:var(--text-muted);font-size:0.75rem;text-decoration:none">× Cancel</a>
    </div>
  `;

  const liveVideo = document.getElementById('camera-live');
  liveVideo.srcObject = stream;
  try {
    await liveVideo.play();
  } catch (err) {
    stopCameraStream();
    container.innerHTML = savedHTML;
    throw err;
  }

  let fileCallback = null;
  let recorder = null;
  let chunks = [];
  let timerInterval = null;
  let autoStopTimeout = null;
  let elapsed = 0;
  let recording = false;

  const timerEl = document.getElementById('camera-timer');
  const timeEl = document.getElementById('camera-time');
  const recordBtn = document.getElementById('camera-record-btn');
  const recordIcon = document.getElementById('camera-record-icon');

  function formatTime(s) {
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  function startTimer() {
    elapsed = 0;
    timerEl.style.display = 'block';
    timerInterval = setInterval(() => {
      elapsed++;
      timeEl.textContent = formatTime(elapsed);
    }, 1000);
  }

  function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  function stopRecording() {
    if (!recording) return;
    recording = false;
    clearTimeout(autoStopTimeout);
    stopTimer();
    recorder.stop();
  }

  recordBtn.addEventListener('click', () => {
    if (!recording) {
      // Start recording
      recording = true;
      chunks = [];
      recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const file = new File([blob], `recording.${ext}`, { type: mimeType });
        stopCameraStream();
        container.innerHTML = '';
        if (fileCallback) fileCallback(file);
      };
      recorder.start();
      // Change button to stop square
      recordIcon.style.borderRadius = '2px';
      // Start timer and 60s auto-stop
      startTimer();
      autoStopTimeout = setTimeout(stopRecording, 60000);
    } else {
      stopRecording();
    }
  });

  document.getElementById('camera-cancel').addEventListener('click', e => {
    e.preventDefault();
    stopRecording();
    stopCameraStream();
    container.innerHTML = '';
  });

  return {
    onFile(callback) {
      fileCallback = callback;
    },
    cancel() {
      fileCallback = null;
      stopRecording();
      stopCameraStream();
      container.innerHTML = '';
    },
  };
}
