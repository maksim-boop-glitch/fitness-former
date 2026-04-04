import { BENCH_RULES } from '../../../src/engine/exercises/bench-press.js';
import { LM } from '../../../src/engine/rules.js';

function lm(overrides = {}) {
  const pts = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 }));
  Object.entries(overrides).forEach(([i, v]) => { pts[i] = { ...pts[i], ...v }; });
  return pts;
}

describe('bench: elbows_at_75', () => {
  const rule = BENCH_RULES.find(r => r.id === 'elbows_at_75');

  it('passes when shoulder-elbow-wrist angle is ~75-90°', () => {
    const frame = lm({
      [LM.L_SHOULDER]: { x: 0.3, y: 0.5 },
      [LM.L_ELBOW]:    { x: 0.45, y: 0.55 },
      [LM.L_WRIST]:    { x: 0.5, y: 0.45 },
    });
    expect(rule.check(frame)).toBe(true);
  });

  it('check runs without throwing on degenerate input', () => {
    const frame = lm();
    expect(typeof rule.check(frame)).toBe('boolean');
  });
});
