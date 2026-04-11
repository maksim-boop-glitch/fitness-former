import { angleDeg, horizDist, LM, evaluateRules } from '../../src/engine/rules.js';

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

describe('angleDeg — 3D', () => {
  it('returns 90 for a right angle in the XZ plane (y=0)', () => {
    const a = { x: 1, y: 0, z: 0 };
    const b = { x: 0, y: 0, z: 0 };
    const c = { x: 0, y: 0, z: 1 };
    expect(angleDeg(a, b, c)).toBeCloseTo(90, 0);
  });

  it('returns 180 for opposing z-axis vectors', () => {
    const a = { x: 0.5, y: 0.5, z: 1 };
    const b = { x: 0.5, y: 0.5, z: 0 };
    const c = { x: 0.5, y: 0.5, z: -1 };
    expect(angleDeg(a, b, c)).toBeCloseTo(180, 0);
  });
});

describe('horizDist', () => {
  it('returns distance in XZ plane ignoring Y', () => {
    const a = { x: 0, y: 100, z: 0 };
    const b = { x: 3, y: 200, z: 4 };
    expect(horizDist(a, b)).toBeCloseTo(5, 5);
  });

  it('returns 0 for same XZ coords', () => {
    const a = { x: 1, y: 5, z: 2 };
    const b = { x: 1, y: 99, z: 2 };
    expect(horizDist(a, b)).toBeCloseTo(0, 5);
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

  it('passes world landmarks to rule check when frame has { image, world } shape', () => {
    const rule = {
      id: 'world_check',
      label: 'World check',
      severity: 'error',
      cue: 'Fix it',
      check: (lm) => lm[0].x === 0.99,
    };
    const imageLm = fakeLandmarks({ 0: { x: 0.1 } });
    const worldLm = fakeLandmarks({ 0: { x: 0.99 } });
    const frame = { image: imageLm, world: worldLm };
    const results = evaluateRules([rule], [frame]);
    // rule gets world landmarks (x=0.99), not image landmarks (x=0.1)
    expect(results[0].pass).toBe(true);
  });

  it('only evaluates frames in phaseFrames when provided', () => {
    const rule = {
      id: 'phase_test',
      label: 'Phase test',
      severity: 'error',
      cue: 'Fix it',
      check: (lm) => lm[0].x > 0.5,
    };
    const passing = fakeLandmarks({ 0: { x: 0.9 } });
    const failing = fakeLandmarks({ 0: { x: 0.1 } });
    // frames: [failing(0), passing(1), failing(2)]
    // phaseFrames = {1} → only frame 1 (passing) is evaluated → rule passes
    const phaseFrames = new Set([1]);
    const results = evaluateRules([rule], [failing, passing, failing], phaseFrames);
    expect(results[0].pass).toBe(true);
  });

  it('passes all frames when phaseFrames is null', () => {
    const rule = {
      id: 'null_phase',
      label: 'Null phase',
      severity: 'error',
      cue: 'Fix it',
      check: () => false,
    };
    const frames = [fakeLandmarks(), fakeLandmarks()];
    const results = evaluateRules([rule], frames, null);
    expect(results[0].pass).toBe(false);
  });

  it('returns pass:true for all rules when phaseFrames is empty set', () => {
    const rule = {
      id: 'empty_phase',
      label: 'Empty phase',
      severity: 'error',
      cue: 'Fix it',
      check: () => false,
    };
    const results = evaluateRules([rule], [fakeLandmarks()], new Set());
    expect(results[0].pass).toBe(true);
  });
});
