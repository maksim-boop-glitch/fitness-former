/**
 * Maps a 0-100 form score to a color tier.
 * @param {number} score
 * @returns {'red'|'amber'|'green'}
 */
export function scoreColor(score) {
  if (score <= 50) return 'red';
  if (score <= 74) return 'amber';
  return 'green';
}

/**
 * Returns an HTML badge for the given form score.
 * @param {number} score
 * @returns {string} HTML
 */
export function scoreBadgeHTML(score) {
  const tier = scoreColor(score);
  const cssVar = tier === 'red' ? 'var(--score-red)'
    : tier === 'amber' ? 'var(--score-amber)'
    : 'var(--score-green)';
  return `<span class="score-badge score-${tier}" style="
    background: color-mix(in srgb, ${cssVar} 15%, transparent);
    border: 1px solid ${cssVar};
    color: ${cssVar};
    font-size: 0.75rem;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: 5px;
  ">${score}<span style="font-size:0.55rem;opacity:0.6">/100</span></span>`;
}

/**
 * Renders the gradient bar with a position marker.
 * @param {number} score 0-100
 * @returns {string} HTML
 */
export function scoreBarHTML(score, { marginBottom = '0.75rem' } = {}) {
  return `
    <div style="margin-bottom:${marginBottom}">
      <div style="height:8px;border-radius:4px;background:linear-gradient(90deg,var(--score-red),var(--score-amber),var(--score-green));position:relative">
        <div style="position:absolute;left:${score}%;top:-3px;width:2px;height:14px;background:#fff;border-radius:2px;transform:translateX(-50%)"></div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:3px">
        <span style="font-size:0.5rem;color:var(--score-red)">0 · Poor</span>
        <span style="font-size:0.5rem;color:var(--score-amber)">50 · Fair</span>
        <span style="font-size:0.5rem;color:var(--score-green)">100 · Perfect</span>
      </div>
    </div>`;
}
