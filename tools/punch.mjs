// The card punch. Reads each manuscript, encodes it into the Store,
// writes its deck, then runs the deck on the Engine to prove it prints
// the manuscript exactly. Ledger figures ({{CHARS}} etc.) are filled in by
// iterating until the page correctly describes its own deck.
//
//   node tools/punch.mjs

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseDeck, Engine, formatDuration, COLUMNS } from "../engine.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHARS_PER_COLUMN = 16;   // 16 × 3 digits = 48 of the column's 50
const FIRST_DATA_COLUMN = 10;
const MANUSCRIPTS = [["manuscript.html", "page.cards"], ["manual.html", "manual.cards"]];

// The type case holds sorts numbered 1–999. Anything outside it is set as an
// HTML character reference built from sorts that are in the case.
function toTypeCase(text) {
  let out = "";
  for (const ch of text.replace(/\r/g, "")) {
    const code = ch.codePointAt(0);
    out += code >= 1 && code <= 999 ? ch : `&#${code};`;
  }
  return out;
}

function punch(text, name) {
  const columns = [];
  for (let i = 0; i < text.length; i += CHARS_PER_COLUMN) {
    let value = 0n;
    const chunk = text.slice(i, i + CHARS_PER_COLUMN);
    for (let j = chunk.length - 1; j >= 0; j--) value = value * 1000n + BigInt(chunk.charCodeAt(j));
    columns.push(value);
  }
  if (FIRST_DATA_COLUMN + columns.length > COLUMNS) {
    throw new Error(`Manuscript needs ${columns.length} columns; the Store has room for ${COLUMNS - FIRST_DATA_COLUMN}.`);
  }
  const pad = (n) => String(n).padStart(3, "0");
  const deck = [
    `. The Analytical Web — deck punched from ${name}`,
    `. ${text.length} characters in ${columns.length} columns of the Store`,
    ". V000 = 1000 (one character's worth), V001 = 0",
    ". V002 receives each remainder, V003 is the test column",
    "A set type",
    "N000 1000",
    "N001 0",
  ];
  columns.forEach((v, i) => deck.push(`N${pad(FIRST_DATA_COLUMN + i)} ${v}`));
  columns.forEach((_, i) => {
    const c = pad(FIRST_DATA_COLUMN + i);
    deck.push(
      `. column ${c}`,
      "÷", `L${c}`, "L000", `S${c}`, "S002'",   // quotient back to store, remainder to V002
      "+", "L002", "L001", "P",                 // move remainder to egress and print it
      "-", "L001", `L${c}`, "S003",             // 0 − column: run-up lever set while column > 0
      "CB?14",                                  // turn the chain back to ÷
    );
  });
  deck.push(". end of manuscript", "H");
  return deck.join("\n") + "\n";
}

function run(deckText) {
  let printed = "";
  const engine = new Engine(parseDeck(deckText), {
    onPrint: (v, mode) => { printed += mode === "type" ? String.fromCharCode(Number(v)) : String(v) + "\n"; },
  });
  let guard = 0;
  while (!engine.halted && guard++ < 5e6) engine.step();
  if (engine.error) throw new Error(engine.error);
  return { printed, engine };
}

const fmt = (n) => n.toLocaleString("en-US");

async function punchManuscript(name, deckFile) {
  const source = toTypeCase(await readFile(join(root, name), "utf8"));
  let figures = { CHARS: "0", COLUMNS: "0", CARDS: "0", DIVISIONS: "0", TIME: "0 seconds" };
  let text, deck, result;

  for (let pass = 1; pass <= 20; pass++) {
    text = source.replace(/\{\{(\w+)\}\}/g, (_, k) => figures[k]);
    deck = punch(text, name);
    result = run(deck);
    const cards = parseDeck(deck).length;
    const next = {
      CHARS: fmt(text.length),
      COLUMNS: fmt(Math.ceil(text.length / CHARS_PER_COLUMN)),
      CARDS: fmt(cards),
      DIVISIONS: fmt(result.engine.stats["÷"]),
      TIME: formatDuration(result.engine.stats.seconds),
    };
    if (JSON.stringify(next) === JSON.stringify(figures)) break;
    figures = next;
    if (pass === 20) throw new Error(`Ledger figures for ${name} did not settle.`);
  }

  if (result.printed !== text) throw new Error(`The Engine's output does not match ${name}.`);
  await writeFile(join(root, deckFile), deck);
  console.log(`${deckFile}: punched ${figures.CARDS} cards for ${figures.CHARS} characters.`);
  console.log(`  Engine time at Babbage's rated speed: ${figures.TIME}.`);
  console.log(`  Verified: the Engine prints ${name} exactly.`);
}

for (const [name, deckFile] of MANUSCRIPTS) await punchManuscript(name, deckFile);
