async function api(url, options = {}) {
  const response = await fetch(url, { credentials: "same-origin", ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.message || "Request failed."), { status: response.status });
  return data;
}

document.querySelectorAll(".tab").forEach(tab => tab.addEventListener("click", () => {
  document.querySelectorAll(".tab").forEach(item => item.classList.toggle("active", item === tab));
  document.querySelectorAll(".form-panel").forEach(panel => { panel.hidden = panel.dataset.panel !== tab.dataset.tab; });
}));

function wireAuthForm(selector, endpoint, fields, onSuccess) {
  const form = document.querySelector(selector);
  if (!form) return;
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const message = form.querySelector(".form-message");
    const button = form.querySelector("button[type=submit]");
    message.textContent = ""; button.disabled = true; button.textContent = "Please wait…";
    try {
      const body = Object.fromEntries(fields.map(name => [name, form.elements[name].value]));
      const result = await api(endpoint, { method: "POST", body: JSON.stringify(body) });
      if (onSuccess) return onSuccess(result, form);
      location.href = "/dashboard.html";
    } catch (error) { message.textContent = error.message; button.disabled = false; button.textContent = endpoint.endsWith("login") ? "Log in" : "Create profile"; }
  });
}
wireAuthForm("#loginForm", "/api/auth/login", ["email", "password"]);
wireAuthForm("#registerForm", "/api/auth/register", ["name", "age", "bankAccountNumber", "email", "password"], (result, form) => {
  document.querySelector("#loginEmail").value = form.elements.email.value;
  form.reset();
  document.querySelector('[data-tab="login"]').click();
  const message = document.querySelector("#loginForm .form-message");
  message.textContent = result.message;
  message.className = "form-message success";
});

const profileView = document.querySelector("#profileView");
if (profileView) {
  const hireReason = document.querySelector("#hireReason");
  api("/api/profile").then(profile => {
    document.querySelector("#loadingState").hidden = true; profileView.hidden = false;
    document.querySelector("#profileName").textContent = profile.name;
    document.querySelector("#profileAge").textContent = profile.age;
    document.querySelector("#profileAccount").textContent = profile.bankAccountNumber;
    document.querySelector("#avatar").textContent = profile.name.charAt(0).toUpperCase();
    hireReason.value = profile.hireReason;
    document.querySelector("#strongestSkills").value = profile.strongestSkills;
    document.querySelector("#challengeSolved").value = profile.challengeSolved;
    document.querySelectorAll("textarea[maxlength]").forEach(field => {
      document.querySelector(`[data-count-for="${field.id}"]`).textContent = field.value.length;
    });
  }).catch(error => { if (error.status === 401) location.replace("/?login=required"); else document.querySelector("#loadingState").innerHTML = `<p class="form-message">${error.message}</p>`; });
  document.querySelectorAll("textarea[maxlength]").forEach(field => field.addEventListener("input", () => {
    document.querySelector(`[data-count-for="${field.id}"]`).textContent = field.value.length;
  }));
  document.querySelector("#hireForm").addEventListener("submit", async event => {
    event.preventDefault(); const message = document.querySelector("#saveMessage");
    const answers = { hireReason: hireReason.value.trim(), strongestSkills: document.querySelector("#strongestSkills").value.trim(), challengeSolved: document.querySelector("#challengeSolved").value.trim() };
    try { await api("/api/profile", { method: "PATCH", body: JSON.stringify(answers) }); message.textContent = "Answers saved"; message.className = "form-message success"; }
    catch (error) { message.textContent = error.message; message.className = "form-message"; }
  });
  document.querySelector("#logoutButton").addEventListener("click", async () => { await api("/api/auth/logout", { method: "POST" }); location.replace("/"); });
}
