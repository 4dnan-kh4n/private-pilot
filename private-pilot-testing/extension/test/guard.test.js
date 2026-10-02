const assert = require("node:assert/strict");
const test = require("node:test");
require("../capture.js");
require("../pii.js");
const { scan, start, snapshot, setManual, clear, applyAction } = require("../guard.js");
const { element, textNode, fakeDocument, bankTable } = require("../test-support/dom-fixture");

function page() {
  const p = element({ tagName: "P" });
  const nodes = [textNode("Welcome", p), textNode("Full name:", p), textNode("Mira Srinivasan", p), textNode("Account No:", p), textNode("123456789012", p)];
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
    assert.equal(phone.value, "MOBILE_1");
    observer.disconnect();
  } finally {
    global.MutationObserver = previousObserver;
    clear();
  }
});

test("savings-account masking changes displayed text as well as the safe preview", () => {
  clear();
  try {
    const label = element({ tagName: "SPAN" }); label.textContent = "Savings Account";
    const value = element({ tagName: "SPAN" }); value.previousElementSibling = label;
    const labelText = textNode("Savings Account", label);
    const valueText = textNode("123456789012", value);
    const inline = textNode("Savings Account: 123456789012", element({ tagName: "P" }));
    const splitParent = element({ tagName: "P" });
    const splitLabel = textNode("SB A/c No.", splitParent);
    const splitValue = textNode("919876543210", splitParent); splitValue.previousSibling = splitLabel;
    const input = element({ id: "savings-account", label: "Saving Account Number", value: "1234 5678 9012" });
    const document = fakeDocument([label, labelText, value, valueText, inline, splitLabel, splitValue, input], [input]);
    scan(document);
    assert.equal(valueText.nodeValue, "ACCOUNT_1", "the displayed account must change, not only the preview");
    assert.equal(inline.nodeValue, "Savings Account: ACCOUNT_1");
    assert.equal(input.value, "ACCOUNT_1", "formatted copies reuse the same placeholder");
    assert.equal(splitValue.nodeValue, "ACCOUNT_2", "account labels take precedence over a phone-like digit sequence");
    const context = snapshot(document);
    assert.doesNotMatch(context.safeText, /123456789012|1234 5678 9012|919876543210/);
    assert.match(context.originalText, /123456789012/);
    require("../pii.js").assertSafePayload({ safeContext: context.safeText, question: "Summarize" }, context.privateValues);
    scan(document);
    assert.equal(valueText.nodeValue, "ACCOUNT_1", "rescanning must not replace a placeholder again");
    clear();
    assert.equal(valueText.nodeValue, "123456789012");
    assert.equal(input.value, "1234 5678 9012");
  } finally { clear(); }
});

test("a page refresh of a masked account text node is scanned again", () => {
  clear();
  try {
    const node = textNode("Account No: 123456789012", element({ tagName: "P" }));
    const document = fakeDocument([node]);
    scan(document);
    assert.equal(node.nodeValue, "Account No: ACCOUNT_1");
    node.nodeValue = "Account No: 123456789013";
    scan(document);
    assert.equal(node.nodeValue, "Account No: ACCOUNT_2");
    assert.doesNotMatch(snapshot(document).safeText, /12345678901[23]/);
    clear();
    assert.equal(node.nodeValue, "Account No: 123456789013", "Clear restores the latest page value");
  } finally { clear(); }
});

test("bank table headings stay unchanged and values below each heading are redacted", () => {
  for (const options of [{}, { headerTag: "TH" }, { thead: true }, { aria: true }, { headerTag: "TH", rowHeader: true }]) {
    clear();
    try {
      const { document, headers, values, nodes } = bankTable(options);
      const duplicate = textNode("Riya Banerjee", element({ tagName: "A" })); nodes.unshift(duplicate);
      scan(document);
      assert.deepEqual(headers.map(cell => cell.textContent), ["Account Name", "Account Number", "Account Type", "Balance", "Withdrawable", "Currency"]);
      assert.deepEqual(values.map(row => row.map(cell => cell.textContent)), [["PERSON_1", "ACCOUNT_1", "Savings", "4367.36", "4367.36", "INR"], ["PERSON_2", "ACCOUNT_2", "Current", "5000.00", "5000.00", "INR"]]);
      assert.equal(duplicate.nodeValue, "PERSON_1", "earlier name links also use the table's local mapping");
      const context = snapshot(document);
      assert.doesNotMatch(context.safeText, /Riya Banerjee|Mira Srinivasan|10293847561[01]/);
      assert.match(context.safeText, /Account Name\nAccount Number/);
      require("../pii.js").assertSafePayload({ safeContext: context.safeText, question: "Summarize" }, context.privateValues);
      values[0][1].text.nodeValue = "102938475612";
      scan(document);
      assert.equal(values[0][1].textContent, "ACCOUNT_3");
      clear();
      assert.equal(values[0][1].textContent, "102938475612");
      assert.equal(values[0][0].textContent, "Riya Banerjee");
    } finally { clear(); }
  }
});

test("table column labels apply to nested inputs and linked values", () => {
  clear();
  try {
    const { document, headers, values, nodes } = bankTable({ headerTag: "TH" });
    const accountCell = values[0][1]; accountCell.text.nodeValue = "";
    const input = element({ id: "bank-account", value: "102938475610" }); input.parentElement = accountCell;
    input.closest = selector => accountCell.closest(selector);
    nodes.splice(nodes.indexOf(accountCell.text) + 1, 0, input);
    const nameCell = values[0][0]; nameCell.text.nodeValue = "";
    const link = element({ tagName: "A" }); link.parentElement = nameCell; link.closest = selector => nameCell.closest(selector);
    const name = textNode("Riya Banerjee", link); nodes.splice(nodes.indexOf(nameCell.text) + 1, 0, link, name);
    assert.equal(PrivatePilotCapture.labelFor(input), "Account Number");
    scan(document);
    assert.equal(input.value, "ACCOUNT_1");
    assert.equal(name.nodeValue, "PERSON_1");
    assert.equal(headers[1].textContent, "Account Number");
    assert.doesNotThrow(() => snapshot(document));
  } finally { clear(); }
});
