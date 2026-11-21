// The three scenes. Each one is a single draw function, draw(ctx, v, t), that paints the whole
// picture in panel coordinates (0..600 x 0..500) and reads a variant object `v` of boolean flags:
// the left panel is drawn with every flag off, the right panel with every flag on. Each scene's
// `diffs` list names those flags: a difference's id IS the flag it flips, and its x, y, r (in panel
// coordinates) are where it is drawn and where a click finds it. Positions come from the same
// constant objects the drawing uses, so the art and the hit targets cannot drift apart.
//
// `t` is a time in seconds for gentle ambient motion (flicker, shimmer) that is identical on both
// panels; it never moves anything a player has to compare.
import { createRandom } from './random.js';

const TAU = Math.PI * 2;

// ---------------------------------------------------------------- drawing helpers

function rgba(hex, a) {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

function circle(ctx, x, y, r, fill) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = fill;
  ctx.fill();
}

function ellipse(ctx, x, y, rx, ry, fill, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
  ctx.fillStyle = fill;
  ctx.fill();
}

function rect(ctx, x, y, w, h, fill) {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
}

/** A filled (and optionally inked) polygon from a flat [x0, y0, x1, y1, ...] list. */
function poly(ctx, pts, fill, ink, width = 2) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (ink) {
    ctx.strokeStyle = ink;
    ctx.lineWidth = width;
    ctx.stroke();
  }
}

function line(ctx, x1, y1, x2, y2, color, width) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

/** A soft radial glow: `color` at the centre fading to nothing at radius r. */
function glow(ctx, x, y, r, color, alpha) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, alpha));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

function vertical(ctx, y0, y1, stops) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  return g;
}

/** A four-pointed sparkle star. */
function sparkle(ctx, x, y, r, color) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fillStyle = color;
  ctx.fill();
}

/**
 * Random background stars from a fixed seed, kept clear of `keepout` circles so no stray star ever
 * sits on (or next to) a difference and muddies it.
 */
function makeStars(seed, count, x0, y0, x1, y1, keepout) {
  const rng = createRandom(seed);
  const stars = [];
  while (stars.length < count) {
    const s = { x: x0 + rng() * (x1 - x0), y: y0 + rng() * (y1 - y0), r: 0.6 + rng() * rng() * 1.8, p: rng() * TAU };
    if (keepout.every((k) => Math.hypot(s.x - k.x, s.y - k.y) > k.r)) stars.push(s);
  }
  return stars;
}

function drawStars(ctx, stars, t, color = '#fff7dc') {
  for (const s of stars) {
    const a = 0.55 + 0.35 * Math.sin(t * 1.7 + s.p);
    circle(ctx, s.x, s.y, s.r, rgba(color, a));
  }
}

// Paper grain and a soft vignette over every picture, the same on both panels: the hand-drawn feel.
const GRAIN = (() => {
  const rng = createRandom(9001);
  return Array.from({ length: 420 }, () => ({ x: rng() * 600, y: rng() * 500, r: 0.5 + rng() * 1.1, light: rng() < 0.5 }));
})();

function finish(ctx) {
  for (const g of GRAIN) circle(ctx, g.x, g.y, g.r, g.light ? 'rgba(255,250,235,0.07)' : 'rgba(20,8,0,0.08)');
  const v = ctx.createRadialGradient(300, 250, 200, 300, 250, 420);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(20,6,10,0.38)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, 600, 500);
}

// ---------------------------------------------------------------- scene 1: Lantern Festival

const S1 = {
  moon: { x: 520, y: 52, r: 24 },
  cat: { x: 92, y: 160 },
  sign: { x: 268, y: 240 },
  banner: { x: 561, y: 286 },
  pot: { x: 206, y: 404 },
  boat: { x: 150, y: 466 },
};

/** The lantern string's height at u (0..1 across the panel). */
function festivalString(u) {
  return 92 + 12 * u + 22 * Math.sin(Math.PI * u);
}

const S1_LANTERNS = Array.from({ length: 7 }, (_, i) => {
  const u = (i + 0.5) / 7;
  const sy = festivalString(u);
  return { x: 600 * u, sy, y: sy + 18, hue: ['#e8452c', '#ff8a2b', '#e8452c', '#f2b63b', '#e8452c', '#ff8a2b', '#e8452c'][i] };
});
const UNLIT = 5;

const S1_STARS = makeStars(101, 70, 0, 0, 600, 200, [
  { ...S1.moon, r: 46 },
  { x: S1_LANTERNS[UNLIT].x, y: S1_LANTERNS[UNLIT].y, r: 34 },
  { x: S1.cat.x + 12, y: S1.cat.y, r: 40 },
]);

function drawLantern(ctx, l, lit, t, i) {
  line(ctx, l.x, l.sy, l.x, l.y - 14, '#2a1a18', 1.5);
  if (lit) glow(ctx, l.x, l.y, 46, '#ffb35c', 0.42 + 0.08 * Math.sin(t * 3.1 + i * 1.7));
  const body = ctx.createRadialGradient(l.x - 3, l.y - 4, 2, l.x, l.y, 16);
  body.addColorStop(0, lit ? '#fff0b8' : '#6b3a36');
  body.addColorStop(0.45, lit ? '#ffc35e' : '#5a2d2c');
  body.addColorStop(1, lit ? l.hue : '#3a1e22');
  ellipse(ctx, l.x, l.y, 12, 15, body);
  ctx.strokeStyle = lit ? rgba('#7a1f10', 0.6) : 'rgba(10,0,0,0.6)';
  ctx.lineWidth = 1.2;
  for (const dx of [-6, 0, 6]) {
    ctx.beginPath();
    ctx.ellipse(l.x, l.y, Math.abs(dx) + 0.5, 15, 0, 0, TAU);
    ctx.stroke();
  }
  rect(ctx, l.x - 6, l.y - 17, 12, 4, '#2b1b16');
  rect(ctx, l.x - 6, l.y + 13, 12, 4, '#2b1b16');
  line(ctx, l.x, l.y + 17, l.x, l.y + 25, lit ? '#ffcf6a' : '#5a3a2a', 2);
}

