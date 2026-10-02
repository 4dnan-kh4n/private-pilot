const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

test("executeScript targets contain only keys supported by Chrome", async () => {
  const executeScriptCalls = [];
  let messageListener;
  const event = () => ({ addListener() {} });
  const chrome = {
    action: { onClicked: event() },
    permissions: { contains: async () => false, request: async () => false },
    runtime: {
      onInstalled: event(), onStartup: event(), onMessage: { addListener(listener) { messageListener = listener; } },
      sendMessage: async () => {},
    },
    scripting: {
      executeScript(details) {
        const allowedTargetKeys = new Set(["tabId", "frameIds", "allFrames", "documentIds"]);
        for (const key of Object.keys(details.target)) {
          assert.ok(allowedTargetKeys.has(key), `Unsupported chrome.scripting.executeScript target key: ${key}`);
        }
        executeScriptCalls.push(details);
        return Promise.resolve([]);
      },
    },
    sidePanel: { open: async () => {}, setPanelBehavior: async () => {} },
    tabs: { captureVisibleTab: async () => "data:image/png;base64,", onUpdated: event() },
  };
  const worker = fs.readFileSync(path.join(__dirname, "..", "service-worker.js"), "utf8");
  vm.runInNewContext(worker, { chrome, URL, setTimeout, document: { readyState: "complete" }, requestIdleCallback: callback => callback() });

  await new Promise((resolve, reject) => {
    messageListener({ type: "privatepilot:ensure-content-script", tabId: 42 }, {}, result => {
      try {
        assert.equal(result?.ok, true);
        resolve();
      } catch (error) { reject(error); }
    });
  });

  assert.equal(executeScriptCalls.length, 2);
  for (const { target } of executeScriptCalls) assert.deepEqual({ ...target }, { tabId: 42, allFrames: true });
});
