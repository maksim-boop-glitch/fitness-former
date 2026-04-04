import { DEADLIFT_RULES } from '../../../src/engine/exercises/deadlift.js';
import { LM } from '../../../src/engine/rules.js';

function lm(overrides = {}) {
  const pts = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 }));
  Object.entries(overrides).forEach(([i, v]) => { pts[i] = { ...pts[i], ...v }; });
  return pts;
}

describe('deadlift: back_flat', () => {
  const rule = DEADLIFT_RULES.find(r => r.id === 'back_flat');

  it('passes when shoulder is above hip (flat back)', () => {
    const frame = lm({
      [LM.L_SHOULDER]: { x: 0.4, y: 0.4 },
      [LM.L_HIP]:      { x: 0.5, y: 0.5 },
      [LM.L_KNEE]:     { x: 0.5, y: 0.7 },
    });
    expect(rule.check(frame)).toBe(true);
  });

  it('fails when shoulders drop below hip level (rounded back)', () => {
    const frame = lm({
      [LM.L_SHOULDER]: { x: 0.5, y: 0.65 },
      [LM.L_HIP]:      { x: 0.5, y: 0.5 },
      [LM.L_KNEE]:     { x: 0.5, y: 0.7 },
    });
    expect(rule.check(frame)).toBe(false);
  });
});

describe('deadlift: hips_not_too_high', () => {
  const rule = DEADLIFT_RULES.find(r => r.id === 'hips_not_too_high');

  it('passes when hip delta to knee is reasonable', () => {
    const frame = lm({
      [LM.L_HIP]:  { x: 0.5, y: 0.5 },
      [LM.L_KNEE]: { x: 0.5, y: 0.65 },
    });
    expect(rule.check(frame)).toBe(true);
  });

  it('fails when hips shoot too high', () => {
    const frame = lm({
      [LM.L_HIP]:  { x: 0.5, y: 0.2 },
      [LM.L_KNEE]: { x: 0.5, y: 0.65 },
    });
    expect(rule.check(frame)).toBe(false);
  });
});
