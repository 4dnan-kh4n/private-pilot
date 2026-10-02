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
module.exports = { textNode, element, fakeDocument };
