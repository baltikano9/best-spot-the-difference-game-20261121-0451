// Every tuning number, size and colour in one place. The game is laid out on a fixed 1280x720
// logical canvas; the renderer scales that to the window, so nothing below depends on the screen.

export const VIEW = { width: 1280, height: 720 };

/**
 * The two picture panels. Scenes are drawn in panel coordinates (0..600 x 0..500); the left panel
 * sits at x=24 and the right one at x=656, both at y=132, with a 32 px gutter between them.
 */
export const PANEL = { width: 600, height: 500, y: 132, leftX: 24, rightX: 656 };

export const HEADER = { height: 104, barY: 90, barHeight: 8 };

export const FOOTER = {
  y: 648,
  hint: { x: 24, y: 650, w: 236, h: 48 },
  pause: { x: 272, y: 650, w: 150, h: 48 },
};

/** The win screen's Play Again button, in canvas coordinates. */
export const PLAY_AGAIN = { x: 530, y: 526, w: 220, h: 52 };

export const TIMING = {
  sceneSeconds: 180,
  missPenalty: 5,
  /** Below these fractions of the scene time the timer bar turns amber, then red. */
  amberAt: 0.5,
  redAt: 0.2,
  /** How long a scene's celebration stays up before the next scene starts on its own. */
  clearSeconds: 3.6,
  /** The last scene's celebration before the win screen. */
  finalClearSeconds: 2.4,
  hintSeconds: 2.6,
  shakeSeconds: 0.35,
  ringGrowSeconds: 0.45,
  labelSeconds: 1.8,
};

export const SCORING = {
  perFind: 100,
  hintCost: 150,
  hintsPerScene: 3,
  /** Points for each whole second left on the clock when a scene is cleared. */
  bonusPerSecond: 5,
};

export const DIFFS_PER_SCENE = 7;

export const PALETTE = {
  backdrop: '#120d1c',
  headerTop: '#24182f',
  headerBottom: '#1a1225',
  ink: '#fff6e6',
  muted: '#c9b9d6',
  faint: '#8d7a9e',
  gold: '#ffc861',
  goldDeep: '#e8912e',
  ember: '#ff7a45',
  ring: '#ffd54f',
  ringShadow: 'rgba(40, 14, 0, 0.75)',
  hint: '#7fe3ff',
  miss: '#ff5a5a',
  barTrack: 'rgba(255, 255, 255, 0.12)',
  barOk: '#5fd39a',
  barAmber: '#ffb238',
  barRed: '#ff4d4d',
  card: 'rgba(30, 20, 42, 0.96)',
  cardEdge: '#ffc861',
  frame: '#d9a55b',
  button: '#ff9e45',
  buttonText: '#2a1306',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", "Hiragino Sans", "Noto Sans", sans-serif';
export const DISPLAY_FONT = 'Georgia, "Palatino Linotype", "Book Antiqua", "Times New Roman", serif';

export const TITLE = 'Twin Lanterns';
export const SUBTITLE = 'Spot the Difference';

/** Where the best total score is kept between visits (this browser only). */
export const BEST_KEY = 'twin-lanterns.best';
