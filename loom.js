// A Jacquard loom of 1804, after the 400-hook single-action machine described
// in H. William Nelson's "Jacquard Machines" (1909).
//
// Each card is one pick: one pass of the shuttle. A hole lets its needle push
// a hook into the griffe, which lifts that warp thread; a blank leaves it
// down. Where the warp is lifted it lies over the weft in the cloth.
//
// Card notation: one card per line, 400 holes as "O" (punched) or "."
// (blank), written in fifty rows of eight as the needles are arranged.
// Spaces are ignored. Lines starting with "." followed by a space are notes.

export const HOOKS = 400;
export const NEEDLE_ROW = 8;

// Nelson gives ninety to one hundred thirty picks a minute as the most
// suitable speeds for a single-action machine.
export const PICKS_PER_MINUTE = 90;

export function parseLoomDeck(text) {
  const cards = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith(". ") || line === ".") return;
    const holes = line.replace(/\s+/g, "");
    if (holes.length !== HOOKS || /[^O.]/.test(holes)) {
      throw new Error(`Card at line ${i + 1} must have ${HOOKS} positions of "O" or ".".`);
    }
    cards.push(Uint8Array.from(holes, (c) => (c === "O" ? 1 : 0)));
  });
  return cards;
}

export function formatCard(lifts) {
  let out = "";
  for (let h = 0; h < HOOKS; h++) {
    if (h && h % NEEDLE_ROW === 0) out += " ";
    out += lifts[h] ? "O" : ".";
  }
  return out;
}

export class Loom {
  constructor(cards) {
    this.cards = cards;
    this.pc = 0;
    this.cloth = [];
    this.seconds = 0;
  }

  get done() { return this.pc >= this.cards.length; }

  // Throw the shuttle once through the shed the next card opens.
  step() {
    if (this.done) return null;
    const lifts = this.cards[this.pc++];
    this.cloth.push(lifts);
    this.seconds += 60 / PICKS_PER_MINUTE;
    return lifts;
  }
}
