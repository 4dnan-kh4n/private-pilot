(function registerCaptureApi(root, factory) {
  const api = factory();
  if (typeof module === "object") module.exports = api;
  root.PrivatePilotCapture = api;
})(globalThis, function createCaptureApi() {
  const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "SVG", "CANVAS"]);
  const MAX_TEXT_LENGTH = 50000;
  const MAX_FIELDS = 250;
  const originalTextSecurity = new WeakMap();

  function isVisible(element) {
    if (!element || element.hidden || element.getAttribute?.("aria-hidden") === "true" || element.type === "hidden") return false;
    const view = element.ownerDocument?.defaultView;
    const style = view?.getComputedStyle?.(element);
    if (style && (style.display === "none" || style.visibility === "hidden" || style.opacity === "0")) return false;
    if (typeof element.getClientRects === "function" && element.getClientRects().length === 0) return false;
    return true;
  }

  function tableContextFor(element) {
    const cellSelector = "td, th, [role='cell'], [role='gridcell'], [role='columnheader'], [role='rowheader']";
    const tableSelector = "table, [role='table'], [role='grid']";
    const cell = element?.closest?.(cellSelector);
    if (!cell) return {};
    const cellsFor = row => row.cells ? [...row.cells] : [...(row.children || [])].filter(child => child.closest?.(cellSelector) === child);
    const columnHeader = cell => (cell.tagName === "TH" && cell.getAttribute?.("scope") !== "row") || cell.getAttribute?.("role") === "columnheader";
    const row = cell.closest?.("tr, [role='row']");
    const table = row?.closest?.(tableSelector);
    const explicitHeader = cell.tagName === "TH" || /^(?:columnheader|rowheader)$/.test(cell.getAttribute?.("role") || "");
    if (!row || !table) return { isHeader: explicitHeader };
    const rows = [...(table.rows || table.querySelectorAll("tr, [role='row']"))].filter(row => row.closest?.(tableSelector) === table);
    const headerRow = candidate => {
      const cells = cellsFor(candidate);
      if (candidate.closest?.("thead") || (cells.length && cells.every(columnHeader))) return true;
      // Some bank tables use TD for every heading. Require a short, nonnumeric label row.
      if (candidate !== rows[0] || cells.length < 2 || cells.some(cell => cell.querySelector?.("input, textarea, select"))) return false;
      const texts = cells.map(cell => cell.textContent.trim());
      return texts.every(text => text && !/\d/.test(text) && text.split(/\s+/).length <= 5)
        && texts.filter(text => /\b(?:name|number|no|account|type|balance|withdrawable|currency|email|phone|mobile|address|ifsc|date|status)\b/i.test(text)).length >= 2;
    };
    if (cell.getAttribute?.("role") === "columnheader" || headerRow(row)) return { isHeader: true };
    const headings = rows.slice(0, rows.indexOf(row)).filter(headerRow).at(-1);
    if (!headings) return { isHeader: explicitHeader };
    const cells = cellsFor(row);
    const headers = cellsFor(headings);
    // ponytail: flat columns only; merged cells need a span-aware grid before matching.
    if ([...cells, ...headers].some(cell => Number(cell.colSpan || 1) > 1 || Number(cell.rowSpan || 1) > 1)) return {};
    const column = cell.getAttribute?.("aria-colindex");
    const header = column ? headers.find(header => header.getAttribute?.("aria-colindex") === column) : headers[cells.indexOf(cell)];
    return { label: header?.textContent.trim() || "" };
  }

  function labelFor(field) {
    const labels = [...(field.labels || [])].map(item => item.textContent).filter(Boolean);
    const wrapping = field.closest?.("label")?.textContent;
    const ariaLabelledBy = field.getAttribute?.("aria-labelledby")?.split(/\s+/).map(id => field.ownerDocument?.getElementById?.(id)?.textContent).filter(Boolean).join(" ");
    const aria = field.getAttribute?.("aria-label") || ariaLabelledBy;
    const tableLabel = tableContextFor(field).label;
    const siblings = [...(field.parentElement?.children || [])];
    const position = siblings.indexOf(field);
    const sibling = field.previousElementSibling || siblings.slice(0, position).at(-1) || field.parentElement?.previousElementSibling;
    const siblingText = sibling?.textContent || sibling?.innerText || "";
    const shortLabel = siblingText.trim().split(/\s+/).length <= 5 && /[:\-]\s*$/.test(siblingText.trim());
    const semanticSibling = ["LABEL", "DT", "TH"].includes(String(sibling?.tagName || "").toUpperCase())
      || (String(field.parentElement?.tagName || "").toUpperCase() === "TD" && String(sibling?.tagName || "").toUpperCase() === "TD");
    const cellSibling = field.parentElement?.parentElement?.previousElementSibling
      || field.parentElement?.parentElement?.children?.[Math.max(0, [...(field.parentElement.parentElement?.children || [])].indexOf(field.parentElement) - 1)];
    const cellText = cellSibling?.textContent || cellSibling?.innerText || "";
    const cellLabel = cellText.trim().split(/\s+/).length <= 5 && (/[:\-]\s*$/.test(cellText.trim()) || ["DT", "TH"].includes(String(cellSibling?.tagName || "").toUpperCase()));
    const adjacent = semanticSibling || shortLabel ? siblingText : cellLabel ? cellText : "";
    return [labels[0], wrapping, aria, tableLabel, field.getAttribute?.("placeholder"), adjacent]
      .find(value => value && value.trim() && value.trim().split(/\s+/).length <= 5)?.trim() || "Unlabelled field";
  }

  function isLabelingRestricted(element) {
    const blockedTags = new Set(["NAV", "HEADER", "MENU", "BUTTON", "A"]);
    for (let current = element; current; current = current.parentElement) {
      if (blockedTags.has(String(current.tagName || "").toUpperCase())) return true;
      if (["button", "menu", "menuitem"].includes(String(current.getAttribute?.("role") || "").toLowerCase())) return true;
      if (current.getAttribute?.("aria-hidden") === "true") return true;
      if (/\b(?:sr-only|visually-hidden|screen-reader-only|a-offscreen|offscreen)\b/i.test(String(current.className || ""))) return true;
      const style = current.ownerDocument?.defaultView?.getComputedStyle?.(current);
      if (style && style.position === "absolute" && (style.clip || style.clipPath || style.overflow === "hidden")
        && (parseFloat(style.width) <= 1 || parseFloat(style.height) <= 1)) return true;
    }
    return false;
  }

  function isNeverRead(field, label = labelFor(field)) {
    const type = String(field.type || "").toLowerCase();
    const autocomplete = String(field.getAttribute?.("autocomplete") || "").toLowerCase();
    const hint = `${label} ${field.name || ""} ${field.id || ""} ${autocomplete}`;
    return type === "password" || /current-password|new-password|one-time-code|cc-csc|cc-number|cc-exp|cc-name/.test(autocomplete)
      || /password|passwd|passcode|\b(?:otp|one[- ]?time (?:password|code)|verification code|cvv|cvc|security code)\b|card\s+pin|\bpin\b(?!\s*code)/i.test(hint);
  }

  function maskSecret(field) {
    if (!field.style) return;
    if (!originalTextSecurity.has(field)) originalTextSecurity.set(field, field.style.webkitTextSecurity || "");
    field.style.webkitTextSecurity = "disc";
  }
  function walkRoots(documentRef, callback) {
    const seen = new Set();
    const visit = root => {
      if (!root || seen.has(root)) return;
      seen.add(root);
      const doc = root.ownerDocument || (root.nodeType === 9 ? root : documentRef);
      const walker = doc.createTreeWalker(root, 0xFFFFFFFF, {
        acceptNode(node) {
          if (node.nodeType !== 1) return 1;
          if (SKIP.has(node.tagName) || !isVisible(node)) return 2;
          return 1;
        }
      });
      let node;
      while ((node = walker.nextNode())) {
        if (node.nodeType === 1) {
          if (SKIP.has(node.tagName) || !isVisible(node)) continue;
          if (node.shadowRoot) visit(node.shadowRoot);
          if (node.tagName === "IFRAME") {
            try { if (node.contentDocument) visit(node.contentDocument); } catch { /* Cross-origin frames need explicit site access. */ }
          }
        }
        callback(node);
      }
    };
    visit(documentRef);
  }

  function capture(documentRef) {
    const chunks = [];
    const fields = [];
    const textNodes = [];
    const ordered = [];
    const docs = new Set([documentRef]);
    walkRoots(documentRef, node => {
      if (node.ownerDocument) docs.add(node.ownerDocument);
      if (node.nodeType === 3) {
        const value = String(node.nodeValue || "").trim();
        const parent = node.parentElement;
        if (value && parent && isVisible(parent) && !SKIP.has(parent.tagName)) { chunks.push(value); textNodes.push(node); ordered.push({ type: "text", node }); }
      } else if (node.nodeType === 1 && /^(INPUT|TEXTAREA|SELECT)$/.test(node.tagName) && isVisible(node)) {
        if (node.ownerDocument) docs.add(node.ownerDocument);
        const label = labelFor(node);
        const locked = isNeverRead(node, label);
        if (locked) maskSecret(node);
        const value = locked ? "" : String(node.value ?? "").trim().slice(0, 1000);
        if (value || label !== "Unlabelled field" || locked) {
          const field = { label, value, type: node.type || node.tagName.toLowerCase(), id: node.id || "", locked, element: node };
          fields.push(field);
          if (fields.length <= MAX_FIELDS) ordered.push({ type: "field", field });
        }
      }
    });
    const text = chunks.join("\n").replace(/\n{3,}/g, "\n\n").slice(0, MAX_TEXT_LENGTH);
    return { pageTitle: documentRef.title || "Untitled page", capturedAt: new Date().toISOString(), text, fields: fields.slice(0, MAX_FIELDS), textNodes, ordered, documents: [...docs] };
  }
  function restoreMask(field) {
    if (!originalTextSecurity.has(field) || !field.style) return;
    field.style.webkitTextSecurity = originalTextSecurity.get(field);
    originalTextSecurity.delete(field);
  }
  return { capture, isVisible, labelFor, tableContextFor, isNeverRead, isLabelingRestricted, walkRoots, restoreMask };
});
