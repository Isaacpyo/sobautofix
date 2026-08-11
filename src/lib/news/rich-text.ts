const safeHref = /^(?:\/[^\s]*|https?:\/\/[^\s]+)$/i;

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function inlineMarkupToHtml(value: string) {
  const escaped = escapeHtml(value);
  return escaped.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(((?:\/|https?:\/\/)[^)]+)\)/g, '<a href="$2">$1</a>');
}

export function articleMarkupToHtml(value: string) {
  const lines = value.split(/\r?\n/);
  const blocks: string[] = [];
  for (let index = 0; index < lines.length;) {
    const line = lines[index]?.trim() || "";
    if (!line) { index += 1; continue; }
    if (line.startsWith("## ")) { blocks.push(`<h2>${inlineMarkupToHtml(line.slice(3))}</h2>`); index += 1; continue; }
    if (line.startsWith("### ")) { blocks.push(`<h3>${inlineMarkupToHtml(line.slice(4))}</h3>`); index += 1; continue; }
    if (line.startsWith("> ")) { blocks.push(`<blockquote>${inlineMarkupToHtml(line.slice(2))}</blockquote>`); index += 1; continue; }
    if (line.startsWith("- ")) {
      const items: string[] = [];
      while ((lines[index]?.trim() || "").startsWith("- ")) { items.push(`<li>${inlineMarkupToHtml((lines[index]?.trim() || "").slice(2))}</li>`); index += 1; }
      blocks.push(`<ul>${items.join("")}</ul>`); continue;
    }
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (/^\d+\.\s/.test(lines[index]?.trim() || "")) { items.push(`<li>${inlineMarkupToHtml((lines[index]?.trim() || "").replace(/^\d+\.\s/, ""))}</li>`); index += 1; }
      blocks.push(`<ol>${items.join("")}</ol>`); continue;
    }
    blocks.push(`<p>${inlineMarkupToHtml(line)}</p>`);
    index += 1;
  }
  return blocks.join("");
}

function inlineNodeToMarkup(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent || "";
  if (!(node instanceof HTMLElement)) return "";
  const content = [...node.childNodes].map(inlineNodeToMarkup).join("");
  if (node.tagName === "STRONG" || node.tagName === "B") return `**${content}**`;
  if (node.tagName === "EM" || node.tagName === "I") return `*${content}*`;
  if (node.tagName === "A") {
    const href = node.getAttribute("href") || "";
    return safeHref.test(href) ? `[${content}](${href})` : content;
  }
  if (node.tagName === "BR") return "\n";
  return content;
}

export function editorHtmlToArticleMarkup(html: string) {
  const documentValue = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = documentValue.body.firstElementChild;
  if (!root) return "";
  const blocks: string[] = [];
  for (const node of root.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text) blocks.push(text);
      continue;
    }
    if (!(node instanceof HTMLElement)) continue;
    const content = [...node.childNodes].map(inlineNodeToMarkup).join("").trim();
    if (!content) continue;
    if (node.tagName === "H2") blocks.push(`## ${content}`);
    else if (node.tagName === "H3") blocks.push(`### ${content}`);
    else if (node.tagName === "BLOCKQUOTE") blocks.push(`> ${content}`);
    else if (node.tagName === "UL" || node.tagName === "OL") {
      const ordered = node.tagName === "OL";
      blocks.push([...node.children].filter((child) => child.tagName === "LI").map((child, index) => `${ordered ? `${index + 1}.` : "-"} ${[...child.childNodes].map(inlineNodeToMarkup).join("").trim()}`).join("\n"));
    } else blocks.push(content);
  }
  return blocks.join("\n\n");
}

export function sanitisePastedArticleHtml(html: string) {
  const source = new DOMParser().parseFromString(html, "text/html");
  const output = document.implementation.createHTMLDocument("");
  const container = output.createElement("div");

  function clean(node: Node, parent: HTMLElement) {
    if (node.nodeType === Node.TEXT_NODE) { parent.append(output.createTextNode(node.textContent || "")); return; }
    if (!(node instanceof HTMLElement)) return;
    if (["SCRIPT", "STYLE", "IFRAME", "OBJECT", "SVG", "FORM"].includes(node.tagName)) return;
    const allowed: Record<string, string> = { P: "p", DIV: "p", H1: "h2", H2: "h2", H3: "h3", STRONG: "strong", B: "strong", EM: "em", I: "em", UL: "ul", OL: "ol", LI: "li", BLOCKQUOTE: "blockquote", BR: "br", A: "a" };
    const tag = allowed[node.tagName];
    if (!tag) { for (const child of node.childNodes) clean(child, parent); return; }
    const element = output.createElement(tag);
    if (tag === "a") {
      const href = node.getAttribute("href") || "";
      if (!safeHref.test(href)) { for (const child of node.childNodes) clean(child, parent); return; }
      element.setAttribute("href", href);
    }
    for (const child of node.childNodes) clean(child, element);
    parent.append(element);
  }

  for (const child of source.body.childNodes) clean(child, container);
  return container.innerHTML;
}
