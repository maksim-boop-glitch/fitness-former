import { getJointColor, buildCallouts } from '../../src/pose/overlay.js';

describe('getJointColor', () => {
  it('returns green for joints with no failing rule', () => {
    expect(getJointColor('L_KNEE', [])).toBe('#00cc44');
  });

  it('returns red for joints associated with a failing error rule', () => {
    const failingResults = [{ id: 'knees_over_toes', pass: false, severity: 'error' }];
    expect(getJointColor('L_KNEE', failingResults)).toBe('#cc2200');
  });
});

describe('buildCallouts', () => {
  it('returns one callout per failing rule', () => {
    const results = [
      { id: 'knees_over_toes', label: 'Knees track over toes', pass: false, severity: 'error', cue: 'Push knees out' },
      { id: 'back_neutral', label: 'Torso upright', pass: true, severity: 'error', cue: '' },
    ];
    const callouts = buildCallouts(results);
    expect(callouts).toHaveLength(1);
    expect(callouts[0].label).toBe('Knees track over toes');
  });

  it('returns empty array when all rules pass', () => {
    const results = [{ id: 'x', label: 'x', pass: true, severity: 'error', cue: '' }];
    expect(buildCallouts(results)).toHaveLength(0);
  });
});
