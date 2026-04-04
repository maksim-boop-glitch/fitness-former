import { LM, angleDeg } from '../rules.js';

export const BENCH_RULES = [
  {
    id: 'elbows_at_75',
    label: 'Elbows at ~75° from torso',
    severity: 'error',
    cue: 'Do not flare elbows to 90°. Tuck them to ~75° to protect your shoulders.',
    check(lm) {
      const angle = angleDeg(lm[LM.L_SHOULDER], lm[LM.L_ELBOW], lm[LM.L_WRIST]);
      return angle > 30 && angle < 110;
    },
  },
  {
    id: 'bar_to_lower_chest',
    label: 'Bar lowers to lower chest',
    severity: 'warning',
    cue: 'Lower the bar to your lower chest / nipple line, not your upper chest or neck.',
    check(lm) {
      const wristY = (lm[LM.L_WRIST].y + lm[LM.R_WRIST].y) / 2;
      const shoulderY = (lm[LM.L_SHOULDER].y + lm[LM.R_SHOULDER].y) / 2;
      return Math.abs(wristY - shoulderY) < 0.12;
    },
  },
  {
    id: 'scapular_retraction',
    label: 'Shoulder blades retracted',
    severity: 'warning',
    cue: 'Pinch your shoulder blades together before unracking — this protects your shoulders and improves power.',
    check(lm) {
      return Math.abs(lm[LM.L_SHOULDER].y - lm[LM.R_SHOULDER].y) < 0.06;
    },
  },
];
