import { BENCH_RULES } from '../../../src/engine/exercises/bench-press.js';
import { LM } from '../../../src/engine/rules.js';

function lm(overrides = {}) {
  const pts = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 }));
  Object.entries(overrides).forEach(([i, v]) => { pts[i] = { ...pts[i], ...v }; });
  return pts;
}

describe('bench: elbows_at_75', () => {
  const rule = BENCH_RULES.find(r => r.id === 'elbows_at_75');

  it('passes when upper arm is at ~75° from torso (good form)', () => {
    // Hip below shoulder, elbow outward at ~75° — good bench position
    const frame = lm({
      [LM.L_HIP]:      { x: 0.5, y: 0.8 },
      [LM.L_SHOULDER]: { x: 0.5, y: 0.5 },
      [LM.L_ELBOW]:    { x: 0.65, y: 0.55 },  // arm angled ~60-75° from torso
    });
    expect(rule.check(frame)).toBe(true);
  });

  it('fails when elbow is fully flared to 90° from torso', () => {
    // Elbow directly to the side at 90° — flared position
    const frame = lm({
      [LM.L_HIP]:      { x: 0.5, y: 0.8 },
      [LM.L_SHOULDER]: { x: 0.5, y: 0.5 },
      [LM.L_ELBOW]:    { x: 0.9, y: 0.5 },  // arm straight out = 90°
    });
    expect(rule.check(frame)).toBe(false);
  });

  it('check runs without throwing on degenerate input', () => {
    const frame = lm();
    expect(typeof rule.check(frame)).toBe('boolean');
  });
});
