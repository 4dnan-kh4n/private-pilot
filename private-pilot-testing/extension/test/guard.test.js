const assert = require("node:assert/strict");
const test = require("node:test");
require("../capture.js");
require("../pii.js");
const { scan, snapshot, setManual, registerVisual, resolvePlaceholders, applyAction } = require("../guard.js");

function element({ id, text = "", value, type = "text", label } = {}) {
  const attributes = new Map();
  const node = {
    id,
    type,
    tagName: value === undefined ? "DD" : "INPUT",
    textContent: text,
    hidden: false,
    labels: label ? [{ textContent: label }] : [],
    getAttribute(name) { return attributes.get(name) || null; },
    setAttribute(name, content) { attributes.set(name, content); },
    removeAttribute(name) { attributes.delete(name); }
  };
  if (value !== undefined) node.value = value;
  return node;
}

function dashboard() {
  const name = element({ id: "profileName", text: "Aarav Demo" });
  const account = element({ id: "profileAccount", text: "123456789012" });
  const reason = element({ id: "hireReason", value: "I solve difficult problems.", label: "Why should we hire you?" });
  const documentRef = {
    body: { get innerText() { return `Full name\n${name.textContent}\nBank account number\n${account.textContent}`; } },
    querySelectorAll(selector) {
      if (selector === "input, textarea, select") return [reason];
      if (selector === "dt") return [
        { textContent: "Full name", nextElementSibling: name },
        { textContent: "Bank account number", nextElementSibling: account }
      ];
      if (selector === "[data-privatepilot-redacted='true']") return [name, account, reason].filter(item => item.getAttribute("data-privatepilot-redacted") === "true");
      return [];
    },
    querySelector(selector) {
      if (selector === "#profileName") return name;
      if (selector === "#profileAccount") return account;
      return null;
    }
  };
  return { documentRef, name, account, reason };
}

test("guard redacts dynamic profile values and keeps raw values out of the safe context", () => {
  const { documentRef, name, account } = dashboard();
  scan(documentRef);
  const context = snapshot(documentRef);

  assert.equal(name.textContent, "PERSON_1");
  assert.equal(account.textContent, "ACCOUNT_1");
  assert.match(context.originalText, /Aarav Demo/);
  assert.match(context.safeText, /PERSON_1/);
  assert.doesNotMatch(JSON.stringify({ safeText: context.safeText, fields: context.fields }), /Aarav Demo|123456789012/);
});

test("a user can mark and unmark a normal field locally", () => {
  const { documentRef, reason } = dashboard();
  scan(documentRef);
  assert.equal(setManual("hireReason", true), true);
  assert.equal(reason.value, "PRIVATE_1");
  assert.equal(setManual("hireReason", false), true);
  assert.equal(reason.value, "I solve difficult problems.");
});

test("visual redaction returns placeholders without visual OCR text", () => {
  const regions = registerVisual([{ raw: "Account: 123456789012", kind: "ACCOUNT", confidence: "High", bounds: { x: 10, y: 20, width: 100, height: 20 } }]);
  assert.match(regions[0].placeholder, /^ACCOUNT_\d+$/);
  assert.doesNotMatch(JSON.stringify(regions), /123456789012/);
});

test("approved fill actions resolve placeholders only inside the extension", () => {
  const { documentRef, name, reason } = dashboard();
  documentRef.getElementById = id => id === "hireReason" ? reason : null;
  scan(documentRef);
  const result = applyAction(documentRef, { type: "fill_field", fieldId: "hireReason", value: `I am ${name.textContent} and I solve problems.` });
  assert.equal(result.ok, true);
  assert.equal(reason.value, "I am Aarav Demo and I solve problems.");
  assert.equal(resolvePlaceholders(name.textContent), "Aarav Demo");
});
