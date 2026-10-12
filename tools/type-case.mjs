// The type case holds sorts numbered 1–999. Anything outside it is set as an
// HTML character reference built from sorts that are in the case.
export function toTypeCase(text) {
  let out = "";
  for (const ch of text.replace(/\r/g, "")) {
    const code = ch.codePointAt(0);
    out += code >= 1 && code <= 999 ? ch : `&#${code};`;
  }
  return out;
}
