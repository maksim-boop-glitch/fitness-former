import { vi, describe, it, expect, beforeEach } from 'vitest';
import { detectExerciseViaVision } from '../../src/engine/vision-detect.js';

describe('detectExerciseViaVision', () => {
  let fakeVideo;

  beforeEach(() => {
    fakeVideo = {
      duration: 10,
      readyState: 4,
      currentTime: 0,
      width: 320,
      height: 240,
      addEventListener: vi.fn((event, cb, opts) => {
        if (event === 'seeked') cb();
      }),
      removeEventListener: vi.fn(),
    };

    const mockCtx = { drawImage: vi.fn() };
    vi.spyOn(document, 'createElement').mockImplementation(tag => {
      if (tag === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: () => mockCtx,
          toDataURL: () => 'data:image/jpeg;base64,FAKEFRAME',
        };
      }
      return document.createElement.wrappedMethod?.(tag) ?? {};
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it('returns the exercise name from a successful API response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ exercise: 'push-up' }),
    });

    const result = await detectExerciseViaVision(fakeVideo);
    expect(result).toBe('push-up');
    expect(fetch).toHaveBeenCalledWith('/api/detect-exercise', expect.objectContaining({
      method: 'POST',
    }));
  });

  it('returns null when the API responds with a non-ok status', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false });
    const result = await detectExerciseViaVision(fakeVideo);
    expect(result).toBeNull();
  });

  it('returns null when fetch throws (network error)', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network error'));
    const result = await detectExerciseViaVision(fakeVideo);
    expect(result).toBeNull();
  });
});