function drawCat(ctx, cat, tailDown) {
  const ink = '#0e0b16';
  ctx.lineCap = 'round';
  ctx.strokeStyle = ink;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(cat.x + 13, cat.y + 2);
  if (tailDown) ctx.bezierCurveTo(cat.x + 26, cat.y + 6, cat.x + 22, cat.y + 20, cat.x + 25, cat.y + 26);
  else ctx.bezierCurveTo(cat.x + 26, cat.y - 2, cat.x + 22, cat.y - 16, cat.x + 30, cat.y - 22);
  ctx.stroke();
  ellipse(ctx, cat.x, cat.y + 2, 16, 11, ink);
  circle(ctx, cat.x - 14, cat.y - 9, 9, ink);
  poly(ctx, [cat.x - 22, cat.y - 13, cat.x - 21, cat.y - 24, cat.x - 15, cat.y - 16], ink);
  poly(ctx, [cat.x - 13, cat.y - 16, cat.x - 8, cat.y - 24, cat.x - 6, cat.y - 13], ink);
  circle(ctx, cat.x - 17, cat.y - 10, 1.8, '#ffd84a');
  circle(ctx, cat.x - 11, cat.y - 10, 1.8, '#ffd84a');
  // A rim of moonlight along its back.
  ctx.strokeStyle = 'rgba(200,190,255,0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(cat.x, cat.y + 2, 16, 11, 0, Math.PI * 1.1, Math.PI * 1.9);
  ctx.stroke();
}

function drawAwning(ctx, x, y, w, h, a, b, stripes) {
  const sw = w / stripes;
  for (let i = 0; i < stripes; i += 1) {
    rect(ctx, x + i * sw, y, sw + 0.5, h, i % 2 ? b : a);
    ctx.beginPath();
    ctx.arc(x + i * sw + sw / 2, y + h, sw / 2, 0, Math.PI);
    ctx.fillStyle = i % 2 ? b : a;
    ctx.fill();
  }
  line(ctx, x, y, x + w, y, 'rgba(30,10,10,0.6)', 2);
}

