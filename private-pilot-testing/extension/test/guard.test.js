const assert = require("node:assert/strict");
const test = require("node:test");
require("../capture.js");
require("../pii.js");
const { scan, start, snapshot, setManual, clear, applyAction } = require("../guard.js");
const { element, textNode, fakeDocument } = require("../test-support/dom-fixture");

function page() {
  const p = element({ tagName: "P" });
  const nodes = [textNode("Welcome", p), textNode("Full name", p), textNode("Mira Srinivasan", p), textNode("Account No", p), textNode("123456789012", p)];
  const name = element({ id: "customerName", tagName: "INPUT", label: "Full name", value: "Mira Srinivasan" });
  const account = element({ id: "accountNumber", tagName: "INPUT", label: "Account No", value: "123456789012" });
  const duplicate = element({ id: "accountCopy", tagName: "INPUT", label: "Account No", value: "123456789012" });
  const response = element({ id: "hireReason", tagName: "TEXTAREA", label: "Why should we hire you?", value: "I solve problems." });
  const fields = [name, account, duplicate, response];
  const document = fakeDocument([...nodes, ...fields], fields);
  document.getElementById = id => fields.find(field => field.id === id);
  return { document, name, account, duplicate, response };
}

test("generic page context redacts labelled text and fields, with stable placeholders", () => {
  clear();
  const { document, name, account, duplicate } = page();
  scan(document);
  const context = snapshot(document);
  assert.equal(name.value, "PERSON_1");
  assert.equal(account.value, "ACCOUNT_1");
  assert.equal(duplicate.value, "ACCOUNT_1");
  assert.match(context.originalText, /Mira Srinivasan/);
  assert.match(context.safeText, /PERSON_1/);
  assert.match(context.safeText, /ACCOUNT_1/);
  assert.doesNotMatch(JSON.stringify({ safeText: context.safeText, fields: context.fields }), /Mira Srinivasan|123456789012/);
  require("../pii.js").assertSafePayload({ safeContext: context.safeText, question: "Summarize these details" });
  assert.throws(() => require("../pii.js").assertSafePayload({ safeContext: context.safeText, question: "My name is Mira Srinivasan" }, context.privateValues), /blocked a request/);
});

test("manual marking, unmarking, and Clear restore local values", () => {
  clear();
  const { document, response } = page();
  scan(document);
  assert.equal(setManual("hireReason", true), true);
  assert.equal(response.value, "PRIVATE_1");
  assert.equal(setManual("hireReason", false), true);
  assert.equal(response.value, "I solve problems.");
  setManual("accountNumber", true);
  clear();
  assert.equal(response.value, "I solve problems.");
});

test("approved fill actions resolve placeholders only inside the extension", () => {
  clear();
  const { document, name, response } = page();
  scan(document);
  assert.equal(applyAction(document, { type: "fill_field", fieldId: "hireReason", value: `I am ${name.value}.` }).ok, true);
  assert.equal(response.value, "I am Mira Srinivasan.");
});

test("debounced observer redacts fields added after initial SPA load", async () => {
  clear();
  const labelNode = element({ tagName: "P" });
  const nodes = [labelNode];
  const fields = [];
  const document = fakeDocument(nodes, fields);
  document.documentElement = {};
  let mutationCallback;
  const previousObserver = global.MutationObserver;
  global.MutationObserver = class {
    constructor(callback) { mutationCallback = callback; }
    observe() {}
    disconnect() {}
  };
  try {
    const observer = start(document);
    const phone = element({ id: "dynamicPhone", label: "Mobile", value: "98765 43210" });
    fields.push(phone); nodes.push(phone);
    mutationCallback();
    await new Promise(resolve => setTimeout(resolve, 220));
    assert.equal(phone.value, "PHONE_1");
    observer.disconnect();
  } finally {
    global.MutationObserver = previousObserver;
    clear();
  }
});
