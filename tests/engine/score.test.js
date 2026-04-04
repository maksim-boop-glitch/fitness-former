import { calculateScore } from '../../src/engine/score.js';

describe('calculateScore', () => {
  it('returns 100 when all rules pass', () => {
    const results = [
      { pass: true, severity: 'error' },
      { pass: true, severity: 'warning' },
    ];
    expect(calculateScore(results)).toBe(100);
  });

  it('returns 0 when all error rules fail', () => {
    const results = [
      { pass: false, severity: 'error' },
      { pass: false, severity: 'error' },
    ];
    expect(calculateScore(results)).toBe(0);
  });

  it('errors deduct more than warnings', () => {
    const oneError = [{ pass: false, severity: 'error' }, { pass: true, severity: 'error' }];
    const oneWarn  = [{ pass: false, severity: 'warning' }, { pass: true, severity: 'warning' }];
    expect(calculateScore(oneError)).toBeLessThan(calculateScore(oneWarn));
  });

  it('returns 100 for empty results', () => {
    expect(calculateScore([])).toBe(100);
  });
});
