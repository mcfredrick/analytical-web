// The sheet a machine's output is set on. Until the manuscript's stylesheet
// is closed, it shows the raw galley rather than a blank or unstyled page.
export function compositor(host) {
  const sheet = host.attachShadow({ mode: "open" });
  const galleyCss = new CSSStyleSheet();
  galleyCss.replaceSync(`
    :host { display: block; }
    .galley { margin: 0; padding: 20px; color: #4a4536; font: 13px/1.5 ui-monospace, "Courier New", monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
    .galley::before { content: "Galley proof. The stylesheet is still being set, and the page takes its shape when it closes."; display: block; font: italic 14px/1.4 var(--italic); color: #7a2a1c; margin-bottom: 10px; white-space: normal; }`);
  let shown = null;
  return (text) => {
    if (text === shown) return;
    shown = text;
    const openStyle = !text.includes("</style>") && (text.includes("<style") || "<style".startsWith(text));
    if (openStyle) {
      sheet.innerHTML = `<pre class="galley"></pre>`;
      sheet.querySelector("pre").textContent = text;
      sheet.adoptedStyleSheets = [galleyCss];
    } else {
      sheet.innerHTML = text;
      sheet.adoptedStyleSheets = [];
    }
  };
}
