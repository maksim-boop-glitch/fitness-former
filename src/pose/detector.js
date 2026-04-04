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
 * Processes a <video> element frame-by-frame and returns an array of
 * landmark arrays (one per sampled frame).
 *
 * @param {HTMLVideoElement} videoEl
 * @param {number} [sampleRate=10]  — process 1 frame every N video frames
 * @param {(progress: number) => void} [onProgress]
 * @returns {Promise<Array<Array<{x,y,z,visibility}>>>}
 */
export async function processVideo(videoEl, sampleRate = 10, onProgress) {
  await loadPoseModel();

  const canvas = document.createElement('canvas');
  canvas.width  = videoEl.videoWidth  || 640;
  canvas.height = videoEl.videoHeight || 480;
  const ctx = canvas.getContext('2d');

  const fps = 30;
  const duration = videoEl.duration;
  const totalFrames = Math.floor(duration * fps / sampleRate);
  const frames = [];

  for (let i = 0; i < totalFrames; i++) {
    const t = (i * sampleRate) / fps;
    videoEl.currentTime = t;
    await new Promise(resolve => videoEl.addEventListener('seeked', resolve, { once: true }));

    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
    const result = poseLandmarker.detectForVideo(canvas, performance.now());

    if (result.landmarks?.[0]) {
      frames.push(result.landmarks[0]);
    }

    onProgress?.((i + 1) / totalFrames);
  }

  return frames;
}
