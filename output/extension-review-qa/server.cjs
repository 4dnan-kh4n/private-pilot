const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "../../private-pilot-testing/extension");
const shell="<!doctype html><html><head><meta charset=\"utf-8\"><title>PrivatePilot local browser check</title><style>body{margin:0;background:#f0ecf8;font:16px system-ui;color:#251442}header{padding:14px 20px}button{padding:10px;margin-right:12px}main{display:grid;grid-template-columns:1fr 400px;height:calc(100vh - 100px);gap:15px;padding:0 20px}iframe{border:1px solid #ddd;border-radius:15px;width:100%;height:100%;background:#fff}</style></head><body><header><strong>Fictional shopping account. Local UI check.</strong><p><button id=\"next\">Navigate to the next page</button><button id=\"late\">Add a late-loading email</button></p></header><main><iframe id=\"page\" title=\"Fictional shopping page\" src=\"/page?step=1\"></iframe><iframe id=\"panel\" title=\"PrivatePilot panel\"></iframe></main><script src=\"/shell.js\"></script></body></html>";
const shellScript="\nconst page = document.querySelector(\"#page\"), panel = document.querySelector(\"#panel\");\nconst updates = [], runtime = [];\nconst info = () => ({ id: 1, windowId: 1, url: page.src });\nwindow.qaChrome = {\n  tabs: {\n    query: (_query, callback) => callback([info()]),\n    get: (_id, callback) => callback(info()),\n    sendMessage: async (_id, message) => {\n      const guard = page.contentWindow.PrivatePilotGuard;\n      if (!guard) throw new Error(\"Scanner is loading.\");\n      if (message.type === \"privatepilot:review\") return { ok: true, review: guard.review(page.contentDocument) };\n      if (message.type === \"privatepilot:set-manual\") return { ok: guard.setManual(message.id, message.isPrivate) };\n    },\n    onUpdated: { addListener: callback => updates.push(callback) },\n    onActivated: { addListener() {} }\n  },\n  runtime: {\n    sendMessage: async () => ({ ok: true }),\n    onMessage: { addListener: callback => runtime.push(callback) }\n  }\n};\nwindow.notifyChange = () => runtime.forEach(callback => callback({ type: \"privatepilot:page-updated\" }, { tab: { id: 1 } }));\npage.addEventListener(\"load\", () => {\n  if (!panel.getAttribute(\"src\")) panel.src = \"/panel\";\n  else updates.forEach(callback => callback(1, { status: \"complete\" }, info()));\n});\ndocument.querySelector(\"#next\").addEventListener(\"click\", () => {\n  updates.forEach(callback => callback(1, { status: \"loading\" }, info()));\n  page.src = \"/page?step=2\";\n});\ndocument.querySelector(\"#late\").addEventListener(\"click\", () => page.contentWindow.addDetail());\n";
const pageInit="PrivatePilotGuard.start(document, () => parent.notifyChange());\nwindow.addDetail = () => {\n  const paragraph = document.createElement(\"p\");\n  paragraph.textContent = \"Contact: new.person@example.test\";\n  document.querySelector(\"main\").append(paragraph);\n};";

http.createServer((req, res) => {
  const url = new URL(req.url, "http://127.0.0.1:4175");
  const send = (body, type = "text/html") => { res.setHeader("Content-Type", type); res.end(body); };
  if (url.pathname === "/") return send(shell);
  if (url.pathname === "/login-test") return send(fs.readFileSync(path.join(root, "../test-fixtures/login-form.html"), "utf8").replaceAll("../extension/", "/"));
  if (url.pathname === "/shell.js") return send(shellScript, "text/javascript");
  if (url.pathname === "/init.js") return send(pageInit, "text/javascript");
  if (url.pathname === "/shim.js") return send("window.chrome = parent.qaChrome;", "text/javascript");
  if (url.pathname === "/panel") {
    const html = fs.readFileSync(path.join(root, "sidepanel.html"), "utf8")
      .replace('<script src="sidepanel.js">', '<script src="/shim.js"></script><script src="sidepanel.js">');
    return send(html);
  }
  if (url.pathname === "/page") {
    const next = url.searchParams.get("step") === "2";
    const title = next ? "Fictional next account page" : "Fictional shopping account";
    const details = next
      ? "<b>Name:</b><div>Mira Srinivasan</div><b>Primary mobile number:</b><div>9876543210</div>"
      : "<nav>Hello, Tapan<div>Account &amp; Lists</div><div>Returns &amp; Orders</div></nav><h2>Login and security</h2><b>Name:</b><div>Tapan Patidar</div><b>E-mail:</b><div>tapan.patidar@example.test</div><b>Primary mobile number:</b><div>+91 98765 43210</div><label>Password: <input type=\"password\" value=\"fictional-secret\"></label><p>Order reference: 123456789012</p>";
    return send('<!doctype html><html><head><meta charset="utf-8"><title>' + title + '</title><style>body{font:18px system-ui;margin:30px;background:#fff;color:#21362f}b{display:block;margin-top:22px}nav{background:#eee;padding:14px}h1{font-size:28px}</style></head><body><main><h1>' + title + '</h1>' + details + '</main><script src="/capture.js"></script><script src="/pii.js"></script><script src="/guard.js"></script><script src="/init.js"></script></body></html>');
  }
  const name = url.pathname.slice(1);
  if (["capture.js", "pii.js", "guard.js", "sidepanel.js", "sidepanel.css", "privatepilot-logo.png"].includes(name)) {
    return send(fs.readFileSync(path.join(root, name)), name.endsWith(".js") ? "text/javascript" : name.endsWith(".css") ? "text/css" : "image/png");
  }
  res.statusCode = 404; res.end();
}).listen(4175, "127.0.0.1", () => console.log("Local fictional-data QA: http://127.0.0.1:4175"));
