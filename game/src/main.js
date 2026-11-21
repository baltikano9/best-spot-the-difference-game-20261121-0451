// Boot and the one loop. Screens run title → play → scene clear → play … → win, with paused and
// time's-up on the side. Each frame takes the clicks and key presses since the last one, advances
// the world by the real elapsed time (capped, so a stalled tab is not replayed), and paints.
//
// ?seed=N fixes the run's random choices (hint picks, celebration sparkles). ?shot=start|play|
// festival|win (with &seed=N) stages that moment with the real rules instead of running the loop,
// paints it twice and sets window.__shotReady for the screenshot tool.
import { BEST_KEY, DIFFS_PER_SCENE, FOOTER, PLAY_AGAIN, TIMING } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_TIMEUP, RESULT_FOUND, RESULT_MISS } from './world.js';
import {
  ACTION_CONFIRM, ACTION_HINT, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, createInput, inRect,
} from './input.js';
import {
  counterText, createRenderer, SCREEN_CLEAR, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TIMEUP, SCREEN_TITLE, SCREEN_WIN,
} from './render.js';
import { createSound } from './sound.js';
import { stageShot } from './shots.js';

/** The longest frame the loop advances by; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.1;
/**
 * The scene-clear and time's-up cards ignore clicks and keys this long, so a burst of clicks at the
 * moment they appear does not skip straight past them.
 */
const CARD_GRACE = 0.7;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);

