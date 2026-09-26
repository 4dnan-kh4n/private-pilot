require("dotenv").config();
const path = require("path");
const express = require("express");
const helmet = require("helmet");
const session = require("express-session");
const { MongoStore } = require("connect-mongo");
const bcrypt = require("bcryptjs");
const { connectDatabase } = require("./src/db");
const User = require("./src/models/User");
const { askSafeAssistant, validateSafeRequest, validateAction } = require("./src/privatepilot-assistant");

function publicProfile(user) {
  return {
    name: user.name,
    age: user.age,
    bankAccountNumber: user.bankAccountNumber,
    hireReason: user.hireReason || "",
    strongestSkills: user.strongestSkills || "",
    challengeSolved: user.challengeSolved || ""
  };
}

function createApp(dependencies = {}) {
  const Model = dependencies.User || User;
  const connect = dependencies.connectDatabase || connectDatabase;
  const privatePilotAssistant = dependencies.privatePilotAssistant || askSafeAssistant;
  const store = dependencies.sessionStore || (process.env.MONGODB_URI
    ? MongoStore.create({ mongoUrl: process.env.MONGODB_URI, collectionName: "sessions", ttl: 60 * 60 * 4 })
    : new session.MemoryStore());
  const app = express();
  app.set("trust proxy", 1);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(express.json({ limit: "20kb" }));
  app.use(session({
    name: "privatepilot.sid",
    secret: process.env.SESSION_SECRET || "development-only-change-me",
    store,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 4
    }
  }));
  app.use(express.static(path.join(__dirname, "public")));
  app.use("/api/privatepilot", (req, res, next) => {
    const origin = req.get("origin") || "";
    if (origin.startsWith("chrome-extension://")) {
      res.set("Access-Control-Allow-Origin", origin);
      res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.set("Access-Control-Allow-Headers", "Content-Type");
    }
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });

  app.post("/api/privatepilot/assist", async (req, res, next) => {
    try {
      const safeContext = String(req.body.safeContext || "").trim();
      const question = String(req.body.question || "").trim();
      if (!validateSafeRequest({ safeContext, question })) return res.status(400).json({ message: "PrivatePilot accepts redacted context only." });
      const result = await privatePilotAssistant({ safeContext, question });
      res.set("Cache-Control", "no-store");
      res.json({ mode: result.mode, answer: result.answer, action: validateAction(result.action) });
    } catch (error) { next(error); }
  });

  app.use("/api", async (req, _res, next) => {
    if (req.path.startsWith("/privatepilot/")) return next();
    try { await connect(); next(); } catch (error) { next(error); }
  });

  function requireAuth(req, res, next) {
    if (!req.session.userId) return res.status(401).json({ message: "Please log in to view this profile." });
    next();
  }

  app.post("/api/auth/register", async (req, res, next) => {
    try {
      const email = String(req.body.email || "").trim().toLowerCase();
      const password = String(req.body.password || "");
      const name = String(req.body.name || "").trim();
      const age = Number(req.body.age);
      const bankAccountNumber = String(req.body.bankAccountNumber || "").replace(/[\s-]/g, "");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: "Enter a valid email address." });
      if (password.length < 8 || password.length > 72) return res.status(400).json({ message: "Use a password containing 8–72 characters." });
      if (name.length < 2 || name.length > 80) return res.status(400).json({ message: "Enter a name containing 2–80 characters." });
      if (!Number.isInteger(age) || age < 16 || age > 100) return res.status(400).json({ message: "Enter an age between 16 and 100." });
      if (!/^\d{6,18}$/.test(bankAccountNumber)) return res.status(400).json({ message: "Enter a bank account number containing 6–18 digits." });
      if (await Model.exists({ email })) return res.status(409).json({ message: "That email is already registered." });
      const passwordHash = await bcrypt.hash(password, 12);
      await Model.create({ email, passwordHash, name, age, bankAccountNumber });
      res.status(201).json({ message: "Registration successful. Please log in." });
    } catch (error) { next(error); }
  });

  app.post("/api/auth/login", async (req, res, next) => {
    try {
      const email = String(req.body.email || "").trim().toLowerCase();
      const password = String(req.body.password || "");
      const user = await Model.findOne({ email }).select("+passwordHash");
      if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ message: "Invalid email or password." });
      req.session.regenerate(error => {
        if (error) return next(error);
        req.session.userId = String(user._id);
        req.session.save(saveError => saveError ? next(saveError) : res.json({ message: "Logged in." }));
      });
    } catch (error) { next(error); }
  });

  app.post("/api/auth/logout", (req, res, next) => {
    req.session.destroy(error => {
      if (error) return next(error);
      res.clearCookie("privatepilot.sid");
      res.json({ message: "Logged out." });
    });
  });

  app.get("/api/profile", requireAuth, async (req, res, next) => {
    try {
      const user = await Model.findById(req.session.userId).lean();
      if (!user) return res.status(401).json({ message: "Session user no longer exists." });
      res.set("Cache-Control", "no-store");
      res.json(publicProfile(user));
    } catch (error) { next(error); }
  });

  app.patch("/api/profile", requireAuth, async (req, res, next) => {
    try {
      const answers = {
        hireReason: String(req.body.hireReason || "").trim(),
        strongestSkills: String(req.body.strongestSkills || "").trim(),
        challengeSolved: String(req.body.challengeSolved || "").trim()
      };
      if (Object.values(answers).some(answer => answer.length > 500)) return res.status(400).json({ message: "Keep every answer within 500 characters." });
      const user = await Model.findByIdAndUpdate(req.session.userId, answers, { new: true }).lean();
      if (!user) return res.status(401).json({ message: "Session user no longer exists." });
      res.json({ message: "Answer saved.", profile: publicProfile(user) });
    } catch (error) { next(error); }
  });

  app.use((err, _req, res, _next) => {
    console.error(err);
    const unavailable = err.message === "MONGODB_URI is not configured.";
    res.status(unavailable ? 503 : 500).json({ message: unavailable ? "Database is not configured." : "Something went wrong. Please try again." });
  });
  return app;
}

const app = createApp();
if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  app.listen(port, () => console.log(`Basic Registration Demo running at http://localhost:${port}`));
}
module.exports = app;
module.exports.createApp = createApp;
module.exports.publicProfile = publicProfile;
