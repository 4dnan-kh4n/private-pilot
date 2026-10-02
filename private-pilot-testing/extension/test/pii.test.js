const assert = require("node:assert/strict");
const test = require("node:test");
const { detect, luhn, redactText, assertSafePayload, sendSafeRequest } = require("../pii.js");

test("detects Indian banking, identity and contact formats", () => {
  const cases = [
    ["Email", "a.person@example.in", "EMAIL"],
    ["Mobile", "+91 98765 43210", "MOBILE"],
    ["Mobile", "98765-43210", "MOBILE"],
    ["PAN", "ABCDE1234F", "PAN"],
    ["Aadhaar", "2000 0000 0009", "AADHAAR"],
    ["IFSC", "HDFC0001234", "IFSC"],
    ["Account No", "123456789", "ACCOUNT"],
    ["Card number", "4111 1111 1111 1111", "CARD"],
    ["UPI ID", "riya@okaxis", "UPI"],
    ["PIN code", "560001", "PIN"],
    ["Date of birth", "12/04/1995", "DOB"],
    ["Name", "Mira Srinivasan", "PERSON"],
    ["Address", "42 Lake Road", "ADDRESS"]
  ];
  for (const [label, value, kind] of cases) assert.equal(detect(label, value)?.kind, kind, `${label}: ${value}`);
  assert.equal(luhn("4111111111111111"), true);
});

test("does not treat ordinary years, prices, order IDs or invalid cards as private account data", () => {
  assert.equal(detect("Order reference", "ORD-123456789"), null);
  assert.equal(detect("Order reference", "123456789012"), null);
  assert.equal(detect("Invoice", "2024"), null);
  assert.equal(detect("Price", "₹123456789"), null);
  assert.equal(detect("", "₹9876543210"), null);
  assert.equal(detect("", "4111111111111112"), null);
  assert.equal(luhn("4111111111111112"), false);
  assert.equal(redactText("Order ORD-123456789 cost ₹900 in 2024", () => "MASK"), "Order ORD-123456789 cost ₹900 in 2024");
  assert.equal(redactText("Order reference: 123456789012", () => "MASK"), "Order reference: 123456789012");
  assert.equal(redactText("Amount: ₹9876543210", () => "MASK"), "Amount: ₹9876543210");
});

test("password, OTP, card security and password autocomplete fields are never-read classifications", () => {
  assert.equal(detect("Password", "", "password")?.neverRead, true);
  assert.equal(detect("One-time code", "")?.kind, "OTP");
  assert.equal(detect("CVV", "")?.neverRead, true);
});

test("labels determine specific kinds and secrets are hidden without placeholders", () => {
  assert.equal(detect("Account holder name", "Tapan Patidar")?.kind, "PERSON");
  assert.equal(detect("A/C number", "123456789012")?.kind, "ACCOUNT");
  assert.equal(detect("Primary mobile number", "+91 98 765-43210")?.kind, "MOBILE");
  assert.equal(detect("E-mail", "tapan@example.test")?.kind, "EMAIL");
  assert.equal(detect("Password", "secret", "password")?.neverRead, true);
  assert.equal(detect("Card PIN", "1234")?.neverRead, true);
  assert.equal(detect("Unknown field", "123456789012"), null);
  assert.equal(detect("Card number", "4111111111111112"), null);
  assert.equal(detect("Aadhaar", "432187651098"), null);
  assert.equal(redactText("Primary mobile number: +91 98765 43210", kind => `${kind}_1`), "Primary mobile number: MOBILE_1");
  assert.equal(redactText("E-mail: add your email", kind => `${kind}_1`), "E-mail: add your email");
  assert.equal(redactText("Password: hidden-secret\nOTP: 123456", () => { throw new Error("secret placeholder must not be created"); }), "Password: [HIDDEN]\nOTP: [HIDDEN]");
  assert.equal(detect("", "432187651098"), null);
  assert.equal(detect("", "200000000009")?.kind, "AADHAAR");
});

