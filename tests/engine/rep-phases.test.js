import { getBottomPhaseFrames } from '../../src/engine/rep-phases.js';

function makeLmWithHip(hipY) {
  const lm = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 1 }));
  lm[23] = { ...lm[23], y: hipY }; // L_HIP
  lm[24] = { ...lm[24], y: hipY }; // R_HIP
  return lm;
}

function makeLmWithWrist(wristY) {
  const lm = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 1 }));
  lm[15] = { ...lm[15], y: wristY }; // L_WRIST
  lm[16] = { ...lm[16], y: wristY }; // R_WRIST
  return lm;
}

describe('getBottomPhaseFrames', () => {
  it('returns all frame indices for deadlift', () => {
    const frames = [makeLmWithHip(1.0), makeLmWithHip(0.8), makeLmWithHip(0.6)];
    const result = getBottomPhaseFrames(frames, 'deadlift');
    expect([...result].sort((a,b)=>a-b)).toEqual([0, 1, 2]);
  });

  it('returns bottom 30% frames for squat by hip Y', () => {
    // Hip Y descends from 1.0 (standing) to 0.30 across 10 frames
    // range = 0.70, threshold = 0.30 + 0.30*0.70 = 0.51
    // frames with hip.y <= 0.51 are bottom phase
    const frames = Array.from({ length: 10 }, (_, i) => {
      const hipY = 1.0 - (i * 0.07); // 1.0, 0.93, 0.86, 0.79, 0.72, 0.65, 0.58, 0.51, 0.44, 0.37
      return makeLmWithHip(hipY);
    });
    const result = getBottomPhaseFrames(frames, 'squat');
    expect(result.has(9)).toBe(true);  // hipY=0.37, definitely bottom
    expect(result.has(0)).toBe(false); // hipY=1.0, standing
  });

  it('returns all frames when signal range < 0.05m (static hold)', () => {
    const frames = [makeLmWithHip(0.50), makeLmWithHip(0.51), makeLmWithHip(0.50),
                    makeLmWithHip(0.51), makeLmWithHip(0.50)];
    const result = getBottomPhaseFrames(frames, 'squat');
    expect([...result].sort((a,b)=>a-b)).toEqual([0, 1, 2, 3, 4]);
  });

  it('returns all frames when fewer than 3 valid landmark frames', () => {
    const frames = [makeLmWithHip(1.0), makeLmWithHip(0.5)];
    const result = getBottomPhaseFrames(frames, 'squat');
    expect([...result].sort((a,b)=>a-b)).toEqual([0, 1]);
  });

  it('uses wrist Y for push-up bottom phase', () => {
    // Wrists descend from 0.6 to 0.1 across 6 frames
    // range=0.5, threshold = 0.1 + 0.3*0.5 = 0.25
    // frames with wristY <= 0.25: indices 4 (0.2) and 5 (0.1)
    const frames = Array.from({ length: 6 }, (_, i) => {
      const wristY = 0.6 - (i * 0.1); // 0.6, 0.5, 0.4, 0.3, 0.2, 0.1
      return makeLmWithWrist(wristY);
    });
    const result = getBottomPhaseFrames(frames, 'push-up');
    expect(result.has(5)).toBe(true);
    expect(result.has(0)).toBe(false);
  });
});