function drawFestival(ctx, v, t) {
  // Sky, stars and the crescent moon (the flipped crescent is a difference).
  ctx.fillStyle = vertical(ctx, 0, 330, ['#121640', '#2c2560', '#5b3767', '#8a4a5e']);
  ctx.fillRect(0, 0, 600, 500);
  drawStars(ctx, S1_STARS, t);
  const m = S1.moon;
  glow(ctx, m.x, m.y, 80, '#fff1c0', 0.28);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, 600, 500);
  const dir = v.moonFlip ? -1 : 1;
  ctx.arc(m.x + dir * 11, m.y - 5, m.r * 0.86, 0, TAU);
  ctx.clip('evenodd');
  circle(ctx, m.x, m.y, m.r, '#fff3c4');
  ctx.restore();

  // Far rooftops.
  poly(ctx, [0, 240, 40, 214, 90, 222, 130, 200, 210, 206, 260, 190, 330, 196, 380, 178, 440, 190, 520, 176, 600, 186, 600, 300, 0, 300], '#2a2048');
  for (const [x, y] of [[150, 214], [300, 205], [410, 196], [520, 196]]) rect(ctx, x, y, 7, 7, rgba('#ffcf7a', 0.55));

  // Left house: tiled roof with the cat on the ridge (its tail is a difference), a lit window.
  rect(ctx, 0, 214, 198, 190, '#4a2f2a');
  for (let y = 226; y < 400; y += 14) line(ctx, 0, y, 198, y, 'rgba(0,0,0,0.12)', 1);
  poly(ctx, [-10, 218, 28, 172, 168, 172, 210, 218], '#2b2236', '#160f1e', 2);
  for (let x = 6; x < 200; x += 12) line(ctx, x, 216, x * 0.85 + 26, 174, 'rgba(255,255,255,0.05)', 1);
  line(ctx, 26, 172, 170, 172, '#1a1424', 4);
  drawCat(ctx, S1.cat, v.catTail);
  const win = ctx.createLinearGradient(0, 250, 0, 330);
  win.addColorStop(0, '#ffe7a8');
  win.addColorStop(1, '#f0a85a');
  rect(ctx, 40, 252, 112, 78, win);
  glow(ctx, 96, 292, 90, '#ffb860', 0.25);
  ctx.strokeStyle = '#3a2418';
  ctx.lineWidth = 3;
  ctx.strokeRect(40, 252, 112, 78);
  for (let x = 68; x < 152; x += 28) line(ctx, x, 252, x, 330, '#3a2418', 2);
  line(ctx, 40, 291, 152, 291, '#3a2418', 2);
  rect(ctx, 34, 330, 124, 6, '#2b1b16');

  // Right building with two hanging cloth banners (the far one changes colour) and a doorway.
  rect(ctx, 446, 222, 160, 182, '#3d2a3a');
  poly(ctx, [424, 230, 466, 194, 610, 194, 610, 230], '#2b2236', '#160f1e', 2);
  const door = ctx.createLinearGradient(0, 300, 0, 404);
  door.addColorStop(0, '#ffcf7e');
  door.addColorStop(1, '#d9773e');
  rect(ctx, 504, 306, 40, 98, door);
  glow(ctx, 524, 350, 60, '#ffb35c', 0.3);
  for (let i = 0; i < 3; i += 1) rect(ctx, 504 + i * 14, 306, 12, 30, ['#2f5f8f', '#294f78', '#2f5f8f'][i]);
  const bannerOf = [['#2f8f88', '#ffffff'], [v.bannerColor ? '#6d48b8' : '#d8432f', '#fff3de']];
  [474, S1.banner.x].forEach((bx, i) => {
    line(ctx, bx - 16, 236, bx + 16, 236, '#5a3a2a', 3);
    poly(ctx, [bx - 13, 238, bx + 13, 238, bx + 13, 338, bx, 328, bx - 13, 338], bannerOf[i][0], 'rgba(20,0,0,0.5)', 1.5);
    circle(ctx, bx, 268, 8, bannerOf[i][1]);
    circle(ctx, bx, 268, 4, bannerOf[i][0]);
    for (let y = 290; y < 320; y += 9) line(ctx, bx - 6, y, bx + 6, y, rgba(bannerOf[i][1], 0.8), 2);
  });

  // The street, two food stalls (the dumpling sign's count is a difference) and a flower pot.
  ctx.fillStyle = vertical(ctx, 392, 436, ['#4a3640', '#33262f']);
  ctx.fillRect(0, 392, 600, 44);
  for (let x = 0; x < 600; x += 36) line(ctx, x, 394, x - 8, 434, 'rgba(0,0,0,0.18)', 1);

  // Stall A: dumplings.
  rect(ctx, 216, 268, 5, 126, '#3b2418');
  rect(ctx, 318, 268, 5, 126, '#3b2418');
  rect(ctx, 214, 322, 110, 72, '#8a5a3a');
  for (let y = 334; y < 394; y += 12) line(ctx, 214, y, 324, y, 'rgba(40,16,0,0.35)', 1);
  rect(ctx, 210, 316, 118, 8, '#5e3a24');
  for (const [x, c] of [[234, '#f6e3c2'], [262, '#f4b9b2'], [292, '#e9e2c9']]) ellipse(ctx, x, 312, 11, 5, c);
  for (let i = 0; i < 3; i += 1) {
    const sx = 246 + i * 24;
    const rise = (t * 12 + i * 9) % 24;
    circle(ctx, sx + Math.sin(t + i) * 3, 304 - rise, 5 + rise * 0.12, `rgba(255,255,255,${0.16 - rise * 0.005})`);
  }
  drawAwning(ctx, 206, 270, 126, 22, '#d8432f', '#fbe7cf', 7);
  const sg = S1.sign;
  rect(ctx, sg.x - 34, sg.y - 17, 68, 34, '#fbe7cf');
  ctx.strokeStyle = '#3b2418';
  ctx.lineWidth = 3;
  ctx.strokeRect(sg.x - 34, sg.y - 17, 68, 34);
  line(ctx, sg.x - 24, sg.y + 8, sg.x + 24, sg.y - 8, '#7a4a2a', 3);
  const balls = v.dangoSign ? ['#f49ab0', '#fff8ec'] : ['#f49ab0', '#fff8ec', '#8fcf7a'];
  balls.forEach((c, i) => {
    circle(ctx, sg.x - 13 + i * 13, sg.y + 4 - i * 4.4, 6.5, c);
    ctx.strokeStyle = 'rgba(60,20,10,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  // Stall B: fish-shaped cakes.
  rect(ctx, 338, 274, 5, 120, '#3b2418');
  rect(ctx, 432, 274, 5, 120, '#3b2418');
  rect(ctx, 336, 326, 104, 68, '#6e4a33');
  rect(ctx, 332, 320, 112, 8, '#4a2f1e');
  for (let i = 0; i < 4; i += 1) {
    const fx = 352 + i * 24;
    ellipse(ctx, fx, 312, 10, 5.5, '#d99a4a');
    poly(ctx, [fx + 9, 312, fx + 15, 307, fx + 15, 317], '#c4823a');
  }
  drawAwning(ctx, 330, 276, 116, 20, '#2f5f8f', '#fbe7cf', 6);
  glow(ctx, 270, 330, 70, '#ffb35c', 0.18);
  glow(ctx, 388, 330, 70, '#ffb35c', 0.16);

  if (!v.potMissing) {
    const p = S1.pot;
    for (const [dx, dy, c] of [[-8, -22, '#ff8fb1'], [0, -28, '#ffd1e0'], [9, -21, '#ff8fb1'], [-2, -16, '#f45f8a']]) {
      line(ctx, p.x, p.y - 8, p.x + dx, p.y + dy, '#3d7a3a', 2);
      circle(ctx, p.x + dx, p.y + dy, 5, c);
    }
    poly(ctx, [p.x - 12, p.y - 8, p.x + 12, p.y - 8, p.x + 9, p.y + 12, p.x - 9, p.y + 12], '#c0643a', '#5a2a14', 1.5);
  }

  // The stream with floating candles (the extra paper boat is a difference) and the arched bridge.
  ctx.fillStyle = vertical(ctx, 436, 500, ['#1b2350', '#121a3a']);
  ctx.fillRect(0, 436, 600, 64);
  for (let i = 0; i < 14; i += 1) {
    const y = 444 + (i % 7) * 8;
    const x = ((i * 97 + t * 14) % 640) - 20;
    line(ctx, x, y, x + 26, y, 'rgba(255,200,120,0.22)', 2);
  }
  for (const l of S1_LANTERNS) if (l.x < 330) ellipse(ctx, l.x, 470, 5, 2, 'rgba(255,190,110,0.3)');
  for (const [x, y] of [[60, 474], [282, 482]]) {
    glow(ctx, x, y - 6, 26, '#ffbd66', 0.5);
    rect(ctx, x - 8, y - 6, 16, 8, '#fbe7cf');
    circle(ctx, x, y - 9, 3, '#ffd77a');
  }
  if (v.paperBoat) {
    const b = S1.boat;
    poly(ctx, [b.x - 18, b.y - 2, b.x + 18, b.y - 2, b.x + 11, b.y + 8, b.x - 11, b.y + 8], '#f6f1e6', '#8a8070', 1);
    poly(ctx, [b.x - 4, b.y - 2, b.x + 2, b.y - 20, b.x + 9, b.y - 2], '#ffffff', '#8a8070', 1);
  }
  ctx.fillStyle = '#b3402e';
  ctx.beginPath();
  ctx.moveTo(330, 440);
  ctx.quadraticCurveTo(465, 362, 600, 420);
  ctx.lineTo(600, 432);
  ctx.quadraticCurveTo(465, 380, 330, 452);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#5a1810';
  ctx.lineWidth = 2;
  ctx.stroke();
  for (let i = 0; i <= 8; i += 1) {
    const u = i / 8;
    const x = 340 + u * 250;
    const y = (1 - u) * (1 - u) * 440 + 2 * u * (1 - u) * 362 + u * u * 420 - 4;
    rect(ctx, x - 2.5, y - 24, 5, 24, '#c9523a');
    if (i % 4 === 0) {
      circle(ctx, x, y - 27, 4.5, '#f2c46a');
      glow(ctx, x, y - 27, 18, '#ffc86b', 0.4);
    }
  }
  ctx.strokeStyle = '#c9523a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(338, 414);
  ctx.quadraticCurveTo(465, 336, 600, 394);
  ctx.stroke();

  // The lantern string, drawn last so the lanterns hang in front (one goes dark on the right).
  ctx.strokeStyle = '#2a1a18';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i <= 40; i += 1) {
    const u = i / 40;
    if (i === 0) ctx.moveTo(0, festivalString(u));
    else ctx.lineTo(600 * u, festivalString(u));
  }
  ctx.stroke();
  S1_LANTERNS.forEach((l, i) => drawLantern(ctx, l, !(i === UNLIT && v.lanternUnlit), t, i));
  finish(ctx);
}

