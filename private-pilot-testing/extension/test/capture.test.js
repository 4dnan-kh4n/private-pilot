const assert = require("node:assert/strict");
const test = require("node:test");
const { capture, isVisible } = require("../capture.js");

function field({ id, type = "text", value = "", label, hidden = false }) {
  return {
    id,
    type,
    value,
    hidden,
    name: id,
    labels: label ? [{ textContent: label }] : [],
    getAttribute() { return null; }
  };
}

test("capture returns visible mock dashboard text and labelled fields", () => {
  const name = field({ id: "profileName", value: "Aarav Demo", label: "Full name" });
  const reason = field({ id: "hireReason", value: "I solve problems.", label: "Why should we hire you?" });
  const password = field({ id: "password", type: "password", value: "never-capture", label: "Password" });
  const hidden = field({ id: "internal", value: "hidden", hidden: true });
  const fakeDocument = {
    title: "Private dashboard",
    body: { innerText: "Your profile\nAarav Demo\nAccount 123456789012" },
    querySelectorAll() { return [name, reason, password, hidden]; },
    querySelector() { return null; }
  };

  const result = capture(fakeDocument);
  assert.equal(result.pageTitle, "Private dashboard");
  assert.match(result.text, /Account 123456789012/);
  assert.deepEqual(result.fields.map(item => item.label), ["Full name", "Why should we hire you?"]);
  assert.doesNotMatch(JSON.stringify(result.fields), /never-capture/);
});

test("capture excludes hidden elements", () => {
  assert.equal(isVisible(field({ id: "visible" })), true);
  assert.equal(isVisible(field({ id: "hidden", hidden: true })), false);
  assert.equal(isVisible(field({ id: "secret", type: "hidden" })), false);
});
