const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const extensionRoot = path.join(__dirname, "..");
const projectRoot = path.join(extensionRoot, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(extensionRoot, "manifest.json"), "utf8"));
const allWebsites = ["<all_urls>"];

test("Manifest V3 runs the local guard on normal webpages", () => {
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.host_permissions, allWebsites);
  assert.deepEqual(manifest.content_scripts[0].matches, allWebsites);
  assert.deepEqual(manifest.permissions.sort(), ["activeTab", "scripting", "sidePanel"]);
  assert.equal(manifest.content_scripts[0].run_at, "document_start");
  assert.equal(manifest.content_security_policy.extension_pages, "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'");
});

test("extension entry points support local capture without a backend request", () => {
  for (const file of ["pii.js", "guard.js", "capture.js", "visual.js", "visual-overlay.js", "service-worker.js", "content-script.js", "sidepanel.html", "sidepanel.js", "sidepanel.css"]) {
    assert.equal(fs.existsSync(path.join(extensionRoot, file)), true, `${file} is missing`);
  }
  const contentScript = fs.readFileSync(path.join(extensionRoot, "content-script.js"), "utf8");
  assert.match(contentScript, /PrivatePilotGuard\.start\(document\)/);
  assert.match(contentScript, /PrivatePilotGuard\.snapshot\(document\)/);
  assert.match(fs.readFileSync(path.join(extensionRoot, "sidepanel.js"), "utf8"), /\/api\/privatepilot\/assist/);
});

test("visual scan captures only after the button path and has no network request", () => {
  const panel = fs.readFileSync(path.join(extensionRoot, "sidepanel.js"), "utf8");
  const worker = fs.readFileSync(path.join(extensionRoot, "service-worker.js"), "utf8");
  const visual = fs.readFileSync(path.join(extensionRoot, "visual.js"), "utf8");

  assert.match(panel, /visualButton\.addEventListener\("click"/);
  assert.match(worker, /chrome\.tabs\.captureVisibleTab/);
  assert.match(worker, /chrome\.scripting\.executeScript/);
  assert.match(worker, /chrome\.action\.onClicked/);
  assert.match(worker, /chrome\.sidePanel\.open/);
  assert.match(worker, /openPanelOnActionClick: false/);
  assert.doesNotMatch(`${worker}${visual}`, /\bfetch\s*\(/);
  assert.match(visual, /Tesseract\.createWorker/);
  assert.match(visual, /\{ blocks: true \}/);
  assert.equal(fs.existsSync(path.join(extensionRoot, "vendor", "tesseract", "lang", "eng.traineddata.gz")), true);
  assert.equal(fs.existsSync(path.join(projectRoot, "public", "visual-test.html")), true);
  assert.equal(fs.existsSync(path.join(projectRoot, "public", "visual-ocr-fixture.svg")), true);
});

test("suggested page actions require an explicit user confirmation", () => {
  const panel = fs.readFileSync(path.join(extensionRoot, "sidepanel.js"), "utf8");
  const contentScript = fs.readFileSync(path.join(extensionRoot, "content-script.js"), "utf8");
  assert.match(panel, /window\.confirm\(`Approve filling/);
  assert.match(contentScript, /privatepilot:apply-action/);
});

test("safe-context preview is initiated only by its button and Clear removes the preview", () => {
  const panel = fs.readFileSync(path.join(extensionRoot, "sidepanel.js"), "utf8");
  const clickHandler = panel.indexOf('analyseButton.addEventListener("click"');

  assert.match(panel, /function refreshContext\(\)[\s\S]*?privatepilot:view-context/);
  assert.ok(clickHandler >= 0 && panel.indexOf("await refreshContext()", clickHandler) > clickHandler);
  assert.match(panel, /function clearCapture\(\)[\s\S]*?captureView\.hidden = true[\s\S]*?fieldsList\.replaceChildren\(\)[\s\S]*?contextPreview\.textContent = ""/);
});
