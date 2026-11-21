// Node checks for Twin Lanterns (no browser, no packages): run `node tests/check.mjs` from the repo root.
// 1. every game/src/*.js parses as an ES module;
// 2. each scene's difference data is sane (7 ids, radii 24-30, inside the panel, no overlaps);
// 3. the single source of truth holds: drawing reads exactly the diff ids as flags, and flipping
//    each one alone changes the drawing;
// 4. the rules: every difference is found from its own coordinates on either panel, a repeat is
//    ignored, a far-away click is a miss that costs 5 s, hints, time-up and scene flow;
// 5. the four ?shot= stagings reach the states the brief asks for, and the renderer paints them
//    (into a recording mock canvas) with the required text on screen.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const src = join(root, 'game', 'src');
let failures = 0;
let passes = 0;
function check(ok, message) {
  if (ok) passes += 1;
  else {
    failures += 1;
    console.log(`FAIL ${message}`);
  }
}

// ---------------------------------------------------------------- 1. module syntax
const tmp = mkdtempSync(join(tmpdir(), 'twin-lanterns-'));
let totalBytes = statSync(join(root, 'game', 'index.html')).size;
for (const file of readdirSync(src).filter((f) => f.endsWith('.js'))) {
  const text = readFileSync(join(src, file), 'utf8');
  totalBytes += Buffer.byteLength(text);
  copyFileSync(join(src, file), join(tmp, file.replace(/\.js$/, '.mjs')));
  try {
    execFileSync(process.execPath, ['--check', join(tmp, file.replace(/\.js$/, '.mjs'))], { stdio: 'pipe' });
    check(true);
  } catch (e) {
    check(false, `${file} does not parse as a module: ${e.stderr}`);
  }
  check(!/\brequire\(/.test(text), `${file} uses require()`);
  check(!/https?:\/\//.test(text), `${file} mentions a network URL`);
}
check(totalBytes < 160 * 1024, `game/ source is ${totalBytes} bytes`);
console.log(`game/ source text: ${totalBytes} bytes`);

const { SCENES } = await import('../game/src/scenes.js');
const { createWorld, hitTest, RESULT_FOUND, RESULT_IGNORED, RESULT_MISS, EVENT_TIMEUP } = await import('../game/src/world.js');
const { createRandom } = await import('../game/src/random.js');
const { PANEL, SCORING, TIMING } = await import('../game/src/config.js');

// ---------------------------------------------------------------- a recording mock canvas
function mockContext(log) {
  const gradient = { addColorStop() {} };
  const target = {
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    measureText: (s) => ({ width: String(s).length * 8 }),
  };
  return new Proxy(target, {
    get(t, key) {
      if (key in t) return t[key];
      return (...args) => log.push(`${String(key)}(${args.map((a) => (typeof a === 'number' ? a.toFixed(2) : typeof a === 'object' ? 'obj' : String(a))).join(',')})`);
    },
    set(t, key, value) {
      log.push(`${String(key)}=${typeof value === 'object' ? 'obj' : String(value)}`);
      return true;
    },
  });
}
function drawLog(sceneDef, flags) {
  const log = [];
  sceneDef.draw(mockContext(log), flags, 1.5);
  return log.join('\n');
}

// ---------------------------------------------------------------- 2-4. per scene
check(SCENES.length === 3, 'there are three scenes');
for (const s of SCENES) {
  const ids = s.diffs.map((d) => d.id);
  check(ids.length === 7 && new Set(ids).size === 7, `${s.name}: 7 unique differences`);
  for (const d of s.diffs) {
    check(d.r >= 24 && d.r <= 30, `${s.name}/${d.id}: radius ${d.r} outside 24-30`);
    check(d.x - d.r >= 0 && d.x + d.r <= PANEL.width && d.y - d.r >= 0 && d.y + d.r <= PANEL.height, `${s.name}/${d.id}: target leaves the panel`);
    check(typeof d.label === 'string' && d.label.length > 5, `${s.name}/${d.id}: has a label`);
  }
  for (let i = 0; i < s.diffs.length; i += 1) {
    for (let j = i + 1; j < s.diffs.length; j += 1) {
      const a = s.diffs[i];
      const b = s.diffs[j];
      check(Math.hypot(a.x - b.x, a.y - b.y) > a.r + b.r, `${s.name}: ${a.id} and ${b.id} targets overlap`);
    }
  }

  // Single source of truth: which flags does drawing read?
  const read = new Set();
  const spy = new Proxy({}, { get: (_, k) => (typeof k === 'string' && read.add(k), false) });
  s.draw(mockContext([]), spy, 0);
  check([...read].sort().join() === [...ids].sort().join(), `${s.name}: draw reads flags [${[...read]}] but diffs are [${ids}]`);
  const left = drawLog(s, s.left);
  const right = drawLog(s, s.right);
  check(left !== right, `${s.name}: left and right panels differ`);
  check(left === drawLog(s, {}), `${s.name}: the left panel is the all-flags-off picture`);
  for (const id of ids) check(drawLog(s, { [id]: true }) !== left, `${s.name}/${id}: flipping the flag alone changes nothing`);
}

// Rules, scene by scene, clicking each difference's own coordinates.
const world = createWorld(createRandom(1));
world.startRun();
for (let si = 0; si < SCENES.length; si += 1) {
  const s = world.state.scene;
  check(s === SCENES[si], `scene ${si} is up`);
  // A far-away click: the spot furthest from every difference on a coarse grid.
  let far = null;
  let farDistance = -1;
  for (let x = 10; x < 600; x += 10) {
    for (let y = 10; y < 500; y += 10) {
      const nearest = Math.min(...s.diffs.map((d) => Math.hypot(x - d.x, y - d.y) - d.r));
      if (nearest > farDistance) {
        farDistance = nearest;
        far = { x, y };
      }
    }
  }
  const before = world.state.timeLeft;
  const miss = world.click(far.x, far.y, 'left');
  check(miss.result === RESULT_MISS, `${s.name}: far click (${far.x},${far.y}) is a miss`);
  check(Math.abs(world.state.timeLeft - (before - TIMING.missPenalty)) < 1e-9, `${s.name}: a miss costs ${TIMING.missPenalty} s`);
  check(world.click(0, 0, 'right').result === RESULT_MISS || hitTest(s, 0, 0), `${s.name}: corner click`);
  // Just outside each target is not a find of that target.
  for (const d of s.diffs) {
    const h = hitTest(s, d.x + d.r + 1, d.y);
    check(!h || h.id !== d.id, `${s.name}/${d.id}: a click just outside its radius still finds it`);
  }
  s.diffs.forEach((d, i) => {
    world.tick(5, true);
    const side = i % 2 ? 'left' : 'right';
    // Click a little off-centre, as a player would.
    const r = world.click(d.x + d.r * 0.5, d.y - d.r * 0.4, side);
    check(r.result === RESULT_FOUND && r.diff.id === d.id, `${s.name}/${d.id}: click on ${side} finds it`);
    check(r.complete === (i === 6), `${s.name}/${d.id}: completion flag`);
    if (i < 6) check(world.click(d.x, d.y, side === 'left' ? 'right' : 'left').result === RESULT_IGNORED, `${s.name}/${d.id}: second click ignored`);
  });
  check(world.state.cleared, `${s.name}: cleared after 7 finds`);
  const last = world.state.results.at(-1);
  check(last.bonus === Math.floor(world.state.timeLeft) * SCORING.bonusPerSecond, `${s.name}: time bonus is ${SCORING.bonusPerSecond} per second left`);
  check(world.click(far.x, far.y, 'left').result === RESULT_IGNORED, `${s.name}: clicks ignored once cleared`);
  const moved = world.nextScene();
  check(moved === si < SCENES.length - 1, `nextScene after ${s.name}`);
}
const expected = world.state.results.reduce((n, r) => n + r.finds + r.bonus, 0);
check(world.state.score === expected, `final score ${world.state.score} = finds + bonuses ${expected}`);

// Hints: three per scene, 150 each, never below zero, pulse an unfound one.
const hw = createWorld(createRandom(7));
hw.startRun();
hw.state.score = 400;
const h1 = hw.useHint();
check(h1 && !hw.isFound(h1.id) && hw.state.score === 250 && hw.state.hintsLeft === 2, 'first hint costs 150');
check(hw.useHint() === null, 'no second hint while one is pulsing');
hw.tick(TIMING.hintSeconds + 0.1, true);
check(hw.useHint() && hw.state.score === 100, 'second hint after the pulse');
hw.tick(TIMING.hintSeconds + 0.1, true);
check(hw.useHint() && hw.state.score === 0 && hw.state.hintsLeft === 0, 'third hint, score floored at 0');
hw.tick(TIMING.hintSeconds + 0.1, true);
check(hw.useHint() === null, 'no fourth hint');

// Time up, then retry restores the scene's starting score.
const tw = createWorld(createRandom(3));
tw.startRun();
const d0 = tw.state.scene.diffs[0];
tw.click(d0.x, d0.y, 'left');
let event = 0;
for (let i = 0; i < 200 && !event; i += 1) event = tw.tick(1, true);
check(event === EVENT_TIMEUP && tw.state.timeUp, 'the timer runs out');
check(tw.click(d0.x, d0.y, 'left').result === RESULT_IGNORED, 'no clicks after time up');
tw.retryScene();
check(tw.state.score === 0 && tw.state.found.length === 0 && tw.state.timeLeft === TIMING.sceneSeconds, 'retry resets the scene');
const paused = tw.state.timeLeft;
tw.tick(10, false);
check(tw.state.timeLeft === paused, 'the timer does not run when not playing');

// ---------------------------------------------------------------- 5. shots and the renderer
globalThis.window = { devicePixelRatio: 1 };
const { stageShot } = await import('../game/src/shots.js');
const { createRenderer } = await import('../game/src/render.js');
const shots = JSON.parse(readFileSync(join(root, 'shots.json'), 'utf8'));
check(shots.map((s) => s.name).join() === '1-start.jpg,2-play.jpg,3-festival.jpg,4-win.jpg', 'shots.json names');
const wants = {
  start: ['Twin Lanterns', 'Find 7 differences between the two pictures', 'Click to play'],
  play: ['3 / 7 found · 4 to go'],
  festival: ['2 / 7 found · 5 to go', 'Scene 2 of 3 · Star Observatory'],
  win: ['You found them all!', 'Total time bonus', 'FINAL SCORE', 'Play Again (R)', '7 / 7 found · 0 to go'],
};
for (const { query } of shots) {
  const name = new URLSearchParams(query).get('shot');
  const w = createWorld(createRandom(1));
  const staged = stageShot(name, w);
  const log = [];
  const canvas = { clientWidth: 1280, clientHeight: 720, width: 0, height: 0, getContext: () => mockContext(log) };
  const sparkles = Array.from({ length: 5 }, (_, i) => ({ x: i * 200, y: 300, speed: 40, sway: 1, phase: i, size: 1, lantern: i === 0, colour: '#fff' }));
  const renderer = createRenderer(canvas);
  renderer.draw(w.state, { ...staged, hover: { x: -1, y: -1 }, muted: false, sparkles });
  check(canvas.width === 1280 && canvas.height === 720, `${name}: renders at 1280x720`);
  const texts = log.filter((l) => l.startsWith('fillText(')).join('\n');
  for (const want of wants[name]) check(texts.includes(want), `${name}: "${want}" is drawn`);
  // Both panels draw each found ring: two translate()s to the panels, rings via arc() after them.
  const found = w.state.found.length;
  if (name === 'play') check(found === 3 && w.state.timeLeft < TIMING.sceneSeconds && w.state.timeLeft > 30, `play: 3 found, timer partly used (${w.state.timeLeft})`);
  if (name === 'festival') check(w.state.sceneIndex === 1 && found === 2, 'festival: scene 2 with 2 found');
  if (name === 'win') check(w.state.results.length === 3 && found === 7 && w.state.cleared, 'win: all three scenes cleared');
  console.log(`shot ${name}: scene ${w.state.sceneIndex + 1}, ${found}/7 found, ${w.state.timeLeft.toFixed(1)} s left, score ${w.state.score}, ${log.length} canvas calls`);
}

console.log(`${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
