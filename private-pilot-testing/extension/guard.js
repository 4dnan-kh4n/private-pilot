(function registerGuardApi(root, factory) {
  const api = factory();
  if (typeof module === "object") module.exports = api;
  root.PrivatePilotGuard = api;
})(globalThis, function createGuardApi() {
  const originals = new Map();
  const fields = new Map();
  const fieldRecords = new Map();
  const overrides = new Map();
  const valueToPlaceholder = new Map();
  const placeholderToValue = new Map();
  const counters = new Map();
  const visualRecords = new Map();
  const MAX_SAFE_CONTEXT_LENGTH = 14000;
  const audit = [];
  let nextId = 1;

  function recordAudit(event) { audit.push({ at: new Date().toISOString(), event }); if (audit.length > 40) audit.shift(); }
  function idFor(element) { let id = element.getAttribute?.("data-privatepilot-id") || element.id; if (!id) { id = `pp-field-${nextId++}`; element.setAttribute?.("data-privatepilot-id", id); } return id; }
  function placeholderFor(kind, raw) {
    const value = String(raw).trim();
    const key = `${kind}:${/^(?:MOBILE|AADHAAR|CARD|ACCOUNT|PIN)$/.test(kind) ? value.replace(/\D/g, "") : value.toLocaleLowerCase()}`;
    if (valueToPlaceholder.has(key)) return valueToPlaceholder.get(key);
    const number = (counters.get(kind) || 0) + 1; counters.set(kind, number);
    const placeholder = `${kind}_${number}`; valueToPlaceholder.set(key, placeholder); placeholderToValue.set(placeholder, String(raw));
    return placeholder;
  }
  function saveText(node, raw) {
    if (!originals.has(node)) originals.set(node, raw);
  }
  function redactedText(raw) { return PrivatePilotPii.redactText(raw, (kind, value) => placeholderFor(kind, value)); }
  function collect(documentRef) {
    const snapshot = PrivatePilotCapture.capture(documentRef);
    function processField(field) {
      const element = field.element;
      if (!element) return;
      const id = idFor(element); const label = PrivatePilotCapture.labelFor(element);
      fields.set(id, { id, label, type: element.type || element.tagName?.toLowerCase() || "text", element });
      const priorRecord = fieldRecords.get(id);
      if (priorRecord?.locked) return;
      if (priorRecord && String(element.value || "") === priorRecord.placeholder) return;
      if (field.locked) {
        const autocomplete = String(element.getAttribute?.("autocomplete") || "").toLowerCase();
        const kind = /one-time-code|otp/.test(autocomplete) ? "OTP" : PrivatePilotPii.detect(label, "", field.type)?.kind || (/cc-|cvv|cvc/.test(`${autocomplete} ${label}`) ? "PASSWORD" : "PASSWORD");
        fieldRecords.set(id, { kind, locked: true });
        return;
      }
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
      const index = snapshot.textNodes.indexOf(node);
      const raw = node.nodeValue || "";
      if (originals.has(node)) return;
      let safe = redactedText(raw);
      if (safe === raw) {
        const nearby = snapshot.textNodes.slice(Math.max(0, index - 4), index).map(item => item.nodeValue || "").join(" ").slice(-140);
        const parent = node.parentElement;
        const siblingLabel = parent?.previousElementSibling?.textContent || parent?.previousElementSibling?.innerText
          || parent?.parentElement?.previousElementSibling?.textContent
          || parent?.parentElement?.children?.[Math.max(0, [...(parent.parentElement.children || [])].indexOf(parent) - 1)]?.textContent;
        const label = `${siblingLabel || ""} ${nearby}`.match(/(?:password|passcode|otp|one[- ]?time (?:password|code)|verification code|cvv|cvc|card\s+pin|pin\s+(?:number|code)|security code|account holder|customer name|full name|first name|last name|your name|\bname\b|account(?: number| no\.?| #|\s+a\/c)?|aadhaar|aadhar|uid|pan(?: number)?|ifsc|upi(?: id)?|vpa|mobile|phone|contact|cell|e-?mail|mail\s*id|pin ?code|postal code|zip code|date of birth|\bdob\b|address|street address|card\s*(?:number|no\b))\s*[:\-]?\s*$/i)?.[0];
        const detection = label && PrivatePilotPii.detect(label, raw);
        if (detection && raw.trim()) safe = raw.replace(raw.trim(), detection.neverRead ? "[HIDDEN]" : placeholderFor(detection.kind, raw.trim()));
      }
      if (safe !== raw) { saveText(node, raw); node.nodeValue = safe; }
    }
    const order = snapshot.ordered || [
      ...snapshot.fields.map(field => ({ type: "field", field })),
      ...snapshot.textNodes.map(node => ({ type: "text", node }))
    ];
    for (const item of order) {
      if (item.type === "field") processField(item.field);
      else processText(item.node);
    }
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
    const captured = collect(documentRef);
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
  function setManual(id, isPrivate) {
    const field = fields.get(id); if (!field) return false;
    overrides.set(id, isPrivate);
    if (!isPrivate) {
      const record = fieldRecords.get(id);
      if (record && !record.locked) { field.element.value = record.original; field.element.removeAttribute?.("data-privatepilot-redacted"); }
      fieldRecords.delete(id); return true;
    }
    const raw = String(field.element.value || "");
    if (!raw) return false;
    const placeholder = placeholderFor("PRIVATE", raw); fieldRecords.set(id, { original: raw, placeholder, kind: "PRIVATE" }); field.element.value = placeholder;
    return true;
  }
  function clear() {
    for (const [node, raw] of originals) if (node) node.nodeValue = raw;
    for (const [id, record] of fieldRecords) { const field = fields.get(id); if (field && record.original) field.element.value = record.original; if (field) PrivatePilotCapture.restoreMask(field.element); field?.element.removeAttribute?.("data-privatepilot-redacted"); }
    originals.clear(); fields.clear(); fieldRecords.clear(); overrides.clear(); valueToPlaceholder.clear(); placeholderToValue.clear(); counters.clear(); visualRecords.clear(); recordAudit("Local context cleared");
  }
  function registerVisual(candidates) {
    return candidates.map(candidate => { const placeholder = placeholderFor(candidate.kind, candidate.raw); visualRecords.set(placeholder, { original: candidate.raw, kind: candidate.kind }); recordAudit(`Visual PII detected: ${candidate.kind}`); return { kind: candidate.kind, confidence: candidate.confidence, placeholder, bounds: candidate.bounds }; });
  }
  function status(documentRef) { return documentRef.querySelectorAll?.("[data-privatepilot-redacted='true']").length || fieldRecords.size + originals.size; }
  function auditTrail() { return [...audit]; }
  function resolvePlaceholders(value) { let resolved = String(value || ""); for (const [placeholder, original] of placeholderToValue) resolved = resolved.replaceAll(placeholder, original); for (const [placeholder, record] of visualRecords) resolved = resolved.replaceAll(placeholder, record.original); return resolved; }
  function applyAction(documentRef, action) {
    if (action?.type !== "fill_field" || !["hireReason", "strongestSkills", "challengeSolved"].includes(action.fieldId) || typeof action.value !== "string" || action.value.length > 500) return { ok: false };
    const field = documentRef.getElementById?.(action.fieldId); if (!field) return { ok: false };
    field.value = resolvePlaceholders(action.value); field.dispatchEvent?.(new Event("input", { bubbles: true })); recordAudit("Approved action applied"); return { ok: true };
  }
  function start(documentRef) {
    recordAudit("Local page scan started");
    let timer;
    const observers = new Map();
    const rescan = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const result = scan(documentRef);
        for (const doc of result.documents || []) if (!observers.has(doc)) observe(doc);
      }, 150);
    };
    const observe = doc => {
      const observer = new MutationObserver(rescan);
      observer.observe(doc.documentElement || doc, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["value", "placeholder", "aria-label", "autocomplete"] });
      doc.addEventListener?.("input", rescan, true);
      doc.addEventListener?.("change", rescan, true);
      observers.set(doc, observer);
    };
    const result = scan(documentRef);
    for (const doc of result.documents || [documentRef]) observe(doc);
    return { disconnect() { clearTimeout(timer); for (const observer of observers.values()) observer.disconnect(); observers.clear(); } };
  }
  return { scan, start, status, snapshot, setManual, clear, registerVisual, auditTrail, resolvePlaceholders, applyAction };
});
