function textNode(value, parent) { return { nodeType: 3, nodeValue: value, parentElement: parent }; }
function element({ tagName = "INPUT", id = "", type = "text", value = "", label = "", attrs = {}, children = [] } = {}) {
  const attributes = new Map(Object.entries(attrs));
  const node = {
    nodeType: 1, tagName, id, type, value, name: id, textContent: "", hidden: false,
    labels: label ? [{ textContent: label }] : [], style: {}, children,
    getAttribute(key) { return attributes.get(key) || null; },
    setAttribute(key, val) { attributes.set(key, val); }, removeAttribute(key) { attributes.delete(key); },
    getClientRects() { return [{}]; }, closest() { return null; }, dispatchEvent() {}
  };
  node.childNodes = children;
  return node;
}
function fakeDocument(nodes, fields = []) {
  return {
    nodeType: 9, title: "Offline fixture", documentElement: {},
    createTreeWalker() { let index = 0; return { nextNode() { return nodes[index++] || null; } }; },
    addEventListener() {}, querySelectorAll(selector) {
      if (selector === "input, textarea, select") return fields;
      if (selector.includes("data-privatepilot-redacted")) return fields.filter(field => field.getAttribute("data-privatepilot-redacted") === "true");
      return [];
    },
    getElementById(id) { return fields.find(field => field.id === id); }
  };
}
function bankTable({ headerTag = "TD", thead = false, aria = false, rowHeader = false } = {}) {
  const nodes = [];
  function make(tagName, parent, content, role) {
    const node = element({ tagName, attrs: role ? { role } : {} });
    node.parentElement = parent;
    if (parent) { node.previousElementSibling = parent.children.at(-1); parent.children.push(node); }
    node.closest = selector => {
      for (let current = node; current; current = current.parentElement) {
        if (selector.split(",").some(part => {
          const roleMatch = part.trim().match(/^\[role=['"]?([^'"\]]+)['"]?\]$/);
          return roleMatch ? current.getAttribute("role") === roleMatch[1] : current.tagName === part.trim().toUpperCase();
        })) return current;
      }
      return null;
    };
    nodes.push(node);
    if (content !== undefined) { node.text = textNode(content, node); nodes.push(node.text); }
    Object.defineProperty(node, "textContent", { get: () => node.text?.nodeValue ?? node.children.map(child => child.textContent).join(" ") });
    return node;
  }
  const table = make(aria ? "DIV" : "TABLE", null, undefined, aria ? "table" : undefined);
  const head = thead ? make("THEAD", table) : table;
  const headerRow = make(aria ? "DIV" : "TR", head, undefined, aria ? "row" : undefined);
  const headers = ["Account Name", "Account Number", "Account Type", "Balance", "Withdrawable", "Currency"].map(text => make(aria ? "DIV" : headerTag, headerRow, text, aria ? "columnheader" : undefined));
  const rows = [headerRow];
  const values = [["Riya Banerjee", "102938475610", "Savings", "4367.36", "4367.36", "INR"], ["Mira Srinivasan", "102938475611", "Current", "5000.00", "5000.00", "INR"]].map(contents => {
    const row = make(aria ? "DIV" : "TR", table, undefined, aria ? "row" : undefined); rows.push(row);
    const cells = contents.map(text => make(aria ? "DIV" : "TD", row, text, aria ? "cell" : undefined));
    if (rowHeader) { cells[0].tagName = "TH"; cells[0].setAttribute("scope", "row"); }
    row.cells = cells;
    return cells;
  });
  headerRow.cells = headers;
  if (!aria) table.rows = rows;
  table.querySelectorAll = () => rows;
  return { document: fakeDocument(nodes), table, headers, values, nodes };
}
module.exports = { textNode, element, fakeDocument, bankTable };
