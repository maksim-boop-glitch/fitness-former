# Overlay Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the text-callout overlay with thick color-coded skeleton, angle arcs at failing joints, and a side-by-side responsive results layout.

**Architecture:** Two files change: `src/pose/overlay.js` gains a `RULE_ANGLES` map and `drawAngleBadge` function, loses `buildCallouts` and the callout drawing loop; `src/tabs/results.js` gains a private `scoreColor` helper and restructures its returned HTML with a `<style>` block + responsive CSS classes.

**Tech Stack:** Vanilla JS, Canvas 2D API, CSS `@media` query injected as an HTML `<style>` block.

---

## File Map

| File | Change |
|---|---|
| `src/pose/overlay.js` | Remove `buildCallouts` + callout block; thicken bones/dots; add `RULE_ANGLES` + `drawAngleBadge`; draw badges in `drawOverlay` |
| `src/tabs/results.js` | Add private `scoreColor`; inject `<style>` block; restructure HTML to two-column responsive layout; `margin-bottom:0` on issue row cards |

No other files change (no test files — UI rendering is not unit-tested in this project).

---

## Task 1: Update `src/pose/overlay.js`

**Files:**
- Modify: `src/pose/overlay.js`

- [ ] **Step 1: Read the current file**

Read `src/pose/overlay.js` to confirm the current content before editing.

- [ ] **Step 2: Remove `buildCallouts` export and the callout drawing block**

In `src/pose/overlay.js`:

Remove the `buildCallouts` function entirely (currently lines 49–53):
```js
// DELETE this entire function:
export function buildCallouts(results) {
  return results
    .filter(r => !r.pass)
    .map(r => ({ id: r.id, label: r.label, severity: r.severity }));
}
```

Remove the callout drawing block at the bottom of `drawOverlay` (currently lines 159–172):
```js
// DELETE this entire block:
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
```

- [ ] **Step 3: Add `RULE_ANGLES` map — after the `RULE_JOINTS` block, before `BONES`**

Insert this constant between `RULE_JOINTS` and `BONES`:

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

- [ ] **Step 4: Add `drawAngleBadge` function — before `drawSurface`**

Insert this function before `drawSurface`:

```js
function drawAngleBadge(ctx, vx, vy, ax, ay, cx, cy, deg, color) {
  const R = 22;

  const angleA = Math.atan2(ay - vy, ax - vx);
  const angleC = Math.atan2(cy - vy, cx - vx);

  ctx.save();
  ctx.setLineDash([3, 3]);
  ctx.strokeStyle = color + 'cc';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  let start = angleA, end = angleC;
  let ccw = false;
  const diff = ((end - start) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
  if (diff > Math.PI) { ccw = true; }
  ctx.arc(vx, vy, R, start, end, ccw);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

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

- [ ] **Step 5: Update bone width, dot radius, and shadow blur in `drawOverlay`**

Change:
```js
  ctx.lineWidth = 2;
```
To:
```js
  ctx.lineWidth = 3;
```

Change the joint dot arc call:
```js
    ctx.arc(x, y, 5, 0, Math.PI * 2);
```
To:
```js
    ctx.arc(x, y, 6, 0, Math.PI * 2);
```

Change shadow blur:
```js
    ctx.shadowBlur = 8;
```
To:
```js
    ctx.shadowBlur = 10;
```

- [ ] **Step 6: Add angle badge drawing block in `drawOverlay` — after joint-dots loop, before floor surface**

Add this block between the joint-dots `forEach` and the `// ── Floor / bench surface ──` line:

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

      const abx = ax - bx, aby = ay - by;
      const cbx = cx - bx, cby = cy - by;
      const dot = abx * cbx + aby * cby;
      const mag = Math.sqrt((abx ** 2 + aby ** 2) * (cbx ** 2 + cby ** 2));
      const deg = mag === 0 ? 0 : Math.acos(Math.max(-1, Math.min(1, dot / mag))) * (180 / Math.PI);

      const color = SEVERITY_COLOR_MAP[r.severity] ?? '#cc2200';
      drawAngleBadge(ctx, bx, by, ax, ay, cx, cy, deg, color);
    });
