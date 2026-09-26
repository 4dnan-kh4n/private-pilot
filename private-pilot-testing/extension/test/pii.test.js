const assert = require("node:assert/strict");
const test = require("node:test");
const { detect } = require("../pii.js");

test("PII detector identifies supported labels and reliable value patterns", () => {
  assert.equal(detect("Full name", "Aarav Demo")?.kind, "PERSON");
  assert.equal(detect("Email", "demo@example.com")?.kind, "EMAIL");
  assert.equal(detect("Contact", "+91 98765 43210")?.kind, "PHONE");
  assert.equal(detect("Bank account number", "123456789012")?.kind, "ACCOUNT");
  assert.equal(detect("Home address", "12 Demo Street")?.kind, "ADDRESS");
  assert.equal(detect("Password", "secret", "password")?.kind, "PASSWORD");
  assert.equal(detect("OTP", "123456")?.kind, "OTP");
  assert.equal(detect("Why should we hire you?", "I solve problems."), null);
});
