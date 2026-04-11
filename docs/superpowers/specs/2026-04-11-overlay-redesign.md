# Overlay Redesign — LightBuzz-Style Tracking UI

**Goal:** Replace the current overlay and results layout with a polished, professional visualization: thick color-coded skeleton, joint angle arcs with degree badges at failing/warning joints, and a responsive side-by-side layout that puts feedback flush against the video.

---

## What Changes

### Visual style (canvas overlay)

- **Bones:** 3 px thick, rounded linecap, gradient from joint A color to joint B color (unchanged gradient logic)
- **Joint dots:** 6 px radius (up from 5), glow shadow 10 px blur (up from 8)
- **Color coding:** unchanged — green `#00cc44` / amber `#cc8800` / red `#cc2200` based on which rules each joint is involved in
- **Angle arcs + degree badges:** drawn at the vertex joint of any failing or warning rule that has an associated angle. A dashed arc sweeps between the two bone vectors, and a filled pill badge shows the degree value in monospace. Badge color matches rule severity (red or amber).
- **No warning text callouts on canvas.** The `buildCallouts` function and the badge-drawing block at the bottom of `drawOverlay` are removed entirely. Feedback lives in the side panel only.
- **Floor/bench surface line:** kept as-is.

### Responsive layout (results page)

Two breakpoints driven by a `<style>` block injected by `renderResults`:

**≥ 700 px (desktop/Mac):**
```
┌─────────────────────────────────────────────────┐
│  Barbell Squat · 135 lbs                    [74]│
├──────────────────────┬──────────────────────────┤
│                      │ Form Score          74    │
│   video + canvas     │ ━━━━━━━●━━━━━━━━━━━━━━━  │
│                      ├──────────────────────────┤
│  (angle badges on    │ ✓ Back stays neutral      │
│   problem joints)    │ ✗ Elbows flaring          │
│                      │   Tuck elbows to ~75°…    │
│                      │ ~ Squat depth low         │
│                      │   Lower hips to knee…     │
│                      │ ~ Knees over toes         │
└──────────────────────┴──────────────────────────┘
  [Analyze Another Video]
```
- Video and panel share a `border-radius: var(--radius)` container. Panel has `border-left: 1px solid #1e1e1e`, no gap between them.
- Panel width: `min(260px, 40%)`.

**< 700 px (phone):**
```
┌──────────────────┐
│  Squat · 135 lbs │  [74]
├──────────────────┤
│                  │
│  video + canvas  │
│                  │
├──────────────────┤  ← score bar flush here
│ ━━●━━━━ Fair form│
├──────────────────┤  ← 4 px gap
│ ✓ Back neutral   │
│ ✗ Elbows flaring │
│ ~ Squat depth    │
│ ~ Knees over toes│
└──────────────────┘
  [Analyze Another Video]
```
- Score bar sits in a dark strip directly below the video (no gap). Feedback cards follow immediately with `gap: 4px`.

---

## Architecture

### Files changed

| File | Change |
|---|---|
| `src/pose/overlay.js` | Remove callouts; add `RULE_ANGLES` map + `drawAngleBadge`; thicker bones/dots |
| `src/tabs/results.js` | Responsive two-column layout via injected `<style>` block |

No other files change. `rules.js`, engine files, detector, storage — all untouched.

---

## `src/pose/overlay.js` — detailed spec

### Remove

- `buildCallouts()` function (exported — check it has no other callers; only `drawOverlay` calls it)
- The callout-drawing `forEach` block at the bottom of `drawOverlay` (the badge rectangles with `⚠ label` text)

### Add: `RULE_ANGLES` map

Maps each rule ID to the three joint names used in its angle computation. `null` means the rule uses a distance check — no arc is drawn.

```js
const RULE_ANGLES = {
  // Squat
  knees_over_toes:    null,
  back_neutral:       { a: 'L_SHOULDER', b: 'L_HIP',      c: 'L_KNEE'   },
  squat_depth:        null,
  // Deadlift
  back_flat:          { a: 'L_SHOULDER', b: 'L_HIP',      c: 'L_KNEE'   },
  hips_not_too_high:  null,
  bar_over_feet:      null,
  // Push-up
  body_straight:      { a: 'L_SHOULDER', b: 'L_HIP',      c: 'L_ANKLE'  },
  elbows_not_flared:  { a: 'L_SHOULDER', b: 'L_ELBOW',    c: 'L_WRIST'  },
  full_depth:         { a: 'L_SHOULDER', b: 'L_ELBOW',    c: 'L_WRIST'  },
  // Bench press
  elbows_at_75:       { a: 'L_HIP',      b: 'L_SHOULDER', c: 'L_ELBOW'  },
  bar_to_lower_chest: null,
  scapular_retraction:null,
};
```

