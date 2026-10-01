(function installPrivatePilotContent() {
  if (globalThis.__privatePilotListenerInstalled) return;
  globalThis.__privatePilotListenerInstalled = true;
  let coveredBySameOriginParent = false;
  try { coveredBySameOriginParent = window.parent !== window && Boolean(window.top.document); } catch { /* Cross-origin frames scan within their own isolated context. */ }
  if (!coveredBySameOriginParent) PrivatePilotGuard.start(document);

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "privatepilot:status") {
      sendResponse({ ready: true, protectedValues: PrivatePilotGuard.status(document), audit: PrivatePilotGuard.auditTrail() });
      return;
    }
    if (message?.type === "privatepilot:view-context") {
      try { sendResponse({ ok: true, context: PrivatePilotGuard.snapshot(document) }); }
      catch (error) { sendResponse({ ok: false, error: error?.message || "Safe context could not be verified." }); }
      return;
    }
    if (message?.type === "privatepilot:set-manual") { sendResponse({ ok: PrivatePilotGuard.setManual(message.id, message.isPrivate) }); return; }
    if (message?.type === "privatepilot:clear-context") { PrivatePilotGuard.clear(); PrivatePilotOverlay.clear(); sendResponse({ ok: true }); return; }
    if (message?.type === "privatepilot:visual-candidates") {
      const regions = PrivatePilotGuard.registerVisual(message.candidates || []); PrivatePilotOverlay.show(regions); sendResponse({ ok: true, regions }); return;
    }
    if (message?.type === "privatepilot:apply-action") sendResponse(PrivatePilotGuard.applyAction(document, message.action));
  });
})();
