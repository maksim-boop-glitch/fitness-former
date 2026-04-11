import { LM, angleDeg, horizDist } from '../rules.js';

export function getSquatRules(shinLength) {
  return [
    {
      id: 'knees_over_toes',
      label: 'Knees track over toes',
      severity: 'error',
      cue: 'Push your knees outward in line with your toes throughout the movement.',
      check(lm) {
        return horizDist(lm[LM.L_KNEE], lm[LM.L_ANKLE]) < 0.30 * shinLength
            && horizDist(lm[LM.R_KNEE], lm[LM.R_ANKLE]) < 0.30 * shinLength;
      },
    },
    {
      id: 'back_neutral',
      label: 'Torso stays upright',
      severity: 'error',
      cue: 'Keep your chest up — avoid collapsing your torso forward.',
      check(lm) {
        return angleDeg(lm[LM.L_SHOULDER], lm[LM.L_HIP], lm[LM.L_KNEE]) > 90;
      },
    },
    {
      id: 'squat_depth',
      label: 'Hip reaches parallel or below',
      severity: 'warning',
      cue: 'Try to lower your hips to at least knee height for full range of motion.',
      check(lm) {
        const lDepth = lm[LM.L_HIP].y - lm[LM.L_KNEE].y < 0.10 * shinLength;
        const rDepth = lm[LM.R_HIP].y - lm[LM.R_KNEE].y < 0.10 * shinLength;
        return lDepth && rDepth;
      },
    },
  ];
}
