// Paints one whole frame on the 1280x720 logical canvas, letterboxed into the window: the header
// (title, scene, "3 / 7 found · 4 to go" counter, score, timer and its bar), the two picture panels
// with their frames and captions, found rings on both panels, the hint pulse, the wrong-click shake,
// the footer buttons, and the title, paused, scene-clear, time-up and win overlays.
import {
  DIFFS_PER_SCENE, DISPLAY_FONT, FONT, FOOTER, HEADER, PALETTE, PANEL, PLAY_AGAIN, SCORING, SUBTITLE, TIMING, TITLE, VIEW,
} from './config.js';
import { SCENES, variantFor } from './scenes.js';
import { inRect } from './input.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CLEAR = 'clear';
export const SCREEN_TIMEUP = 'timeup';
export const SCREEN_WIN = 'win';

const TAU = Math.PI * 2;

export function counterText(found, total = DIFFS_PER_SCENE) {
  return `${found} / ${total} found · ${total - found} to go`;
}

export function formatTime(seconds) {
  const s = Math.ceil(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function text(ctx, value, x, y, size, color, align = 'left', weight = '600', family = FONT) {
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(value, x, y);
}

function easeOutBack(u) {
  const c = 1.7;
  return 1 + (c + 1) * (u - 1) ** 3 + c * (u - 1) ** 2;
}

/** A little paper lantern icon, used in the header, the counter pips and the title card. */
function lanternIcon(ctx, x, y, s, lit) {
  if (lit) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, 26 * s);
    g.addColorStop(0, 'rgba(255,190,90,0.55)');
    g.addColorStop(1, 'rgba(255,190,90,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 26 * s, y - 26 * s, 52 * s, 52 * s);
  }
  ctx.beginPath();
  ctx.ellipse(x, y, 9 * s, 11 * s, 0, 0, TAU);
  const body = ctx.createLinearGradient(x, y - 11 * s, x, y + 11 * s);
  body.addColorStop(0, lit ? '#ffd27a' : '#4a3550');
  body.addColorStop(1, lit ? '#e8452c' : '#2c2034');
  ctx.fillStyle = body;
  ctx.fill();
  ctx.strokeStyle = lit ? 'rgba(120,30,10,0.6)' : 'rgba(200,180,220,0.35)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = lit ? '#3a1d10' : '#6a5a78';
  ctx.fillRect(x - 5 * s, y - 13 * s, 10 * s, 3 * s);
  ctx.fillRect(x - 5 * s, y + 10 * s, 10 * s, 3 * s);
}

function button(ctx, r, label, hot, disabled = false, secondary = false) {
  ctx.save();
  roundRect(ctx, r.x, r.y, r.w, r.h, r.h / 2);
  if (disabled) ctx.fillStyle = 'rgba(255,255,255,0.08)';
  else if (secondary) {
    ctx.fillStyle = hot ? 'rgba(255,200,97,0.22)' : 'rgba(255,200,97,0.1)';
    ctx.fill();
    ctx.strokeStyle = PALETTE.gold;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    text(ctx, label, r.x + r.w / 2, r.y + r.h / 2 + 7, 19, PALETTE.gold, 'center', '700');
    return;
  } else {
    const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    g.addColorStop(0, hot ? '#ffc061' : '#ffad52');
    g.addColorStop(1, hot ? '#ff8a3a' : PALETTE.goldDeep);
    ctx.fillStyle = g;
    ctx.shadowColor = 'rgba(255,140,60,0.45)';
    ctx.shadowBlur = hot ? 22 : 12;
  }
  ctx.fill();
  ctx.restore();
  text(ctx, label, r.x + r.w / 2, r.y + r.h / 2 + 7, 19, disabled ? PALETTE.faint : PALETTE.buttonText, 'center', '700');
}

function card(ctx, x, y, w, h) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 40;
  roundRect(ctx, x, y, w, h, 22);
  ctx.fillStyle = PALETTE.card;
  ctx.fill();
  ctx.restore();
  roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 22);
  ctx.strokeStyle = PALETTE.cardEdge;
  ctx.lineWidth = 2;
  ctx.stroke();
  roundRect(ctx, x + 8, y + 8, w - 16, h - 16, 16);
  ctx.strokeStyle = 'rgba(255,200,97,0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, ox: 0, oy: 0, dpr: 1 };

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = canvas.clientWidth || VIEW.width;
    const ch = canvas.clientHeight || VIEW.height;
    const w = Math.round(cw * dpr);
    const h = Math.round(ch * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    view.dpr = dpr;
    view.scale = Math.min(cw / VIEW.width, ch / VIEW.height);
    view.ox = (cw - VIEW.width * view.scale) / 2;
    view.oy = (ch - VIEW.height * view.scale) / 2;
  }

  function toLogical(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    return { x: (clientX - r.left - view.ox) / view.scale, y: (clientY - r.top - view.oy) / view.scale };
  }

  // ------------------------------------------------------------ header and footer

  function drawHeader(state, ui) {
    const g = ctx.createLinearGradient(0, 0, 0, HEADER.height);
    g.addColorStop(0, PALETTE.headerTop);
    g.addColorStop(1, PALETTE.headerBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW.width, HEADER.height);
    lanternIcon(ctx, 44, 42, 1.5, true);
    text(ctx, TITLE, 74, 48, 31, PALETTE.gold, 'left', '700', DISPLAY_FONT);
    const sceneDef = state.scene;
    text(ctx, `Scene ${state.sceneIndex + 1} of ${SCENES.length} · ${sceneDef.name}`, 75, 76, 16, PALETTE.muted, 'left', '500');

    const found = state.found.length;
    text(ctx, counterText(found), 640, 46, 27, PALETTE.ink, 'center', '700');
    for (let i = 0; i < DIFFS_PER_SCENE; i += 1) lanternIcon(ctx, 640 + (i - 3) * 26, 68, 0.62, i < found);

    text(ctx, 'SCORE', 1080, 30, 12, PALETTE.faint, 'right', '700');
    text(ctx, String(state.score), 1080, 64, 30, PALETTE.ink, 'right', '700');
    const fraction = state.timeLeft / TIMING.sceneSeconds;
    const barColour = fraction <= TIMING.redAt ? PALETTE.barRed : fraction <= TIMING.amberAt ? PALETTE.barAmber : PALETTE.barOk;
    const pulse = fraction <= TIMING.redAt && ui.screen === SCREEN_PLAY ? 0.6 + 0.4 * Math.abs(Math.sin(ui.t * 4)) : 1;
    text(ctx, 'TIME', 1256, 30, 12, PALETTE.faint, 'right', '700');
    ctx.globalAlpha = pulse;
    text(ctx, formatTime(state.timeLeft), 1256, 64, 30, fraction <= TIMING.amberAt ? barColour : PALETTE.ink, 'right', '700');
    ctx.globalAlpha = 1;

    const bx = 24;
    const bw = VIEW.width - 48;
    roundRect(ctx, bx, HEADER.barY, bw, HEADER.barHeight, 4);
    ctx.fillStyle = PALETTE.barTrack;
    ctx.fill();
    if (fraction > 0) {
      ctx.save();
      ctx.shadowColor = barColour;
      ctx.shadowBlur = 10;
      roundRect(ctx, bx, HEADER.barY, Math.max(8, bw * fraction), HEADER.barHeight, 4);
      ctx.fillStyle = barColour;
      ctx.fill();
      ctx.restore();
    }
  }

  function drawFooter(state, ui) {
    const playing = ui.screen === SCREEN_PLAY;
    const h = FOOTER.hint;
    const noHints = state.hintsLeft <= 0;
    button(ctx, h, noHints ? 'No hints left' : `Hint (H) · ${state.hintsLeft} left`, playing && inRect(ui.hover.x, ui.hover.y, h), noHints || !playing);
    if (!noHints) text(ctx, `costs ${SCORING.hintCost} points`, h.x + h.w / 2, h.y + h.h + 14, 11, PALETTE.faint, 'center', '500');
    const p = FOOTER.pause;
    button(ctx, p, ui.screen === SCREEN_PAUSED ? 'Resume (P)' : 'Pause (P)', inRect(ui.hover.x, ui.hover.y, p), !(playing || ui.screen === SCREEN_PAUSED), true);
    text(ctx, 'Click a difference on either picture. Wrong clicks cost 5 seconds.', 1256, 670, 16, PALETTE.muted, 'right', '500');
    const mistakes = state.mistakes === 1 ? '1 mistake' : `${state.mistakes} mistakes`;
    text(ctx, `${mistakes}  ·  R restart scene  ·  M sound ${ui.muted ? 'off' : 'on'}`, 1256, 694, 14, PALETTE.faint, 'right', '500');
  }

  // ------------------------------------------------------------ panels

  function drawMarkers(state, ui, side) {
    const sceneDef = state.scene;
    if (state.hint) {
      const d = sceneDef.diffs.find((x) => x.id === state.hint.id);
      const age = state.clock - state.hint.at;
      const fade = Math.min(1, (TIMING.hintSeconds - age) * 2);
      for (let k = 0; k < 3; k += 1) {
        const u = ((age + k * 0.3) % 0.9) / 0.9;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r * (0.9 + u * 1.6), 0, TAU);
        ctx.strokeStyle = `rgba(127,227,255,${(1 - u) * 0.9 * fade})`;
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    }
    for (const f of state.found) {
      const d = sceneDef.diffs.find((x) => x.id === f.id);
      const age = state.clock - f.at;
      const u = Math.min(1, age / TIMING.ringGrowSeconds);
      const radius = d.r * (1.7 - 0.7 * easeOutBack(u)) + Math.sin(ui.t * 3 + d.x) * 1.4;
      if (u < 1) {
        ctx.beginPath();
        ctx.arc(d.x, d.y, radius, 0, TAU);
        ctx.fillStyle = `rgba(255,213,79,${(1 - u) * 0.4})`;
        ctx.fill();
      }
      ctx.globalAlpha = Math.min(1, age * 5 + 0.2);
      ctx.beginPath();
      ctx.arc(d.x, d.y, radius, 0, TAU);
      ctx.strokeStyle = PALETTE.ringShadow;
      ctx.lineWidth = 8;
      ctx.stroke();
      ctx.strokeStyle = PALETTE.ring;
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.globalAlpha = 1;
      if (side === 'right' && age < TIMING.labelSeconds) {
        const a = Math.min(1, (TIMING.labelSeconds - age) * 2);
        const x = Math.min(PANEL.width - 130, Math.max(130, d.x));
        const y = d.y < 70 ? d.y + d.r + 26 + age * 8 : d.y - d.r - 12 - age * 14;
        ctx.globalAlpha = a;
        ctx.font = `700 15px ${FONT}`;
        const w = ctx.measureText(d.label).width + 20;
        roundRect(ctx, x - w / 2, y - 18, w, 26, 13);
        ctx.fillStyle = 'rgba(30,16,40,0.85)';
        ctx.fill();
        text(ctx, d.label, x, y, 15, PALETTE.gold, 'center', '700');
        ctx.globalAlpha = 1;
      }
    }
    const miss = state.lastMiss;
    if (miss && miss.side === side) {
      const age = state.clock - miss.at;
      if (age < 0.7) {
        const a = 1 - age / 0.7;
        ctx.strokeStyle = `rgba(255,90,90,${a})`;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        const s = 10 + age * 6;
        ctx.beginPath();
        ctx.moveTo(miss.x - s, miss.y - s);
        ctx.lineTo(miss.x + s, miss.y + s);
        ctx.moveTo(miss.x + s, miss.y - s);
        ctx.lineTo(miss.x - s, miss.y + s);
        ctx.stroke();
        text(ctx, `−${TIMING.missPenalty}s`, miss.x, miss.y - s - 8, 16, `rgba(255,120,120,${a})`, 'center', '800');
      }
    }
  }

  function drawPanel(state, ui, side, hidden) {
    const x0 = side === 'left' ? PANEL.leftX : PANEL.rightX;
    let shake = 0;
    const miss = state.lastMiss;
    if (miss && miss.side === side) {
      const age = state.clock - miss.at;
      if (age < TIMING.shakeSeconds) shake = Math.sin(age * 70) * 7 * (1 - age / TIMING.shakeSeconds);
    }
    // Caption tab.
    const caption = side === 'left' ? 'LEFT · THE ORIGINAL' : `RIGHT · ${DIFFS_PER_SCENE} THINGS CHANGED`;
    ctx.font = `800 13px ${FONT}`;
    const tw = ctx.measureText(caption).width + 28;
    roundRect(ctx, x0 + 14, PANEL.y - 26, tw, 32, 8);
    ctx.fillStyle = side === 'left' ? '#3a2a4a' : '#5a2f2a';
    ctx.fill();
    text(ctx, caption, x0 + 28, PANEL.y - 9, 13, side === 'left' ? PALETTE.muted : '#ffd2a8', 'left', '800');

    ctx.save();
    ctx.translate(x0 + shake, PANEL.y);
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 6;
    roundRect(ctx, 0, 0, PANEL.width, PANEL.height, 14);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.restore();
    ctx.save();
    roundRect(ctx, 0, 0, PANEL.width, PANEL.height, 14);
    ctx.clip();
    if (hidden) {
      ctx.fillStyle = '#1f1530';
      ctx.fillRect(0, 0, PANEL.width, PANEL.height);
      for (let i = 0; i < 12; i += 1) {
        for (let j = 0; j < 10; j += 1) lanternIcon(ctx, 25 + i * 50 + (j % 2) * 25, 25 + j * 50, 0.6, false);
      }
    } else {
      state.scene.draw(ctx, variantFor(state.scene, side), ui.t);
      drawMarkers(state, ui, side);
    }
    ctx.restore();
    roundRect(ctx, 0, 0, PANEL.width, PANEL.height, 14);
    ctx.strokeStyle = PALETTE.frame;
    ctx.lineWidth = 3;
    ctx.stroke();
    roundRect(ctx, -5, -5, PANEL.width + 10, PANEL.height + 10, 18);
    ctx.strokeStyle = 'rgba(217,165,91,0.3)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  // ------------------------------------------------------------ overlays

  function dim(alpha) {
    ctx.fillStyle = `rgba(14,8,24,${alpha})`;
    ctx.fillRect(0, HEADER.height, VIEW.width, VIEW.height - HEADER.height);
  }

  function drawSparkles(ui, age) {
    for (const p of ui.sparkles) {
      const y = ((p.y - age * p.speed) % 760 + 760) % 760 - 20;
      const x = p.x + Math.sin(age * p.sway + p.phase) * 14;
      const a = 0.5 + 0.5 * Math.sin(age * 3 + p.phase);
      ctx.globalAlpha = a;
      if (p.lantern) lanternIcon(ctx, x, y, p.size, true);
      else {
        ctx.beginPath();
        ctx.arc(x, y, p.size * 3, 0, TAU);
        ctx.fillStyle = p.colour;
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawTitle(ui) {
    dim(0.5);
    card(ctx, 290, 172, 700, 376);
    lanternIcon(ctx, 584, 222, 1.6, true);
    lanternIcon(ctx, 696, 222, 1.6, true);
    const g = ctx.createLinearGradient(0, 238, 0, 300);
    g.addColorStop(0, '#ffe6a8');
    g.addColorStop(1, '#ff9a45');
    text(ctx, TITLE, 640, 298, 66, g, 'center', '700', DISPLAY_FONT);
    text(ctx, `— ${SUBTITLE} —`, 640, 334, 22, PALETTE.muted, 'center', 'italic 500', DISPLAY_FONT);
    text(ctx, `Find ${DIFFS_PER_SCENE} differences between the two pictures`, 640, 386, 28, PALETTE.ink, 'center', '700');
    text(ctx, `${SCENES.length} scenes · ${TIMING.sceneSeconds / 60} minutes each · ${SCORING.hintsPerScene} hints per scene`, 640, 418, 17, PALETTE.muted, 'center', '500');
    const r = { x: 530, y: 442, w: 220, h: 54 };
    const s = 1 + 0.03 * Math.sin(ui.t * 4);
    ctx.save();
    ctx.translate(640, 469);
    ctx.scale(s, s);
    ctx.translate(-640, -469);
    button(ctx, r, 'Click to play', true);
    ctx.restore();
    text(ctx, ui.best > 0 ? `Your best total: ${ui.best}` : 'Or press Enter · H hint · P pause · M sound', 640, 526, 14, PALETTE.faint, 'center', '500');
  }

  function drawPaused(state) {
    card(ctx, 440, 300, 400, 170);
    text(ctx, 'Paused', 640, 360, 44, PALETTE.gold, 'center', '700', DISPLAY_FONT);
    text(ctx, `${counterText(state.found.length)} · ${formatTime(state.timeLeft)} left`, 640, 398, 17, PALETTE.muted, 'center', '500');
    text(ctx, 'Press P, Esc or click to resume', 640, 436, 17, PALETTE.ink, 'center', '600');
  }

  function row(label, value, y, size = 19, colour = PALETTE.ink, left = 466, right = 814) {
    text(ctx, label, left, y, size, PALETTE.muted, 'left', '500');
    text(ctx, value, right, y, size, colour, 'right', '700');
  }

  function drawClear(state, ui) {
    const age = state.clock - (state.found.length ? state.found[state.found.length - 1].at : 0);
    drawSparkles(ui, age);
    const result = state.results[state.results.length - 1];
    const y = 250 + Math.max(0, 1 - age * 4) * 30;
    card(ctx, 440, y, 400, 252);
    text(ctx, 'Scene clear!', 640, y + 58, 40, PALETTE.gold, 'center', '700', DISPLAY_FONT);
    text(ctx, `All ${DIFFS_PER_SCENE} found in ${state.scene.name}`, 640, y + 88, 16, PALETTE.muted, 'center', '500');
    row(`${DIFFS_PER_SCENE} differences`, `+${result.finds}`, y + 126);
    row(`Time bonus (${result.secondsLeft} s left)`, `+${result.bonus}`, y + 154);
    row('Score', String(state.score), y + 186, 22, PALETTE.gold);
    const next = SCENES[state.sceneIndex + 1];
    text(ctx, next ? `Next: ${next.name} · click to continue` : 'Last scene done. Adding up your lanterns…', 640, y + 226, 15, PALETTE.faint, 'center', '600');
  }

  function drawTimeUp(state) {
    card(ctx, 420, 290, 440, 200);
    text(ctx, "Time's up!", 640, 348, 42, PALETTE.barRed, 'center', '700', DISPLAY_FONT);
    text(ctx, `You found ${state.found.length} of ${DIFFS_PER_SCENE} in ${state.scene.name}.`, 640, 390, 18, PALETTE.ink, 'center', '600');
    text(ctx, 'Click or press R to try this scene again', 640, 430, 17, PALETTE.gold, 'center', '700');
    text(ctx, `Your score goes back to ${state.sceneStartScore} for the retry.`, 640, 460, 14, PALETTE.faint, 'center', '500');
  }

  function drawWin(state, ui) {
    dim(0.35);
    drawSparkles(ui, ui.t);
    const L = 384;
    const R = 896;
    card(ctx, 344, 124, 592, 476);
    lanternIcon(ctx, 392, 172, 1.2, true);
    lanternIcon(ctx, 888, 172, 1.2, true);
    text(ctx, 'You found them all!', 640, 186, 40, PALETTE.gold, 'center', '700', DISPLAY_FONT);
    const total = state.results.length * DIFFS_PER_SCENE;
    text(ctx, `${total} differences spotted across ${state.results.length} scenes`, 640, 216, 16, PALETTE.muted, 'center', '500');
    text(ctx, 'SCENE', L, 254, 12, PALETTE.faint, 'left', '800');
    text(ctx, 'FINDS', 770, 254, 12, PALETTE.faint, 'right', '800');
    text(ctx, 'TIME BONUS', R, 254, 12, PALETTE.faint, 'right', '800');
    let bonus = 0;
    state.results.forEach((r, i) => {
      const y = 284 + i * 30;
      text(ctx, r.name, L, y, 17, PALETTE.ink, 'left', '600');
      text(ctx, `+${r.finds}`, 770, y, 17, PALETTE.ink, 'right', '600');
      text(ctx, `+${r.bonus}`, R, y, 17, PALETTE.ink, 'right', '600');
      bonus += r.bonus;
    });
    let y = 284 + state.results.length * 30;
    ctx.fillStyle = 'rgba(255,200,97,0.35)';
    ctx.fillRect(L, y - 12, R - L, 1.5);
    row('Total time bonus', `+${bonus}`, y + 14, 18, PALETTE.ink, L, R);
    const hints = state.results.reduce((n, r) => n + r.hintsUsed, 0);
    if (hints) {
      y += 24;
      row(`Hints used (${hints} × ${SCORING.hintCost})`, `−${hints * SCORING.hintCost}`, y + 14, 16, PALETTE.ink, L, R);
    }
    text(ctx, 'FINAL SCORE', 640, 444, 13, PALETTE.faint, 'center', '800');
    text(ctx, String(state.score), 640, 488, 46, PALETTE.gold, 'center', '800');
    if (ui.best > 0) text(ctx, ui.newBest ? 'A new best!' : `Best: ${ui.best}`, 640, 510, 14, ui.newBest ? PALETTE.ember : PALETTE.faint, 'center', '700');
    button(ctx, PLAY_AGAIN, 'Play Again (R)', inRect(ui.hover.x, ui.hover.y, PLAY_AGAIN));
  }

  /**
   * Paint a frame. `ui` carries what is not game state: { screen, t (ambient seconds), hover,
   * muted, best, newBest, sparkles }.
   */
  function draw(state, ui) {
    resize();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const k = view.dpr * view.scale;
    ctx.setTransform(k, 0, 0, k, view.dpr * view.ox, view.dpr * view.oy);
    const bg = ctx.createRadialGradient(640, 400, 100, 640, 400, 800);
    bg.addColorStop(0, '#2a1a36');
    bg.addColorStop(1, PALETTE.backdrop);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);

    const hidden = ui.screen === SCREEN_PAUSED;
    drawHeader(state, ui);
    drawPanel(state, ui, 'left', hidden);
    drawPanel(state, ui, 'right', hidden);
    drawFooter(state, ui);

    if (ui.screen === SCREEN_TITLE) drawTitle(ui);
    else if (ui.screen === SCREEN_PAUSED) drawPaused(state);
    else if (ui.screen === SCREEN_CLEAR) drawClear(state, ui);
    else if (ui.screen === SCREEN_TIMEUP) drawTimeUp(state);
    else if (ui.screen === SCREEN_WIN) drawWin(state, ui);
  }

  return { draw, toLogical, view };
}