```

- [ ] **Step 7: Verify no references to `buildCallouts` remain**

Run:
```bash
grep -n "buildCallouts" src/pose/overlay.js src/tabs/results.js
```

Expected: no output (zero matches).

- [ ] **Step 8: Commit**

```bash
git add src/pose/overlay.js
git commit -m "feat: overlay redesign — thick bones, angle badges, remove callouts"
```

---

## Task 2: Update `src/tabs/results.js`

**Files:**
- Modify: `src/tabs/results.js`

- [ ] **Step 1: Read the current file**

Read `src/tabs/results.js` to confirm current content.

- [ ] **Step 2: Remove unused `buildCallouts` import**

The current import line is:
```js
import { scoreBadgeHTML, scoreBarHTML } from '../ui/score-badge.js';
import { drawOverlay } from '../pose/overlay.js';
```

These two imports stay exactly as-is. No `buildCallouts` is imported here, so nothing to remove.

- [ ] **Step 3: Add private `scoreColor` helper — after the `SEVERITY_ICON` constant**

After this line:
```js
const SEVERITY_ICON  = { error: '✗', warning: '~' };
```

Insert:
```js
function scoreColor(score) {
  if (score >= 75) return 'var(--score-green)';
  if (score >= 51) return 'var(--score-amber)';
  return 'var(--score-red)';
}
```

- [ ] **Step 4: Update `issueRows` — change `margin-bottom:4px` to `margin-bottom:0`**

Change both card variants (pass and fail) so `margin-bottom:4px` becomes `margin-bottom:0`. The gap between cards is now handled by `ff-panel-inner`'s flex `gap: 4px`.

Pass card — change:
```js
      return `<div style="background:#001a08;border-left:3px solid var(--score-green);padding:8px 10px;border-radius:0 var(--radius) var(--radius) 0;margin-bottom:4px">
```
To:
```js
      return `<div style="background:#001a08;border-left:3px solid var(--score-green);padding:8px 10px;border-radius:0 var(--radius) var(--radius) 0;margin-bottom:0">
```

Fail card — change:
```js
    return `<div style="background:#1a0800;border-left:3px solid ${col};padding:8px 10px;border-radius:0 var(--radius) var(--radius) 0;margin-bottom:4px">
```
To:
```js
    return `<div style="background:#1a0800;border-left:3px solid ${col};padding:8px 10px;border-radius:0 var(--radius) var(--radius) 0;margin-bottom:0">
```

- [ ] **Step 5: Replace the `return` statement of `renderResults` with the new responsive layout**

Replace the entire `return \`...\`` block in `renderResults` with:

```js
  return `
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
    .ff-score-strip  { display: none; }
    .ff-panel        { flex: 1; margin-top: 0; min-width: 0; }
    .ff-panel-inner  { background: #111; border: 1px solid #1e1e1e;
                       border-left: none; border-radius: 0 var(--radius) var(--radius) 0;
                       padding: 12px; height: 100%; box-sizing: border-box; }
    .ff-score-desktop { display: flex !important; }
  }
  .ff-score-desktop { display: none; }
</style>

<div class="ff-results-body">
  <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;flex-wrap:wrap">
    <span style="font-weight:700;font-size:0.85rem">${label}</span>
    <span style="color:var(--text-muted);font-size:0.7rem">· ${weight} ${unit}</span>
    <span style="margin-left:auto">${scoreBadgeHTML(score)}</span>
  </div>

  <div class="ff-results-main">
    <div class="ff-video-wrap">
      <video id="result-video" style="width:100%;display:block" controls playsinline></video>
      <canvas id="overlay-canvas" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none"></canvas>
    </div>

    <div class="ff-score-strip">
      ${scoreBarHTML(score)}
    </div>

    <div class="ff-panel">
      <div class="ff-panel-inner">
        <div class="ff-score-desktop" style="flex-direction:column;gap:6px;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid #1e1e1e">
          <div style="display:flex;justify-content:space-between;align-items:baseline">
            <span style="font-size:0.6rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em">Form Score</span>
            <span style="font-size:1.5rem;font-weight:800;color:${scoreColor(score)};line-height:1">${score}</span>
          </div>
          ${scoreBarHTML(score)}
        </div>
        ${issueRows}
      </div>
    </div>
  </div>

  <button class="btn-primary" id="analyze-another" style="margin-top:0.75rem">Analyze Another Video</button>
</div>
  `;
```

- [ ] **Step 6: Verify `#result-video`, `#overlay-canvas`, and `#analyze-another` IDs are present**

Run:
```bash
grep -n "result-video\|overlay-canvas\|analyze-another" src/tabs/results.js
```

Expected: three matches, one for each ID. `attachResultsListeners` relies on these IDs and must not break.

- [ ] **Step 7: Commit**

```bash
git add src/tabs/results.js
git commit -m "feat: results responsive layout — side panel, score strip, desktop two-column"
```
