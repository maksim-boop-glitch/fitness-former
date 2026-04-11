import { getJointColor } from '../../src/pose/overlay.js';

describe('getJointColor', () => {
  it('returns green for joints with no failing rule', () => {
    expect(getJointColor('L_KNEE', [])).toBe('#00cc44');
  });

  it('returns red for joints associated with a failing error rule', () => {
    const failingResults = [{ id: 'knees_over_toes', pass: false, severity: 'error' }];
    expect(getJointColor('L_KNEE', failingResults)).toBe('#cc2200');
  });
});
