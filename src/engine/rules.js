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
 * Returns the angle in degrees at joint B using 3D vectors.
 * Falls back to 2D when z is absent (backward compatible).
 */
export function angleDeg(a, b, c) {
  const ab = { x: a.x - b.x, y: a.y - b.y, z: (a.z ?? 0) - (b.z ?? 0) };
  const cb = { x: c.x - b.x, y: c.y - b.y, z: (c.z ?? 0) - (b.z ?? 0) };
  const dot = ab.x * cb.x + ab.y * cb.y + ab.z * cb.z;
  const mag = Math.sqrt((ab.x ** 2 + ab.y ** 2 + ab.z ** 2) * (cb.x ** 2 + cb.y ** 2 + cb.z ** 2));
  if (mag === 0) return 0;
  return Math.acos(Math.max(-1, Math.min(1, dot / mag))) * (180 / Math.PI);
}

/**
 * Horizontal distance between two points in the world XZ plane.
 * Camera-invariant — Y (height) is ignored.
 */
export function horizDist(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.z - b.z) ** 2);
}

/**
 * Evaluates a set of rules against an array of pose frames.
 * Frames may be bare landmark arrays OR { image, world } objects.
 * Rules receive world landmarks when available.
 *
 * @param {Array} rules
 * @param {Array} frames
 * @param {Set<number>|null} [phaseFrames] - when provided, only these frame
 *   indices are evaluated. null = evaluate all frames.
 */
export function evaluateRules(rules, frames, phaseFrames = null) {
  const active = phaseFrames
    ? frames.filter((_, i) => phaseFrames.has(i))
    : frames;
  if (active.length === 0) return rules.map(rule => ({
    id: rule.id, label: rule.label, severity: rule.severity, cue: rule.cue, pass: true,
  }));
  return rules.map(rule => {
    const passCount = active.filter(f => rule.check(f.world ?? f)).length;
    const pass = passCount / active.length >= 0.5;
    return { id: rule.id, label: rule.label, severity: rule.severity, cue: rule.cue, pass };
  });
}
