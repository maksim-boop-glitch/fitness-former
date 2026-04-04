export const LM = {
  NOSE: 0,
  L_SHOULDER: 11, R_SHOULDER: 12,
  L_ELBOW: 13,    R_ELBOW: 14,
  L_WRIST: 15,    R_WRIST: 16,
  L_HIP: 23,      R_HIP: 24,
  L_KNEE: 25,     R_KNEE: 26,
  L_ANKLE: 27,    R_ANKLE: 28,
};

/**
 * Returns the angle in degrees at joint B.
 * @param {{x:number,y:number}} a
 * @param {{x:number,y:number}} b  — the vertex
 * @param {{x:number,y:number}} c
 * @returns {number}
 */
export function angleDeg(a, b, c) {
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const mag = Math.sqrt((ab.x ** 2 + ab.y ** 2) * (cb.x ** 2 + cb.y ** 2));
  if (mag === 0) return 0;
  return Math.acos(Math.min(1, Math.max(-1, dot / mag))) * (180 / Math.PI);
}

/**
 * Evaluates a set of rules against an array of pose landmark frames.
 * A rule passes if its check() returns true in >= 50% of frames.
 *
 * @param {Array<{id, label, severity, cue, check: (landmarks) => boolean}>} rules
 * @param {Array<Array<{x,y,z,visibility}>>} frames
 * @returns {Array<{id, label, severity, cue, pass}>}
 */
export function evaluateRules(rules, frames) {
  if (frames.length === 0) return rules.map(rule => ({
    id: rule.id, label: rule.label, severity: rule.severity, cue: rule.cue, pass: true,
  }));
  return rules.map(rule => {
    const passCount = frames.filter(lm => rule.check(lm)).length;
    const pass = passCount / frames.length >= 0.5;
    return { id: rule.id, label: rule.label, severity: rule.severity, cue: rule.cue, pass };
  });
}
