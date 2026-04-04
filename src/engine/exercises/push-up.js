import { LM, angleDeg } from '../rules.js';

export const PUSHUP_RULES = [
  {
    id: 'body_straight',
    label: 'Body stays in a straight line',
    severity: 'error',
    cue: 'Keep your hips level — do not let them sag toward the floor or pike up.',
    check(lm) {
      const expectedHipY = (lm[LM.L_SHOULDER].y + lm[LM.L_ANKLE].y) / 2;
      return Math.abs(lm[LM.L_HIP].y - expectedHipY) < 0.08;
    },
  },
  {
    id: 'elbows_not_flared',
    label: 'Elbows at ~45-75° from torso',
    severity: 'warning',
    cue: 'Tuck your elbows slightly — avoid flaring them out to 90° which strains the shoulder.',
    check(lm) {
      const angle = angleDeg(lm[LM.L_SHOULDER], lm[LM.L_ELBOW], lm[LM.L_WRIST]);
      return angle < 110;
    },
  },
  {
    id: 'full_depth',
    label: 'Chest reaches near the floor',
    severity: 'warning',
    cue: 'Lower until your chest nearly touches the floor for full range of motion.',
    check(lm) {
      const angle = angleDeg(lm[LM.L_SHOULDER], lm[LM.L_ELBOW], lm[LM.L_WRIST]);
      return angle < 100;
    },
  },
];
