const CONTENT_FILES = ["capture.js", "pii.js", "guard.js", "visual-overlay.js", "content-script.js"];

function enableActiveTabAction() {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
}
chrome.runtime.onInstalled.addListener(enableActiveTabAction);
chrome.runtime.onStartup.addListener(enableActiveTabAction);

async function injectForTab(tabId) {
  try {
    const target = { tabId, allFrames: true };
    await chrome.scripting.executeScript({ target, func: () => new Promise(resolve => {
      const ready = () => typeof requestIdleCallback === "function" ? requestIdleCallback(() => resolve(), { timeout: 1000 }) : setTimeout(resolve, 0);
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready, { once: true });
      else ready();
    }) });
    await chrome.scripting.executeScript({
      target,
      files: CONTENT_FILES
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error?.message || "PrivatePilot cannot access this page. Try an ordinary HTTP or HTTPS webpage." };
  }
}

chrome.action.onClicked.addListener(async tab => {
  if (!tab.id) return;
  const panelOpening = chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
  const url = new URL(tab.url || "about:blank");
  if (!/^https?:$/.test(url.protocol)) {
    await panelOpening;
    return;
  }
  // activeTab enables click-to-inject without permanent all-sites host access. Optional access
  // to the current origin allows the user to keep protection available on later navigations.
  let siteAccess = false;
  try { siteAccess = await chrome.permissions.request({ origins: [`${url.origin}/*`] }); } catch { /* activeTab access can still permit this click. */ }
  const result = await injectForTab(tab.id);
  await panelOpening;
  if (!result.ok) chrome.runtime.sendMessage({ type: "privatepilot:injection-error", tabId: tab.id, error: result.error }).catch(() => {});
  else if (siteAccess) chrome.runtime.sendMessage({ type: "privatepilot:injection-ready", tabId: tab.id }).catch(() => {});
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "privatepilot:ensure-content-script") {
    injectForTab(message.tabId).then(sendResponse);
    return true;
  }
  if (message?.type !== "privatepilot:capture-visible") return;
  chrome.tabs.captureVisibleTab(message.windowId, { format: "png" })
    .then(dataUrl => sendResponse({ ok: true, dataUrl }))
    .catch(error => sendResponse({ ok: false, error: error?.message || "Visible page capture failed." }));
  return true;
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !tab.url) return;
  try {
    const url = new URL(tab.url);
    if (!/^https?:$/.test(url.protocol)) return;
    const hasSitePermission = await chrome.permissions.contains({ origins: [`${url.origin}/*`] });
    if (hasSitePermission) await injectForTab(tabId);
  } catch { /* The side panel will explain access failures when the user opens it. */ }
});
