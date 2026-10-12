// The loom's card punch. Reads loom.txt (first line the title, the rest the
// body), lays it out as a design on squared paper, binds it in satin, writes
// loom.cards, then weaves the deck to prove the cloth matches the design.
//
//   node tools/punch-loom.mjs

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseLoomDeck, formatCard, Loom, HOOKS } from "../loom.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Five-row type, five threads wide, punched by hand on the design paper.
const FONT = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  C: [".###.", "#...#", "#....", "#....", "#....", "#...#", ".###."],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  G: [".###.", "#...#", "#....", "#.###", "#...#", "#...#", ".####"],
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  I: [".###.", "..#..", "..#..", "..#..", "..#..", "..#..", ".###."],
  J: ["..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."],
  K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  N: ["#...#", "#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  Q: [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "#.#.#", ".#.#."],
  X: ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
  Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
  0: [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
  1: ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  2: [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  3: ["#####", "...#.", "..#..", "...#.", "....#", "#...#", ".###."],
  4: ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  5: ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  6: ["..##.", ".#...", "#....", "####.", "#...#", "#...#", ".###."],
  7: ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
  8: [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  9: [".###.", "#...#", "#...#", ".####", "....#", "...#.", ".##.."],
  ".": [".....", ".....", ".....", ".....", ".....", ".##..", ".##.."],
  ",": [".....", ".....", ".....", ".....", ".##..", "..#..", ".#..."],
  "'": ["..#..", "..#..", ".#...", ".....", ".....", ".....", "....."],
  "-": [".....", ".....", ".....", ".###.", ".....", ".....", "....."],
  ":": [".....", ".##..", ".##..", ".....", ".##..", ".##..", "....."],
  "(": ["...#.", "..#..", ".#...", ".#...", ".#...", "..#..", "...#."],
  ")": [".#...", "..#..", "...#.", "...#.", "...#.", "..#..", ".#..."],
  "&": [".##..", "#..#.", "#.#..", ".#...", "#.#.#", "#..#.", ".##.#"],
  " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
};
const GLYPH_ROWS = 7;
const GLYPH_PITCH = 6;          // five threads of letter and one of space

const MARGIN = 8;               // plain ground outside the frame
const FRAME = 3;                // the woven rule around the plate
const INSET = 12;               // ground inside the frame
const TITLE_SCALE = 3;
const BODY_SCALE = 2;
const LINE_GAP = 8;

// Five-end satin. Each pick binds one end in five, stepping two ends at a
// time, so no two binding points touch and the face stays smooth.
const satin = (h, p) => (2 * h + p) % 5 === 0;
// The ground shows the weft (warp lifted only at binding points); the figure
// shows the warp (lifted everywhere except its binding points).
const lifted = (figure, h, p) => (figure ? !satin(h, p + 2) : satin(h, p));

function setLine(rows, text, scale) {
  const width = text.length * GLYPH_PITCH * scale - scale;
  const left = Math.floor((HOOKS - width) / 2);
  const inner = HOOKS - 2 * (MARGIN + FRAME + INSET);
  if (width > inner) throw new Error(`"${text}" is ${width} threads wide; the plate has room for ${inner}.`);
  for (let r = 0; r < GLYPH_ROWS * scale; r++) {
    const row = new Uint8Array(HOOKS);
    [...text].forEach((ch, i) => {
      const glyph = FONT[ch];
      if (!glyph) throw new Error(`There is no type for "${ch}".`);
      const line = glyph[Math.floor(r / scale)];
      for (let c = 0; c < 5 * scale; c++) {
        if (line[Math.floor(c / scale)] === "#") row[left + i * GLYPH_PITCH * scale + c] = 1;
      }
    });
    rows.push(row);
  }
}

function blank(rows, n) {
  for (let i = 0; i < n; i++) rows.push(new Uint8Array(HOOKS));
}

// The design: one row per pick, 1 where the figure is.
function design(title, body) {
  const rows = [];
  blank(rows, MARGIN + FRAME + INSET);
  setLine(rows, title, TITLE_SCALE);
  blank(rows, INSET);
  body.forEach((line, i) => {
    if (i) blank(rows, LINE_GAP);
    setLine(rows, line, BODY_SCALE);
  });
  blank(rows, INSET + FRAME + MARGIN);
  const last = rows.length - 1;
  rows.forEach((row, p) => {
    const inFrameRows = p >= MARGIN && p <= last - MARGIN;
    const onFrameRow = (p >= MARGIN && p < MARGIN + FRAME) || (p > last - MARGIN - FRAME && p <= last - MARGIN);
    for (let h = MARGIN; h < HOOKS - MARGIN; h++) {
      const onFrameCol = h < MARGIN + FRAME || h >= HOOKS - MARGIN - FRAME;
      if (onFrameRow || (inFrameRows && onFrameCol)) row[h] = 1;
    }
  });
  return rows;
}

const [title, ...body] = (await readFile(join(root, "loom.txt"), "utf8")).trimEnd().split(/\r?\n/);
const figure = design(title, body);
const cards = figure.map((row, p) => Uint8Array.from(row, (f, h) => (lifted(f, h, p) ? 1 : 0)));

const deck = [
  ". The Analytical Web, deck punched from loom.txt",
  `. ${cards.length} picks on ${HOOKS} hooks, five-end satin`,
  ...cards.map(formatCard),
].join("\n") + "\n";

const loom = new Loom(parseLoomDeck(deck));
while (!loom.done) loom.step();
loom.cloth.forEach((lifts, p) => {
  for (let h = 0; h < HOOKS; h++) {
    if (!!lifts[h] !== lifted(figure[p][h], h, p)) throw new Error(`The cloth differs from the design at pick ${p + 1}, end ${h + 1}.`);
  }
});

await writeFile(join(root, "loom.cards"), deck);
console.log(`loom.cards: punched ${cards.length} cards.`);
console.log("  Verified: the loom weaves the design exactly.");
