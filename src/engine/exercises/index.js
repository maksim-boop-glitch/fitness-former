import { getSquatRules }    from './squat.js';
import { getDeadliftRules } from './deadlift.js';
import { getBenchRules }    from './bench-press.js';
import { getPushUpRules }   from './push-up.js';

export function getExerciseRules(exercise, shinLength) {
  const factories = {
    squat:         getSquatRules,
    deadlift:      getDeadliftRules,
    'bench-press': getBenchRules,
    'push-up':     getPushUpRules,
  };
  return factories[exercise]?.(shinLength) ?? [];
}

export const SUPPORTED_EXERCISES = ['squat', 'deadlift', 'bench-press', 'push-up'];