### Add: `drawAngleBadge(ctx, vx, vy, ax, ay, cx, cy, deg, color)`

Draws a dashed arc at the vertex (vx, vy) between vectors toward (ax, ay) and (cx, cy), then a filled pill badge showing `deg°`.

```js
function drawAngleBadge(ctx, vx, vy, ax, ay, cx, cy, deg, color) {
  const R = 22; // arc radius px

  // Angles of the two bone vectors from vertex
  const angleA = Math.atan2(ay - vy, ax - vx);
  const angleC = Math.atan2(cy - vy, cx - vx);

  // Draw dashed arc (always the smaller angle between the two vectors)
  ctx.save();
  ctx.setLineDash([3, 3]);
  ctx.strokeStyle = color + 'cc';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  // Use counterclockwise flag to always pick the short arc
  let start = angleA, end = angleC;
  let ccw = false;
  const diff = ((end - start) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
  if (diff > Math.PI) { ccw = true; }
  ctx.arc(vx, vy, R, start, end, ccw);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // Badge: placed at midpoint of the arc
  const midAngle = start + (ccw ? -(Math.PI * 2 - diff) : diff) / 2;
  const bx = vx + (R + 18) * Math.cos(midAngle);
  const by = vy + (R + 18) * Math.sin(midAngle);
  const label = `${Math.round(deg)}°`;
  ctx.font = 'bold 9px monospace';
  const tw = ctx.measureText(label).width;
  const pad = 5;

  ctx.fillStyle = color + 'e6';
  ctx.beginPath();
  ctx.roundRect(bx - tw / 2 - pad, by - 8, tw + pad * 2, 16, 4);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, bx, by);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}
```

### Update: `drawOverlay` — angle badge section

After the joint-dot loop, add:

```js
// ── Angle badges at failing/warning joints ─────────────────────────────
const SEVERITY_COLOR_MAP = { error: '#cc2200', warning: '#cc8800' };
ruleResults
  .filter(r => !r.pass && RULE_ANGLES[r.id])
  .forEach(r => {
    const joints = RULE_ANGLES[r.id];
    const lmA = landmarks[LM[joints.a]];
    const lmB = landmarks[LM[joints.b]];
    const lmC = landmarks[LM[joints.c]];
    if (!lmA || !lmB || !lmC) return;
    if (lmA.visibility < 0.5 || lmB.visibility < 0.5 || lmC.visibility < 0.5) return;

    const ax = lmA.x * width, ay = lmA.y * height;
    const bx = lmB.x * width, by = lmB.y * height;
    const cx = lmC.x * width, cy = lmC.y * height;

    // Compute angle from image coords (visual consistency with drawn skeleton)
    const abx = ax - bx, aby = ay - by;
    const cbx = cx - bx, cby = cy - by;
    const dot = abx * cbx + aby * cby;
    const mag = Math.sqrt((abx ** 2 + aby ** 2) * (cbx ** 2 + cby ** 2));
    const deg = mag === 0 ? 0 : Math.acos(Math.max(-1, Math.min(1, dot / mag))) * (180 / Math.PI);

    const color = SEVERITY_COLOR_MAP[r.severity] ?? '#cc2200';
    drawAngleBadge(ctx, bx, by, ax, ay, cx, cy, deg, color);
  });
```

### Update bone width and joint dot radius

- `ctx.lineWidth = 2` → `ctx.lineWidth = 3`
- Joint dot `ctx.arc(x, y, 5, ...)` → `ctx.arc(x, y, 6, ...)`
- `ctx.shadowBlur = 8` → `ctx.shadowBlur = 10`

---

## `src/tabs/results.js` — detailed spec

### `renderResults` — inject responsive `<style>` and restructure HTML

The function returns an HTML string. Prepend a `<style>` block and restructure the layout. Full return value:

