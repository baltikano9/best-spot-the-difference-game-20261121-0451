// The screenshot scenes behind ?shot=start|play|festival|win. Each one plays the real rules forward
// from a fresh run: time passes through world.tick and differences are found by world.click at the
// coordinates in the scene data, exactly as a player's clicks would be, so a frame can never show a
// state the game itself could not reach. Nothing here reads a clock or Math.random.
import { RESULT_FOUND, RESULT_MISS } from './world.js';
import { SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

/** Click the named difference's centre on `side`, insisting that it is found. */
function find(world, id, side) {
  const d = world.state.scene.diffs.find((x) => x.id === id);
  const r = world.click(d.x, d.y, side);
  if (r.result !== RESULT_FOUND) throw new Error(`shot staging: ${id} was not found (${r.result})`);
  return r;
}

/** Play the current scene to the end, with `gap` seconds between finds. */
function clearScene(world, gap) {
  const diffs = world.state.scene.diffs;
  diffs.forEach((d, i) => {
    world.tick(gap, true);
    find(world, d.id, i % 2 ? 'left' : 'right');
  });
}

/**
 * Stage the named shot on `world` and return what the renderer needs besides the state:
 * { screen, t, best, newBest }. Unknown names give the title screen.
 */
export function stageShot(name, world) {
  world.startRun();
  if (name === 'play') {
    // Scene 1, a minute and a quarter in: three found, one wrong click, four to go.
    world.tick(21, true);
    find(world, 'moonFlip', 'left');
    world.tick(17, true);
    if (world.click(300, 150, 'right').result !== RESULT_MISS) throw new Error('shot staging: the miss click hit something');
    world.tick(14, true);
    find(world, 'catTail', 'right');
    world.tick(16, true);
    find(world, 'paperBoat', 'right');
    world.tick(0.9, true);
    return { screen: SCREEN_PLAY, t: 2.4, best: 0, newBest: false };
  }
  if (name === 'festival') {
    // Scene 1 cleared, then scene 2 under way: two found, a hint pulsing, five to go.
    clearScene(world, 16);
    world.nextScene();
    world.tick(24, true);
    find(world, 'cometTail', 'right');
    world.tick(31, true);
    find(world, 'windowDark', 'left');
    world.tick(12, true);
    world.useHint();
    world.tick(0.5, true);
    return { screen: SCREEN_PLAY, t: 5.1, best: 0, newBest: false };
  }
  if (name === 'win') {
    clearScene(world, 15);
    world.nextScene();
    clearScene(world, 18);
    world.nextScene();
    clearScene(world, 14);
    world.tick(3, false);
    return { screen: SCREEN_WIN, t: 3.3, best: world.state.score, newBest: true };
  }
  world.tick(1.2, false);
  return { screen: SCREEN_TITLE, t: 1.2, best: 0, newBest: false };
}
