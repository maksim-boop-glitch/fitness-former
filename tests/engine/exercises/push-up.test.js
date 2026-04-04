import { PUSHUP_RULES } from '../../../src/engine/exercises/push-up.js';
import { LM } from '../../../src/engine/rules.js';

function lm(overrides = {}) {
  const pts = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 }));
  Object.entries(overrides).forEach(([i, v]) => { pts[i] = { ...pts[i], ...v }; });
  return pts;
}

describe('push-up: body_straight', () => {
  const rule = PUSHUP_RULES.find(r => r.id === 'body_straight');

  it('passes when shoulder, hip, and ankle are aligned', () => {
    const frame = lm({
      [LM.L_SHOULDER]: { x: 0.5, y: 0.4 },
      [LM.L_HIP]:      { x: 0.5, y: 0.5 },
      [LM.L_ANKLE]:    { x: 0.5, y: 0.6 },
    });
    expect(rule.check(frame)).toBe(true);
  });

  it('fails when hips sag below the shoulder-ankle line', () => {
    const frame = lm({
      [LM.L_SHOULDER]: { x: 0.5, y: 0.4 },
      [LM.L_HIP]:      { x: 0.5, y: 0.7 },
      [LM.L_ANKLE]:    { x: 0.5, y: 0.5 },
    });
    expect(rule.check(frame)).toBe(false);
  });
});

describe('push-up: elbows_not_flared', () => {
  const rule = PUSHUP_RULES.find(r => r.id === 'elbows_not_flared');

  it('passes when elbow angle is reasonable', () => {
    const frame = lm({
      [LM.L_SHOULDER]: { x: 0.3, y: 0.5 },
      [LM.L_ELBOW]:    { x: 0.5, y: 0.55 },
      [LM.L_WRIST]:    { x: 0.5, y: 0.7 },
    });
    expect(rule.check(frame)).toBe(true);
  });
});
