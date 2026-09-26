function enableActiveTabAction() {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
}

chrome.runtime.onInstalled.addListener(enableActiveTabAction);
chrome.runtime.onStartup.addListener(enableActiveTabAction);

chrome.action.onClicked.addListener(tab => {
  if (tab.id) chrome.sidePanel.open({ tabId: tab.id });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "privatepilot:ensure-content-script") {
    chrome.scripting.executeScript({
      target: { tabId: message.tabId },
      files: ["capture.js", "pii.js", "guard.js", "visual-overlay.js", "content-script.js"]
    }).then(() => sendResponse({ ok: true }))
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type !== "privatepilot:capture-visible") return;
  chrome.tabs.captureVisibleTab(message.windowId, { format: "png" })
    .then(dataUrl => sendResponse({ ok: true, dataUrl }))
    .catch(error => sendResponse({ ok: false, error: error.message }));
  return true;
});