// ---------------------------------------------------------------- scene 2: Star Observatory

const S2 = {
  comet: { x: 118, y: 76 },
  cluster: { x: 462, y: 92 },
  dome: { x: 300, y: 250, r: 70 },
  pivot: { x: 300, y: 204 },
  scope: { x: 342, y: 140 },
  windows: [262, 300, 338],
  windowY: 292,
  owl: { x: 86, y: 278 },
  sign: { x: 86, y: 346 },
  tent: { x: 516, y: 372 },
  fire: { x: 426, y: 440 },
};

const CLUSTER = [[-14, -8], [0, -15], [13, -6], [9, 11], [-6, 12], [-2, 0]];
const CONSTELLATION = [[200, 40], [236, 62], [272, 48], [300, 82], [266, 110], [228, 98]];

const S2_STARS = makeStars(202, 150, 0, 0, 600, 300, [
  { ...S2.comet, r: 40 },
  { ...S2.cluster, r: 40 },
  { ...S2.scope, r: 34 },
  ...CONSTELLATION.map(([x, y]) => ({ x, y, r: 10 })),
]);
const S2_MILKY = (() => {
  const rng = createRandom(203);
  return Array.from({ length: 110 }, () => {
    const u = rng();
    return { x: 40 + u * 560, y: 250 - u * 210 + (rng() - 0.5) * 60, r: 0.4 + rng() * 0.8, p: rng() * TAU };
  }).filter((s) => Math.hypot(s.x - S2.cluster.x, s.y - S2.cluster.y) > 40 && Math.hypot(s.x - S2.scope.x, s.y - S2.scope.y) > 34);
})();

