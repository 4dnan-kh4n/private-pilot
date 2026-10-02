const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
require("../capture.js");
require("../pii.js");
const { scan, snapshot, clear } = require("../guard.js");
const { element, textNode, fakeDocument } = require("../test-support/dom-fixture");

function displayPair(label, value) {
  const labelElement = element({ tagName: "B" });
  labelElement.textContent = `${label}:`;
  const labelText = textNode(`${label}:`, labelElement);
  const valueElement = element({ tagName: "DIV" });
  valueElement.previousElementSibling = labelElement;
  valueElement.textContent = value;
  const valueText = textNode(value, valueElement);
  return [labelElement, labelText, valueElement, valueText];
}

test("fake Login & Security layout redacts values by type and never reads password or OTP", () => {
  const fixture = fs.readFileSync(path.join(__dirname, "..", "..", "test-fixtures", "login-security.html"), "utf8");
  assert.match(fixture, /Tapan Patidar/);
  assert.match(fixture, /\+91 98765 43210/);
  assert.match(fixture, /tapan\.patidar@example\.test/);
  assert.match(fixture, /type="password"/);
  assert.match(fixture, /Two-step verification enabled/);
  assert.match(fixture, /one-time-code/);

  clear();
  const name = displayPair("Name", "Tapan Patidar");
  const mobile = displayPair("Primary mobile number", "+91 98765 43210");
  const email = displayPair("E-mail", "tapan.patidar@example.test");
  const password = element({ id: "password", type: "password", label: "Password" });
  const mobileInput = element({ id: "mobile", value: "+91 98765 43210", attrs: { "aria-label": "Primary mobile number" } });
  const otp = element({ id: "otp", label: "Verification code", attrs: { autocomplete: "one-time-code" } });
  Object.defineProperty(password, "value", { get() { throw new Error("password must never be read"); } });
  Object.defineProperty(otp, "value", { get() { throw new Error("OTP must never be read"); } });
  const twoStep = element({ id: "two-step", type: "checkbox", label: "Two-step verification enabled", value: "on" });
  const fields = [mobileInput, password, twoStep, otp];
  const document = fakeDocument([...name, ...mobile, ...email, ...fields], fields);

  scan(document);
  const context = snapshot(document);
  const safe = JSON.stringify({ safeText: context.safeText, fields: context.fields });
  assert.match(context.safeText, /PERSON_1/);
  assert.match(context.safeText, /MOBILE_1/);
  assert.match(context.safeText, /EMAIL_1/);
  assert.match(context.safeText, /\[HIDDEN\]/);
  assert.doesNotMatch(safe, /Tapan Patidar|\+91 98765 43210|tapan\.patidar@example\.test|fake-password-42|654321/);
  assert.equal(context.fields.find(field => field.label === "Password")?.safeValue, "[HIDDEN]");
  assert.equal(context.fields.find(field => field.label === "Verification code")?.safeValue, "[HIDDEN]");
  assert.equal(mobileInput.value, "MOBILE_1");
  require("../pii.js").assertSafePayload({ safeContext: context.safeText, question: "Summarize this security page" });
  clear();
});
