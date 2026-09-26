(function registerCaptureApi(root, factory) {
  const api = factory();
  if (typeof module === "object") module.exports = api;
  root.PrivatePilotCapture = api;
})(globalThis, function createCaptureApi() {
  const MAX_TEXT_LENGTH = 20000;
  const MAX_FIELDS = 60;

  function isVisible(element) {
    if (!element || element.hidden || element.getAttribute?.("aria-hidden") === "true") return false;
    if (element.type === "hidden") return false;
    if (typeof element.getClientRects === "function" && element.getClientRects().length === 0) return false;
    return true;
  }

  function labelFor(field, documentRef) {
    const linkedLabel = field.labels?.[0];
    if (linkedLabel?.textContent) return linkedLabel.textContent.trim();
    if (field.id && documentRef.querySelector) {
      const label = documentRef.querySelector(`label[for="${field.id}"]`);
      if (label?.textContent) return label.textContent.trim();
    }
    return field.getAttribute?.("aria-label") || field.name || field.id || "Unlabelled field";
  }

  function fieldValue(field) {
    return String(field.value ?? field.textContent ?? "").trim().slice(0, 500);
  }

  function capture(documentRef) {
    const fields = Array.from(documentRef.querySelectorAll("input, textarea, select"))
      .filter(field => isVisible(field) && field.type !== "password")
      .slice(0, MAX_FIELDS)
      .map(field => ({
        label: labelFor(field, documentRef),
        value: fieldValue(field),
        type: field.type || field.tagName?.toLowerCase() || "field",
        id: field.id || ""
      }))
      .filter(field => field.value || field.label !== "Unlabelled field");

    // ponytail: 20k text cap keeps extension messages bounded; paginate if a future production site needs more.
    return {
      pageTitle: documentRef.title || "Untitled page",
      capturedAt: new Date().toISOString(),
      text: String(documentRef.body?.innerText || "").trim().slice(0, MAX_TEXT_LENGTH),
      fields
    };
  }

  return { capture, isVisible, labelFor };
});