function drawObservatory(ctx, v, t) {
  ctx.fillStyle = vertical(ctx, 0, 360, ['#060a1e', '#141c46', '#2b2d63', '#5a4373']);
  ctx.fillRect(0, 0, 600, 500);
  // The Milky Way: a soft diagonal band dusted with tiny stars.
  ctx.save();
  ctx.translate(320, 150);
  ctx.rotate(-0.36);
  const band = ctx.createRadialGradient(0, 0, 0, 0, 0, 340);
  band.addColorStop(0, 'rgba(190,170,255,0.20)');
  band.addColorStop(1, 'rgba(190,170,255,0)');
  ctx.scale(1, 0.18);
  ctx.fillStyle = band;
  ctx.fillRect(-340, -340, 680, 680);
  ctx.restore();
  drawStars(ctx, S2_MILKY, t, '#e6dcff');
  drawStars(ctx, S2_STARS, t);

  // A named constellation, joined by faint lines (no difference here: a fair decoy).
  ctx.strokeStyle = 'rgba(170,200,255,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  CONSTELLATION.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.stroke();
  for (const [x, y] of CONSTELLATION) sparkle(ctx, x, y, 5, '#dfe9ff');

  // The star cluster: six stars on the left, five on the right.
  const c = S2.cluster;
  glow(ctx, c.x, c.y, 34, '#9fc3ff', 0.22);
  CLUSTER.forEach(([dx, dy], i) => {
    if (i === 3 && v.clusterStar) return;
    sparkle(ctx, c.x + dx, c.y + dy, 5.5, '#eaf2ff');
    circle(ctx, c.x + dx, c.y + dy, 1.6, '#ffffff');
  });

  // The comet: its tail streams up-left, or up-right on the right panel.
  const k = S2.comet;
  const tail = v.cometTail ? 1 : -1;
  const tx = k.x + tail * 92;
  const ty = k.y - 46;
  const tg = ctx.createLinearGradient(k.x, k.y, tx, ty);
  tg.addColorStop(0, 'rgba(200,240,255,0.85)');
  tg.addColorStop(1, 'rgba(160,200,255,0)');
  ctx.fillStyle = tg;
  ctx.beginPath();
  const nx = 0.45;
  const ny = tail * 0.9;
  ctx.moveTo(k.x + nx * 5, k.y + ny * 5);
  ctx.quadraticCurveTo((k.x + tx) / 2 + nx * 10, (k.y + ty) / 2 + ny * 10, tx + nx * 14, ty + ny * 14);
  ctx.lineTo(tx - nx * 6, ty - ny * 6);
  ctx.quadraticCurveTo((k.x + tx) / 2, (k.y + ty) / 2, k.x - nx * 5, k.y - ny * 5);
  ctx.closePath();
  ctx.fill();
  glow(ctx, k.x, k.y, 22, '#dff6ff', 0.7);
  circle(ctx, k.x, k.y, 4.5, '#ffffff');

  // Hills.
  ctx.fillStyle = '#1a2142';
  ctx.beginPath();
  ctx.moveTo(0, 330);
  ctx.quadraticCurveTo(120, 290, 230, 318);
  ctx.quadraticCurveTo(420, 270, 600, 314);
  ctx.lineTo(600, 500);
  ctx.lineTo(0, 500);
  ctx.fill();
  ctx.fillStyle = vertical(ctx, 320, 500, ['#22344a', '#152233']);
  ctx.beginPath();
  ctx.moveTo(0, 372);
  ctx.quadraticCurveTo(150, 334, 300, 330);
  ctx.quadraticCurveTo(460, 334, 600, 366);
  ctx.lineTo(600, 500);
  ctx.lineTo(0, 500);
  ctx.fill();

  // The observatory: telescope (its angle changes), dome with slit, base with round windows.
  const angle = v.scopeAngle ? 0.77 : 1.08;
  ctx.save();
  ctx.translate(S2.pivot.x, S2.pivot.y);
  ctx.rotate(-angle);
  poly(ctx, [0, -7, 72, -10, 72, 10, 0, 7], '#b8c2d8', '#39415a', 2);
  rect(ctx, 64, -12, 10, 24, '#7d88a6');
  rect(ctx, 22, -9, 6, 18, '#7d88a6');
  ctx.restore();
  const d = S2.dome;
  const dg = ctx.createLinearGradient(d.x - d.r, 0, d.x + d.r, 0);
  dg.addColorStop(0, '#c9d1e6');
  dg.addColorStop(0.6, '#9aa6c4');
  dg.addColorStop(1, '#5f6a8a');
  ctx.fillStyle = dg;
  ctx.beginPath();
  ctx.arc(d.x, d.y, d.r, Math.PI, TAU);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#2c3350';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  for (const a of [0.3, 0.6]) {
    ctx.beginPath();
    ctx.ellipse(d.x, d.y, d.r * a, d.r, 0, Math.PI, TAU);
    ctx.strokeStyle = 'rgba(40,46,80,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  rect(ctx, d.x - 9, d.y - d.r + 2, 18, 40, '#151a33');
  ctx.save();
  ctx.translate(S2.pivot.x, S2.pivot.y);
  ctx.rotate(-angle);
  rect(ctx, -4, -7, 24, 14, '#9aa6c4');
  ctx.restore();
  rect(ctx, 232, 250, 136, 82, '#d6c7a8');
  for (let y = 262; y < 332; y += 12) line(ctx, 232, y, 368, y, 'rgba(90,70,40,0.25)', 1);
  ctx.strokeStyle = '#4a3c28';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(232, 250, 136, 82);
  rect(ctx, 226, 246, 148, 7, '#8a7a5c');
  S2.windows.forEach((x, i) => {
    const lit = !(i === 2 && v.windowDark);
    if (lit) glow(ctx, x, S2.windowY, 30, '#ffc15a', 0.45 + 0.05 * Math.sin(t * 2 + i));
    circle(ctx, x, S2.windowY, 11, lit ? '#ffd477' : '#1d2340');
    ctx.strokeStyle = '#4a3c28';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    line(ctx, x - 11, S2.windowY, x + 11, S2.windowY, '#4a3c28', 1.5);
    line(ctx, x, S2.windowY - 11, x, S2.windowY + 11, '#4a3c28', 1.5);
  });
  rect(ctx, 290, 308, 20, 24, '#5a3a24');
  glow(ctx, 300, 332, 40, '#ffc15a', 0.2);

  // The path up the hill.
  ctx.strokeStyle = 'rgba(214,190,140,0.35)';
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(300, 334);
  ctx.bezierCurveTo(250, 380, 340, 420, 250, 500);
  ctx.stroke();

  // The signpost (its arrow flips) with the owl on top (it winks on the right).
  const s = S2.sign;
  rect(ctx, s.x - 4, 292, 8, 140, '#6b4a2e');
  const dir = v.signArrow ? -1 : 1;
  const bx = s.x - dir * 12;
  poly(ctx, [bx, s.y - 11, bx + dir * 46, s.y - 11, bx + dir * 60, s.y, bx + dir * 46, s.y + 11, bx, s.y + 11], '#c79a5c', '#4a2f1a', 2);
  sparkle(ctx, bx + dir * 24, s.y, 7, '#3a2612');
  const o = S2.owl;
  ellipse(ctx, o.x, o.y + 4, 15, 19, '#8a6a4a');
  ellipse(ctx, o.x, o.y + 10, 10, 12, '#c8aa82');
  poly(ctx, [o.x - 13, o.y - 10, o.x - 12, o.y - 22, o.x - 5, o.y - 13], '#8a6a4a');
  poly(ctx, [o.x + 13, o.y - 10, o.x + 12, o.y - 22, o.x + 5, o.y - 13], '#8a6a4a');
  circle(ctx, o.x - 6, o.y - 6, 6, '#f3e3b8');
  circle(ctx, o.x + 6, o.y - 6, 6, '#f3e3b8');
  circle(ctx, o.x - 6, o.y - 6, 3.2, '#ffb22e');
  circle(ctx, o.x - 6, o.y - 6, 1.6, '#1a0f05');
  if (v.owlWink) {
    ctx.strokeStyle = '#3a2612';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(o.x + 6, o.y - 7, 4, 0.2, Math.PI - 0.2);
    ctx.stroke();
  } else {
    circle(ctx, o.x + 6, o.y - 6, 3.2, '#ffb22e');
    circle(ctx, o.x + 6, o.y - 6, 1.6, '#1a0f05');
  }
  poly(ctx, [o.x - 3, o.y, o.x + 3, o.y, o.x, o.y + 5], '#e8a23a');
  line(ctx, o.x - 6, o.y + 23, o.x - 6, o.y + 18, '#e8a23a', 2);
  line(ctx, o.x + 6, o.y + 23, o.x + 6, o.y + 18, '#e8a23a', 2);

  // The tent (its colour changes) and the campfire.
  const tn = S2.tent;
  poly(ctx, [tn.x - 44, tn.y + 34, tn.x, tn.y - 30, tn.x + 44, tn.y + 34], v.tentColor ? '#2f9c95' : '#e07a3a', '#3a1e10', 2);
  poly(ctx, [tn.x - 10, tn.y + 34, tn.x, tn.y + 2, tn.x + 10, tn.y + 34], 'rgba(30,10,0,0.55)');
  line(ctx, tn.x, tn.y - 30, tn.x, tn.y - 40, '#3a1e10', 2.5);
  const f = S2.fire;
  glow(ctx, f.x, f.y - 8, 90, '#ff9a3c', 0.32 + 0.06 * Math.sin(t * 7));
  line(ctx, f.x - 18, f.y + 6, f.x + 18, f.y - 2, '#5a3418', 6);
  line(ctx, f.x - 18, f.y - 2, f.x + 18, f.y + 6, '#6b4020', 6);
  const flick = Math.sin(t * 9) * 2;
  poly(ctx, [f.x - 12, f.y, f.x - 4 + flick, f.y - 30, f.x + 2, f.y - 16, f.x + 7 - flick, f.y - 26, f.x + 12, f.y], '#ff7a2a');
  poly(ctx, [f.x - 6, f.y, f.x + flick * 0.5, f.y - 18, f.x + 6, f.y], '#ffd45a');
  for (let i = 0; i < 4; i += 1) {
    const rise = (t * 26 + i * 17) % 60;
    circle(ctx, f.x + Math.sin(t * 2 + i * 2) * 8, f.y - 24 - rise, 1.4, `rgba(255,200,90,${1 - rise / 60})`);
  }
  for (const [x, y] of [[60, 450], [160, 410], [560, 450], [380, 470]]) glow(ctx, x, y, 8, '#d7ff7a', 0.6);
  finish(ctx);
}

