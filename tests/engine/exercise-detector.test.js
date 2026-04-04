import { detectExercise } from '../../src/engine/exercise-detector.js';
import { LM } from '../../src/engine/rules.js';

function lm(overrides = {}) {
  const pts = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 }));
  Object.entries(overrides).forEach(([i, v]) => { pts[i] = { ...pts[i], ...v }; });
  return pts;
}

describe('detectExercise', () => {
  it('detects squat when hips are below knees in at least one frame', () => {
    const squatFrame = lm({
      [LM.L_HIP]:      { x: 0.5, y: 0.75 },
      [LM.L_KNEE]:     { x: 0.5, y: 0.65 },
      [LM.L_ANKLE]:    { x: 0.5, y: 0.9 },
      [LM.L_SHOULDER]: { x: 0.5, y: 0.3 },
    });
    expect(detectExercise([squatFrame])).toBe('squat');
  });

  it('detects push-up when person is horizontal', () => {
    const pushupFrame = lm({
      [LM.L_SHOULDER]: { x: 0.3, y: 0.5 },
      [LM.L_HIP]:      { x: 0.5, y: 0.52 },
      [LM.L_ANKLE]:    { x: 0.8, y: 0.54 },
    });
    expect(detectExercise([pushupFrame])).toBe('push-up');
  });

  it('returns null when no exercise is confidently detected', () => {
    const ambiguousFrame = lm();
    expect(detectExercise([ambiguousFrame])).toBeNull();
  });
});
