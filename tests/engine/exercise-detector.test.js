import { detectExercise } from '../../src/engine/exercise-detector.js';
import { LM } from '../../src/engine/rules.js';

// World coordinates: Y is UP (positive = above origin).
// Standing: shoulder ~1.4m, hip ~1.0m, knee ~0.5m, ankle ~0.0m above origin.
function worldLm(overrides = {}) {
  const pts = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 1 }));
  Object.entries(overrides).forEach(([i, v]) => { pts[i] = { ...pts[i], ...v }; });
  return pts;
}

function frame(worldOverrides = {}) {
  const world = worldLm(worldOverrides);
  return { image: world, world };
}

describe('detectExercise', () => {
  it('detects squat when hips are near knee level (world Y)', () => {
    // At the bottom of a squat hip.y ≈ knee.y (both low, within 0.15m)
    const f = frame({
      [LM.L_SHOULDER]: { y: 0.9 },
      [LM.R_SHOULDER]: { y: 0.9 },
      [LM.L_HIP]:      { y: 0.3 },
      [LM.R_HIP]:      { y: 0.3 },
      [LM.L_KNEE]:     { y: 0.2 },
      [LM.R_KNEE]:     { y: 0.2 },
      [LM.L_ANKLE]:    { y: 0.0 },
      [LM.R_ANKLE]:    { y: 0.0 },
    });
    expect(detectExercise([f])).toBe('squat');
  });

  it('detects push-up when person is horizontal', () => {
    const f = frame({
      [LM.L_SHOULDER]: { x: 0.1, y: 0.5 },
      [LM.R_SHOULDER]: { x: 0.1, y: 0.5 },
      [LM.L_HIP]:      { x: 0.0, y: 0.5 },
      [LM.R_HIP]:      { x: 0.0, y: 0.5 },
      [LM.L_ANKLE]:    { x: -0.3, y: 0.5 },
      [LM.R_ANKLE]:    { x: -0.3, y: 0.5 },
    });
    expect(detectExercise([f])).toBe('push-up');
  });

  it('returns null when no exercise is confidently detected', () => {
    // All landmarks at origin — yVariation < 0.1 → skipped
    expect(detectExercise([frame()])).toBeNull();
  });
});
