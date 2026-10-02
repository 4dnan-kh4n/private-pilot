(function registerPiiApi(root, factory) {
  const api = factory();
  if (typeof module === "object") module.exports = api;
  root.PrivatePilotPii = api;
})(globalThis, function createPiiApi() {
  const PHONE_RE = /(?<!\d)(?:\+?91[\s().-]*|0[\s().-]*)?[6-9](?:[\s().-]*\d){9}(?!\d)/g;
  const patterns = [
    ["MOBILE", PHONE_RE],
    ["EMAIL", /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/ig],
    ["PAN", /\b[A-Z]{5}\d{4}[A-Z]\b/ig],
    ["AADHAAR", /(?<!\d)[2-9]\d{3}[ -]?\d{4}[ -]?\d{4}(?!\d)/g],
    ["IFSC", /\b[A-Z]{4}0[A-Z0-9]{6}\b/ig],
    ["UPI", /\b[A-Z0-9._-]{2,}@[A-Z][A-Z0-9.-]{1,}\b/ig],
    ["CARD", /(?<!\d)(?:\d[ -]?){13,19}(?!\d)/g],
    ["DOB", /\b(?:0?[1-9]|[12]\d|3[01])[/-](?:0?[1-9]|1[0-2])[/-](?:19|20)\d{2}\b/g],
  ];
  const secretLabel = /password|passwd|passcode|\botp\b|one[- ]?time (?:password|code)|verification code|cvv|cvc|card\s+pin|\bpin\b(?!\s*code)|security code/i;
  const labelKinds = [
    ["PERSON", /account holder|customer name|full name|first name|last name|\bname\b/i],
    ["MOBILE", /mobile|phone|contact|cell/i],
    ["EMAIL", /e-?mail|mail\s*id/i],
    ["AADHAAR", /aadhaar|aadhar|\buid\b/i],
    ["PAN", /\bpan\b/i], ["IFSC", /\bifsc\b/i], ["UPI", /\bupi\b|\bvpa\b/i],
    ["DOB", /\bdob\b|date of birth/i], ["PIN", /pin\s*code|postal\s*code|zip\s*code/i],
    ["ADDRESS", /address|street|city/i], ["CARD", /card\s*(?:number|no\b)|debit card|credit card/i],
    ["ACCOUNT", /account\s*(?:number|no\b|#|\ba\/c\b)|\ba\/c\b|iban/i],
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

  function verhoeff(value) {
    const d = [[0,1,2,3,4,5,6,7,8,9],[1,2,3,4,0,6,7,8,9,5],[2,3,4,0,1,7,8,9,5,6],[3,4,0,1,2,8,9,5,6,7],[4,0,1,2,3,9,5,6,7,8],[5,9,8,7,6,0,4,3,2,1],[6,5,9,8,7,1,0,4,3,2],[7,6,5,9,8,2,1,0,4,3],[8,7,6,5,9,3,2,1,0,4],[9,8,7,6,5,4,3,2,1,0]];
    const p = [[0,1,2,3,4,5,6,7,8,9],[1,5,7,6,2,8,3,0,9,4],[5,8,0,3,7,9,6,1,4,2],[8,9,1,6,0,4,3,5,2,7],[9,4,5,3,1,2,6,8,7,0],[4,2,8,6,5,7,3,9,0,1],[2,7,9,3,8,0,6,4,1,5],[7,0,4,6,9,1,3,2,5,8]];
    let c = 0;
    const digits = value.replace(/\D/g, "").split("").reverse();
    for (let i = 0; i < digits.length; i++) c = d[c][p[i % 8][Number(digits[i])]];
    return c === 0;
  }
  function validAadhaar(value) { return /^[2-9](?:\d[ -]?){10}\d$/.test(String(value).trim()) && verhoeff(value); }

  function emptyLikeValue(value) {
    return !String(value || "").trim() || /^(?:add|enter|type|your|please enter|e\.g\.?)[\s\w'-]*(?:email|e-mail|phone|mobile|name|address|value)?$/i.test(String(value).trim());
  }
  function detect(label = "", value = "", type = "") {
    const hint = `${label} ${type}`;
    if (String(type).toLowerCase() === "password" || secretLabel.test(hint)) return { kind: /otp|one[- ]?time|verification code/i.test(hint) ? "OTP" : "PASSWORD", confidence: "High", neverRead: true };
    const amountContext = /order|transaction|invoice|reference|tracking|receipt|price|amount/i.test(hint) || /₹|\bINR\b/i.test(value);
    if (amountContext) return null;
    const explicit = labelKinds.find(([, re]) => re.test(label));
    const text = String(value || "").trim();
    if (explicit?.[0] === "CARD" && text && (!/^(?:\d[ -]?){13,19}$/.test(text) || !luhn(text))) return null;
    if (explicit?.[0] === "AADHAAR" && text && !validAadhaar(text)) return null;
    if (explicit) return { kind: explicit[0], confidence: "High" };
    if (!text || emptyLikeValue(text)) return null;
    // Indian phone formats are checked before Aadhaar/card digit sequences.
    const phone = text.match(new RegExp(`^${PHONE_RE.source}$`));
    if (phone) return { kind: "MOBILE", confidence: "High" };
    if (validAadhaar(text)) return { kind: "AADHAAR", confidence: "High" };
    if (/^[A-Z]{5}\d{4}[A-Z]$/i.test(text)) return { kind: "PAN", confidence: "High" };
    if (/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(text)) return { kind: "IFSC", confidence: "High" };
    if (/^[A-Z0-9._-]{2,}@[A-Z][A-Z0-9.-]{1,}$/i.test(text) && !/@[^.]+\.[A-Z]{2,}$/i.test(text)) return { kind: "UPI", confidence: "High" };
    if (/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(text)) return { kind: "EMAIL", confidence: "High" };
    if (/^(?:0?[1-9]|[12]\d|3[01])[/-](?:0?[1-9]|1[0-2])[/-](?:19|20)\d{2}$/.test(text)) return { kind: "DOB", confidence: "High" };
    if (/^(?:\d[ -]?){13,19}$/.test(text) && luhn(text)) return { kind: "CARD", confidence: "High" };
    return null;
  }

  function redactText(text, getPlaceholder) {
    let safe = String(text);
    const placeholder = (kind, value) => getPlaceholder(kind, value);
    const alreadyPlaceholder = value => /^(?:PERSON|MOBILE|EMAIL|AADHAAR|PAN|CARD|ACCOUNT|IFSC|UPI|PIN|DOB|ADDRESS|PRIVATE)_\d+$/i.test(String(value).trim());
    // Labels win over value shapes, including a label and its value on the following line.
    const labelPattern = /(?:password|passwd|passcode|otp|one[- ]?time (?:password|code)|verification code|cvv|cvc|card\s+pin|pin\s+number|\bpin\b(?!\s*code)|security code|account holder|customer name|full name|first name|last name|primary mobile number|mobile number|phone number|contact number|mail\s*id|e-?mail|mobile|phone|contact|cell|\bname\b|aadhaar|aadhar|\buid\b|\bpan\b|\bifsc\b|\bupi\b|\bvpa\b|\bdob\b|date of birth|pin\s*code|postal\s*code|zip\s*code|address|street|card\s*(?:number|no\b)|debit card|credit card|account\s*(?:number|no\b|#)|a\/c|iban)(?:\s*[:\-]\s*|\s*\n\s*)([^\n,;]{1,100})/ig;
    safe = safe.replace(labelPattern, (all, rawValue, offset, whole) => {
      const label = all.slice(0, all.length - rawValue.length).replace(/[:\-\s]+$/, "").trim();
      const value = rawValue.trim();
      if (!value || emptyLikeValue(value) || alreadyPlaceholder(value)) return all;
      const found = detect(label, value);
      if (!found) return all;
      return `${all.slice(0, all.length - rawValue.length)}${found.neverRead ? "[HIDDEN]" : placeholder(found.kind, value)}`;
    });
    for (const [kind, source] of patterns) {
      const re = new RegExp(source.source, source.flags);
      safe = safe.replace(re, (match, offset, whole) => {
        const nearby = whole.slice(Math.max(0, offset - 45), offset);
        if (/order|transaction|invoice|reference|tracking|receipt|price|amount/i.test(nearby) || /(?:₹|\bINR\s*)\s*$/.test(nearby)) return match;
        if (kind === "CARD" && !luhn(match)) return match;
        if (kind === "AADHAAR" && !verhoeff(match)) return match;
        const found = detect("", match);
        return found?.kind === kind && !found.neverRead ? placeholder(kind, match) : match;
      });
    }
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
  return { detect, luhn, verhoeff, redactText, assertSafePayload, sendSafeRequest, patterns };
});
