import { vi, describe, it, expect, beforeEach } from 'vitest';

// Build a landmark array that looks like a squat in world coordinates (Y-up, metres).
// shoulderY (0.9) - hipY (0.3) = 0.6 > HORIZONTAL_THRESHOLD (0.15) → vertical
// hipY (0.3) - kneeY (0.2) = 0.1 < 0.15 → squat
// yVariation = 0.6 + 0.1 + 0.2 = 0.9 > 0.1 → not collapsed
function squatWorldLm() {
  const pts = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 1 }));
  pts[11] = { x: 0, y: 0.9, z: 0, visibility: 1 }; // L_SHOULDER
  pts[12] = { x: 0, y: 0.9, z: 0, visibility: 1 }; // R_SHOULDER
  pts[23] = { x: 0, y: 0.3, z: 0, visibility: 1 }; // L_HIP
  pts[24] = { x: 0, y: 0.3, z: 0, visibility: 1 }; // R_HIP
  pts[25] = { x: 0, y: 0.2, z: 0, visibility: 1 }; // L_KNEE
  pts[26] = { x: 0, y: 0.2, z: 0, visibility: 1 }; // R_KNEE
  pts[27] = { x: 0, y: 0.0, z: 0, visibility: 1 }; // L_ANKLE
  pts[28] = { x: 0, y: 0.0, z: 0, visibility: 1 }; // R_ANKLE
  return pts;
}

vi.mock('../../src/pose/detector.js', () => ({
  processVideo: vi.fn().mockResolvedValue([
    { image: squatWorldLm(), world: squatWorldLm() },
  ]),
}));
vi.mock('../../src/storage.js', () => ({ saveSession: vi.fn() }));

import { runAnalysis } from '../../src/engine/analysis-runner.js';

describe('runAnalysis', () => {
  let fakeVideo;
  beforeEach(() => {
    fakeVideo = { duration: 5 };
    document.body.innerHTML = '<button id="analyze-btn">Analyze</button>';
  });

  it('uses exerciseOverride when provided, skipping auto-detection', async () => {
    const result = await runAnalysis(fakeVideo, 135, 'lbs', 'push-up');
    expect(result.exercise).toBe('push-up');
  });

  it('falls back to heuristic when no override given', async () => {
    const result = await runAnalysis(fakeVideo, 135, 'lbs');
    expect(result.exercise).toBe('squat');
  });
});
