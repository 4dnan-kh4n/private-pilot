const siteMessage = document.querySelector("#siteMessage");
const status = document.querySelector("#status");
const analyseButton = document.querySelector("#analyseButton");
const captureView = document.querySelector("#captureView");
const contextPreview = document.querySelector("#contextPreview");
const originalPreview = document.querySelector("#originalPreview");
const fieldsList = document.querySelector("#fieldsList");
const visualButton = document.querySelector("#visualButton");
const visualStatus = document.querySelector("#visualStatus");
const assistantQuestion = document.querySelector("#assistantQuestion");
const askButton = document.querySelector("#askButton");
const safePayload = document.querySelector("#safePayload");
const assistantReply = document.querySelector("#assistantReply");
const actionControls = document.querySelector("#actionControls");
const approveAction = document.querySelector("#approveAction");
const rejectAction = document.querySelector("#rejectAction");
const auditList = document.querySelector("#auditList");
let activeTab;
let latestContext;
let pendingAction;
let auditEntries = [];

function renderAudit(entries) {
  auditEntries = entries;
  auditList.replaceChildren(...entries.slice(-12).reverse().map(entry => {
    const item = document.createElement("li");
    item.textContent = `${new Date(entry.at).toLocaleTimeString()} — ${entry.event}`;
    return item;
  }));
}

function addAudit(event) {
  auditEntries.push({ at: new Date().toISOString(), event });
  renderAudit(auditEntries);
}

async function sendToPage(message) {
  try {
    return await chrome.tabs.sendMessage(activeTab.id, message);
  } catch (error) {
    const recovered = await chrome.runtime.sendMessage({ type: "privatepilot:ensure-content-script", tabId: activeTab.id });
    if (!recovered?.ok) throw error;
    return chrome.tabs.sendMessage(activeTab.id, message);
  }
}

function clearCapture() {
  captureView.hidden = true;
  fieldsList.replaceChildren();
  originalPreview.textContent = "";
  contextPreview.textContent = "";
  status.textContent = "Protection active";
}

async function refreshContext() {
  const response = await sendToPage({ type: "privatepilot:view-context" });
  if (!response?.ok) throw new Error("The page did not return local context.");
  showCapture(response.context);
}

function showCapture(context) {
  latestContext = context;
  renderAudit(context.audit || auditEntries);
  fieldsList.replaceChildren(...context.fields.map(field => {
    const row = document.createElement("div");
    const label = document.createElement("dt");
    const value = document.createElement("dd");
    const button = document.createElement("button");
    label.textContent = field.label;
    value.textContent = `${field.kind} · ${field.confidence}`;
    button.className = "field-button";
    button.type = "button";
    button.textContent = field.isPrivate ? "Unmark" : "Mark private";
    button.addEventListener("click", async () => {
      await sendToPage({ type: "privatepilot:set-manual", id: field.id, isPrivate: !field.isPrivate });
      await refreshContext();
    });
    row.append(label, value, button);
    return row;
  }));
  originalPreview.textContent = context.originalText || "No visible text was found.";
  contextPreview.textContent = context.safeText || "No visible text was found.";
  captureView.hidden = false;
  askButton.disabled = false;
  status.textContent = "Local redaction review ready";
}

chrome.tabs.query({ active: true, lastFocusedWindow: true }, ([tab]) => {
  activeTab = tab;
  try {
    const protocol = new URL(tab?.url || "").protocol;
    const supported = protocol === "http:" || protocol === "https:";
    analyseButton.disabled = !supported;
    visualButton.disabled = !supported;
    siteMessage.textContent = supported ? "Checking local protection status…" : "PrivatePilot cannot access browser-internal or extension pages.";
    if (!supported || !activeTab?.id) return;
    sendToPage({ type: "privatepilot:status" }).then(result => {
      status.textContent = "Protection active";
      siteMessage.textContent = `${result.protectedValues} supported sensitive value${result.protectedValues === 1 ? "" : "s"} protected locally.`;
      renderAudit(result.audit || []);
    }).catch(() => {
      status.textContent = "Reload this webpage";
      siteMessage.textContent = "Reload this webpage after installing or updating PrivatePilot.";
    });
  } catch {
    siteMessage.textContent = "PrivatePilot cannot access browser-internal or extension pages.";
  }
});

