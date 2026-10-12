// The tablet writer. Reads board-manuscript.html, writes board.tablet as the
// difference between each character code and the last, then works the tablet
// on the counting board to prove the scribe copies the manuscript exactly.
// Ledger figures ({{CHARS}} etc.) are filled in by iterating until the page
// correctly describes its own tablet.
//
//   node tools/punch-board.mjs

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseTablet, toNumeral, Board } from "../board.js";
import { formatDuration } from "../engine.js";
import { toTypeCase } from "./type-case.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fmt = (n) => n.toLocaleString("en-US");

function write(text) {
  const lines = [
    ". The Analytical Web, tablet written from board-manuscript.html",
    `. ${text.length} characters, each the difference from the last`,
  ];
  let last = 0;
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    const diff = code - last;
    lines.push(diff === 0 ? "NIHIL" : `${diff > 0 ? "+" : "-"} ${toNumeral(Math.abs(diff))}`);
    last = code;
  }
  return lines.join("\n") + "\n";
}

function work(tablet) {
  let copied = "";
  const board = new Board(parseTablet(tablet), { onWrite: (code) => { copied += String.fromCharCode(code); } });
  while (!board.done) board.step();
  return { copied, board };
}

const source = toTypeCase(await readFile(join(root, "board-manuscript.html"), "utf8"));
let figures = { CHARS: "0", ENTRIES: "0", MOVES: "0", TIME: "0 seconds" };
let text, tablet, result;

for (let pass = 1; pass <= 20; pass++) {
  text = source.replace(/\{\{(\w+)\}\}/g, (_, k) => figures[k]);
  tablet = write(text);
  result = work(tablet);
  const next = {
    CHARS: fmt(text.length),
    ENTRIES: fmt(parseTablet(tablet).length),
    MOVES: fmt(result.board.stats.moves),
    TIME: formatDuration(result.board.stats.seconds),
  };
  if (JSON.stringify(next) === JSON.stringify(figures)) break;
  figures = next;
  if (pass === 20) throw new Error("Ledger figures did not settle.");
}

if (result.copied !== text) throw new Error("The scribe's copy does not match the manuscript.");
await writeFile(join(root, "board.tablet"), tablet);
console.log(`board.tablet: ${figures.ENTRIES} lines for ${figures.CHARS} characters, ${figures.MOVES} pebble moves.`);
console.log(`  Time at a move a second: ${figures.TIME}.`);
console.log("  Verified: the scribe copies board-manuscript.html exactly.");
