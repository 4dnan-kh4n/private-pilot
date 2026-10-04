const siteMessage = document.querySelector("#siteMessage");
const status = document.querySelector("#status");
const analyseButton = document.querySelector("#analyseButton");
const captureView = document.querySelector("#captureView");
const fieldsList = document.querySelector("#fieldsList");
const emptyMessage = document.querySelector("#emptyMessage");
let activeTab;
let revision = 0;
let requestNumber = 0;
let refreshTimer;

function supported(tab) {
  try { return /^https?:$/.test(new URL(tab?.url || "").protocol); }
  catch { return false; }
}

function clearReview() {
  captureView.hidden = true;
  fieldsList.replaceChildren();
}

async function sendToPage(tab, message) {
  try { return await chrome.tabs.sendMessage(tab.id, message, { frameId: 0 }); }
  catch (error) {
    const recovered = await chrome.runtime.sendMessage({ type: "privatepilot:ensure-content-script", tabId: tab.id });
    if (!recovered?.ok) throw new Error(recovered?.error || error?.message || "Click the PrivatePilot toolbar button to allow access to this site.");
    return chrome.tabs.sendMessage(tab.id, message, { frameId: 0 });
  }
}

function showReview(result) {
  const kinds = { PERSON: "Name", MOBILE: "Phone number", EMAIL: "Email", ACCOUNT: "Account number",
    AADHAAR: "Aadhaar", PAN: "PAN", ADDRESS: "Address", PIN: "PIN code", DOB: "Date of birth",
    CARD: "Card number", UPI: "UPI ID", IFSC: "IFSC", PASSWORD: "Password", OTP: "One-time code", PRIVATE: "Private detail" };
  const tab = activeTab;
  const pageRevision = revision;
  fieldsList.replaceChildren(...result.fields.map(field => {
    const row = document.createElement("div");
    const label = document.createElement("dt");
    const value = document.createElement("dd");
    const button = document.createElement("button");
    label.textContent = kinds[field.kind] || field.label || "Private detail";
    value.textContent = field.value ? field.value.slice(0, 300) : (field.isPrivate ? "Hidden on the page" : "Visible on the page");
    button.className = "field-button";
    button.type = "button";
    button.textContent = field.canUnmark === false ? "Always hidden" : field.isPrivate ? "Unmark" : "Mark private";
    button.disabled = field.canUnmark === false;
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        const response = await sendToPage(tab, { type: "privatepilot:set-manual", id: field.id, isPrivate: !field.isPrivate });
        if (pageRevision !== revision) return;
        if (!response?.ok) throw new Error("This detail changed. Review the page again.");
        await refreshContext();
      } catch (error) {
        if (pageRevision === revision) {
          status.textContent = "Could not update this detail";
          siteMessage.textContent = error.message;
          button.disabled = false;
        }
      }
    });
    row.append(label, value, button);
    return row;
  }));
  emptyMessage.hidden = result.fields.length !== 0;
  captureView.hidden = false;
  status.textContent = "Local review ready";
  const count = result.protectedValues || 0;
  siteMessage.textContent = `${count} detected detail${count === 1 ? "" : "s"} hidden on this page.`;
}

async function refreshContext() {
  if (!activeTab?.id || !supported(activeTab)) return;
  const tab = activeTab;
  const pageRevision = revision;
  const request = ++requestNumber;
  analyseButton.disabled = true;
  analyseButton.textContent = "Checking page…";
  try {
    const response = await sendToPage(tab, { type: "privatepilot:review" });
    if (pageRevision !== revision || request !== requestNumber) return;
    if (!response?.ok || !response.review) throw new Error(response?.error || "The page did not return its local analysis. Reload PrivatePilot and this webpage.");
    showReview(response.review);
  } catch (error) {
    if (pageRevision !== revision || request !== requestNumber) return;
    clearReview();
    status.textContent = "Page access unavailable";
    siteMessage.textContent = error.message || "Click the PrivatePilot toolbar button to allow access to this site.";
  } finally {
    if (pageRevision === revision && request === requestNumber) {
      analyseButton.disabled = !supported(activeTab);
      analyseButton.textContent = "Review local analysis";
    }
  }
}

function scheduleReview() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => { refreshContext(); }, 200);
}

function selectTab(tab, loading = false) {
  revision++;
  requestNumber++;
  clearTimeout(refreshTimer);
  activeTab = tab;
  clearReview();
  analyseButton.textContent = "Review local analysis";
  analyseButton.disabled = !supported(tab) || loading;
  status.textContent = loading ? "Page loading" : supported(tab) ? "Checking this page" : "Page unavailable";
  siteMessage.textContent = supported(tab)
    ? "PrivatePilot checks this page locally. Click its toolbar button if this site needs permission."
    : "Browser-internal pages, the Chrome Web Store and other protected pages cannot be accessed.";
  if (supported(tab) && !loading) scheduleReview();
}

chrome.tabs.query({ active: true, lastFocusedWindow: true }, ([tab]) => selectTab(tab));
chrome.tabs.onActivated.addListener(({ tabId, windowId }) => {
  if (activeTab?.windowId && windowId !== activeTab.windowId) return;
  chrome.tabs.get(tabId, tab => selectTab(tab));
});
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tabId !== activeTab?.id) return;
  if (changeInfo.status === "loading" || changeInfo.url) selectTab({ ...activeTab, ...tab }, changeInfo.status === "loading");
  if (changeInfo.status === "complete") {
    selectTab({ ...activeTab, ...tab });
  }
});
chrome.runtime.onMessage.addListener((message, sender) => {
  const tabId = sender.tab?.id ?? message?.tabId;
  if (tabId !== activeTab?.id) return;
  if (message?.type === "privatepilot:page-updated" || message?.type === "privatepilot:injection-ready") scheduleReview();
  if (message?.type === "privatepilot:injection-error") {
    status.textContent = "Page access unavailable";
    siteMessage.textContent = message.error;
  }
});
analyseButton.addEventListener("click", refreshContext);