analyseButton.addEventListener("click", async () => {
  if (!activeTab?.id) return;
  analyseButton.disabled = true;
  analyseButton.textContent = "Loading…";
  try {
    await refreshContext();
  } catch (error) {
    status.textContent = "Analysis unavailable";
    siteMessage.textContent = error.message || "Reload this webpage and try again.";
  } finally {
    analyseButton.disabled = false;
    analyseButton.textContent = "Review Local Context";
  }
});

document.querySelector("#clearButton").addEventListener("click", async () => {
  if (activeTab?.id) await sendToPage({ type: "privatepilot:clear-context" });
  clearCapture();
  latestContext = undefined;
  askButton.disabled = true;
  safePayload.textContent = "Review local context first.";
  assistantReply.hidden = true;
  actionControls.hidden = true;
});

askButton.addEventListener("click", async () => {
  if (!latestContext || !activeTab?.url) return;
  const question = assistantQuestion.value.trim();
  if (!question) return;
  const payload = { safeContext: latestContext.safeText, question };
  safePayload.textContent = JSON.stringify(payload, null, 2);
  assistantReply.hidden = false;
  assistantReply.textContent = "PrivatePilot is preparing a safe request…";
  addAudit("Safe payload sent to assistant");
  askButton.disabled = true;
  try {
    const endpoint = new URL("/api/privatepilot/assist", activeTab.url);
    const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Assistant unavailable.");
    assistantReply.textContent = `${result.mode === "local-demo" ? "Local demo" : "Configured cloud"}: ${result.answer}`;
    pendingAction = result.action || null;
    actionControls.hidden = !pendingAction;
    if (pendingAction) addAudit(`Action requested: fill ${pendingAction.fieldId}`);
  } catch (error) {
    assistantReply.textContent = error.message || "Assistant unavailable.";
  } finally {
    askButton.disabled = false;
  }
});

approveAction.addEventListener("click", async () => {
  if (!pendingAction || !window.confirm(`Approve filling ${pendingAction.fieldId}?`)) return;
  const result = await sendToPage({ type: "privatepilot:apply-action", action: pendingAction });
  addAudit(result?.ok ? `User approved action: filled ${pendingAction.fieldId}` : "Approved action could not be applied");
  actionControls.hidden = true;
  pendingAction = undefined;
});

rejectAction.addEventListener("click", () => {
  if (!pendingAction) return;
  addAudit(`User rejected action: fill ${pendingAction.fieldId}`);
  pendingAction = undefined;
  actionControls.hidden = true;
});

visualButton.addEventListener("click", async () => {
  if (!activeTab?.windowId || !window.confirm("Capture the visible page for a local-only visual scan? The screenshot will not leave this extension.")) return;
  visualButton.disabled = true;
  visualButton.textContent = "Scanning…";
  visualStatus.textContent = "Capturing the visible tab locally…";
  const started = performance.now();
  try {
    const capture = await chrome.runtime.sendMessage({ type: "privatepilot:capture-visible", windowId: activeTab.windowId });
    if (!capture?.ok) throw new Error(capture?.error || "Screenshot capture failed.");
    const recognised = await PrivatePilotVisual.recognise(capture.dataUrl);
    const scale = activeTab.width / recognised.width;
    const candidates = PrivatePilotVisual.candidatesFromBlocks(recognised.blocks, scale);
    const result = await sendToPage({ type: "privatepilot:visual-candidates", candidates });
    if (!result?.ok) throw new Error("Could not apply local visual redaction.");
    const memoryMiB = (recognised.width * recognised.height * 4 / 1024 / 1024).toFixed(1);
    visualStatus.textContent = `${result.regions.length} visual value${result.regions.length === 1 ? "" : "s"} redacted locally in ${Math.round(performance.now() - started)} ms · ${recognised.lineCount} OCR lines, ${recognised.textLength} characters · ${memoryMiB} MiB screenshot memory.`;
  } catch (error) {
    visualStatus.textContent = error.message || "Visual scan unavailable.";
  } finally {
    visualButton.disabled = false;
    visualButton.textContent = "Run Visual Scan";
  }
});
