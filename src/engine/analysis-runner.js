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
 * @returns {Promise<{exercise, weight, unit, score, ruleResults, frames}>}
 */
export async function runAnalysis(videoEl, weight, unit) {
  const updateProgress = p => {
    const btn = document.getElementById('analyze-btn');
    if (btn) btn.textContent = `Analyzing… ${Math.round(p * 100)}%`;
  };

  const frames = await processVideo(videoEl, 10, updateProgress);

  const exercise = detectExercise(frames) ?? 'squat';
  const rules = EXERCISE_RULES[exercise] ?? [];
  const ruleResults = evaluateRules(rules, frames);
  const score = calculateScore(ruleResults);

  saveSession({ exercise, weight, unit, score, ruleResults });

  return { exercise, weight, unit, score, ruleResults, frames };
}
