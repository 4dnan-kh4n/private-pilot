(function registerPiiApi(root, factory) {
  const api = factory();
  if (typeof module === "object") module.exports = api;
  root.PrivatePilotPii = api;
})(globalThis, function createPiiApi() {
  const rules = [
    { kind: "PASSWORD", label: /password|passcode/i, confidence: "High" },
    { kind: "OTP", label: /\b(otp|one[- ]?time|verification code|security code)\b/i, confidence: "High" },
    { kind: "ACCOUNT", label: /bank|account|iban|card number/i, value: /\b\d{8,24}\b/, confidence: "High" },
    { kind: "EMAIL", label: /e-?mail/i, value: /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/, confidence: "High" },
    { kind: "PHONE", label: /phone|mobile|telephone|contact number/i, value: /(?:\+?\d[\d\s().-]{6,}\d)/, confidence: "Medium" },
    { kind: "ADDRESS", label: /address|street|city|postal|zip|pincode/i, confidence: "Medium" },
    { kind: "PERSON", label: /full name|first name|last name|your name|\bname\b/i, confidence: "High" }
  ];

  function detect(label = "", value = "", type = "") {
    const input = `${label} ${value}`;
    const passwordRule = rules[0];
    if (type === "password" || passwordRule.label.test(input)) return { kind: passwordRule.kind, confidence: passwordRule.confidence };

    for (const rule of rules.slice(1)) {
      if (rule.label.test(label) || (rule.value && rule.value.test(value))) return { kind: rule.kind, confidence: rule.confidence };
    }
    return null;
  }

  return { detect };
});
