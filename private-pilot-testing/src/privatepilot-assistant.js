function hasRawPII(value) {
  return /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/.test(value)
    || /\b\d{8,24}\b/.test(value)
    || /(?:\+?\d[\d\s().-]{6,}\d)/.test(value);
}

function validateSafeRequest({ safeContext, question }) {
  if (!safeContext || safeContext.length > 20000 || !question || question.length > 1000) return false;
  return !hasRawPII(`${safeContext}\n${question}`);
}

function validateAction(action) {
  if (!action) return null;
  if (action.type !== "fill_field" || !["hireReason", "strongestSkills", "challengeSolved"].includes(action.fieldId)) return null;
  if (typeof action.value !== "string" || !action.value.trim() || action.value.length > 500) return null;
  return { type: "fill_field", fieldId: action.fieldId, value: action.value.trim() };
}

function localDemoReply(question) {
  if (/why should we hire you/i.test(question)) {
    return {
      answer: "Draft: You should hire me because I combine practical problem-solving with clear communication, learn quickly, and take ownership of delivering reliable results.",
      action: { type: "fill_field", fieldId: "hireReason", value: "I combine practical problem-solving with clear communication, learn quickly, and take ownership of delivering reliable results." }
    };
  }
  if (/what is my name|account|email|phone/i.test(question)) {
    return { answer: "PrivatePilot received placeholders only, so I do not know the real personal value.", action: null };
  }
  return { answer: "Local demo mode: I can help with the safe context, but I do not receive real personal values.", action: null };
}

async function askSafeAssistant({ safeContext, question }, { fetchImpl = fetch, environment = process.env } = {}) {
  const url = environment.PRIVATEPILOT_LLM_URL;
  const apiKey = environment.PRIVATEPILOT_LLM_API_KEY;
  if (!url || !apiKey) return { mode: "local-demo", ...localDemoReply(question) };

  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: environment.PRIVATEPILOT_LLM_MODEL || "configured-by-deployer",
      messages: [
        { role: "system", content: "Answer using only the supplied safe context. Never infer placeholder values. Return JSON with answer and action. action must be null or {type:'fill_field',fieldId:'hireReason'|'strongestSkills'|'challengeSolved',value:string}." },
        { role: "user", content: `Safe context:\n${safeContext}\n\nQuestion: ${question}` }
      ]
    })
  });
  if (!response.ok) throw new Error("Configured AI service is unavailable.");
  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content || data.output_text;
  if (!raw) throw new Error("Configured AI service returned no answer.");
  let parsed;
  try { parsed = typeof raw === "string" ? JSON.parse(raw) : raw; } catch { throw new Error("Configured AI service returned an invalid response."); }
  if (typeof parsed.answer !== "string") throw new Error("Configured AI service returned an invalid response.");
  return { mode: "configured-cloud", answer: parsed.answer, action: validateAction(parsed.action) };
}

module.exports = { askSafeAssistant, hasRawPII, validateSafeRequest, validateAction };
