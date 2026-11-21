// The game's state and rules, with no DOM: which scene is up, which differences are found, the
// score, the clock, hints and mistakes. Clicks arrive in panel coordinates (0..600 x 0..500) and
// are tested against the very same difference list the scene draws from (scenes.js), so what you
// see is exactly what you can click. Time only moves through tick(dt); nothing reads a real clock,
// which keeps the screenshot scenes and the Node test harness deterministic.
import { DIFFS_PER_SCENE, SCORING, TIMING } from './config.js';
import { SCENES } from './scenes.js';

export const RESULT_FOUND = 'found';
export const RESULT_MISS = 'miss';
export const RESULT_IGNORED = 'ignored';

export const EVENT_TIMEUP = 1;

/**
 * The difference a click at (x, y) lands on: the nearest one whose circle contains the point, found
 * or not (so a second click on a found difference is harmless), or null.
 */
export function hitTest(sceneDef, x, y) {
  let best = null;
  let bestDistance = Infinity;
  for (const d of sceneDef.diffs) {
    const distance = Math.hypot(x - d.x, y - d.y);
    if (distance <= d.r && distance < bestDistance) {
      best = d;
      bestDistance = distance;
    }
  }
  return best;
}

export function createWorld(random) {
  const state = {
    sceneIndex: 0,
    scene: SCENES[0],
    /** Found differences in the order found: { id, at } with `at` on the world clock. */
    found: [],
    score: 0,
    sceneStartScore: 0,
    timeLeft: TIMING.sceneSeconds,
    hintsLeft: SCORING.hintsPerScene,
    mistakes: 0,
    /** Seconds since the world began; drives ring, shake and hint animations. */
    clock: 0,
    lastMiss: null,
    hint: null,
    cleared: false,
    timeUp: false,
    /** One entry per cleared scene: { name, finds, bonus, secondsLeft, mistakes, hintsUsed }. */
    results: [],
  };

  function isFound(id) {
    return state.found.some((f) => f.id === id);
  }

  function startScene(index) {
    state.sceneIndex = index;
    state.scene = SCENES[index];
    state.found = [];
    state.sceneStartScore = state.score;
    state.timeLeft = TIMING.sceneSeconds;
    state.hintsLeft = SCORING.hintsPerScene;
    state.mistakes = 0;
    state.lastMiss = null;
    state.hint = null;
    state.cleared = false;
    state.timeUp = false;
  }

  function finishScene() {
    const secondsLeft = Math.floor(state.timeLeft);
    const bonus = secondsLeft * SCORING.bonusPerSecond;
    state.score += bonus;
    state.cleared = true;
    state.hint = null;
    state.results.push({
      name: state.scene.name,
      finds: DIFFS_PER_SCENE * SCORING.perFind,
      bonus,
      secondsLeft,
      mistakes: state.mistakes,
      hintsUsed: SCORING.hintsPerScene - state.hintsLeft,
    });
  }

  return {
    state,
    isFound,

    /** A fresh run from the first scene. */
    startRun() {
      state.score = 0;
      state.results = [];
      startScene(0);
    },

    /** Play the current scene again from its start, with the score it began with. */
    retryScene() {
      state.score = state.sceneStartScore;
      startScene(state.sceneIndex);
    },

    /** Move on to the next scene; false when the cleared scene was the last one. */
    nextScene() {
      if (state.sceneIndex + 1 >= SCENES.length) return false;
      startScene(state.sceneIndex + 1);
      return true;
    },

    get isLastScene() {
      return state.sceneIndex === SCENES.length - 1;
    },

    /**
     * A click at panel coordinates (x, y) on `side` ('left' or 'right'). Returns { result, diff,
     * complete }: found (a new difference; complete when it was the last one), miss (nothing there:
     * costs time and shakes that panel) or ignored (already found, or the scene is not running).
     */
    click(x, y, side) {
      if (state.cleared || state.timeUp) return { result: RESULT_IGNORED, diff: null, complete: false };
      const diff = hitTest(state.scene, x, y);
      if (diff && isFound(diff.id)) return { result: RESULT_IGNORED, diff, complete: false };
      if (diff) {
        state.found.push({ id: diff.id, at: state.clock });
        state.score += SCORING.perFind;
        if (state.hint && state.hint.id === diff.id) state.hint = null;
        const complete = state.found.length === state.scene.diffs.length;
        if (complete) finishScene();
        return { result: RESULT_FOUND, diff, complete };
      }
      state.mistakes += 1;
      state.timeLeft = Math.max(0, state.timeLeft - TIMING.missPenalty);
      state.lastMiss = { side, x, y, at: state.clock };
      return { result: RESULT_MISS, diff: null, complete: false };
    },

    /** Pulse a random unfound difference for a moment; null when no hints are left (or none needed). */
    useHint() {
      if (state.cleared || state.timeUp || state.hintsLeft <= 0) return null;
      if (state.hint && state.clock - state.hint.at < TIMING.hintSeconds) return null;
      const unfound = state.scene.diffs.filter((d) => !isFound(d.id));
      if (unfound.length === 0) return null;
      const diff = unfound[Math.floor(random() * unfound.length)];
      state.hintsLeft -= 1;
      state.score = Math.max(0, state.score - SCORING.hintCost);
      state.hint = { id: diff.id, at: state.clock };
      return diff;
    },

    /**
     * Advance time by dt seconds. The world clock always runs (animations); the scene timer only
     * while the scene is being played (`running`). Returns EVENT_TIMEUP the moment time runs out.
     */
    tick(dt, running) {
      state.clock += dt;
      if (state.hint && state.clock - state.hint.at > TIMING.hintSeconds) state.hint = null;
      if (!running || state.cleared || state.timeUp) return 0;
      state.timeLeft = Math.max(0, state.timeLeft - dt);
      if (state.timeLeft === 0) {
        state.timeUp = true;
        state.hint = null;
        return EVENT_TIMEUP;
      }
      return 0;
    },
  };
}