```html
<style>
  .ff-results-body { display: flex; flex-direction: column; }
  .ff-results-main { display: flex; flex-direction: column; gap: 0; }
  .ff-video-wrap   { position: relative; background: #000; border-radius: var(--radius) var(--radius) 0 0; overflow: hidden; }
  .ff-score-strip  { background: #111; border-radius: 0 0 var(--radius) var(--radius);
                     padding: 6px 10px; display: flex; align-items: center; gap: 10px; }
  .ff-panel        { display: flex; flex-direction: column; gap: 4px; margin-top: 4px; }
  .ff-panel-inner  { display: flex; flex-direction: column; gap: 4px; }

  @media (min-width: 700px) {
    .ff-results-main { flex-direction: row; align-items: stretch; }
    .ff-video-wrap   { flex: 1.2; border-radius: var(--radius) 0 0 var(--radius); }
    .ff-score-strip  { display: none; }  /* score moves into panel on desktop */
    .ff-panel        { flex: 1; margin-top: 0; min-width: 0; }
    .ff-panel-inner  { background: #111; border: 1px solid #1e1e1e;
                       border-left: none; border-radius: 0 var(--radius) var(--radius) 0;
                       padding: 12px; height: 100%; box-sizing: border-box; }
    .ff-score-desktop { display: flex !important; }
  }
  .ff-score-desktop { display: none; }
</style>

<div class="ff-results-body">
  <!-- Top bar -->
  <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;flex-wrap:wrap">
    <span style="font-weight:700;font-size:0.85rem">${label}</span>
    <span style="color:var(--text-muted);font-size:0.7rem">· ${weight} ${unit}</span>
    <span style="margin-left:auto">${scoreBadgeHTML(score)}</span>
  </div>

  <div class="ff-results-main">
    <!-- Video + canvas -->
    <div class="ff-video-wrap">
      <video id="result-video" style="width:100%;display:block" controls playsinline></video>
      <canvas id="overlay-canvas" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none"></canvas>
    </div>

    <!-- Score strip (mobile only — sits directly below video) -->
    <div class="ff-score-strip">
      ${scoreBarHTML(score)}
    </div>

    <!-- Feedback panel -->
    <div class="ff-panel">
      <div class="ff-panel-inner">
        <!-- Score (desktop only — inside panel) -->
        <div class="ff-score-desktop" style="flex-direction:column;gap:6px;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid #1e1e1e">
          <div style="display:flex;justify-content:space-between;align-items:baseline">
            <span style="font-size:0.6rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em">Form Score</span>
            <span style="font-size:1.5rem;font-weight:800;color:${scoreColor(score)};line-height:1">${score}</span>
          </div>
          ${scoreBarHTML(score)}
        </div>
        <!-- Rule result cards -->
        ${issueRows}
      </div>
    </div>
  </div>

  <button class="btn-primary" id="analyze-another" style="margin-top:0.75rem">Analyze Another Video</button>
</div>
```

### `scoreColor(score)` helper (private, inside results.js)

```js
function scoreColor(score) {
  if (score >= 75) return 'var(--score-green)';
  if (score >= 51) return 'var(--score-amber)';
  return 'var(--score-red)';
}
```

### Issue row cards — tighten spacing

Keep existing card markup. Reduce `margin-bottom` from `4px` to `0` (gap is handled by `ff-panel-inner` flex gap).

---

## What does NOT change

- `src/engine/rules.js`, all exercise files, `src/pose/detector.js`, `src/engine/exercise-detector.js`, `src/engine/analysis-runner.js` — no changes
- `src/styles.css` — no changes (layout handled by injected `<style>` in `renderResults`)
- Score badge HTML — unchanged
- Score bar HTML — unchanged (reused in both phone and desktop positions)
- `attachResultsListeners` — no changes needed; it already references `#result-video`, `#overlay-canvas`, and calls `drawOverlay` with `frame.image`
- Test files — no changes (overlay and results are not unit-tested per project scope)

---

## Edge cases

- **`ctx.roundRect` availability:** Supported in all modern browsers (Chrome 99+, Safari 15.4+, Firefox 112+). No polyfill needed for this PWA.
- **Badge clipping:** Badges near canvas edges may clip. Accept this — joints near edges have low visibility anyway and will often be filtered by the `visibility < 0.5` guard.
- **`elbows_not_flared` and `full_depth` same joints:** Both map to `L_SHOULDER / L_ELBOW / L_WRIST`. If both fail, two badges would overlap. The `ruleResults` array processes them in order; the second badge overwrites the first. This is acceptable — the angle value is the same for both rules.
