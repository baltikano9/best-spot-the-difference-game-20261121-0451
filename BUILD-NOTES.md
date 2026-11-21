# Build notes: Twin Lanterns — Spot the Difference

## What was built
An original spot-the-difference game that replaces the starter's Block Dodger. It is static ES modules under `game/` (about 82 KB of source text). It has no build step and makes no network requests. All the art is Canvas 2D code and all the sound is WebAudio.

- **Three scenes, each with 7 differences:** Lantern Festival, Star Observatory and Seaside Bakery at Dawn. Each scene has a decoy element that is the same on both sides: the floating candles, the constellation and campfire, and the lighthouse.
- **One source of truth:** each scene is a single `draw(ctx, v, t)` function. The left panel is drawn with every flag off and the right panel with every flag on. Each entry in a scene's `diffs` list is `{ id, label, x, y, r }`, and its `id` is the flag it flips. The positions come from the same constant objects the drawing uses, and `world.click` hit-tests against that same list.
- **Rules:**
  - Each find scores 100. A ring appears on both panels, a label floats up and a two-note chime plays.
  - A wrong click costs 5 seconds, shakes the panel that was clicked and shows a red ✕.
  - Each scene has 180 s. The timer bar turns amber at 50% and red at 20%.
  - Clearing a scene adds a bonus of 5 points for each second left.
  - A hint (button or H) pulses one unfound difference and costs 150 points. You get 3 per scene, and the score never goes below 0.
  - P or Esc pauses, and the pictures are covered while paused. R restarts the scene, or starts a new game from the win screen. M mutes.
  - Each cleared scene gets a celebration card, then the next scene starts. After scene 3 the win screen shows the score for each scene, the time bonus, the final score, your best score (saved in localStorage) and a Play Again button.
  - When time runs out, a "Time's up" card offers a retry at the score the scene started with.
- **Screenshots:** `?shot=start|play|festival|win&seed=1` stage these moments through the real `world.tick` and `world.click` calls. The page paints twice and then sets `window.__shotReady`. `shots.json` lists the four required names.
  - Following the brief, the `festival` shot shows **scene 2 (Star Observatory)**: 2 found, 5 to go, with a hint pulsing.
- **main.ts:** the hand-in behaviour is unchanged. I added a `GAME_TITLE` constant, rewrote the header comment and added two `console.log` lines.

`vendor/makefun-game.ts` (sha256 `dc671875…6129`), `LICENSE`, `serve.ts` and `screenshots/*.jpg` were not touched, and nothing was committed. `screenshots/` still holds the starter's three JPEGs, including `3-end.jpg`. They need replacing with the four browser captures named in `shots.json`.

## Tests
- `node tests/check.mjs`: **322 passed, 0 failed.** It checks:
  - Every `game/src/*.js` file passes `node --check` as a module, none uses `require` or a network URL, and the source is under 160 KB.
  - Each scene has 7 unique ids, radii between 24 and 30, every target inside the panel, and no two targets overlapping.
  - Drawing reads exactly the diff ids as flags, and nothing else. This uses a Proxy spy and a recording mock canvas.
  - The left panel is the drawing with every flag off, and turning on any single flag changes the drawing.
  - Clicking each difference slightly off-centre, on either panel, finds it. A second click is ignored, and a click just outside a radius does not find it.
  - The point farthest from every difference is a miss and costs exactly 5 s.
  - Completing a scene clears it and awards the right bonus, and the final score equals the finds plus the bonuses.
  - Hints: the cost, the limit of 3, the cooldown and the floor at 0.
  - Time-up and retry work, and the timer stops when the game is not running.
  - Each of the four shots reaches the state the brief asks for (3/7 on scene 1, 2/7 on scene 2, all 3 scenes cleared). Each renders at 1280x720 with the required text: "Find 7 differences…", "Click to play", "3 / 7 found · 4 to go", "You found them all!", the time bonus and the final score.
- **Visual check:** I rendered the four shots and both panels of each scene with a headless canvas (`@napi-rs/canvas`, installed in a scratch directory outside the repo) and looked at them. Every difference sits inside its hit circle. This led to two fixes on the win card: the scene names overlapped the score column, and the best-score line was hidden behind the button. I also made the Pause button a quieter secondary style.
- **Loop smoke test:** I drove the real `main.js` with a fake DOM through a whole run: title, a miss, a hint, pause and resume, all 21 finds, automatic scene advances, the win screen with the best score saved, Play Again, time-up and R to retry. This found a bug: a click landing just as time ran out retried at once, so the "Time's up" card never showed. Both the scene-clear and time-up cards now ignore input for 0.7 s.
- `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts` writes `out/dossier.json` (all 9 modules in its text, not truncated), `out/game/` and `out/screenshots/`. `node serve.ts --port 8123` serves the page and the modules with the right MIME types.

## Not verified here
No real browser was available in this environment. The shots were checked through `@napi-rs/canvas` (Skia), not Chrome, so the final screenshot capture is the first real-browser run. Sound has not been heard: `sound.js` builds its notes correctly, but the chimes have not been played.
