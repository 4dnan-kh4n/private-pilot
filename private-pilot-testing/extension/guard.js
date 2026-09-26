(function registerGuardApi(root, factory) {
  const api = factory();
  if (typeof module === "object") module.exports = api;
  root.PrivatePilotGuard = api;
})(globalThis, function createGuardApi() {
  const records = new Map();
  const elements = new Map();
  const fields = new Map();
  const overrides = new Map();
  const counters = new Map();
  const visualRecords = new Map();
  const audit = [];
  let nextId = 1;

  function valueOf(element) {
    return String("value" in element ? element.value : element.textContent || "").trim();
  }

  function recordAudit(event) {
    audit.push({ at: new Date().toISOString(), event });
    if (audit.length > 30) audit.shift();
  }

  function setValue(element, value) {
    if ("value" in element) element.value = value;
    else element.textContent = value;
  }

  function idFor(element) {
    let id = element.getAttribute("data-privatepilot-id") || element.id;
    if (!id) {
      id = `field-${nextId++}`;
      element.setAttribute("data-privatepilot-id", id);
    }
    return id;
  }

  function addCandidate(element, label) {
    if (!element) return;
    const id = idFor(element);
    elements.set(id, element);
    fields.set(id, { id, label: String(label || "Unlabelled field").trim(), type: element.type || element.tagName?.toLowerCase() || "text" });
  }

  function collect(documentRef) {
    documentRef.querySelectorAll("input, textarea, select").forEach(element => {
      if (!PrivatePilotCapture.isVisible(element)) return;
      addCandidate(element, PrivatePilotCapture.labelFor(element, documentRef));
    });
    documentRef.querySelectorAll("dt").forEach(label => addCandidate(label.nextElementSibling, label.textContent));
    addCandidate(documentRef.querySelector("#profileName"), "Full name");
    addCandidate(documentRef.querySelector("#profileAccount"), "Bank account number");
  }

  function placeholderFor(kind) {
    const count = (counters.get(kind) || 0) + 1;
    counters.set(kind, count);
    return `${kind}_${count}`;
  }

  function redact(id, detection) {
    const element = elements.get(id);
    const field = fields.get(id);
    const currentValue = valueOf(element);
    const existing = records.get(id);
    if (!currentValue || currentValue === existing?.placeholder) return;
    const placeholder = existing?.placeholder || placeholderFor(detection.kind);
    records.set(id, { ...field, original: currentValue, placeholder, kind: detection.kind, confidence: detection.confidence });
    setValue(element, placeholder);
    element.setAttribute("data-privatepilot-redacted", "true");
    recordAudit(`PII detected: ${detection.kind}`);
    recordAudit(`Value redacted: ${placeholder}`);
  }

  function restore(id) {
    const record = records.get(id);
    const element = elements.get(id);
    if (!record || !element) return;
    setValue(element, record.original);
    element.removeAttribute("data-privatepilot-redacted");
    records.delete(id);
  }

  function scan(documentRef) {
    collect(documentRef);
    for (const [id, field] of fields) {
      const override = overrides.get(id);
      if (override === false) continue;
      const detection = override === true ? { kind: "PRIVATE", confidence: "User marked" } : PrivatePilotPii.detect(field.label, valueOf(elements.get(id)), field.type);
      if (detection) redact(id, detection);
    }
  }

  function snapshot(documentRef) {
    scan(documentRef);
    const safeText = String(documentRef.body?.innerText || "").trim().slice(0, 20000);
    let originalText = safeText;
    for (const record of records.values()) originalText = originalText.replaceAll(record.placeholder, record.original);
    return {
      originalText,
      safeText,
      audit: auditTrail(),
      fields: Array.from(fields.values()).map(field => {
        const record = records.get(field.id);
        return {
          id: field.id,
          label: field.label,
          kind: record?.kind || "Not detected",
          confidence: record?.confidence || "Not detected",
          isPrivate: Boolean(record),
          safeValue: valueOf(elements.get(field.id))
        };
      })
    };
  }

  function setManual(id, isPrivate) {
    if (!elements.has(id)) return false;
    overrides.set(id, isPrivate);
    if (isPrivate) redact(id, { kind: "PRIVATE", confidence: "User marked" });
    else restore(id);
    return true;
  }

  function clear() {
    records.clear();
    overrides.clear();
    visualRecords.clear();
    recordAudit("Local context cleared");
  }

  function registerVisual(candidates) {
    return candidates.map(candidate => {
      const placeholder = placeholderFor(candidate.kind);
      visualRecords.set(placeholder, { original: candidate.raw, kind: candidate.kind });
      recordAudit(`Visual PII detected: ${candidate.kind}`);
      recordAudit(`Visual value redacted: ${placeholder}`);
      return { kind: candidate.kind, confidence: candidate.confidence, placeholder, bounds: candidate.bounds };
    });
  }

  function status(documentRef) {
    return documentRef.querySelectorAll("[data-privatepilot-redacted='true']").length;
  }

  function auditTrail() {
    return [...audit];
  }

  function resolvePlaceholders(value) {
    let resolved = String(value || "");
    for (const record of records.values()) resolved = resolved.replaceAll(record.placeholder, record.original);
    for (const [placeholder, record] of visualRecords) resolved = resolved.replaceAll(placeholder, record.original);
    return resolved;
  }

  function applyAction(documentRef, action) {
    if (action?.type !== "fill_field" || !["hireReason", "strongestSkills", "challengeSolved"].includes(action.fieldId) || typeof action.value !== "string" || action.value.length > 500) return { ok: false };
    const field = documentRef.getElementById(action.fieldId);
    if (!field) return { ok: false };
    field.value = resolvePlaceholders(action.value);
    field.dispatchEvent?.(new Event("input", { bubbles: true }));
    recordAudit(`Action applied: fill ${action.fieldId}`);
    return { ok: true };
  }

  function start(documentRef) {
    recordAudit("Scan started");
    let queued = false;
    const scanSoon = () => {
      if (queued) return;
      queued = true;
      queueMicrotask(() => { queued = false; scan(documentRef); });
    };
    const observer = new MutationObserver(scanSoon);
    observer.observe(documentRef.documentElement || documentRef, { childList: true, subtree: true, characterData: true });
    scanSoon();
    return observer;
  }

  // ponytail: records are lost on page refresh; persistence is unnecessary until user-approved actions need it.
  return { scan, start, status, snapshot, setManual, clear, registerVisual, auditTrail, resolvePlaceholders, applyAction };
});
