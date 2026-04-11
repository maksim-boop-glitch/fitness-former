const BONE_PAIRS = [
  ['shoulder', 'elbow'], ['elbow', 'wrist'],
  ['shoulder', 'hip'],
  ['hip', 'knee'], ['knee', 'ankle'],
];

const ANIMATIONS = {
  squat: {
    duration: 2400,
    keyframes: [
      { t: 0,    joints: { head:[.50,.07], shoulder:[.50,.22], elbow:[.38,.33], wrist:[.36,.44], hip:[.50,.46], knee:[.48,.66], ankle:[.47,.87] } },
      { t: 0.45, joints: { head:[.50,.20], shoulder:[.46,.35], elbow:[.33,.44], wrist:[.30,.54], hip:[.47,.59], knee:[.47,.60], ankle:[.46,.87] } },
      { t: 0.55, joints: { head:[.50,.20], shoulder:[.46,.35], elbow:[.33,.44], wrist:[.30,.54], hip:[.47,.59], knee:[.47,.60], ankle:[.46,.87] } },
      { t: 1,    joints: { head:[.50,.07], shoulder:[.50,.22], elbow:[.38,.33], wrist:[.36,.44], hip:[.50,.46], knee:[.48,.66], ankle:[.47,.87] } },
    ],
  },

  deadlift: {
    duration: 2800,
    keyframes: [
      { t: 0,    joints: { head:[.44,.20], shoulder:[.40,.28], elbow:[.46,.44], wrist:[.49,.58], hip:[.52,.38], knee:[.50,.60], ankle:[.49,.87] } },
      { t: 0.5,  joints: { head:[.50,.07], shoulder:[.50,.22], elbow:[.44,.36], wrist:[.46,.50], hip:[.50,.46], knee:[.49,.66], ankle:[.49,.87] } },
      { t: 0.55, joints: { head:[.50,.07], shoulder:[.50,.22], elbow:[.44,.36], wrist:[.46,.50], hip:[.50,.46], knee:[.49,.66], ankle:[.49,.87] } },
      { t: 1,    joints: { head:[.44,.20], shoulder:[.40,.28], elbow:[.46,.44], wrist:[.49,.58], hip:[.52,.38], knee:[.50,.60], ankle:[.49,.87] } },
    ],
  },

  'push-up': {
    duration: 2200,
    keyframes: [
      { t: 0,    joints: { head:[.18,.42], shoulder:[.28,.46], elbow:[.50,.46], wrist:[.68,.46], hip:[.50,.50], knee:[.70,.50], ankle:[.88,.50] } },
      { t: 0.45, joints: { head:[.18,.50], shoulder:[.28,.52], elbow:[.42,.52], wrist:[.56,.56], hip:[.50,.54], knee:[.70,.54], ankle:[.88,.54] } },
      { t: 0.55, joints: { head:[.18,.50], shoulder:[.28,.52], elbow:[.42,.52], wrist:[.56,.56], hip:[.50,.54], knee:[.70,.54], ankle:[.88,.54] } },
      { t: 1,    joints: { head:[.18,.42], shoulder:[.28,.46], elbow:[.50,.46], wrist:[.68,.46], hip:[.50,.50], knee:[.70,.50], ankle:[.88,.50] } },
    ],
  },

  'bench-press': {
    duration: 2200,
    keyframes: [
      { t: 0,    joints: { head:[.12,.50], shoulder:[.30,.50], elbow:[.50,.50], wrist:[.66,.32], hip:[.58,.55], knee:[.76,.60], ankle:[.90,.65] } },
      { t: 0.45, joints: { head:[.12,.50], shoulder:[.30,.50], elbow:[.44,.50], wrist:[.44,.54], hip:[.58,.55], knee:[.76,.60], ankle:[.90,.65] } },
      { t: 0.55, joints: { head:[.12,.50], shoulder:[.30,.50], elbow:[.44,.50], wrist:[.44,.54], hip:[.58,.55], knee:[.76,.60], ankle:[.90,.65] } },
      { t: 1,    joints: { head:[.12,.50], shoulder:[.30,.50], elbow:[.50,.50], wrist:[.66,.32], hip:[.58,.55], knee:[.76,.60], ankle:[.90,.65] } },
    ],
  },
};

const STATIC_POSE = { head:[.50,.07], shoulder:[.50,.22], elbow:[.38,.33], wrist:[.36,.44], hip:[.50,.46], knee:[.48,.66], ankle:[.47,.87] };

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

function interpolateJoints(kfA, kfB, rawT) {
  const span = kfB.t - kfA.t;
  const local = span === 0 ? 0 : easeInOut((rawT - kfA.t) / span);
  const result = {};
  for (const key of Object.keys(kfA.joints)) {
    const [ax, ay] = kfA.joints[key];
    const [bx, by] = kfB.joints[key];
    result[key] = [ax + (bx - ax) * local, ay + (by - ay) * local];
  }
  return result;
}

function drawFrame(ctx, w, h, joints) {
  ctx.clearRect(0, 0, w, h);

  ctx.strokeStyle = '#00cc44';
  ctx.lineWidth = Math.max(2, w * 0.025);
  ctx.lineCap = 'round';
  ctx.shadowColor = '#00cc44';
  ctx.shadowBlur = 8;

  for (const [a, b] of BONE_PAIRS) {
    if (!joints[a] || !joints[b]) continue;
    ctx.beginPath();
    ctx.moveTo(joints[a][0] * w, joints[a][1] * h);
    ctx.lineTo(joints[b][0] * w, joints[b][1] * h);
    ctx.stroke();
  }

  const [hx, hy] = joints.head;
  const headR = Math.max(6, w * 0.065);
  ctx.beginPath();
  ctx.arc(hx * w, hy * h, headR, 0, Math.PI * 2);
  ctx.strokeStyle = '#00cc44';
  ctx.lineWidth = Math.max(2, w * 0.022);
  ctx.stroke();

  ctx.shadowBlur = 10;
  for (const key of Object.keys(joints)) {
    if (key === 'head') continue;
    const [x, y] = joints[key];
    ctx.beginPath();
    ctx.arc(x * w, y * h, Math.max(3, w * 0.04), 0, Math.PI * 2);
    ctx.fillStyle = '#00cc44';
    ctx.fill();
  }

  ctx.shadowBlur = 0;
}

let rafId = null;

export function startAnimation(canvas, exerciseId) {
  stopAnimation();
  const ctx = canvas.getContext('2d');
  const anim = ANIMATIONS[exerciseId];

  if (!anim) {
    drawFrame(ctx, canvas.width, canvas.height, STATIC_POSE);
    return;
  }

  const { duration, keyframes } = anim;
  const startTime = performance.now();

  function tick(now) {
    const elapsed = (now - startTime) % duration;
    const t = elapsed / duration;

    let kfA = keyframes[0];
    let kfB = keyframes[keyframes.length - 1];
    for (let i = 0; i < keyframes.length - 1; i++) {
      if (t >= keyframes[i].t && t < keyframes[i + 1].t) {
        kfA = keyframes[i];
        kfB = keyframes[i + 1];
        break;
      }
    }

    const joints = interpolateJoints(kfA, kfB, t);
    drawFrame(ctx, canvas.width, canvas.height, joints);
    rafId = requestAnimationFrame(tick);
  }

  rafId = requestAnimationFrame(tick);
}

export function stopAnimation() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}