// ---------------------------------------------------------------- scene 3: Seaside Bakery at Dawn

const S3 = {
  sun: { x: 470, y: 238, r: 40 },
  horizon: 238,
  clock: { x: 66, y: 166, r: 17 },
  door: { x: 226, y: 326 },
  chimney: { x: 252, y: 60 },
  smoke: { x: 264, y: 30 },
  boats: [{ x: 376, y: 290, s: 1 }, { x: 540, y: 306, s: 0.8 }],
  gulls: [[340, 104], [408, 140], [550, 96]],
  gullExtra: { x: 476, y: 74 },
  basket: { x: 484, y: 414 },
};

function bakeryString(u) {
  return 128 + 18 * u + 26 * Math.sin(Math.PI * u);
}

const FLAG_COLOURS = ['#ff7f6e', '#ffd35a', '#3fb6b0', '#fff3e0', '#5b7fe0'];
const S3_FLAGS = Array.from({ length: 11 }, (_, i) => {
  const u = (i + 0.5) / 11;
  const y = bakeryString(u);
  return { x: 310 + 290 * u, y, colour: FLAG_COLOURS[i % FLAG_COLOURS.length] };
});
const ODD_FLAG = 6;

function gull(ctx, x, y, s) {
  ctx.strokeStyle = '#3b3550';
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - 14 * s, y - 2 * s);
  ctx.quadraticCurveTo(x - 7 * s, y - 9 * s, x, y);
  ctx.quadraticCurveTo(x + 7 * s, y - 9 * s, x + 14 * s, y - 2 * s);
  ctx.stroke();
}

function boat(ctx, b, sail) {
  const s = b.s;
  ellipse(ctx, b.x, b.y + 12 * s, 28 * s, 3 * s, 'rgba(60,40,80,0.25)');
  poly(ctx, [b.x - 26 * s, b.y, b.x + 26 * s, b.y, b.x + 18 * s, b.y + 10 * s, b.x - 18 * s, b.y + 10 * s], '#7a3b2e', '#3a1a12', 1.5);
  line(ctx, b.x, b.y, b.x, b.y - 40 * s, '#3a1a12', 2);
  poly(ctx, [b.x + 2 * s, b.y - 38 * s, b.x + 2 * s, b.y - 4 * s, b.x + 24 * s, b.y - 4 * s], sail, '#6a5a50', 1);
  poly(ctx, [b.x - 2 * s, b.y - 30 * s, b.x - 2 * s, b.y - 6 * s, b.x - 16 * s, b.y - 6 * s], '#fff6ea', '#6a5a50', 1);
}