test("label words require boundaries and typed labels validate their values", () => {
  for (const word of ["Expand", "Company", "Japan", "Spanish"]) {
    assert.equal(detect(word, "ordinary value"), null, `${word} must not be read as a PAN label`);
    assert.equal(redactText(word, () => "PAN_1"), word);
  }
  assert.equal(redactText("PAN: ABCDE1234F", kind => `${kind}_1`), "PAN: PAN_1");
  assert.equal(detect("PAN", "ABCDE123XF"), null);
  assert.equal(detect("Mobile", "not a phone"), null);
  assert.equal(detect("E-mail", "add your email"), null);
  assert.equal(detect("PIN code", "12345"), null);
  assert.equal(detect("Date of birth", "31/02/1990"), null);
});

test("outgoing guard allows placeholders and rejects detectable raw values", () => {
  assert.equal(assertSafePayload({ safeContext: "Email: EMAIL_1\nAccount: ACCOUNT_1\nMobile: MOBILE_1", question: "Summarize this" }), true);
  assert.throws(() => assertSafePayload({ safeContext: "Email: mira@example.in", question: "Help" }), /blocked a request/);
  assert.throws(() => assertSafePayload({ safeContext: "Safe context", question: "My mobile is +91 98765 43210" }), /blocked a request/);
  assert.throws(() => assertSafePayload({ safeContext: "secret raw value", question: "help" }, ["secret raw value"]), /blocked a request/);
});

test("outgoing request never invokes fetch when raw PII is present", async () => {
  let calls = 0;
  const fetchSpy = async (_url, options) => { calls++; return { options }; };
  await assert.rejects(sendSafeRequest("https://assistant.example.test/assist", {
    safeContext: "Account number: 123456789012", question: "Summarize this"
  }, fetchSpy), /blocked a request/);
  assert.equal(calls, 0);
  await assert.rejects(sendSafeRequest("https://assistant.example.test/assist", {
    safeContext: "Safe", question: "May I use this?"
  }, fetchSpy, ["May"]), /blocked a request/);
  assert.equal(calls, 0);
  const safe = await sendSafeRequest("https://assistant.example.test/assist", {
    safeContext: "Account: ACCOUNT_1", question: "Summarize this"
  }, fetchSpy);
  assert.equal(calls, 1);
  assert.equal(safe.options.credentials, "omit");
  assert.doesNotMatch(safe.options.body, /123456789012/);
});

test("savings-account labels identify the entire number before generic digit patterns", () => {
  for (const label of ["Account", "Savings Account", "Saving Account Number", "Savings Account No.", "Current Account", "Salary Account", "SB A/c No.", "A / C Number", "Acc.No.", "Acct No.", "Account #", "Demo account number", "Primary account number", "Account a/c"]) {
    for (const value of ["123456789012", "1234 5678 9012", "919876543210", "200000000009"]) {
      assert.equal(detect(label, value)?.kind, "ACCOUNT", label);
    }
  }
  for (const label of ["Account balance", "Account & Lists", "Order reference", "Transaction number"]) {
    assert.equal(detect(label, "123456789012"), null, label);
  }
  assert.equal(detect("Savings Account", "12345678"), null);
  assert.equal(detect("Savings Account", "1234567890123456789"), null);
});

test("savings-account context redacts inline and separate labels without changing amounts", () => {
  const safe = redactText("Savings Account 123456789012\nSavings Account:\n1234 5678 9012\nSB A/c No.: 919876543210\nAccount balance: ₹123456789012\nOrder reference: 123456789012", kind => `${kind}_1`);
  assert.equal(safe, "Savings Account ACCOUNT_1\nSavings Account:\nACCOUNT_1\nSB A/c No.: ACCOUNT_1\nAccount balance: ₹123456789012\nOrder reference: 123456789012");
  assert.throws(() => assertSafePayload({ safeContext: "Savings Account 123456789012", question: "Help" }), /blocked a request/);
});
