import { processVideo } from '../pose/detector.js';
import { detectExercise } from './exercise-detector.js';
import { evaluateRules } from './rules.js';
import { calculateScore } from './score.js';
import { getExerciseRules } from './exercises/index.js';
import { computeBodyMetrics } from './body-metrics.js';
import { getBottomPhaseFrames } from './rep-phases.js';
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

  const frames = await processVideo(videoEl, 5, updateProgress);

  if (frames.length === 0) {
    const btn = document.getElementById('analyze-btn');
    if (btn) {
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.textContent = 'Analyze My Form';
    }
    throw new Error('No pose frames detected');
  }

  const exercise = exerciseOverride ?? detectExercise(frames) ?? 'squat';
  const worldFrames = frames.map(f => f.world ?? f);
  const { shinLength } = computeBodyMetrics(worldFrames);
  const phaseFrames = getBottomPhaseFrames(worldFrames, exercise);
  const rules = getExerciseRules(exercise, shinLength);
  const ruleResults = evaluateRules(rules, worldFrames, phaseFrames);
  const score = calculateScore(ruleResults);

  saveSession({ exercise, weight, unit, score, ruleResults });

  return { exercise, weight, unit, score, ruleResults, frames };
}
