import { LM, angleDeg } from '../rules.js';

export function getBenchRules(shinLength) {
  return [
    {
      id: 'elbows_at_75',
      label: 'Elbows at ~75° from torso',
      severity: 'error',
      cue: 'Do not flare elbows to 90°. Tuck them to ~75° to protect your shoulders.',
      check(lm) {
        const lAngle = angleDeg(lm[LM.L_HIP], lm[LM.L_SHOULDER], lm[LM.L_ELBOW]);
        const rAngle = angleDeg(lm[LM.R_HIP], lm[LM.R_SHOULDER], lm[LM.R_ELBOW]);
        return lAngle > 30 && lAngle < 85 && rAngle > 30 && rAngle < 85;
      },
    },
    {
      id: 'bar_to_lower_chest',
      label: 'Bar lowers to lower chest',
      severity: 'warning',
      cue: 'Lower the bar to your lower chest / nipple line, not your upper chest or neck.',
      check(lm) {
        const wristY    = (lm[LM.L_WRIST].y + lm[LM.R_WRIST].y) / 2;
        const shoulderY = (lm[LM.L_SHOULDER].y + lm[LM.R_SHOULDER].y) / 2;
        const wristZ    = (lm[LM.L_WRIST].z + lm[LM.R_WRIST].z) / 2;
        const shoulderZ = (lm[LM.L_SHOULDER].z + lm[LM.R_SHOULDER].z) / 2;
        return Math.abs(wristY - shoulderY) < 0.24 * shinLength
            && Math.abs(wristZ - shoulderZ) < 0.80 * shinLength;
      },
    },
    {
      id: 'scapular_retraction',
      label: 'Shoulders level on bench',
      severity: 'warning',
      cue: 'Keep both shoulders in contact with the bench — avoid one side rising higher than the other.',
      check(lm) {
        return Math.abs(lm[LM.L_SHOULDER].y - lm[LM.R_SHOULDER].y) < 0.12 * shinLength;
      },
    },
  ];
}
