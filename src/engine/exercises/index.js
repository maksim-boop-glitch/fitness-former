import { SQUAT_RULES }    from './squat.js';
import { DEADLIFT_RULES } from './deadlift.js';
import { BENCH_RULES }    from './bench-press.js';
import { PUSHUP_RULES }   from './push-up.js';

export const EXERCISE_RULES = {
  squat:           SQUAT_RULES,
  deadlift:        DEADLIFT_RULES,
  'bench-press':   BENCH_RULES,
  'push-up':       PUSHUP_RULES,
};

export const SUPPORTED_EXERCISES = Object.keys(EXERCISE_RULES);
