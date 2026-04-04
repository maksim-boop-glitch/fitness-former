import { angleDeg, LM, evaluateRules } from '../../src/engine/rules.js';

function fakeLandmarks(overrides = {}) {
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 }));
  Object.entries(overrides).forEach(([i, val]) => { lm[i] = { ...lm[i], ...val }; });
  return lm;
}

describe('angleDeg', () => {
  it('returns 90 for a right angle', () => {
    const a = { x: 0, y: 1 };
    const b = { x: 0, y: 0 };
    const c = { x: 1, y: 0 };
    expect(angleDeg(a, b, c)).toBeCloseTo(90, 0);
  });

  it('returns 180 for a straight line', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 1, y: 0 };
    const c = { x: 2, y: 0 };
    expect(angleDeg(a, b, c)).toBeCloseTo(180, 0);
  });
});

describe('evaluateRules', () => {
  it('returns pass when rule condition is met', () => {
    const rule = {
      id: 'test_pass',
      label: 'Test passes',
      severity: 'error',
      cue: 'Do the thing',
      check: () => true,
    };
    const frames = [fakeLandmarks()];
    const results = evaluateRules([rule], frames);
    expect(results[0]).toMatchObject({ id: 'test_pass', pass: true });
  });

  it('returns fail when rule condition is not met', () => {
    const rule = {
      id: 'test_fail',
      label: 'Test fails',
      severity: 'error',
      cue: 'Fix this',
      check: () => false,
    };
    const frames = [fakeLandmarks()];
    const results = evaluateRules([rule], frames);
    expect(results[0]).toMatchObject({ id: 'test_fail', pass: false, cue: 'Fix this' });
  });

  it('passes if rule is true in majority of frames', () => {
    const rule = {
      id: 'majority',
      label: 'Majority rule',
      severity: 'warning',
      cue: 'Fix it',
      check: (lm) => lm[0].x > 0.3,
    };
    const passing = fakeLandmarks({ 0: { x: 0.9 } });
    const failing = fakeLandmarks({ 0: { x: 0.1 } });
    const results = evaluateRules([rule], [passing, passing, passing, failing]);
    expect(results[0].pass).toBe(true);
  });
});
