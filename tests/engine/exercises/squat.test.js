import { SQUAT_RULES } from '../../../src/engine/exercises/squat.js';
import { LM } from '../../../src/engine/rules.js';

function lm(overrides = {}) {
  const pts = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 }));
  Object.entries(overrides).forEach(([i, v]) => { pts[i] = { ...pts[i], ...v }; });
  return pts;
}

describe('squat: knees_over_toes', () => {
  const rule = SQUAT_RULES.find(r => r.id === 'knees_over_toes');

  it('passes when knee x is close to ankle x', () => {
    const frame = lm({
      [LM.L_KNEE]: { x: 0.4, y: 0.7 }, [LM.L_ANKLE]: { x: 0.4, y: 0.9 },
      [LM.R_KNEE]: { x: 0.6, y: 0.7 }, [LM.R_ANKLE]: { x: 0.6, y: 0.9 },
    });
    expect(rule.check(frame)).toBe(true);
  });

  it('fails when knees cave inward', () => {
    const frame = lm({
      [LM.L_KNEE]: { x: 0.48, y: 0.7 }, [LM.L_ANKLE]: { x: 0.35, y: 0.9 },
      [LM.R_KNEE]: { x: 0.52, y: 0.7 }, [LM.R_ANKLE]: { x: 0.65, y: 0.9 },
    });
    expect(rule.check(frame)).toBe(false);
  });
});

describe('squat: back_neutral', () => {
  const rule = SQUAT_RULES.find(r => r.id === 'back_neutral');

  it('passes when shoulder is above hip (upright torso)', () => {
    const frame = lm({
      [LM.L_SHOULDER]: { x: 0.5, y: 0.3 },
      [LM.L_HIP]:      { x: 0.5, y: 0.6 },
      [LM.L_KNEE]:     { x: 0.5, y: 0.8 },
    });
    expect(rule.check(frame)).toBe(true);
  });

  it('fails when torso collapses forward past 45°', () => {
    const frame = lm({
      [LM.L_SHOULDER]: { x: 0.3, y: 0.65 },
      [LM.L_HIP]:      { x: 0.5, y: 0.6 },
      [LM.L_KNEE]:     { x: 0.5, y: 0.8 },
    });
    expect(rule.check(frame)).toBe(false);
  });
});
