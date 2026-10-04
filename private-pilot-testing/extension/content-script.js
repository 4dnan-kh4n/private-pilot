(function installPrivatePilotContent() {
  if (globalThis.__privatePilotListenerInstalled) return;
  globalThis.__privatePilotListenerInstalled = true;
  let coveredBySameOriginParent = false;
  try { coveredBySameOriginParent = window.parent !== window && Boolean(window.top.document); }
  catch { /* Cross-origin frames scan within their own isolated context. */ }
  if (!coveredBySameOriginParent) PrivatePilotGuard.start(document, () => {
    chrome.runtime.sendMessage({ type: "privatepilot:page-updated" }).catch(() => {});
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "privatepilot:status") {
      sendResponse({ ready: true, protectedValues: PrivatePilotGuard.status(document) });
      return;
    }
    if (message?.type === "privatepilot:review") {
      try { sendResponse({ ok: true, review: PrivatePilotGuard.review(document) }); }
      catch (error) { sendResponse({ ok: false, error: error?.message || "Could not review this page." }); }
      return;
    }
    if (message?.type === "privatepilot:set-manual") {
      sendResponse({ ok: PrivatePilotGuard.setManual(message.id, message.isPrivate) });
    }
  });
})();
