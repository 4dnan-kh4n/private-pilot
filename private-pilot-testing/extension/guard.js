(function registerGuardApi(root, factory) {
  if (root.PrivatePilotGuard) return;
  const api = factory();
  if (typeof module === "object") module.exports = api;
  root.PrivatePilotGuard = api;
})(globalThis, function createGuardApi() {
  const originals = new Map();
  const redactedNodes = new Map();
  const textRecords = new Map();
  const fields = new Map();
  const fieldRecords = new Map();
  const overrides = new Map();
  const valueToPlaceholder = new Map();
  const placeholderToValue = new Map();
  const counters = new Map();
  const personParts = new Map();
  const personNames = new Map();
  const visualRecords = new Map();
  const MAX_SAFE_CONTEXT_LENGTH = 14000;
  const audit = [];
  let nextId = 1;

  function recordAudit(event) { audit.push({ at: new Date().toISOString(), event }); if (audit.length > 40) audit.shift(); }
  function idFor(element) { let id = element.getAttribute?.("data-privatepilot-id") || element.id; if (!id) { id = `pp-field-${nextId++}`; element.setAttribute?.("data-privatepilot-id", id); } return id; }
  function placeholderFor(kind, raw) {
    const value = String(raw).trim();
    const key = `${kind}:${/^(?:MOBILE|AADHAAR|CARD|ACCOUNT|PIN)$/.test(kind) ? value.replace(/\D/g, "") : value.toLocaleLowerCase()}`;
    let placeholder = valueToPlaceholder.get(key);
    if (!placeholder && kind === "PERSON") {
      const existing = new Set(value.split(/\s+/).map(part => personParts.get(part.toLocaleLowerCase())).filter(Boolean));
      if (existing.size === 1) placeholder = [...existing][0];
    }
    if (!placeholder) {
      const number = (counters.get(kind) || 0) + 1; counters.set(kind, number);
      placeholder = `${kind}_${number}`;
    }
    valueToPlaceholder.set(key, placeholder);
    if (kind === "PERSON") {
      personNames.set(value.toLocaleLowerCase(), placeholder);
      for (const part of value.match(/[\p{L}][\p{L}'’-]*/gu) || []) {
        if (part.length >= 3 && !PrivatePilotPii.isCommonNamePart(part)) personParts.set(part.toLocaleLowerCase(), placeholder);
      }
    }
    placeholderToValue.set(placeholder, value);
    return placeholder;
  }
  function saveText(node, raw, safe) {
    originals.set(node, raw);
    redactedNodes.set(node, safe);
  }
  function redactedText(raw, allowLabels = true) {
    return PrivatePilotPii.redactText(raw, (kind, value) => placeholderFor(kind, value), { allowLabels, personParts, personNames });
  }
  function collect(documentRef, includeContext = false) {
    const snapshot = PrivatePilotCapture.capture(documentRef);
    const currentNodes = new Set(snapshot.textNodes);
    const currentFields = new Set(snapshot.fields.map(field => field.element));
    for (const [node, record] of textRecords) if (!currentNodes.has(node)) {
      overrides.delete(record.id); textRecords.delete(node); originals.delete(node); redactedNodes.delete(node);
    }
    for (const [id, field] of fields) if (!currentFields.has(field.element)) {
      fields.delete(id); fieldRecords.delete(id); overrides.delete(id);
    }
    function processField(field) {
      const element = field.element;
      if (!element) return;
      const id = idFor(element); const label = PrivatePilotCapture.labelFor(element);
      if (field.authentication) {
        const record = fieldRecords.get(id);
        if (record?.original && element.value === record.placeholder) element.value = record.original;
        element.removeAttribute?.("data-privatepilot-redacted");
        fields.delete(id); fieldRecords.delete(id); overrides.delete(id);
        return;
      }
      fields.set(id, { id, label, type: element.type || element.tagName?.toLowerCase() || "text", element });
      const priorRecord = fieldRecords.get(id);
      if (field.locked) {
        const autocomplete = String(element.getAttribute?.("autocomplete") || "").toLowerCase();
        const kind = /one-time-code|otp/.test(autocomplete) ? "OTP" : PrivatePilotPii.detect(label, "", field.type)?.kind || (/cc-|cvv|cvc/.test(`${autocomplete} ${label}`) ? "PASSWORD" : "PASSWORD");
        fieldRecords.set(id, { kind, locked: true });
        return;
      }
      if (priorRecord?.locked) fieldRecords.delete(id);
      else if (priorRecord && String(element.value || "") === priorRecord.placeholder) return;
      if (overrides.get(id) === false) return;
      const detection = overrides.get(id) === true ? { kind: "PRIVATE", confidence: "User marked" } : PrivatePilotPii.detect(label, field.value, field.type);
      if (detection && field.value) {
        const placeholder = placeholderFor(detection.kind, field.value);
        fieldRecords.set(id, { original: field.value, placeholder, kind: detection.kind });
        element.value = placeholder;
        element.setAttribute?.("data-privatepilot-redacted", "true");
      } else if (priorRecord && !priorRecord.locked) {
        fieldRecords.delete(id);
        element.removeAttribute?.("data-privatepilot-redacted");
      }
    }
    function processText(node) {
      const raw = node.nodeValue || "";
      const previousRecord = textRecords.get(node);
      if (previousRecord && overrides.get(previousRecord.id) === false && raw === previousRecord.original) return;
      const table = PrivatePilotCapture.tableContextFor(node.parentElement);
      if (table.isHeader) return;
      if (originals.has(node) && raw === redactedNodes.get(node)) return;
      // A site can reuse a text node when switching accounts or refreshing a balance.
      originals.delete(node); redactedNodes.delete(node); textRecords.delete(node);
      if (previousRecord) overrides.delete(previousRecord.id);
      const parent = node.parentElement;
      const sibling = parent?.previousElementSibling;
      const siblingLabel = sibling?.querySelector?.("input, textarea, select") ? "" : sibling?.textContent || sibling?.innerText || "";
      let preceding = node.previousSibling;
      while (preceding?.nodeType === 3 && !String(preceding.nodeValue || "").trim()) preceding = preceding.previousSibling;
      const precedingLabel = preceding?.textContent || preceding?.nodeValue || "";
      const account = [precedingLabel, siblingLabel].some(label => label && PrivatePilotPii.detect(label, raw)?.kind === "ACCOUNT");
      const tableDetection = table.label ? PrivatePilotPii.detect(table.label, raw) : null;
      const restricted = PrivatePilotCapture.isLabelingRestricted(node.parentElement);
      let safe = tableDetection ? raw.replace(raw.trim(), tableDetection.neverRead ? "[HIDDEN]" : placeholderFor(tableDetection.kind, raw.trim()))
        : account ? raw.replace(raw.trim(), placeholderFor("ACCOUNT", raw.trim())) : redactedText(raw, !restricted);
      if (safe === raw && !table.label) {
        const semanticLabel = ["LABEL", "DT", "TH"].includes(String(sibling?.tagName || "").toUpperCase())
          || (String(parent?.tagName || "").toUpperCase() === "TD" && String(sibling?.tagName || "").toUpperCase() === "TD");
        const shortLabel = siblingLabel.trim().split(/\s+/).filter(Boolean).length <= 5;
        const delimitedLabel = /[:\-]\s*$/.test(siblingLabel.trim());
        const detection = !restricted && shortLabel && (semanticLabel || delimitedLabel) ? PrivatePilotPii.detect(siblingLabel, raw) : null;
        if (detection && raw.trim()) safe = raw.replace(raw.trim(), detection.neverRead ? "[HIDDEN]" : placeholderFor(detection.kind, raw.trim()));
      }
      if (safe !== raw) {
        saveText(node, raw, safe);
        const tokens = safe.match(/\b[A-Z]+_\d+\b/g) || [];
        const kind = [...new Set(tokens.map(token => token.replace(/_\d+$/, "")))].join(", ") || "PRIVATE";
        textRecords.set(node, { id: previousRecord?.id || `pp-text-${nextId++}`, label: table.label || (account ? siblingLabel || precedingLabel : kind), original: raw, placeholder: safe, kind });
        node.nodeValue = safe;
      }
    }
    const order = snapshot.ordered || [
      ...snapshot.fields.map(field => ({ type: "field", field })),
      ...snapshot.textNodes.map(node => ({ type: "text", node }))
    ];
    for (const item of order) {
      if (item.type === "field") processField(item.field);
      else processText(item.node);
    }
    // Names found later in document order also protect earlier greetings and other visible mentions.
    for (const node of snapshot.textNodes) processText(node);
    if (!includeContext) return snapshot;
    // Rebuild safe page text after DOM mutation; never send local original-value fields.
    const after = PrivatePilotCapture.capture(documentRef);
    const safeFields = after.fields.map(field => {
      const record = fieldRecords.get(idFor(field.element));
      return `${field.label}: ${record?.locked ? "[HIDDEN]" : record?.placeholder || field.value}`;
    });
    snapshot.text = redactedText([after.text, ...safeFields].filter(Boolean).join("\n")).slice(0, MAX_SAFE_CONTEXT_LENGTH);
    snapshot.originalFields = snapshot.fields.map(field => {
      const record = fieldRecords.get(idFor(field.element));
      return `${field.label}: ${record?.original || field.value || record?.placeholder || ""}`;
    }).filter(Boolean);
    return snapshot;
  }
  function scan(documentRef) { return collect(documentRef); }
  function snapshot(documentRef) {
    const captured = collect(documentRef, true);
    const originalText = [captured.textNodes.map(node => originals.get(node) ?? node.nodeValue ?? "").join("\n"), ...(captured.originalFields || [])].filter(Boolean).join("\n").slice(0, 50000);
    const safeText = captured.text.slice(0, 50000);
    for (const raw of placeholderToValue.values()) {
      if (raw.length >= 3 && safeText.includes(raw)) throw new Error("PrivatePilot blocked context containing a stored private value.");
    }
    return {
      originalText,
      safeText,
      privateValues: Array.from(placeholderToValue.values()).filter(value => !String(value).startsWith("locked:")),
      audit: auditTrail(),
      fields: Array.from(fields.values()).map(field => {
        const record = fieldRecords.get(field.id);
        return { id: field.id, label: field.label, kind: record?.kind || PrivatePilotPii.detect(field.label, "", field.type)?.kind || "Not detected", confidence: record ? "High" : "Not detected", isPrivate: Boolean(record), safeValue: record?.locked ? "[HIDDEN]" : record?.placeholder || "" };
      })
    };
  }
  function review(documentRef) {
    collect(documentRef);
    const detected = [...textRecords.values()].map(record => ({
      id: record.id, label: record.label, kind: record.kind, value: record.original,
      safeValue: record.placeholder, isPrivate: overrides.get(record.id) !== false, canUnmark: true
    }));
    for (const field of fields.values()) {
      const record = fieldRecords.get(field.id);
      if (!record && !overrides.has(field.id)) continue;
      detected.push({ id: field.id, label: field.label, kind: record?.kind || "PRIVATE",
        value: record?.locked ? "Never read" : record?.original || String(field.element.value || ""),
        safeValue: record?.locked ? "[HIDDEN]" : record?.placeholder || "",
        isPrivate: Boolean(record), canUnmark: !record?.locked });
    }
    return { fields: detected, protectedValues: status(documentRef), audit: auditTrail() };
  }
  function setManual(id, isPrivate) {
    const textEntry = [...textRecords].find(([, record]) => record.id === id);
    if (textEntry) {
      const [node, record] = textEntry;
      const expected = overrides.get(id) === false ? record.original : record.placeholder;
      if (node.nodeValue !== expected) return false;
      overrides.set(id, isPrivate);
      node.nodeValue = isPrivate ? record.placeholder : record.original;
      recordAudit(isPrivate ? "Detail marked private" : "Detail unmarked");
      return true;
    }
    const field = fields.get(id); if (!field) return false;
    if (fieldRecords.get(id)?.locked || PrivatePilotCapture.isAuthenticationField(field.element)) return false;
    overrides.set(id, isPrivate);
    if (!isPrivate) {
      const record = fieldRecords.get(id);
      if (record && !record.locked) { field.element.value = record.original; field.element.removeAttribute?.("data-privatepilot-redacted"); }
      fieldRecords.delete(id); return true;
    }
    if (fieldRecords.has(id)) return true;
    const raw = String(field.element.value || "");
    if (!raw) return false;
    const kind = PrivatePilotPii.detect(field.label, raw, field.type)?.kind || "PRIVATE";
    const placeholder = placeholderFor(kind, raw); fieldRecords.set(id, { original: raw, placeholder, kind }); field.element.value = placeholder;
    field.element.setAttribute?.("data-privatepilot-redacted", "true");
    return true;
  }
  function clear() {
    for (const [node, raw] of originals) if (node?.nodeValue === redactedNodes.get(node)) node.nodeValue = raw;
    for (const [id, record] of fieldRecords) { const field = fields.get(id); if (field && record.original) field.element.value = record.original; if (field) PrivatePilotCapture.restoreMask(field.element); field?.element.removeAttribute?.("data-privatepilot-redacted"); }
    originals.clear(); redactedNodes.clear(); textRecords.clear(); fields.clear(); fieldRecords.clear(); overrides.clear(); valueToPlaceholder.clear(); placeholderToValue.clear(); counters.clear(); personParts.clear(); personNames.clear(); visualRecords.clear(); recordAudit("Local context cleared");
  }
  function registerVisual(candidates) {
    return candidates.map(candidate => { const placeholder = placeholderFor(candidate.kind, candidate.raw); visualRecords.set(placeholder, { original: candidate.raw, kind: candidate.kind }); recordAudit(`Visual PII detected: ${candidate.kind}`); return { kind: candidate.kind, confidence: candidate.confidence, placeholder, bounds: candidate.bounds }; });
  }
  function status() { return fieldRecords.size + [...textRecords.values()].filter(record => overrides.get(record.id) !== false).length; }
  function auditTrail() { return [...audit]; }
  function start(documentRef, onChange = () => {}) {
    recordAudit("Local page scan started");
    let timer;
    const observers = new Map();
    const rescan = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const result = scan(documentRef);
        for (const doc of result.documents || []) if (!observers.has(doc)) observe(doc);
        onChange();
      }, 150);
    };
    const observe = doc => {
      const observer = new MutationObserver(rescan);
      observer.observe(doc.documentElement || doc, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["value", "type", "name", "action", "role", "placeholder", "aria-label", "autocomplete"] });
      doc.addEventListener?.("input", rescan, true);
      doc.addEventListener?.("change", rescan, true);
      observers.set(doc, observer);
    };
    const result = scan(documentRef);
    for (const doc of result.documents || [documentRef]) observe(doc);
    return { disconnect() { clearTimeout(timer); for (const observer of observers.values()) observer.disconnect(); observers.clear(); } };
  }
  return { scan, start, status, snapshot, review, setManual, clear, registerVisual, auditTrail };
});
