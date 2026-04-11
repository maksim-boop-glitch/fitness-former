import { computeBodyMetrics } from '../../src/engine/body-metrics.js';

function makeLm(kneeY, ankleY) {
  const lm = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 1 }));
  lm[25] = { ...lm[25], y: kneeY };  // L_KNEE
  lm[26] = { ...lm[26], y: kneeY };  // R_KNEE
  lm[27] = { ...lm[27], y: ankleY }; // L_ANKLE
  lm[28] = { ...lm[28], y: ankleY }; // R_ANKLE
  return lm;
}

describe('computeBodyMetrics', () => {
  it('returns shinLength as median knee-ankle distance', () => {
    const frames = [makeLm(0.5, 0.0), makeLm(0.5, 0.0), makeLm(0.5, 0.0)];
    const { shinLength } = computeBodyMetrics(frames);
    expect(shinLength).toBeCloseTo(0.5, 2);
  });

  it('falls back to 0.5 when fewer than 3 valid frames', () => {
    expect(computeBodyMetrics([]).shinLength).toBe(0.5);
    expect(computeBodyMetrics([makeLm(0.3, 0.0), makeLm(0.3, 0.0)]).shinLength).toBe(0.5);
  });

  it('uses median to resist outliers', () => {
    const frames = [
      makeLm(0.5, 0.0), makeLm(0.5, 0.0), makeLm(0.5, 0.0),
      makeLm(0.5, 0.0), makeLm(2.0, 0.0),
    ];
    const { shinLength } = computeBodyMetrics(frames);
    expect(shinLength).toBeCloseTo(0.5, 2);
  });

  it('averages left and right shin per frame', () => {
    const frames = Array.from({ length: 3 }, () => {
      const lm = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 1 }));
      lm[25] = { ...lm[25], y: 0.4 }; // L_KNEE
      lm[26] = { ...lm[26], y: 0.6 }; // R_KNEE
      lm[27] = { ...lm[27], y: 0.0 }; // L_ANKLE
      lm[28] = { ...lm[28], y: 0.0 }; // R_ANKLE
      return lm;
    });
    const { shinLength } = computeBodyMetrics(frames);
    expect(shinLength).toBeCloseTo(0.5, 2);
  });
});
