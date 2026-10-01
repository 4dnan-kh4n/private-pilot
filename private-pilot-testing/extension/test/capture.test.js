const assert = require("node:assert/strict");
const test = require("node:test");
const { capture, isVisible, isNeverRead, restoreMask } = require("../capture.js");
const { element, textNode, fakeDocument } = require("../test-support/dom-fixture");

test("capture walks visible text and visible form values without reading locked secrets", () => {
  const label = element({ tagName: "P" });
  const visibleText = textNode("Welcome to your account", label);
  const email = element({ id: "email", label: "Email", value: "mira@example.in" });
  const password = element({ id: "pass", type: "password", label: "Password" });
  Object.defineProperty(password, "value", { get() { throw new Error("password value must never be read"); } });
  const otp = element({ id: "otp", value: "123456", attrs: { autocomplete: "one-time-code" } });
  const hidden = element({ id: "hidden", value: "not visible" });
  hidden.hidden = true;
  const doc = fakeDocument([label, visibleText, email, password, otp, hidden], [email, password, otp, hidden]);
  const result = capture(doc);
  assert.match(result.text, /Welcome to your account/);
  assert.deepEqual(result.fields.map(field => field.label), ["Email", "Password", "one-time-code"]);
  assert.equal(result.fields[0].value, "mira@example.in");
  assert.equal(result.fields[1].locked, true);
  assert.equal(result.fields[1].value, "");
  assert.equal(result.fields[2].locked, true);
  assert.equal(password.style.webkitTextSecurity, "disc");
  restoreMask(password);
  assert.equal(password.style.webkitTextSecurity, "");
});

test("capture visibility and password-related autocomplete classifications", () => {
  assert.equal(isVisible(element()), true);
  assert.equal(isVisible(Object.assign(element(), { hidden: true })), false);
  assert.equal(isNeverRead(element({ attrs: { autocomplete: "current-password" } })), true);
  assert.equal(isNeverRead(element({ attrs: { autocomplete: "cc-csc" } })), true);
});

test("capture walks open shadow roots and same-origin iframe documents", () => {
  const mainLabel = element({ tagName: "P" });
  const mainText = textNode("Main page", mainLabel);
  const frameDoc = fakeDocument([]);
  const frameP = element({ tagName: "P" });
  frameP.ownerDocument = frameDoc;
  const frameText = textNode("Account No: 987654321", frameP);
  frameDoc.createTreeWalker = () => { let i = 0; const nodes = [frameP, frameText]; return { nextNode() { return nodes[i++] || null; } }; };
  const shadowP = element({ tagName: "P" });
  const shadowText = textNode("Open shadow content", shadowP);
  const doc = fakeDocument([mainLabel, mainText], []);
  const host = element({ tagName: "DIV" });
  const shadowRoot = { nodeType: 11, ownerDocument: doc };
  host.shadowRoot = shadowRoot;
  const iframe = element({ tagName: "IFRAME" });
  iframe.contentDocument = frameDoc;
  doc.createTreeWalker = root => { let i = 0; const nodes = root === shadowRoot ? [shadowP, shadowText] : [mainLabel, mainText, host, iframe]; return { nextNode() { return nodes[i++] || null; } }; };
  const result = capture(doc);
  assert.match(result.text, /Main page/);
  assert.match(result.text, /Open shadow content/);
  assert.match(result.text, /Account No: 987654321/);
  assert.equal(result.documents.includes(frameDoc), true);
});
