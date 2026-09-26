const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const session = require("express-session");
const { createApp } = require("../server");

function buildTestApp(privatePilotAssistant) {
  const users = [];
  const User = {
    async exists({ email }) { return users.some(user => user.email === email); },
    async create(data) { const user = { ...data, _id: String(users.length + 1), hireReason: "" }; users.push(user); return user; },
    findOne({ email }) { return { select: async () => users.find(user => user.email === email) || null }; },
    findById(id) { return { lean: async () => users.find(user => user._id === id) || null }; },
    findByIdAndUpdate(id, update) { return { lean: async () => { const user = users.find(item => item._id === id); if (user) Object.assign(user, update); return user || null; } }; }
  };
  return createApp({ User, connectDatabase: async () => {}, sessionStore: new session.MemoryStore(), privatePilotAssistant });
}

test("profile API rejects a browser without a session", async () => {
  const response = await request(buildTestApp()).get("/api/profile");
  assert.equal(response.status, 401);
  assert.equal(response.body.message, "Please log in to view this profile.");
});

test("registration succeeds, login creates an HTTP-only session, and another browser is denied", async () => {
  const app = buildTestApp();
  const loggedInBrowser = request.agent(app);
  const registration = await loggedInBrowser.post("/api/auth/register").send({
    name: "Jordan Reed", age: 21, bankAccountNumber: "12345678",
    email: "jordan@example.test", password: "dummy-pass-123"
  });
  assert.equal(registration.status, 201);
  assert.equal(registration.body.message, "Registration successful. Please log in.");

  const beforeLogin = await loggedInBrowser.get("/api/profile");
  assert.equal(beforeLogin.status, 401);

  const login = await loggedInBrowser.post("/api/auth/login").send({
    email: "jordan@example.test", password: "dummy-pass-123"
  });
  assert.equal(login.status, 200);
  assert.match(login.headers["set-cookie"][0], /HttpOnly/i);
  assert.match(login.headers["set-cookie"][0], /SameSite=Lax/i);

  const ownProfile = await loggedInBrowser.get("/api/profile");
  assert.equal(ownProfile.status, 200);
  assert.equal(ownProfile.body.name, "Jordan Reed");
  assert.equal(ownProfile.body.bankAccountNumber, "12345678");
  assert.equal(Object.hasOwn(ownProfile.body, "passwordHash"), false);

  const differentBrowser = await request(app).get("/api/profile");
  assert.equal(differentBrowser.status, 401);

  const saved = await loggedInBrowser.patch("/api/profile").send({
    hireReason: "I learn quickly and communicate clearly.",
    strongestSkills: "Problem solving and backend development.",
    challengeSolved: "I diagnosed and fixed a deployment configuration issue."
  });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.profile.strongestSkills, "Problem solving and backend development.");
  assert.equal(saved.body.profile.challengeSolved, "I diagnosed and fixed a deployment configuration issue.");
});

test("PrivatePilot rejects raw PII before the assistant layer", async () => {
  let received;
  const app = buildTestApp(async payload => { received = payload; return { mode: "configured-cloud", answer: "Should not run" }; });
  const response = await request(app).post("/api/privatepilot/assist").send({
    safeContext: "Full name\nAarav Demo\nAccount\n123456789012",
    question: "Help me answer why should we hire you?"
  });
  assert.equal(response.status, 400);
  assert.equal(received, undefined);
});

test("PrivatePilot sends only redacted context to the assistant and supports local demo mode", async () => {
  let received;
  const safeContext = "Full name\nPERSON_1\nBank account number\nACCOUNT_1";
  const configuredApp = buildTestApp(async payload => { received = payload; return { mode: "configured-cloud", answer: "Safe answer" }; });
  const configured = await request(configuredApp).post("/api/privatepilot/assist").send({ safeContext, question: "Help me answer why should we hire you?" });
  assert.equal(configured.status, 200);
  assert.deepEqual(received, { safeContext, question: "Help me answer why should we hire you?" });
  assert.doesNotMatch(JSON.stringify(received), /Aarav Demo|123456789012/);

  const local = await request(buildTestApp()).post("/api/privatepilot/assist").send({ safeContext, question: "What is my name?" });
  assert.equal(local.status, 200);
  assert.equal(local.body.mode, "local-demo");
  assert.match(local.body.answer, /do not know the real personal value/i);

  const action = await request(buildTestApp()).post("/api/privatepilot/assist").send({ safeContext, question: "Help me answer why should we hire you?" });
  assert.equal(action.status, 200);
  assert.deepEqual(action.body.action, {
    type: "fill_field",
    fieldId: "hireReason",
    value: "I combine practical problem-solving with clear communication, learn quickly, and take ownership of delivering reliable results."
  });
});
