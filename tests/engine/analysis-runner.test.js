import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../src/pose/detector.js', () => ({
  processVideo: vi.fn().mockResolvedValue([
    Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 })),
  ]),
}));
vi.mock('../../src/storage.js', () => ({ saveSession: vi.fn() }));

import { runAnalysis } from '../../src/engine/analysis-runner.js';

describe('runAnalysis', () => {
  let fakeVideo;
  beforeEach(() => {
    fakeVideo = { duration: 5 };
    document.body.innerHTML = '<button id="analyze-btn">Analyze</button>';
  });

  it('uses exerciseOverride when provided, skipping auto-detection', async () => {
    const result = await runAnalysis(fakeVideo, 135, 'lbs', 'push-up');
    expect(result.exercise).toBe('push-up');
  });

  it('falls back to heuristic when no override given', async () => {
    const result = await runAnalysis(fakeVideo, 135, 'lbs');
    expect(result.exercise).toBe('squat');
  });
});
