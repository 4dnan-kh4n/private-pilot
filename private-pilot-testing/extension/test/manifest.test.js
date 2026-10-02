const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const extensionRoot = path.join(__dirname, "..");
const projectRoot = path.join(extensionRoot, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(extensionRoot, "manifest.json"), "utf8"));

test("Manifest V3 uses click-to-inject permissions and bundles OCR assets", () => {
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions.sort(), ["activeTab", "scripting", "sidePanel"]);
  assert.deepEqual(manifest.optional_host_permissions, ["http://*/*", "https://*/*"]);
  assert.deepEqual(manifest.host_permissions, ["http://localhost:3000/*"]);
  assert.equal(manifest.content_scripts, undefined);
  assert.match(manifest.content_security_policy.extension_pages, /wasm-unsafe-eval/);
  assert.ok(manifest.web_accessible_resources.some(item => item.resources.includes("vendor/tesseract/worker.min.js")));
  assert.equal(fs.existsSync(path.join(extensionRoot, "vendor", "tesseract", "lang", "eng.traineddata.gz")), true);
  const worker = fs.readFileSync(path.join(extensionRoot, "service-worker.js"), "utf8");
  assert.match(worker, /allFrames:\s*true/);
  assert.doesNotMatch(worker, /matchAboutBlank/);
  assert.match(worker, /chrome\.permissions\.request/);
});

test("content-script recovery and side panel use the supported message flow", () => {
  for (const file of ["pii.js", "guard.js", "capture.js", "visual.js", "visual-overlay.js", "service-worker.js", "content-script.js", "sidepanel.html", "sidepanel.js", "sidepanel.css"]) {
    assert.equal(fs.existsSync(path.join(extensionRoot, file)), true, `${file} is missing`);
  }
  const panel = fs.readFileSync(path.join(extensionRoot, "sidepanel.js"), "utf8");
  const pii = fs.readFileSync(path.join(extensionRoot, "pii.js"), "utf8");
  assert.match(panel, /ASSISTANT_ENDPOINT/);
  assert.match(pii, /credentials:\s*"omit"/);
  assert.match(panel, /sendSafeRequest/);
  assert.doesNotMatch(panel, /new URL\("\/api\/privatepilot\/assist",\s*activeTab\.url\)/);
});

test("extension has no persistent private-value storage or raw-value console logging", () => {
  const source = fs.readdirSync(extensionRoot).filter(name => name.endsWith(".js")).map(name => fs.readFileSync(path.join(extensionRoot, name), "utf8")).join("\n");
  assert.doesNotMatch(source, /chrome\.storage\.(?:local|sync|session)/);
  assert.doesNotMatch(source, /console\.(?:log|debug|info)\s*\(/);
});

test("offline HTML fixtures cover banking, labelled registration and delayed SPA content", () => {
  const fixtures = path.join(projectRoot, "test-fixtures");
  const bank = fs.readFileSync(path.join(fixtures, "net-banking-dashboard.html"), "utf8");
  const registration = fs.readFileSync(path.join(fixtures, "registration-form.html"), "utf8");
  const spa = fs.readFileSync(path.join(fixtures, "spa-dashboard.html"), "utf8");
  assert.match(bank, /<table>/); assert.match(bank, /<iframe/);
  assert.match(registration, /autocomplete="one-time-code"/); assert.match(registration, /type="password"/);
  assert.match(spa, /setTimeout/); assert.match(spa, /example\.test/);
  for (const html of [bank, registration, spa]) assert.doesNotMatch(html, /https?:\/\/(?!example\.test)/i);
});