/** Rising lanterns and sparks for the celebrations, from the seed so screenshots repeat. */
function makeSparkles(random) {
  const colours = ['#ffd54f', '#ff9a45', '#ff7f9e', '#7fe3ff', '#fff3c4'];
  return Array.from({ length: 46 }, (_, i) => ({
    x: random() * 1280,
    y: random() * 760,
    speed: 30 + random() * 60,
    sway: 0.6 + random() * 1.4,
    phase: random() * Math.PI * 2,
    size: i % 5 === 0 ? 0.7 + random() * 0.5 : 0.6 + random() * 1.2,
    lantern: i % 5 === 0,
    colour: colours[i % colours.length],
  }));
}
const sparkles = makeSparkles(createRandom(seed ^ 0x5bd1e995));

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const staged = stageShot(name, world);
  const ui = { ...staged, hover: { x: -1, y: -1 }, muted: false, sparkles };
  let painted = 0;
  function paint() {
    renderer.draw(world.state, ui);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const sound = createSound(true);
  const input = createInput(canvas, renderer.toLogical, () => sound.unlock());
  const state = world.state;
  const ui = { screen: SCREEN_TITLE, t: 0, hover: input.hover, muted: false, best: readBest(), newBest: false, sparkles };
  let clearLeft = 0;
  /** Seconds since the scene-clear or time's-up card appeared. */
  let cardAge = 0;
  let last = performance.now();
  world.startRun();

  // Screen readers (and anyone watching the page's text) hear each screen change and each find.
  function announce(message) {
    status.textContent = message;
  }

  function beginScene() {
    ui.screen = SCREEN_PLAY;
    announce(`Scene ${state.sceneIndex + 1}: ${state.scene.name}. ${state.scene.blurb} Find ${DIFFS_PER_SCENE} differences in ${TIMING.sceneSeconds / 60} minutes.`);
  }

  function startRun() {
    world.startRun();
    ui.newBest = false;
    beginScene();
  }

  function retry() {
    world.retryScene();
    beginScene();
  }

  function setPaused(paused) {
    ui.screen = paused ? SCREEN_PAUSED : SCREEN_PLAY;
    announce(paused ? 'Paused.' : 'Playing.');
  }

  function advance() {
    if (world.nextScene()) {
      beginScene();
      return;
    }
    ui.screen = SCREEN_WIN;
    ui.newBest = state.score > ui.best;
    if (ui.newBest) {
      ui.best = state.score;
      saveBest(ui.best);
    }
    sound.win();
    announce(`You found them all! Final score ${state.score}. Press R or click Play Again.`);
  }

  function hint() {
    const d = world.useHint();
    if (d) {
      sound.hint();
      announce(`Hint: look near the glowing circle. ${state.hintsLeft} hints left.`);
    } else if (state.hintsLeft <= 0) announce('No hints left in this scene.');
  }

  function clickPanel(panel) {
    const r = world.click(panel.x, panel.y, panel.side);
    if (r.result === RESULT_FOUND) {
      sound.find();
      if (r.complete) {
        sound.clear();
        cardAge = 0;
        clearLeft = world.isLastScene ? TIMING.finalClearSeconds : TIMING.clearSeconds;
        ui.screen = SCREEN_CLEAR;
        const result = state.results[state.results.length - 1];
        announce(`${r.diff.label}. Scene clear! Time bonus ${result.bonus}. Score ${state.score}.`);
      } else announce(`${r.diff.label}. ${counterText(state.found.length)}.`);
    } else if (r.result === RESULT_MISS) {
      sound.miss();
      announce(`Nothing different there: ${TIMING.missPenalty} seconds lost.`);
    }
  }

  function handleClick(c) {
    switch (ui.screen) {
      case SCREEN_TITLE:
        startRun();
        break;
      case SCREEN_PAUSED:
        setPaused(false);
        break;
      case SCREEN_CLEAR:
        if (cardAge > CARD_GRACE) advance();
        break;
      case SCREEN_TIMEUP:
        if (cardAge > CARD_GRACE) retry();
        break;
      case SCREEN_WIN:
        if (inRect(c.x, c.y, PLAY_AGAIN)) startRun();
        break;
      default:
        if (inRect(c.x, c.y, FOOTER.hint)) hint();
        else if (inRect(c.x, c.y, FOOTER.pause)) setPaused(true);
        else if (c.panel) clickPanel(c.panel);
    }
  }

  function handleActions(actions) {
    if (actions & ACTION_MUTE) {
      ui.muted = sound.toggleMute();
      announce(ui.muted ? 'Sound off.' : 'Sound on.');
    }
    const go = actions & (ACTION_CONFIRM | ACTION_RESTART);
    if (ui.screen === SCREEN_TITLE && go) startRun();
    else if (ui.screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) setPaused(true);
      else if (actions & ACTION_HINT) hint();
      else if (actions & ACTION_RESTART) retry();
    } else if (ui.screen === SCREEN_PAUSED && actions & (ACTION_PAUSE | ACTION_CONFIRM)) setPaused(false);
    else if (ui.screen === SCREEN_CLEAR && go && cardAge > CARD_GRACE) advance();
    else if (ui.screen === SCREEN_TIMEUP && go && cardAge > CARD_GRACE) retry();
    else if (ui.screen === SCREEN_WIN && go) startRun();
  }

  function updateCursor() {
    const h = input.hover;
    let pointer = ui.screen !== SCREEN_PLAY && ui.screen !== SCREEN_WIN;
    if (ui.screen === SCREEN_PLAY) pointer = inRect(h.x, h.y, FOOTER.hint) || inRect(h.x, h.y, FOOTER.pause);
    if (ui.screen === SCREEN_WIN) pointer = inRect(h.x, h.y, PLAY_AGAIN);
    const cursor = pointer ? 'pointer' : ui.screen === SCREEN_PLAY ? 'crosshair' : 'default';
    if (canvas.style.cursor !== cursor) canvas.style.cursor = cursor;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions(input.takeActions());
    for (const c of input.takeClicks()) handleClick(c);
    if (ui.screen !== SCREEN_PAUSED) {
      ui.t += dt;
      if (world.tick(dt, ui.screen === SCREEN_PLAY) & EVENT_TIMEUP) {
        ui.screen = SCREEN_TIMEUP;
        cardAge = 0;
        sound.timeUp();
        announce(`Time's up. You found ${state.found.length} of ${DIFFS_PER_SCENE}. Press R or click to try again.`);
      }
    }
    cardAge += dt;
    if (ui.screen === SCREEN_CLEAR) {
      clearLeft -= dt;
      if (clearLeft <= 0) advance();
    }
    updateCursor();
    renderer.draw(state, ui);
  }

  // Leaving the tab pauses a running scene rather than letting the clock run unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && ui.screen === SCREEN_PLAY) setPaused(true);
  });

  announce(`Twin Lanterns, a spot-the-difference game. Find ${DIFFS_PER_SCENE} differences in each of three scenes. Click or press Enter to play.`);
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
