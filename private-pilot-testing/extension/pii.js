(function registerPiiApi(root, factory) {
  const api = factory();
  if (typeof module === "object") module.exports = api;
  root.PrivatePilotPii = api;
})(globalThis, function createPiiApi() {
  const patterns = [
    ["EMAIL", /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/ig],
    ["PAN", /\b[A-Z]{5}\d{4}[A-Z]\b/ig],
    ["AADHAAR", /\b(?:\d{4}[ -]?){2}\d{4}\b/g],
    ["IFSC", /\b[A-Z]{4}0[A-Z0-9]{6}\b/ig],
    ["UPI", /\b[A-Z0-9._-]{2,}@[A-Z][A-Z0-9.-]{1,}\b/ig],
    ["CARD", /\b(?:\d[ -]?){13,19}\b/g],
    ["PHONE", /(?<!\d)(?:\+?91[ -]?)?[6-9]\d{4}[ -]?\d{5}(?!\d)/g],
    ["DOB", /\b(?:0?[1-9]|[12]\d|3[01])[/-](?:0?[1-9]|1[0-2])[/-](?:19|20)\d{2}\b/g],
  ];
  const labels = [
    ["PASSWORD", /password|passwd|passcode|secret/i],
    ["OTP", /\b(?:otp|one[- ]?time (?:password|code)|verification code|security code)\b/i],
    ["CARD", /cvv|cvc|security code|card number|debit card|credit card/i],
    ["AADHAAR", /aadhaar|aadhar|uid(?:ai)?/i],
    ["PAN", /\bpan(?: number)?\b/i], ["IFSC", /\bifsc\b/i],
    ["UPI", /upi(?: id)?|vpa/i], ["ACCOUNT", /account(?: number| no\.?| #)?|iban/i],
    ["PHONE", /mobile|phone|telephone|contact number/i], ["EMAIL", /e-?mail/i],
    ["ADDRESS", /address|street|city|postal address/i], ["PINCODE", /pin ?code|postal code|zip code/i],
    ["DOB", /date of birth|\bdob\b|birth date/i], ["PERSON", /full name|first name|last name|your name|\bname\b/i]
  ];

  function luhn(value) {
    const digits = value.replace(/\D/g, "");
    if (digits.length < 13 || digits.length > 19) return false;
    let sum = 0;
    for (let i = 0; i < digits.length; i++) {
      let n = Number(digits[digits.length - 1 - i]);
      if (i % 2) { n *= 2; if (n > 9) n -= 9; }
      sum += n;
    }
    return sum % 10 === 0;
  }

  function detect(label = "", value = "", type = "") {
    const hint = `${label} ${type}`;
    const digits = value.replace(/\D/g, "");
    if ((/order|transaction|invoice|reference|tracking|receipt|price|amount/i.test(hint) || /₹|\bINR\b/i.test(value)) && /^\d{6,19}$/.test(digits)) return null;
    const secret = labels.find(([kind, re]) => ["PASSWORD", "OTP"].includes(kind) && re.test(hint));
    if (type === "password" || secret) return { kind: secret?.[0] || "PASSWORD", confidence: "High", neverRead: true };
    const direct = labels.find(([kind, re]) => re.test(hint) && kind !== "PERSON" && kind !== "ADDRESS");
    if (direct) return { kind: direct[0], confidence: "High" };
    if (/account(?: number| no\.?| #)?|iban/i.test(hint) && /^\d{9,18}$/.test(value.replace(/[ -]/g, ""))) return { kind: "ACCOUNT", confidence: "High" };
    for (const [kind, re] of patterns) {
      const match = value.match(re)?.[0];
      if (!match) continue;
      if (kind === "CARD" && !luhn(match)) continue;
      if (kind === "ACCOUNT" && (/^(19|20)\d{2}$/.test(match) || /(?:₹|\bINR\s*)\s*\d/.test(label))) continue;
      return { kind, confidence: "High" };
    }
    const person = labels.find(([kind, re]) => kind === "PERSON" && re.test(hint));
    if (person && value.trim()) return { kind: "PERSON", confidence: "High" };
    const address = labels.find(([kind, re]) => kind === "ADDRESS" && re.test(hint));
    if (address && value.trim()) return { kind: "ADDRESS", confidence: "Medium" };
    return null;
  }

  function redactText(text, getPlaceholder) {
    const put = (kind, value) => /^(?:PERSON|ACCOUNT|EMAIL|PHONE|PAN|AADHAAR|IFSC|CARD|UPI|PINCODE|DOB|ADDRESS|PASSWORD|OTP|PRIVATE)_\d+$/i.test(String(value)) ? value : getPlaceholder(kind, value);
    let safe = String(text);
    for (const [kind, re] of patterns) {
      safe = safe.replace(re, (match, offset, whole) => {
        const nearby = whole.slice(Math.max(0, offset - 40), offset);
        if ((/order|transaction|invoice|reference|tracking|receipt|price|amount/i.test(nearby) || /(?:₹|\bINR\s*)\s*$/.test(nearby)) && /^\d+$/.test(match.replace(/[ -]/g, ""))) return match;
        if (kind === "CARD" && !luhn(match)) return match;
        if (kind === "ACCOUNT" && (/^(19|20)\d{2}$/.test(match) || /(?:₹|INR\s*)\s*\d/.test(safe.slice(Math.max(0, safe.indexOf(match) - 8), safe.indexOf(match))))) return match;
        return put(kind, match);
      });
    }
    // Names and addresses are redacted only with nearby explicit labels to avoid masking ordinary prose.
    safe = safe.replace(/\b(?:full name|first name|last name|your name|name)\s*[:\-]?\s*([\p{Lu}][\p{L}'’-]+(?:\s+[\p{Lu}][\p{L}'’-]+){0,2})(?![\p{L}\p{N}_])/giu,
      (_all, value) => `${_all.slice(0, _all.length - value.length)}${put("PERSON", value)}`);
    safe = safe.replace(/\b(password|passcode|otp|one[- ]?time (?:password|code)|verification code|cvv|cvc|security code)\s*[:\-]\s*([^\n,;]{1,48})/gi,
      (all, label, value) => `${all.slice(0, all.length - value.length)}${put(/otp|one[- ]?time|verification/i.test(label) ? "OTP" : /cvv|cvc|security code/i.test(label) ? "CARD" : "PASSWORD", value)}`);
    safe = safe.replace(/\b(?:account(?: number| no\.?| #)?|aadhaar|aadhar|pan(?: number)?|ifsc|upi(?: id)?|mobile|phone|e-?mail|pin ?code|postal code|date of birth|dob|address|street address)(?:\s*[:\-]\s*|\s*\n\s*)([^\n,;]{3,48})/gi,
      (all, value) => `${all.slice(0, all.length - value.length)}${put(detect(all.slice(0, all.length - value.length), value)?.kind || "PRIVATE", value)}`);
    return safe;
  }
  function assertSafePayload(payload, knownPrivateValues = []) {
    const text = `${payload?.safeContext || ""}\n${payload?.question || ""}`;
    if (knownPrivateValues.some(value => value && String(value).length >= 3 && text.includes(String(value)))
      || redactText(text, () => "__PRIVATE__") !== text) {
      throw new Error("PrivatePilot blocked a request containing a detected private value. Review the redacted context and try again.");
    }
    return true;
  }
  async function sendSafeRequest(endpoint, payload, fetchImpl = fetch, knownPrivateValues = []) {
    assertSafePayload(payload, knownPrivateValues);
    return fetchImpl(endpoint, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload), cache: "no-store", credentials: "omit"
    });
  }
  return { detect, luhn, redactText, assertSafePayload, sendSafeRequest, patterns };
});
