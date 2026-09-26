PrivatePilotGuard.start(document);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "privatepilot:status") {
    sendResponse({ ready: true, phase: 6, protectedValues: PrivatePilotGuard.status(document), audit: PrivatePilotGuard.auditTrail() });
    return;
  }

  if (message?.type === "privatepilot:view-context") {
    sendResponse({ ok: true, context: PrivatePilotGuard.snapshot(document) });
    return;
  }

  if (message?.type === "privatepilot:set-manual") {
    sendResponse({ ok: PrivatePilotGuard.setManual(message.id, message.isPrivate) });
    return;
  }

  if (message?.type === "privatepilot:clear-context") {
    PrivatePilotGuard.clear();
    PrivatePilotOverlay.clear();
    sendResponse({ ok: true });
    return;
  }

  if (message?.type === "privatepilot:visual-candidates") {
    const regions = PrivatePilotGuard.registerVisual(message.candidates || []);
    PrivatePilotOverlay.show(regions);
    sendResponse({ ok: true, regions });
    return;
  }

  if (message?.type === "privatepilot:apply-action") {
    sendResponse(PrivatePilotGuard.applyAction(document, message.action));
  }
});
