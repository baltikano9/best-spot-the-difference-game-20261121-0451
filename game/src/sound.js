// Tiny WebAudio chimes, synthesised on the spot (no sound files). The audio context is created
// lazily on the first user gesture, as browsers require; until then, when muted, and always in
// screenshot mode, every call is silent.

export function createSound(enabled) {
  let ctx = null;
  let master = null;
  let muted = false;

  function unlock() {
    if (!enabled) return;
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    ctx = new AudioCtx();
    master = ctx.createGain();
    master.gain.value = 0.32;
    master.connect(ctx.destination);
  }

  /** One enveloped note: frequency (Hz), start offset and length (s), waveform, peak level, optional end pitch. */
  function note(freq, start, length, type = 'sine', level = 0.5, endFreq = 0) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + length);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(level, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + length);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + length + 0.05);
  }

  return {
    unlock,
    get muted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    /** A pleasant two-note chime, with a soft octave shimmer. */
    find() {
      note(784, 0, 0.35, 'sine', 0.5);
      note(1175, 0.09, 0.55, 'sine', 0.45);
      note(2350, 0.09, 0.4, 'triangle', 0.06);
    },
    /** A low thud. */
    miss() {
      note(150, 0, 0.22, 'sine', 0.7, 60);
      note(90, 0, 0.18, 'triangle', 0.25, 50);
    },
    hint() {
      note(1320, 0, 0.3, 'triangle', 0.18);
      note(1760, 0.08, 0.4, 'triangle', 0.14);
    },
    /** A rising arpeggio for a cleared scene. */
    clear() {
      [523, 659, 784, 1047].forEach((f, i) => note(f, i * 0.09, 0.5, 'triangle', 0.3));
    },
    /** The longer arpeggio for the final win. */
    win() {
      [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => note(f, i * 0.11, 0.7, 'triangle', 0.3));
      note(262, 0, 1.4, 'sine', 0.2);
      note(392, 0.33, 1.2, 'sine', 0.15);
    },
    timeUp() {
      [392, 330, 262].forEach((f, i) => note(f, i * 0.16, 0.4, 'sine', 0.35));
    },
  };
}
