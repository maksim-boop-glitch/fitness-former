import { scoreColor, scoreBadgeHTML } from '../../src/ui/score-badge.js';

describe('scoreColor', () => {
  it('returns red for score 0', () => expect(scoreColor(0)).toBe('red'));
  it('returns red for score 50', () => expect(scoreColor(50)).toBe('red'));
  it('returns amber for score 51', () => expect(scoreColor(51)).toBe('amber'));
  it('returns amber for score 74', () => expect(scoreColor(74)).toBe('amber'));
  it('returns green for score 75', () => expect(scoreColor(75)).toBe('green'));
  it('returns green for score 100', () => expect(scoreColor(100)).toBe('green'));
});

describe('scoreBadgeHTML', () => {
  it('includes the score number', () => {
    expect(scoreBadgeHTML(82)).toContain('82');
  });
  it('includes green class for score 82', () => {
    expect(scoreBadgeHTML(82)).toContain('score-green');
  });
  it('includes red class for score 40', () => {
    expect(scoreBadgeHTML(40)).toContain('score-red');
  });
});
