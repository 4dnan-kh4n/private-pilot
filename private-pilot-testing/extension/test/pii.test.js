const assert = require("node:assert/strict");
const test = require("node:test");
const { detect, luhn, redactText, assertSafePayload, sendSafeRequest } = require("../pii.js");

test("detects Indian banking, identity and contact formats", () => {
  const cases = [
    ["Email", "a.person@example.in", "EMAIL"],
    ["Mobile", "+91 98765 43210", "PHONE"],
    ["Mobile", "98765-43210", "PHONE"],
    ["PAN", "ABCDE1234F", "PAN"],
    ["Aadhaar", "4321 8765 1098", "AADHAAR"],
    ["IFSC", "HDFC0001234", "IFSC"],
    ["Account No", "123456789", "ACCOUNT"],
    ["Card number", "4111 1111 1111 1111", "CARD"],
    ["UPI ID", "riya@okaxis", "UPI"],
    ["PIN code", "560001", "PINCODE"],
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
  assert.equal(detect("CVV", "")?.kind, "CARD");
});

test("outgoing guard allows placeholders and rejects detectable raw values", () => {
  assert.equal(assertSafePayload({ safeContext: "Email: EMAIL_1\nAccount: ACCOUNT_1", question: "Summarize this" }), true);
  assert.throws(() => assertSafePayload({ safeContext: "Email: mira@example.in", question: "Help" }), /blocked a request/);
  assert.throws(() => assertSafePayload({ safeContext: "Safe context", question: "My mobile is +91 98765 43210" }), /blocked a request/);
  assert.throws(() => assertSafePayload({ safeContext: "secret raw value", question: "help" }, ["secret raw value"]), /blocked a request/);
});

test("outgoing request never invokes fetch when raw PII is present", async () => {
  let calls = 0;
  const fetchSpy = async (_url, options) => { calls++; return { options }; };
  await assert.rejects(sendSafeRequest("https://assistant.example.test/assist", {
    safeContext: "Account: 123456789012", question: "Summarize this"
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