function drawBakery(ctx, v, t) {
  const H = S3.horizon;
  ctx.fillStyle = vertical(ctx, 0, H, ['#6f7fc6', '#b78db8', '#f3a6a0', '#ffd59a']);
  ctx.fillRect(0, 0, 600, H);
  const sun = S3.sun;
  glow(ctx, sun.x, sun.y, 170, '#ffe2a0', 0.55);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, 600, H);
  ctx.clip();
  circle(ctx, sun.x, sun.y, sun.r, '#fff0bf');
  ctx.restore();
  // Wispy clouds.
  for (const [x, y, w] of [[360, 60, 70], [520, 40, 50], [420, 196, 60]]) {
    ellipse(ctx, x, y, w, 6, 'rgba(255,236,220,0.55)');
    ellipse(ctx, x + w * 0.3, y - 4, w * 0.5, 5, 'rgba(255,246,236,0.5)');
  }

  // The sea with the sun's road and the boats (the second one is gone on the right).
  ctx.fillStyle = vertical(ctx, H, 392, ['#f2b7a2', '#8f9fd0', '#4f6aa8']);
  ctx.fillRect(0, H, 600, 392 - H);
  for (let i = 0; i < 18; i += 1) {
    const y = H + 6 + i * 8;
    const w = 50 - i * 1.5 + Math.sin(t * 2 + i) * 6;
    line(ctx, sun.x - w / 2, y, sun.x + w / 2, y, 'rgba(255,240,200,0.5)', 2);
  }
  for (let i = 0; i < 12; i += 1) {
    const x = 320 + ((i * 53 + t * 8) % 280);
    const y = H + 20 + (i % 6) * 22;
    line(ctx, x, y, x + 14, y, 'rgba(255,255,255,0.3)', 1.5);
  }
  poly(ctx, [520, H, 560, 222, 600, 214, 600, H], '#6b6894');
  rect(ctx, 578, 186, 8, 30, '#fff3e0');
  rect(ctx, 578, 196, 8, 6, '#d8432f');
  glow(ctx, 582, 186, 20, '#fff2a0', 0.7);
  boat(ctx, S3.boats[0], '#fff6ea');
  if (!v.boatMissing) boat(ctx, S3.boats[1], '#ff7f6e');

  // Gulls (one more on the right).
  for (const [x, y] of S3.gulls) gull(ctx, x, y, 1);
  if (v.gullExtra) gull(ctx, S3.gullExtra.x, S3.gullExtra.y, 0.9);

  // The bakery: roof, chimney and its smoke (missing on the right).
  if (!v.smokeMissing) {
    for (const [dx, dy, r] of [[2, 20, 8], [8, 6, 10], [18, -10, 12]]) {
      circle(ctx, S3.chimney.x + dx + Math.sin(t + dy) * 1.5, S3.chimney.y + dy - 30, r, 'rgba(250,245,250,0.75)');
    }
  }
  rect(ctx, S3.chimney.x - 13, S3.chimney.y - 8, 26, 40, '#a3523c');
  rect(ctx, S3.chimney.x - 16, S3.chimney.y - 12, 32, 7, '#6e3324');
  poly(ctx, [4, 132, 40, 84, 282, 84, 316, 132], '#4b5470', '#262b40', 2.5);
  for (let x = 20; x < 300; x += 16) line(ctx, x, 130, x * 0.86 + 24, 86, 'rgba(255,255,255,0.08)', 1.5);

  // Wall, clock (the minute hand moves), sign, awning.
  rect(ctx, 14, 130, 292, 272, '#f6e4c6');
  for (let y = 142; y < 400; y += 16) line(ctx, 14, y, 306, y, 'rgba(150,110,70,0.12)', 1);
  ctx.strokeStyle = '#7a5a3a';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(14, 130, 292, 272);
  const c = S3.clock;
  circle(ctx, c.x, c.y, c.r + 3, '#5a3a24');
  circle(ctx, c.x, c.y, c.r, '#fffaf0');
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * TAU;
    circle(ctx, c.x + Math.sin(a) * (c.r - 4), c.y - Math.cos(a) * (c.r - 4), 1, '#5a3a24');
  }
  const hour = (7 / 12) * TAU + (v.clockTime ? (0.25 / 12) * TAU : 0);
  const minute = v.clockTime ? TAU * 0.25 : 0;
  ctx.lineCap = 'round';
  line(ctx, c.x, c.y, c.x + Math.sin(hour) * 9, c.y - Math.cos(hour) * 9, '#2a1a10', 3);
  line(ctx, c.x, c.y, c.x + Math.sin(minute) * 13, c.y - Math.cos(minute) * 13, '#2a1a10', 2);
  circle(ctx, c.x, c.y, 2, '#c0392b');
  rect(ctx, 106, 146, 186, 42, '#2f5a46');
  ctx.strokeStyle = '#d9b26a';
  ctx.lineWidth = 2;
  ctx.strokeRect(110, 150, 178, 34);
  ctx.fillStyle = '#ffe3a0';
  ctx.font = 'bold 21px Georgia, "Times New Roman", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('BAKERY', 214, 168);
  ellipse(ctx, 134, 168, 12, 6, '#e0a050', -0.3);
  for (const dx of [-5, 0, 5]) line(ctx, 134 + dx - 2, 164, 134 + dx + 2, 171, '#9a5a20', 1.2);
  drawAwning(ctx, 18, 204, 284, 30, '#ff7f6e', '#fff3e0', 12);

  // Display window with loaves, flower box, door (its colour changes).
  ctx.fillStyle = vertical(ctx, 256, 362, ['#cfe3ee', '#9cbad0']);
  ctx.fillRect(32, 256, 140, 104);
  line(ctx, 40, 262, 70, 300, 'rgba(255,255,255,0.6)', 3);
  rect(ctx, 32, 312, 140, 5, '#8a5a3a');
  rect(ctx, 32, 352, 140, 5, '#8a5a3a');
  for (const x of [52, 84, 116, 148]) ellipse(ctx, x, 302, 13, 10, '#d4914a');
  for (const x of [52, 84, 116, 148]) line(ctx, x - 6, 298, x + 6, 298, '#f6d3a0', 2);
  for (const x of [58, 102, 146]) {
    ellipse(ctx, x, 344, 20, 6, '#e3a25a', -0.08);
    for (const dx of [-10, 0, 10]) line(ctx, x + dx - 3, 341, x + dx + 3, 347, '#a8662c', 1.5);
  }
  ctx.strokeStyle = '#5a3a24';
  ctx.lineWidth = 4;
  ctx.strokeRect(32, 256, 140, 104);
  rect(ctx, 28, 362, 148, 16, '#7a4a2a');
  for (let i = 0; i < 9; i += 1) circle(ctx, 40 + i * 16, 360, 5, ['#ff7f9e', '#ffd35a', '#fff3e0'][i % 3]);
  const dr = S3.door;
  rect(ctx, dr.x - 32, dr.y - 72, 64, 150, '#5a3a24');
  rect(ctx, dr.x - 28, dr.y - 68, 56, 146, v.doorColor ? '#9a4a7a' : '#2f8f88');
  rect(ctx, dr.x - 18, dr.y - 56, 36, 40, '#cfe3ee');
  line(ctx, dr.x, dr.y - 56, dr.x, dr.y - 16, '#5a3a24', 2);
  circle(ctx, dr.x + 18, dr.y + 12, 3.5, '#f2c46a');
  rect(ctx, dr.x - 38, dr.y + 76, 76, 6, '#8a7a6a');
  rect(ctx, 270, 382, 22, 20, '#c0643a');
  circle(ctx, 281, 370, 13, '#4e9a4a');
  circle(ctx, 275, 364, 4, '#ff7f9e');

  // The bunting from the roof corner across the bay (one flag changes colour).
  ctx.strokeStyle = '#5a4a5a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i <= 30; i += 1) {
    const u = i / 30;
    if (i === 0) ctx.moveTo(310, bakeryString(u));
    else ctx.lineTo(310 + 290 * u, bakeryString(u));
  }
  ctx.stroke();
  S3_FLAGS.forEach((fl, i) => {
    const colour = i === ODD_FLAG && v.flagColor ? '#6cc04a' : fl.colour;
    poly(ctx, [fl.x - 9, fl.y, fl.x + 9, fl.y, fl.x, fl.y + 20], colour, 'rgba(60,40,60,0.6)', 1);
  });

  // Sea wall, promenade, street lamp and the bicycle (its basket loses the bread).
  rect(ctx, 306, 380, 294, 22, '#b9a58e');
  for (let x = 306; x < 600; x += 28) line(ctx, x, 380, x, 402, 'rgba(80,60,40,0.3)', 1);
  ctx.fillStyle = vertical(ctx, 402, 500, ['#e2c9a6', '#c7a882']);
  ctx.fillRect(0, 402, 600, 98);
  for (let y = 412; y < 500; y += 14) {
    for (let x = (y / 14) % 2 ? 0 : 14; x < 600; x += 28) ellipse(ctx, x, y, 12, 5, 'rgba(140,100,60,0.12)');
  }
  ellipse(ctx, 430, 480, 70, 6, 'rgba(80,50,60,0.25)');
  rect(ctx, 326, 300, 5, 100, '#3b3550');
  ellipse(ctx, 328, 296, 10, 6, '#3b3550');
  circle(ctx, 328, 304, 5, '#fff3c8');

  const wheelY = 452;
  for (const x of [392, 470]) {
    ctx.strokeStyle = '#2a2a3a';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(x, wheelY, 26, 0, TAU);
    ctx.stroke();
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI;
      line(ctx, x - Math.cos(a) * 25, wheelY - Math.sin(a) * 25, x + Math.cos(a) * 25, wheelY + Math.sin(a) * 25, 'rgba(60,60,80,0.6)', 1);
    }
  }
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#d8432f';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(392, wheelY);
  ctx.lineTo(424, wheelY);
  ctx.lineTo(462, 420);
  ctx.lineTo(414, 420);
  ctx.lineTo(392, wheelY);
  ctx.moveTo(414, 420);
  ctx.lineTo(424, wheelY);
  ctx.moveTo(462, 420);
  ctx.lineTo(470, wheelY);
  ctx.moveTo(408, 410);
  ctx.lineTo(414, 420);
  ctx.moveTo(458, 404);
  ctx.lineTo(462, 420);
  ctx.stroke();
  line(ctx, 400, 408, 418, 408, '#2a2a3a', 5);
  line(ctx, 452, 402, 466, 400, '#2a2a3a', 3);
  const b = S3.basket;
  if (!v.basketBread) {
    ellipse(ctx, b.x - 4, b.y - 10, 18, 4.5, '#e0a050', -0.9);
    ellipse(ctx, b.x + 6, b.y - 8, 16, 4.5, '#d4914a', -1.1);
  }
  poly(ctx, [b.x - 16, b.y - 8, b.x + 16, b.y - 8, b.x + 12, b.y + 10, b.x - 12, b.y + 10], '#c79a5c', '#6a4a24', 1.5);
  for (let i = -1; i <= 1; i += 1) line(ctx, b.x + i * 8, b.y - 8, b.x + i * 6, b.y + 10, 'rgba(106,74,36,0.7)', 1);
  finish(ctx);
}

