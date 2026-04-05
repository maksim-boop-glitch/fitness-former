import { processVideo } from '../pose/detector.js';
import { detectExercise } from './exercise-detector.js';
import { evaluateRules } from './rules.js';
import { calculateScore } from './score.js';
import { EXERCISE_RULES } from './exercises/index.js';
import { saveSession } from '../storage.js';

/**
 * Runs the full analysis pipeline on a video element.
 *
 * @param {HTMLVideoElement} videoEl
 * @param {number} weight
 * @param {'lbs'|'kg'} unit
 * @param {string|null} [exerciseOverride] - skip auto-detection and use this exercise
 * @returns {Promise<{exercise, weight, unit, score, ruleResults, frames}>}
 */
export async function runAnalysis(videoEl, weight, unit, exerciseOverride = null) {
  const updateProgress = p => {
    const btn = document.getElementById('analyze-btn');
    if (btn) btn.textContent = `Analyzing… ${Math.round(p * 100)}%`;
  };

  const frames = await processVideo(videoEl, 10, updateProgress);

  if (frames.length === 0) {
    const btn = document.getElementById('analyze-btn');
    if (btn) {
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.textContent = 'Analyze My Form';
    }
    const errorEl = document.createElement('p');
    errorEl.style.cssText = 'color:var(--score-red);font-size:0.7rem;text-align:center;margin-top:0.5rem';
    errorEl.textContent = 'No pose detected — make sure your full body is visible in the video.';
    document.getElementById('analyze-btn')?.after(errorEl);
    throw new Error('No pose frames detected');
  }

  const exercise = exerciseOverride ?? detectExercise(frames) ?? 'squat';
  const rules = EXERCISE_RULES[exercise] ?? [];
  const ruleResults = evaluateRules(rules, frames);
  const score = calculateScore(ruleResults);

  saveSession({ exercise, weight, unit, score, ruleResults });

  return { exercise, weight, unit, score, ruleResults, frames };
}
