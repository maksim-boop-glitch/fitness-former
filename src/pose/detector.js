import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

let poseLandmarker = null;

/**
 * Loads the MediaPipe PoseLandmarker model (once, cached).
 */
export async function loadPoseModel() {
  if (poseLandmarker) return;
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
  );
  poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    numPoses: 1,
  });
}

/**
 * Detects the source frame rate of a video element by observing frame
 * presentation timestamps via requestVideoFrameCallback. Falls back to 30.
 *
 * @param {HTMLVideoElement} videoEl
 * @returns {Promise<number>}
 */
async function detectVideoFPS(videoEl) {
  if (!('requestVideoFrameCallback' in HTMLVideoElement.prototype)) return 30;

  const savedTime = videoEl.currentTime;
  const timestamps = [];

  await new Promise(resolve => {
    function onFrame(_, { mediaTime }) {
      timestamps.push(mediaTime);
      if (timestamps.length >= 5) {
        videoEl.pause();
        resolve();
        return;
      }
      videoEl.requestVideoFrameCallback(onFrame);
    }
    videoEl.requestVideoFrameCallback(onFrame);
    videoEl.currentTime = 0;
    videoEl.play().catch(() => resolve());
  });

  videoEl.pause();
  videoEl.currentTime = savedTime;

  if (timestamps.length < 2) return 30;
  const intervals = timestamps.slice(1).map((t, i) => t - timestamps[i]);
  const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  return avg > 0 ? Math.round(1 / avg) : 30;
}

/**
 * Processes a <video> element frame-by-frame and returns an array of
 * landmark arrays (one per sampled frame).
 *
 * The returned array has a `.fps` property set to the effective sampled
 * frame rate (source FPS / sampleRate), for use in overlay sync.
 *
 * @param {HTMLVideoElement} videoEl
 * @param {number} [sampleRate=5]  — process 1 frame every N video frames
 * @param {(progress: number) => void} [onProgress]
 * @returns {Promise<Array<{image: Array<{x,y,z,visibility}>, world: Array<{x,y,z,visibility}>}>>}
 */
export async function processVideo(videoEl, sampleRate = 5, onProgress) {
  await loadPoseModel();

  const canvas = document.createElement('canvas');
  canvas.width  = videoEl.videoWidth  || 640;
  canvas.height = videoEl.videoHeight || 480;
  const ctx = canvas.getContext('2d');

  const fps = await detectVideoFPS(videoEl);
  const duration = videoEl.duration;
  const totalFrames = Math.floor(duration * fps / sampleRate);
  const frames = [];

  for (let i = 0; i < totalFrames; i++) {
    const t = (i * sampleRate) / fps;
    videoEl.currentTime = t;
    await new Promise(resolve => videoEl.addEventListener('seeked', resolve, { once: true }));

    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
    const result = poseLandmarker.detectForVideo(canvas, performance.now());

    if (result.landmarks?.[0] && result.worldLandmarks?.[0]) {
      frames.push({ image: result.landmarks[0], world: result.worldLandmarks[0] });
    }

    onProgress?.((i + 1) / totalFrames);
  }

  frames.fps = fps / sampleRate;
  return frames;
}
