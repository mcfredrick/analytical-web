// A Roman counting board. Pebbles (calculi) sit on ruled lines worth 1, 10
// and 100, or in the spaces above them worth 5, 50 and 500. A line holds up
// to four pebbles and a space holds one, so the board reads like an additive
// Roman numeral: DCCCCLXXXXVIIII is the most it holds.
//
// Tablet notation, one entry per line (lines starting with ". " are notes):
//   + XIIII    add 14 to the board, then read it off for the scribe
//   - VIIII    subtract 9, then read
//   NIHIL      add nothing (Roman numerals have no zero), then read

export const PLACES = [
  { name: "I", value: 1, line: true },
  { name: "V", value: 5, line: false },
  { name: "X", value: 10, line: true },
  { name: "L", value: 50, line: false },
  { name: "C", value: 100, line: true },
  { name: "D", value: 500, line: false },
];
const PLACE = Object.fromEntries(PLACES.map((p, i) => [p.name, i]));

// Our own estimate of a practised reckoner, since no ancient source rates one.
export const SECONDS_PER_MOVE = 1;

export function toNumeral(n) {
  let out = "";
  for (let i = PLACES.length - 1; i >= 0; i--) {
    while (n >= PLACES[i].value) { out += PLACES[i].name; n -= PLACES[i].value; }
  }
  return out;
}

export function fromNumeral(numeral) {
  let n = 0;
  for (const c of numeral) {
    if (!(c in PLACE)) throw new Error(`"${c}" is not a numeral the board can hold.`);
    n += PLACES[PLACE[c]].value;
  }
  return n;
}

export function parseTablet(text) {
  const entries = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith(". ")) return;
    if (line === "NIHIL") { entries.push({ sign: 1, numeral: "", text: line }); return; }
    const m = line.match(/^([+-])\s+([IVXLCD]+)$/);
    if (!m) throw new Error(`Line ${i + 1} of the tablet cannot be read: ${line}`);
    entries.push({ sign: m[1] === "+" ? 1 : -1, numeral: m[2], text: line });
  });
  return entries;
}

// The reckoner works through the tablet one pebble move at a time. Each move
// is recorded so the console can show the board between moves.
export class Board {
  constructor(entries, { onWrite = () => {} } = {}) {
    this.entries = entries;
    this.onWrite = onWrite;
    this.counts = new Array(PLACES.length).fill(0);
    this.pc = 0;
    this.moves = [];
    this.stats = { moves: 0, written: 0, seconds: 0 };
  }

  get done() { return this.pc >= this.entries.length && this.moves.length === 0; }
  get value() { return this.counts.reduce((sum, n, i) => sum + n * PLACES[i].value, 0); }

  // Make one pebble move, reading the next tablet entry when the last is done.
  step() {
    if (!this.moves.length) {
      if (this.pc >= this.entries.length) return null;
      this.moves = this.plan(this.entries[this.pc]);
    }
    const move = this.moves.shift();
    move.apply();
    this.stats.moves++;
    this.stats.seconds += SECONDS_PER_MOVE;
    if (!this.moves.length) this.pc++;
    return move;
  }

  // Lay out the moves for one entry against a scratch copy of the board.
  plan(entry) {
    const counts = [...this.counts];
    const moves = [];
    const move = (say, place, delta) => {
      counts[place] += delta;
      moves.push({ say, entry, apply: () => { this.counts[place] += delta; } });
    };
    const pebbles = [...entry.numeral].map((c) => PLACE[c]);
    if (entry.sign > 0) {
      for (const p of pebbles) move(`Set a pebble ${where(p)}`, p, 1);
      for (let p = 0; p < PLACES.length; p++) {
        const full = PLACES[p].line ? 5 : 2;
        while (counts[p] >= full) {
          if (p + 1 >= PLACES.length) throw new Error("The board overflows past D.");
          move(`Lift ${full === 5 ? "five" : "two"} ${where(p)}`, p, -full);
          move(`Carry one ${where(p + 1)}`, p + 1, 1);
        }
      }
    } else {
      for (const p of pebbles) {
        if (!counts[p]) {
          let q = p + 1;
          while (q < PLACES.length && !counts[q]) q++;
          if (q >= PLACES.length) throw new Error("The tablet subtracts more than the board holds.");
          for (; q > p; q--) {
            const split = PLACES[q].value / PLACES[q - 1].value;
            move(`Break a pebble ${where(q)}`, q, -1);
            move(`Put ${split === 5 ? "five" : "two"} ${where(q - 1)}`, q - 1, split);
          }
        }
        move(`Take a pebble ${where(p)}`, p, -1);
      }
    }
    const code = counts.reduce((sum, n, i) => sum + n * PLACES[i].value, 0);
    moves.push({
      say: `Read ${toNumeral(code) || "nothing"} for the scribe`, entry, code,
      apply: () => { this.stats.written++; this.onWrite(code); },
    });
    return moves;
  }
}

function where(p) {
  return PLACES[p].line ? `on the ${PLACES[p].name} line` : `in the ${PLACES[p].name} space`;
}