// ---------------------------------------------------------------- the scene list

const RIGHT_ONLY = (diffs) => Object.freeze(Object.fromEntries(diffs.map((d) => [d.id, true])));

function scene(def) {
  return Object.freeze({ ...def, diffs: Object.freeze(def.diffs.map((d) => Object.freeze(d))), left: Object.freeze({}), right: RIGHT_ONLY(def.diffs) });
}

const L5 = S1_LANTERNS[UNLIT];
const FLAG = S3_FLAGS[ODD_FLAG];

export const SCENES = [
  scene({
    id: 'festival',
    name: 'Lantern Festival',
    blurb: 'A night street of lanterns, food stalls and a quiet stream.',
    draw: drawFestival,
    diffs: [
      { id: 'moonFlip', label: 'The crescent moon is flipped', x: S1.moon.x, y: S1.moon.y, r: 30 },
      { id: 'lanternUnlit', label: 'One lantern has gone dark', x: L5.x, y: L5.y, r: 26 },
      { id: 'catTail', label: "The cat's tail hangs down", x: S1.cat.x + 14, y: S1.cat.y + 2, r: 30 },
      { id: 'dangoSign', label: 'The dumpling sign has one dumpling fewer', x: S1.sign.x, y: S1.sign.y, r: 28 },
      { id: 'bannerColor', label: 'The red banner turned purple', x: S1.banner.x, y: S1.banner.y, r: 30 },
      { id: 'potMissing', label: 'The flower pot is missing', x: S1.pot.x, y: S1.pot.y - 8, r: 26 },
      { id: 'paperBoat', label: 'A paper boat floats on the stream', x: S1.boat.x, y: S1.boat.y - 4, r: 28 },
    ],
  }),
  scene({
    id: 'observatory',
    name: 'Star Observatory',
    blurb: 'A hilltop dome under a sky full of stars.',
    draw: drawObservatory,
    diffs: [
      { id: 'cometTail', label: "The comet's tail points the other way", x: S2.comet.x, y: S2.comet.y, r: 30 },
      { id: 'clusterStar', label: 'The star cluster has one star fewer', x: S2.cluster.x, y: S2.cluster.y, r: 28 },
      { id: 'scopeAngle', label: 'The telescope is tilted lower', x: S2.scope.x, y: S2.scope.y, r: 28 },
      { id: 'windowDark', label: 'One round window is dark', x: S2.windows[2], y: S2.windowY, r: 24 },
      { id: 'owlWink', label: 'The owl is winking', x: S2.owl.x, y: S2.owl.y - 4, r: 24 },
      { id: 'signArrow', label: 'The signpost points the other way', x: S2.sign.x, y: S2.sign.y, r: 30 },
      { id: 'tentColor', label: 'The tent changed colour', x: S2.tent.x, y: S2.tent.y + 6, r: 30 },
    ],
  }),
  scene({
    id: 'bakery',
    name: 'Seaside Bakery at Dawn',
    blurb: 'Fresh bread, a sleepy harbour and the first gulls of the day.',
    draw: drawBakery,
    diffs: [
      { id: 'clockTime', label: 'The clock shows a quarter past', x: S3.clock.x, y: S3.clock.y, r: 26 },
      { id: 'doorColor', label: 'The door is painted plum', x: S3.door.x, y: S3.door.y, r: 30 },
      { id: 'smokeMissing', label: 'No smoke from the chimney', x: S3.smoke.x, y: S3.smoke.y, r: 28 },
      { id: 'boatMissing', label: 'A sailboat has left the bay', x: S3.boats[1].x, y: S3.boats[1].y - 12, r: 30 },
      { id: 'gullExtra', label: 'One more seagull joined the flock', x: S3.gullExtra.x, y: S3.gullExtra.y - 3, r: 26 },
      { id: 'flagColor', label: 'One bunting flag turned green', x: FLAG.x, y: FLAG.y + 8, r: 24 },
      { id: 'basketBread', label: 'The bike basket is empty', x: S3.basket.x, y: S3.basket.y - 4, r: 26 },
    ],
  }),
];

/** The variant flags for one side of a scene: 'left' (all off) or 'right' (all on). */
export function variantFor(sceneDef, side) {
  return side === 'right' ? sceneDef.right : sceneDef.left;
}
