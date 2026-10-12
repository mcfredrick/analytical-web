// The Analytical Engine, after Charles Babbage (1837) and the card notation
// popularised by John Walker's emulator at fourmilab.ch.
//
// Store: 1,000 columns, each holding a signed number of 50 decimal digits.
// Mill:  two ingress axes, an egress axis and a primed egress axis (the
//        remainder of a division), plus the run-up lever used for branching.
//
// Card vocabulary (one card per line; lines starting with "." are comments):
//   N017 12345      Number card: place 12345 in column 17
//   + - × ÷         Operation card (* and / are accepted too)
//   L017            Variable card: copy column 17 to the next ingress axis
//   Z017            Variable card: copy column 17 to the ingress axis and zero it
//   S017            Variable card: store the egress axis in column 17
//   S017'           Variable card: store the primed egress axis (remainder)
//   P               Print the egress axis on the printing apparatus
//   CF+n  CB+n      Combinatorial card: turn the chain forward/back n cards
//   CF?n  CB?n      ...only if the run-up lever is set
//                   (n counts from the card that would otherwise come next)
//   A set type      Attendant card: printer sets each number as a type sort
//   A set numerals  Attendant card: printer prints plain numerals
//   H               Halt the engine

export const DIGITS = 50;
export const COLUMNS = 1000;
const LIMIT = 10n ** BigInt(DIGITS);

// Babbage's rated speeds: "sixty additions or subtractions ... in one minute.
// One multiplication of two numbers, each of fifty figures, in one minute.
// One division of a number having 100 places of figures by another of 50,
// in one minute."  (Passages from the Life of a Philosopher, 1864.)
export const SECONDS = { "+": 1, "-": 1, "×": 60, "÷": 60 };

const OPS = { "+": "+", "-": "-", "−": "-", "*": "×", "×": "×", "/": "÷", "÷": "÷" };

export function parseDeck(text) {
  const cards = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith(".")) return;
    const at = `line ${i + 1}`;
    const head = line[0];
    let card;
    if (OPS[head] && line.length === 1) {
      card = { kind: "op", op: OPS[head] };
    } else if (head === "N") {
      const m = line.match(/^N(\d{1,3})\s+(-?\d+)$/);
      if (!m) throw new Error(`Malformed number card at ${at}: ${line}`);
      const value = BigInt(m[2]);
      if ((value < 0n ? -value : value) >= LIMIT) throw new Error(`Number wider than ${DIGITS} digits at ${at}`);
      card = { kind: "number", col: +m[1], value };
    } else if (head === "L" || head === "Z" || head === "S") {
      const m = line.match(/^[LZS](\d{1,3})('?)$/);
      if (!m) throw new Error(`Malformed variable card at ${at}: ${line}`);
      card = { kind: head === "S" ? "store" : "load", zero: head === "Z", col: +m[1], prime: m[2] === "'" };
    } else if (head === "P" && line.length === 1) {
      card = { kind: "print" };
    } else if (head === "H" && line.length === 1) {
      card = { kind: "halt" };
    } else if (head === "C") {
      const m = line.match(/^C([FB])([+?])(\d+)$/);
      if (!m) throw new Error(`Malformed combinatorial card at ${at}: ${line}`);
      card = { kind: "comb", back: m[1] === "B", cond: m[2] === "?", n: +m[3] };
    } else if (head === "A") {
      const m = line.match(/^A\s+set\s+(type|numerals)$/i);
      if (!m) throw new Error(`Unknown attendant card at ${at}: ${line}`);
      card = { kind: "attendant", mode: m[1].toLowerCase() };
    } else {
      throw new Error(`Unrecognised card at ${at}: ${line}`);
    }
    card.text = line;
    cards.push(card);
  });
  return cards;
}

export class Engine {
  constructor(cards, { onPrint = () => {} } = {}) {
    this.cards = cards;
    this.onPrint = onPrint;
    this.reset();
  }

  reset() {
    this.store = new Array(COLUMNS).fill(0n);
    this.pc = 0;
    this.op = "+";
    this.ingress = [];
    this.lastIngress = [0n, 0n];
    this.egress = 0n;
    this.egressPrime = 0n;
    this.lever = false;
    this.halted = false;
    this.error = null;
    this.printMode = "numerals";
    this.lastCol = null;
    this.stats = { cards: 0, "+": 0, "-": 0, "×": 0, "÷": 0, printed: 0, seconds: 0 };
  }

  // Execute one card. Returns the card and the engine seconds it consumed.
  step() {
    if (this.halted) return null;
    if (this.pc < 0 || this.pc >= this.cards.length) {
      this.halted = true;
      this.error = "The card chain ran off its end.";
      return null;
    }
    const index = this.pc;
    const card = this.cards[this.pc++];
    let cost = 0;
    this.stats.cards++;
    switch (card.kind) {
      case "number":
        this.store[card.col] = card.value;
        this.lastCol = card.col;
        break;
      case "op":
        this.op = card.op;
        this.ingress = [];
        break;
      case "load": {
        const v = this.store[card.col];
        if (card.zero) this.store[card.col] = 0n;
        this.ingress.push(v);
        this.lastCol = card.col;
        if (this.ingress.length === 2) cost = this.mill();
        break;
      }
      case "store":
        this.store[card.col] = card.prime ? this.egressPrime : this.egress;
        this.lastCol = card.col;
        break;
      case "print":
        this.stats.printed++;
        this.onPrint(this.egress, this.printMode);
        break;
      case "comb":
        if (!card.cond || this.lever) this.pc += card.back ? -card.n : card.n;
        break;
      case "attendant":
        this.printMode = card.mode;
        break;
      case "halt":
        this.halted = true;
        break;
    }
    this.stats.seconds += cost;
    return { card, index, cost };
  }

  mill() {
    const [a, b] = this.ingress;
    this.lastIngress = [a, b];
    this.ingress = [];
    let r = 0n, rem = 0n;
    this.lever = false;
    switch (this.op) {
      case "+": r = a + b; break;
      case "-": r = a - b; break;
      case "×": r = a * b; break;
      case "÷":
        if (b === 0n) { this.lever = true; break; }
        r = a / b;          // BigInt division truncates toward zero
        rem = a % b;
        break;
    }
    if ((r < 0n ? -r : r) >= LIMIT) { this.lever = true; r = r % LIMIT; }
    if ((r < 0n) !== (a < 0n)) this.lever = true;   // sign changed from first operand
    this.egress = r;
    this.egressPrime = rem;
    this.stats[this.op]++;
    return SECONDS[this.op];
  }
}

export function formatDuration(seconds) {
  seconds = Math.round(seconds);
  const parts = [];
  const units = [["day", 86400], ["hour", 3600], ["minute", 60], ["second", 1]];
  for (const [name, size] of units) {
    const n = Math.floor(seconds / size);
    seconds -= n * size;
    if (n) parts.push(`${n} ${name}${n === 1 ? "" : "s"}`);
  }
  return parts.length ? parts.slice(0, 3).join(", ") : "0 seconds";
}
