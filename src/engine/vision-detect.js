/**
 * Extracts a frame from the video at 25% of duration,
 * sends it to the backend vision API, and returns the detected exercise name.
 * Returns null on any failure — vision detection is always optional.
 *
 * @param {HTMLVideoElement} videoEl
 * @returns {Promise<string|null>}
 */
export async function detectExerciseViaVision(videoEl) {
  try {
    const imageBase64 = await extractFrame(videoEl);
    const res = await fetch('/api/detect-exercise', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64 }),
    });
    if (!res.ok) return null;
    const { exercise } = await res.json();
    return exercise ?? null;
  } catch {
    return null;
  }
}

function extractFrame(videoEl) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext('2d');

    videoEl.currentTime = videoEl.duration * 0.25;

    videoEl.addEventListener('seeked', function onSeeked() {
      videoEl.removeEventListener('seeked', onSeeked);
      try {
        ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        resolve(dataUrl.split(',')[1]);
      } catch (err) {
        reject(err);
      }
    }, { once: true });
  });
}
