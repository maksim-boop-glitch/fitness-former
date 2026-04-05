import { LM, angleDeg } from '../rules.js';

export const PUSHUP_RULES = [
  {
    id: 'body_straight',
    label: 'Body stays in a straight line',
    severity: 'error',
    cue: 'Keep your hips level — do not let them sag toward the floor or pike up.',
    check(lm) {
      // 3D angle at hip: shoulder–hip–ankle; straight body = ~180°
      return angleDeg(lm[LM.L_SHOULDER], lm[LM.L_HIP], lm[LM.L_ANKLE]) > 165
          && angleDeg(lm[LM.R_SHOULDER], lm[LM.R_HIP], lm[LM.R_ANKLE]) > 165;
    },
  },
  {
    id: 'elbows_not_flared',
    label: 'Elbows at ~45-75° from torso',
    severity: 'warning',
    cue: 'Tuck your elbows slightly — avoid flaring them out to 90° which strains the shoulder.',
    check(lm) {
      // 3D elbow angle: shoulder–elbow–wrist; not flared = < 110°
      return angleDeg(lm[LM.L_SHOULDER], lm[LM.L_ELBOW], lm[LM.L_WRIST]) < 110
          && angleDeg(lm[LM.R_SHOULDER], lm[LM.R_ELBOW], lm[LM.R_WRIST]) < 110;
    },
  },
  {
    id: 'full_depth',
    label: 'Chest reaches near the floor',
    severity: 'warning',
    cue: 'Lower until your chest nearly touches the floor for full range of motion.',
    check(lm) {
      // At full depth the elbow angle is sharper
      return angleDeg(lm[LM.L_SHOULDER], lm[LM.L_ELBOW], lm[LM.L_WRIST]) < 100
          && angleDeg(lm[LM.R_SHOULDER], lm[LM.R_ELBOW], lm[LM.R_WRIST]) < 100;
    },
  },
];
