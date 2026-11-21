// A small seeded random number generator (mulberry32). The scenes use fixed seeds for their star
// fields and scattered details, so the left and right pictures (and every screenshot) always match;
// the run's own seed only decides celebration sparkles and which unfound difference a hint shows.

export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
