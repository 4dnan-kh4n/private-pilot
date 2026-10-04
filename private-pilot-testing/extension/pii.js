(function registerPiiApi(root, factory) {
  if (root.PrivatePilotPii) return;
  const api = factory();
  if (typeof module === "object") module.exports = api;
  root.PrivatePilotPii = api;
})(globalThis, function createPiiApi() {
  const PHONE_RE = /(?<!\d)(?:\+?91[\s().-]*|0[\s().-]*)?[6-9](?:[\s().-]*\d){9}(?!\d)/g;
  const ACCOUNT_LABEL_RE = /\b(?:account\s*(?:number|no\.?|#|a\/c)|a\/c|iban)\b|^(?:(?:savings?|current|salary|bank|sb)\s+)?(?:account|a\s*\/\s*c|acc(?:t)?\.?|iban)(?:\s*(?:number|no\.?|#))?\s*[:\-]?\s*$/i;
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
  const secretLabel = /\b(?:password|passwd|passcode|otp|cvv|cvc|security code)\b|\bone[- ]?time (?:password|code)\b|\bverification code\b|\bcard\s+pin\b|\bpin\b(?!\s*code)/i;
  const labelKinds = [
    ["PERSON", /\b(?:account holder|customer name|full name|first name|last name|your name|name)\b/i],
    ["MOBILE", /\b(?:mobile|phone|telephone|contact|cell)(?:\s+(?:number|no\.?))?\b/i],
    ["EMAIL", /\b(?:e-?mail|mail\s*id)\b/i],
    ["AADHAAR", /\b(?:aadhaar|aadhar|uid)\b/i],
    ["PAN", /\bpan(?:\s+(?:number|card|no\.?))?\b/i],
    ["IFSC", /\bifsc\b/i], ["UPI", /\b(?:upi|vpa)(?:\s+id)?\b/i],
    ["DOB", /\b(?:dob|date of birth|birth date)\b/i],
    ["PIN", /\b(?:pin\s*code|postal\s*code|zip\s*code)\b/i],
    ["ADDRESS", /\b(?:address|street address|city)\b/i],
    ["CARD", /\b(?:card\s*(?:number|no\.?|#)|debit card|credit card)\b/i],
    ["ACCOUNT", ACCOUNT_LABEL_RE],
  ];
  const commonWords = new Set("a an and the hello hi welcome namaste account accounts lists list return returns order orders cart company expand japan spanish english language menu home sign in sign out profile security settings edit update save cancel help contact search your you this that my our customer user name password email mobile phone number pan card address date birth dob pin code postal zip payment amazon shopping today with from have will may mark rose hope grace bill page chip apple orange target prime books deals gift registry shop store".split(" "));

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
  function validAadhaar(value) { return /^(?:[2-9]\d{11}|[2-9]\d{3}[ -]\d{4}[ -]\d{4})$/.test(String(value).trim()) && verhoeff(value); }
  function validMobile(value) { return /^(?:(?:\+?91|0)?[6-9]\d{9})$/.test(String(value).trim().replace(/[\s().-]/g, "")); }
  function validEmail(value) { return /^[A-Z0-9._%+-]+@(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,63}$/i.test(String(value).trim()); }
  function validUpi(value) { return /^[A-Z0-9._-]{2,}@[A-Z][A-Z0-9.-]{1,}$/i.test(String(value).trim()); }
  function validDob(value) {
    const match = String(value).trim().match(/^(\d{1,2})[/-](\d{1,2})[/-]((?:19|20)\d{2})$/);
    if (!match) return false;
    const [, day, month, year] = match.map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }
  function validKind(kind, value) {
    const text = String(value || "").trim();
    if (emptyLikeValue(text)) return false;
    switch (kind) {
      case "PERSON": case "ADDRESS": return true;
      case "MOBILE": return validMobile(text);
      case "EMAIL": return validEmail(text);
      case "AADHAAR": return validAadhaar(text);
      case "PAN": return /^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(text);
      case "IFSC": return /^[A-Z]{4}0[A-Z0-9]{6}$/i.test(text);
      case "UPI": return validUpi(text);
      case "DOB": return validDob(text);
      case "PIN": return /^\d{6}$/.test(text);
      case "CARD": return /^(?:\d[ -]?){13,19}$/.test(text) && luhn(text);
      case "ACCOUNT": return /^\d{9,18}$/.test(text.replace(/[ -]/g, ""));
      default: return false;
    }
  }

  function emptyLikeValue(value) {
    return !String(value || "").trim() || /^(?:add|enter|type|your|please enter|e\.g\.?)[\s\w'-]*(?:email|e-mail|phone|mobile|name|address|value)?$/i.test(String(value).trim());
  }
  function isCommonNamePart(value) { return commonWords.has(String(value).toLocaleLowerCase()); }
  function detect(label = "", value = "", type = "") {
    const labelText = String(label).trim();
    const trustedLabel = labelText.split(/\s+/).filter(Boolean).length <= 5 ? labelText : "";
    const hint = `${trustedLabel} ${type}`;
    if (String(type).toLowerCase() === "password" || secretLabel.test(hint)) return { kind: /otp|one[- ]?time|verification code/i.test(hint) ? "OTP" : "PASSWORD", confidence: "High", neverRead: true };
    const amountContext = /order|transaction|invoice|reference|tracking|receipt|price|amount/i.test(hint) || /₹|\bINR\b/i.test(value);
    if (amountContext) return null;
    const text = String(value || "").trim();
    const explicit = labelKinds.find(([, re]) => re.test(trustedLabel));
    if (explicit) return validKind(explicit[0], text) ? { kind: explicit[0], confidence: "High" } : null;
    if (!text || emptyLikeValue(text)) return null;
    // Indian phone formats are checked before Aadhaar/card digit sequences.
    for (const kind of ["MOBILE", "AADHAAR", "PAN", "IFSC", "EMAIL", "UPI", "DOB", "PIN", "CARD"]) {
      if (validKind(kind, text)) return { kind, confidence: "High" };
    }
    return null;
  }

  function redactText(text, getPlaceholder, { allowLabels = true, personParts = [], personNames = [] } = {}) {
    let safe = String(text);
    const placeholder = (kind, value) => getPlaceholder(kind, value);
    const alreadyPlaceholder = value => /^(?:[A-Z]+_\d+)(?:\s+[A-Z]+_\d+)*$/i.test(String(value).trim());
    // An explicit account label takes precedence over phone/Aadhaar-shaped digits.
    const accountLines = safe.split("\n");
    for (let i = 0; i < accountLines.length; i++) {
      const inline = accountLines[i].match(/^(\s*.*?)([:\-]\s*|\s+)(\d(?:[ \t-]*\d){8,17})(\s*)$/);
      if (inline && detect(inline[1], inline[3])?.kind === "ACCOUNT") {
        accountLines[i] = `${inline[1]}${inline[2]}${placeholder("ACCOUNT", inline[3])}${inline[4]}`;
      } else if (i + 1 < accountLines.length && detect(accountLines[i], accountLines[i + 1])?.kind === "ACCOUNT") {
        const raw = accountLines[i + 1].trim();
        accountLines[i + 1] = accountLines[i + 1].replace(raw, placeholder("ACCOUNT", raw));
        i++;
      }
    }
    safe = accountLines.join("\n");
    if (allowLabels) {
      const lines = safe.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const current = lines[i];
        const labelMatch = current.match(/^\s*([\p{L}\p{N}][\p{L}\p{N} /#&.'’-]{0,58}?)\s*[:\-]\s*(.*?)\s*$/u);
        if (labelMatch) {
          const label = labelMatch[1].trim();
          if (label.split(/\s+/).length > 5) continue;
          let value = labelMatch[2].trim();
          let valueLine = i;
          if (!value && i + 1 < lines.length && lines[i + 1].trim()) { value = lines[i + 1].trim(); valueLine = i + 1; }
          if (!value || emptyLikeValue(value) || alreadyPlaceholder(value)) continue;
          const found = detect(label, value);
          if (found) {
            const safeValue = found.neverRead ? "[HIDDEN]" : placeholder(found.kind, value);
            if (valueLine === i) lines[i] = `${current.slice(0, current.search(/[:\-]/) + 1)} ${safeValue}`;
            else lines[valueLine] = safeValue;
          }
        }
      }
      safe = lines.join("\n");
    }
    // Greetings are an explicit, narrow person-name context, including navigation greetings.
    const greeting = /\b(hello|hi|welcome|namaste)(\s*,?\s+)([\p{Lu}][\p{L}'’-]{2,}(?:\s+[\p{Lu}][\p{L}'’-]{2,}){0,2})(?![\p{L}\p{N}_])/gu;
    safe = safe.replace(greeting, (all, salutation, spacer, name) => {
      const parts = name.split(/\s+/);
      if (parts.every(isCommonNamePart)) return all;
      return `${salutation}${spacer}${placeholder("PERSON", name)}`;
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
    for (const [name, token] of personNames) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      safe = safe.replace(new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, "giu"), token);
    }
    for (const [part, token] of personParts) {
      if (part.length < 3 || isCommonNamePart(part)) continue;
      const escaped = part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      safe = safe.replace(new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, "giu"), token);
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
  return { detect, luhn, verhoeff, redactText, assertSafePayload, isCommonNamePart, patterns };
});
