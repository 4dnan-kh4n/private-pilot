const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function panel(sendMessage) {
  const elements = new Map();
  const timers = new Map();
  let nextTimer = 0;
  let update, activate, runtimeMessage;
  const messages = [];
  const node = () => ({
    hidden: false, disabled: false, textContent: "", children: [], events: {},
    replaceChildren(...children) { this.children = children; },
    append(...children) { this.children.push(...children); },
    addEventListener(event, callback) { this.events[event] = callback; }
  });
  const sandbox = {
    URL,
    setTimeout(callback) { const id = ++nextTimer; timers.set(id, callback); return id; },
    clearTimeout(id) { timers.delete(id); },
    document: {
      querySelector(selector) { if (!elements.has(selector)) elements.set(selector, node()); return elements.get(selector); },
      createElement: node,
    },
    chrome: {
      tabs: {
        query(_query, callback) { callback([{ id: 1, url: "https://amazon.example.test/account" }]); },
        get(id, callback) { callback({ id, url: "https://flipkart.example.test/profile" }); },
        sendMessage: async (id, message) => {
          messages.push({ id, ...message });
          return sendMessage ? sendMessage(id, message) : { ok: true, review: { fields: [], protectedValues: 0 } };
        },
        onUpdated: { addListener(listener) { update = listener; } },
        onActivated: { addListener(listener) { activate = listener; } },
      },
      runtime: {
        sendMessage: async () => ({ ok: true }),
        onMessage: { addListener(listener) { runtimeMessage = listener; } },
      },
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "sidepanel.js"), "utf8"), sandbox);
  return { elements, messages, update, activate, runtimeMessage, sandbox,
    refresh: () => vm.runInContext("refreshContext()", sandbox),
    flush: async () => { const pending = [...timers.values()]; timers.clear(); pending.forEach(callback => callback()); await new Promise(resolve => setImmediate(resolve)); } };
}

test("review lists detected page details and unmark sends a local update", async () => {
  let marked = true;
  const instance = panel((_id, message) => {
    if (message.type === "privatepilot:set-manual") { marked = message.isPrivate; return { ok: true }; }
    return { ok: true, review: { protectedValues: marked ? 1 : 0, fields: [
      { id: "pp-text-1", kind: "EMAIL", value: "mira@example.test", isPrivate: marked, canUnmark: true }
    ] } };
  });
  await instance.flush();
  const list = instance.elements.get("#fieldsList");
  assert.equal(list.children.length, 1);
  assert.equal(list.children[0].children[1].textContent, "mira@example.test");
  assert.equal(list.children[0].children[2].textContent, "Unmark");
  await list.children[0].children[2].events.click();
  assert.equal(list.children[0].children[2].textContent, "Mark private");
  assert.equal(instance.messages.at(-2).type, "privatepilot:set-manual");
  assert.equal(instance.messages.at(-2).isPrivate, false);
});

test("panel refreshes after full navigation, same-tab URL changes, tab switches and late DOM content", async () => {
  const instance = panel();
  await instance.flush();
  instance.update(1, { status: "loading" }, { id: 1, url: "https://amazon.example.test/orders" });
  assert.equal(instance.elements.get("#captureView").hidden, true);
  instance.update(1, { status: "complete" }, { id: 1, url: "https://amazon.example.test/orders" });
  await instance.flush();
  assert.equal(instance.messages.length, 2);
  instance.update(1, { url: "https://amazon.example.test/address" }, { id: 1, url: "https://amazon.example.test/address" });
  await instance.flush();
  assert.equal(instance.messages.length, 3);
  instance.activate({ tabId: 2 });
  await instance.flush();
  assert.equal(instance.messages.at(-1).id, 2);
  instance.runtimeMessage({ type: "privatepilot:page-updated" }, { tab: { id: 2 } });
  await instance.flush();
  assert.equal(instance.messages.length, 5);
  instance.runtimeMessage({ type: "privatepilot:page-updated" }, { tab: { id: 1 } });
  await instance.flush();
  assert.equal(instance.messages.length, 5);
});

test("a delayed reply from the old page cannot overwrite the new page review", async () => {
  let resolveOld;
  const instance = panel(id => id === 1 ? new Promise(resolve => { resolveOld = resolve; })
    : { ok: true, review: { fields: [], protectedValues: 0 } });
  const oldRequest = instance.refresh();
  instance.activate({ tabId: 2 });
  await instance.flush();
  resolveOld({ ok: true, review: { fields: [{ value: "Old page", id: "old" }], protectedValues: 1 } });
  await oldRequest;
  assert.equal(instance.elements.get("#fieldsList").children.length, 0);
  assert.equal(instance.elements.get("#siteMessage").textContent, "0 detected details hidden on this page.");
});

test("unsupported pages and failed reviews clear old details and show a useful message", async () => {
  const instance = panel(() => ({ ok: false, error: "Grant access to this site." }));
  await instance.flush();
  assert.equal(instance.elements.get("#captureView").hidden, true);
  assert.equal(instance.elements.get("#siteMessage").textContent, "Grant access to this site.");
  instance.update(1, { url: "chrome://settings" }, { id: 1, url: "chrome://settings" });
  assert.equal(instance.elements.get("#analyseButton").disabled, true);
  assert.match(instance.elements.get("#siteMessage").textContent, /Browser-internal/);
});

test("content script exposes local review even when legacy context verification fails", () => {
  const document = {};
  const window = {}; window.parent = window; window.top = { document };
  let listener, notifyChange;
  const sent = [];
  const sandbox = {
    document, window,
    PrivatePilotGuard: {
      start(_doc, callback) { notifyChange = callback; },
      status: () => 1,
      snapshot() { throw new Error("Stored private substring"); },
      review: () => ({ fields: [{ id: "pp-text-1", kind: "EMAIL" }], protectedValues: 1 }),
    },
    chrome: { runtime: {
      onMessage: { addListener(callback) { listener = callback; } },
      sendMessage: async message => { sent.push(message); },
    } },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "content-script.js"), "utf8"), sandbox);
  let response;
  listener({ type: "privatepilot:review" }, {}, result => { response = result; });
  assert.equal(response.ok, true);
  assert.equal(response.review.fields.length, 1);
  notifyChange();
  assert.equal(sent[0].type, "privatepilot:page-updated");
});
