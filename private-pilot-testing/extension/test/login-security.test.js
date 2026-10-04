const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
require("../capture.js");
require("../pii.js");
const { scan, snapshot, clear } = require("../guard.js");
const { element, textNode, fakeDocument } = require("../test-support/dom-fixture");

test("automatic input and autofill rescans keep the submitted username unchanged", async () => {
  clear();
  const username = element({ id: "username", label: "Email", type: "email", value: "" });
  const document = fakeDocument([username], [username]);
  const listeners = new Map();
  document.addEventListener = (type, callback) => listeners.set(type, callback);
  const previousObserver = global.MutationObserver;
  global.MutationObserver = class { observe() {} disconnect() {} };
  let observer;
  try {
    observer = require("../guard.js").start(document);
    for (const [event, value] of [["input", "demo@example.test"], ["input", "edited@example.test"], ["change", "autofilled@example.test"]]) {
      username.value = value;
      listeners.get(event)();
      await new Promise(resolve => setTimeout(resolve, 180));
      assert.equal(username.value, value);
    }
  } finally {
    observer?.disconnect();
    global.MutationObserver = previousObserver;
    clear();
  }
});

test("an existing detected input becoming a password is not read during the next scan", () => {
  clear();
  const field = element({ id: "dynamic", label: "Email", type: "email", value: "demo@example.test" });
  const document = fakeDocument([field], [field]);
  scan(document);
  field.type = "password";
  Object.defineProperty(field, "value", {
    get() { throw new Error("Password value must never be read"); },
    set() { throw new Error("Password value must never be rewritten"); }
  });
  assert.doesNotThrow(() => scan(document));
  clear();
});


test("sign-in credentials survive repeated scans, edits and manual marking attempts", () => {
  const { review, setManual } = require("../guard.js");
  clear();
  const username = element({ id: "email", type: "email", label: "Email", value: "jordan@example.test" });
  const password = element({ id: "password", type: "password", label: "Password" });
  Object.defineProperty(password, "value", {
    get() { throw new Error("Password must never be read by the scanner"); },
    set() { throw new Error("Password must never be changed by the scanner"); }
  });
  const form = element({ tagName: "FORM", attrs: { action: "/session" } });
  form.querySelector = () => password;
  username.form = form;
  password.form = form;
  const display = displayPair("Email", "jordan@example.test");
  const document = fakeDocument([username, password, ...display], [username, password]);
  for (const value of ["jordan@example.test", "jordan.updated@example.test", "jordan@example.test"]) {
    username.value = value;
    scan(document); review(document); scan(document);
    assert.equal(username.value, value);
    assert.equal(username.getAttribute("data-privatepilot-redacted"), null);
  }
  assert.equal(setManual("email", true), false, "marking must not corrupt sign-in inputs");
  assert.equal(review(document).fields.some(field => field.id === "email"), false);
  assert.equal(display[3].nodeValue, "EMAIL_1", "displayed profile details are still redacted");
  assert.equal(password.style.webkitTextSecurity, "disc");
  clear();
});

test("username autocomplete, email-first forms and OTP login dialogs are never read or rewritten", () => {
  const { capture } = require("../capture.js");
  const cases = [
    { attrs: { autocomplete: "section-login username webauthn" } },
    { attrs: { name: "user_id" } },
    { formAttrs: { action: "https://shop.example.test/ap/signin" } },
    { formAttrs: { name: "signIn" } },
    { dialog: true, formAttrs: { "aria-label": "Login with mobile number" } },
    { otp: true },
    { custom: true },
  ];
  for (const scenario of cases) {
    clear();
    const username = element({ id: "identity", type: "email", label: "Email", attrs: scenario.attrs });
    Object.defineProperty(username, "value", {
      get() { throw new Error("Login identity must not be read"); },
      set() { throw new Error("Login identity must not be rewritten"); }
    });
    if (scenario.formAttrs || scenario.otp) {
      const root = element({ tagName: scenario.dialog ? "DIV" : "FORM", attrs: scenario.formAttrs });
      root.querySelector = () => scenario.otp ? element({ attrs: { autocomplete: "one-time-code" } }) : null;
      if (scenario.dialog) username.closest = () => root;
      else username.form = root;
    }
    const document = fakeDocument([username], [username]);
    if (scenario.custom) {
      username.ownerDocument = document;
      document.querySelector = () => element({ type: "password" });
    }
    assert.doesNotThrow(() => { capture(document); scan(document); snapshot(document); });
    clear();
  }
});

test("a delayed sign-in form restores a placeholder already applied to its identity field", () => {
  clear();
  const username = element({ id: "email", type: "email", label: "Email", value: "jordan@example.test" });
  const document = fakeDocument([username], [username]);
  scan(document);
  assert.equal(username.value, "EMAIL_1");
  const form = element({ tagName: "FORM", attrs: { action: "/login" } });
  username.form = form;
  scan(document);
  assert.equal(username.value, "jordan@example.test");
  scan(document);
  assert.equal(username.value, "jordan@example.test");
  clear();
});


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

test("Amazon-style greeting redacts a known person and leaves navigation items untouched", () => {
  clear();
  const nav = element({ tagName: "NAV" });
  const greeting = textNode("Hello, Tapan", nav);
  const account = textNode("Account & Lists", nav);
  const returns = textNode("Returns & Orders", nav);
  const cart = textNode("Cart", nav);
  const name = element({ id: "customer-name", label: "Name", value: "Tapan Patidar" });
  const document = fakeDocument([nav, greeting, account, returns, cart, name], [name]);

  scan(document);
  const context = snapshot(document);
  assert.match(context.safeText, /Hello, PERSON_1/);
  assert.match(context.safeText, /Account & Lists/);
  assert.match(context.safeText, /Returns & Orders/);
  assert.match(context.safeText, /Cart/);
  assert.equal(name.value, "PERSON_1");
  assert.doesNotMatch(context.safeText, /Tapan/);
  clear();
});
