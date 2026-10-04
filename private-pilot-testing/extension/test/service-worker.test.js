const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function worker({ installed = false, restrictedFrame = false, permission = false } = {}) {
  const calls = [];
  const notifications = [];
  let messageListener, updateListener;
  const event = () => ({ addListener() {} });
  const chrome = {
    action: { onClicked: event() },
    permissions: { contains: async () => permission, request: async () => permission },
    runtime: {
      onInstalled: event(), onStartup: event(),
      onMessage: { addListener(listener) { messageListener = listener; } },
      sendMessage: async message => { notifications.push(message); },
    },
    scripting: {
      async executeScript(details) {
        const allowed = new Set(["tabId", "frameIds", "allFrames", "documentIds"]);
        for (const key of Object.keys(details.target)) assert.ok(allowed.has(key));
        calls.push(details);
        if (restrictedFrame && details.target.allFrames) throw new Error("Restricted iframe");
        return [];
      },
    },
    sidePanel: { open: async () => {}, setPanelBehavior: async () => {} },
    tabs: {
      sendMessage: async () => { if (installed) return { ready: true }; throw new Error("No listener"); },
      onUpdated: { addListener(listener) { updateListener = listener; } },
    },
  };
  const sandbox = vm.createContext({ chrome, URL });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "service-worker.js"), "utf8"), sandbox);
  return { calls, notifications, sandbox,
    ensure: () => new Promise(resolve => messageListener({ type: "privatepilot:ensure-content-script", tabId: 42 }, {}, resolve)),
    update: (...args) => updateListener(...args) };
}

test("main-page injection uses supported targets and succeeds despite a restricted iframe", async () => {
  const instance = worker({ restrictedFrame: true });
  assert.equal((await instance.ensure()).ok, true);
  assert.equal(instance.calls.length, 2);
  assert.deepEqual({ ...instance.calls[0].target }, { tabId: 42 });
  assert.deepEqual({ ...instance.calls[1].target }, { tabId: 42, allFrames: true });
});

test("repeated review reuses an installed scanner instead of overwriting its memory", async () => {
  const instance = worker({ installed: true });
  assert.equal((await instance.ensure()).ok, true);
  assert.equal(instance.calls.length, 0);
});

test("completed navigation reinjects on a granted site and notifies the panel", async () => {
  const instance = worker({ permission: true });
  await instance.update(42, { status: "complete" }, { url: "https://shop.example.test/account" });
  assert.equal(instance.calls.length, 2);
  assert.equal(instance.notifications[0].type, "privatepilot:injection-ready");
  assert.equal(instance.notifications[0].tabId, 42);
  const denied = worker();
  await denied.update(42, { status: "complete" }, { url: "https://other.example.test/account" });
  assert.equal(denied.calls.length, 0);
});

test("reexecuting local libraries preserves redaction records and placeholder mappings", () => {
  const { element, textNode, fakeDocument } = require("../test-support/dom-fixture");
  const node = textNode("Email: mira@example.test", element({ tagName: "P" }));
  const document = fakeDocument([node]);
  const sandbox = vm.createContext({});
  const files = ["capture.js", "pii.js", "guard.js"].map(file =>
    fs.readFileSync(path.join(__dirname, "..", file), "utf8"));
  files.forEach(source => vm.runInContext(source, sandbox));
  const guard = sandbox.PrivatePilotGuard;
  assert.equal(guard.review(document).fields.length, 1);
  files.forEach(source => vm.runInContext(source, sandbox));
  assert.equal(sandbox.PrivatePilotGuard, guard);
  assert.equal(guard.review(document).fields[0].value, "Email: mira@example.test");
  guard.clear();
  assert.equal(node.nodeValue, "Email: mira@example.test");
});
