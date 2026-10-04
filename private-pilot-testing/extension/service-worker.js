const CONTENT_FILES = ["capture.js", "pii.js", "guard.js", "content-script.js"];

function enableActiveTabAction() {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
}
chrome.runtime.onInstalled.addListener(enableActiveTabAction);
chrome.runtime.onStartup.addListener(enableActiveTabAction);

async function injectForTab(tabId) {
  try {
    // Reuse the running scanner so repeated reviews cannot erase its local records.
    try {
      const status = await chrome.tabs.sendMessage(tabId, { type: "privatepilot:status" }, { frameId: 0 });
      if (status?.ready) return { ok: true };
    } catch { /* The new document needs its scanner installed. */ }
    await chrome.scripting.executeScript({ target: { tabId }, files: CONTENT_FILES });
    // A restricted embedded frame must not prevent review of the accessible main page.
    try { await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: CONTENT_FILES }); }
    catch { /* Frames without site permission remain outside the scan. */ }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error?.message || "Click the PrivatePilot toolbar button to allow access to this webpage." };
  }
}

function notifyPanel(tabId, result) {
  chrome.runtime.sendMessage({
    type: result.ok ? "privatepilot:injection-ready" : "privatepilot:injection-error",
    tabId, ...(result.ok ? {} : { error: result.error })
  }).catch(() => {});
}

chrome.action.onClicked.addListener(async tab => {
  if (!tab.id) return;
  const panelOpening = chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
  try {
    const url = new URL(tab.url || "about:blank");
    if (!/^https?:$/.test(url.protocol)) return;
    // Ask only for this site's access, so later navigation can install the scanner again.
    try { await chrome.permissions.request({ origins: [`${url.origin}/*`] }); }
    catch { /* activeTab still permits this toolbar click when persistent access is declined. */ }
    notifyPanel(tab.id, await injectForTab(tab.id));
  } finally { await panelOpening; }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "privatepilot:ensure-content-script") return;
  injectForTab(message.tabId).then(sendResponse);
  return true;
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !tab.url) return;
  try {
    const url = new URL(tab.url);
    if (!/^https?:$/.test(url.protocol)) return;
    if (await chrome.permissions.contains({ origins: [`${url.origin}/*`] })) {
      notifyPanel(tabId, await injectForTab(tabId));
    }
  } catch { /* The panel reports access failures without broadening site permissions. */ }
});
