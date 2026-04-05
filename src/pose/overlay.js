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

// Skeleton connections drawn as bones between joints
const BONES = [
  // Torso
  ['L_SHOULDER', 'R_SHOULDER'],
  ['L_HIP',      'R_HIP'],
  ['L_SHOULDER', 'L_HIP'],
  ['R_SHOULDER', 'R_HIP'],
  // Left arm
  ['L_SHOULDER', 'L_ELBOW'],
  ['L_ELBOW',    'L_WRIST'],
  // Right arm
  ['R_SHOULDER', 'R_ELBOW'],
  ['R_ELBOW',    'R_WRIST'],
  // Left leg
  ['L_HIP',  'L_KNEE'],
  ['L_KNEE', 'L_ANKLE'],
  // Right leg
  ['R_HIP',  'R_KNEE'],
  ['R_KNEE', 'R_ANKLE'],
];

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

/**
 * Estimates where the floor/bench surface is and draws a reference line.
 *
 * Vertical exercises (squat, deadlift): floor at ankle level.
 * Push-up: floor at wrist level (hands on ground).
 * Bench press: bench surface at shoulder/hip level.
 */
function drawSurface(ctx, width, height, landmarks, exercise) {
  let surfaceY = null;
  let label = 'Floor';

  if (exercise === 'push-up') {
    // Hands are on the floor — use wrist y
    const lw = landmarks[LM.L_WRIST];
    const rw = landmarks[LM.R_WRIST];
    const visible = [lw, rw].filter(p => p && p.visibility > 0.4);
    if (visible.length) surfaceY = Math.max(...visible.map(p => p.y)) * height;
    label = 'Floor';
  } else if (exercise === 'bench-press') {
    // Bench surface sits under the shoulders/hips
    const ls = landmarks[LM.L_SHOULDER];
    const rs = landmarks[LM.R_SHOULDER];
    const lh = landmarks[LM.L_HIP];
    const rh = landmarks[LM.R_HIP];
    const visible = [ls, rs, lh, rh].filter(p => p && p.visibility > 0.4);
    if (visible.length) surfaceY = Math.max(...visible.map(p => p.y)) * height;
    label = 'Bench';
  } else {
    // Squat / deadlift — floor at ankle level
    const la = landmarks[LM.L_ANKLE];
    const ra = landmarks[LM.R_ANKLE];
    const visible = [la, ra].filter(p => p && p.visibility > 0.4);
    if (visible.length) surfaceY = Math.max(...visible.map(p => p.y)) * height;
    label = 'Floor';
  }

  if (surfaceY === null) return;

  // Draw dashed surface line
  ctx.save();
  ctx.setLineDash([8, 6]);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.moveTo(0, surfaceY);
  ctx.lineTo(width, surfaceY);
  ctx.stroke();

  // Label
  ctx.setLineDash([]);
  ctx.font = '10px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText(label, 6, surfaceY - 4);
  ctx.restore();
}

export function drawOverlay(ctx, width, height, landmarks, ruleResults, exercise) {
  // ── Bones ──────────────────────────────────────────────────────────────
  ctx.lineWidth = 2;
  BONES.forEach(([a, b]) => {
    const lmA = landmarks[LM[a]];
    const lmB = landmarks[LM[b]];
    if (!lmA || !lmB || lmA.visibility < 0.5 || lmB.visibility < 0.5) return;

    const colorA = getJointColor(a, ruleResults);
    const colorB = getJointColor(b, ruleResults);

    // Gradient along the bone from joint A colour to joint B colour
    const x1 = lmA.x * width;
    const y1 = lmA.y * height;
    const x2 = lmB.x * width;
    const y2 = lmB.y * height;
    const grad = ctx.createLinearGradient(x1, y1, x2, y2);
    grad.addColorStop(0, colorA + 'aa');
    grad.addColorStop(1, colorB + 'aa');

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = grad;
    ctx.stroke();
  });

  // ── Joint dots ─────────────────────────────────────────────────────────
  Object.keys(LM).forEach(name => {
    const lm = landmarks[LM[name]];
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

  // ── Floor / bench surface ──────────────────────────────────────────────
  if (exercise) drawSurface(ctx, width, height, landmarks, exercise);

  // ── Warning callouts ───────────────────────────────────────────────────
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
