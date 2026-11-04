// Picks which quote the banner shows. The banner asks for a new quote every 15 seconds, which is
// 240 quotes an hour, so instead of drawing at random (and repeating) it walks one shuffled cycle of
// every quote. With 250 quotes, any 60 minutes in a row shows 240 different ones.

export const QUOTE_INTERVAL_MS = 15_000;
const SHUFFLE_SEED = 20261104;

// mulberry32: a small seeded generator, so every request and every server gets the same order.
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const orders = new Map<number, number[]>();
function shuffledOrder(count: number): number[] {
  let order = orders.get(count);
  if (!order) {
    order = Array.from({ length: count }, (_, i) => i);
    const random = seeded(SHUFFLE_SEED);
    for (let i = count - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    orders.set(count, order);
  }
  return order;
}

/** The position (0..count-1, in id order) of the quote to show at `now`, and when it changes. */
export function quoteSlot(now: number, count: number): { index: number; nextChangeAt: number } {
  const slot = Math.floor(now / QUOTE_INTERVAL_MS);
  return { index: shuffledOrder(count)[slot % count], nextChangeAt: (slot + 1) * QUOTE_INTERVAL_MS };
}
