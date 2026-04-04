import { LM } from '../engine/rules.js';

const RULE_JOINTS = {
  knees_over_toes:     ['L_KNEE', 'R_KNEE'],
  squat_depth:         ['L_HIP', 'R_HIP'],
  back_neutral:        ['L_SHOULDER', 'L_HIP'],
  back_flat:           ['L_SHOULDER', 'L_HIP'],
  hips_not_too_high:   ['L_HIP'],
  bar_over_feet:       ['L_WRIST'],
  body_straight:       ['L_HIP'],
  elbows_not_flared:   ['L_ELBOW', 'R_ELBOW'],
  full_depth:          ['L_ELBOW'],
  elbows_at_75:        ['L_ELBOW', 'R_ELBOW'],
  bar_to_lower_chest:  ['L_WRIST', 'R_WRIST'],
  scapular_retraction: ['L_SHOULDER', 'R_SHOULDER'],
};

export function getJointColor(jointName, results) {
  const failing = results.filter(r => !r.pass);
  const isInvolved = failing.some(r => (RULE_JOINTS[r.id] ?? []).includes(jointName));
  if (!isInvolved) return '#00cc44';
  const hasError = failing
    .filter(r => (RULE_JOINTS[r.id] ?? []).includes(jointName))
    .some(r => r.severity === 'error');
  return hasError ? '#cc2200' : '#cc8800';
}

export function buildCallouts(results) {
  return results
    .filter(r => !r.pass)
    .map(r => ({ id: r.id, label: r.label, severity: r.severity }));
}

export function drawOverlay(ctx, width, height, landmarks, ruleResults) {
  const JOINT_NAMES = Object.keys(LM);

  JOINT_NAMES.forEach(name => {
    const idx = LM[name];
    const lm = landmarks[idx];
    if (!lm || lm.visibility < 0.5) return;

    const x = lm.x * width;
    const y = lm.y * height;
    const color = getJointColor(name, ruleResults);

    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0;
  });

  const callouts = buildCallouts(ruleResults);
  callouts.forEach((c, i) => {
    const badgeX = width - 8;
    const badgeY = height - 12 - i * 22;
    const color = c.severity === 'error' ? '#cc2200' : '#cc8800';
    ctx.font = 'bold 10px sans-serif';
    const text = `⚠ ${c.label}`;
    const tw = ctx.measureText(text).width;
    ctx.fillStyle = `${color}dd`;
    ctx.fillRect(badgeX - tw - 8, badgeY - 12, tw + 10, 18);
    ctx.fillStyle = '#fff';
    ctx.fillText(text, badgeX - tw - 3, badgeY);
  });
}
