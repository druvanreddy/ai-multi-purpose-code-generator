/* =========================================================
   DMIXERAI — Frontend
   ========================================================= */

const LANGUAGES = ["Python", "Java", "JavaScript", "TypeScript", "C", "C++", "C#", "Go", "Rust", "PHP", "SQL", "HTML", "CSS"];
const DEBUG_LANGUAGES = ["Python", "Java", "JavaScript", "C", "C++", "C#", "Go", "Rust", "SQL"];
const PROJECT_TYPES = ["Script", "API", "Web Application", "Desktop Application", "Machine Learning", "Data Analysis", "Automation", "CLI Tool"];

const SERIES_COLORS = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)", "var(--series-5)"];

const settings = {
  get model() { return localStorage.getItem("acg_model") || null; },
  set model(v) { localStorage.setItem("acg_model", v); },
  get temperature() { return parseFloat(localStorage.getItem("acg_temperature") || "0.2"); },
  set temperature(v) { localStorage.setItem("acg_temperature", v); },
  get maxTokens() { return parseInt(localStorage.getItem("acg_max_tokens") || "8192", 10); },
  set maxTokens(v) { localStorage.setItem("acg_max_tokens", v); },
};

// ================= API HELPERS =================

function apiErrorMessage(data, fallback) {
  return data.error || data.detail || fallback;
}

async function apiGet(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(apiErrorMessage(await res.json().catch(() => ({})), res.statusText));
  return res.json();
}

async function apiPost(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(apiErrorMessage(await res.json().catch(() => ({})), res.statusText));
  return res.json();
}

async function apiDelete(url) {
  const res = await fetch(url, { method: "DELETE" });
  if (!res.ok) throw new Error(apiErrorMessage(await res.json().catch(() => ({})), res.statusText));
  return res.json();
}

const TOAST_ICONS = { success: "icon-check", error: "icon-alert", info: "icon-sparkles" };

function toast(message, type = "info") {
  const stack = document.getElementById("toast-stack");
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `<svg class="icon"><use href="#${TOAST_ICONS[type] || TOAST_ICONS.info}"/></svg><span></span>`;
  el.querySelector("span").textContent = message;
  stack.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function copyToClipboard(text, button) {
  navigator.clipboard.writeText(text || "").then(() => {
    if (!button) return;
    const original = button.innerHTML;
    button.innerHTML = '<svg class="icon"><use href="#icon-check"/></svg>';
    setTimeout(() => (button.innerHTML = original), 1200);
  }).catch(() => toast("Couldn't copy to clipboard", "error"));
}

function safeHighlight(el) {
  if (window.hljs) {
    try {
      hljs.highlightElement(el);
    } catch {
      /* highlighting is cosmetic — fall back to plain text */
    }
  }
}

function renderMarkdown(container, text) {
  container.innerHTML = window.marked ? marked.parse(text || "") : escapeHtml(text || "");
  container.querySelectorAll("pre code").forEach(safeHighlight);
}

function withRequestOptions(body) {
  return { ...body, model: settings.model, temperature: settings.temperature, max_tokens: settings.maxTokens };
}

function download(filename, content) {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function downloadZip(content, projectName, button) {
  const original = button.innerHTML;
  button.disabled = true;
  button.innerHTML = '<span class="spinner"></span>';
  try {
    const res = await fetch("/api/project/zip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, project_name: projectName || "project" }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "ZIP export failed.");
    }
    const blob = await res.blob();
    downloadBlob(`${(projectName || "project").trim() || "project"}.zip`, blob);
  } catch (err) {
    toast(err.message, "error");
  } finally {
    button.disabled = false;
    button.innerHTML = original;
  }
}

async function withLoading(button, fn) {
  const original = button.innerHTML;
  button.disabled = true;
  button.innerHTML = '<span class="spinner"></span> Working…';
  try {
    await fn();
  } catch (err) {
    toast(err.message || "Something went wrong", "error");
  } finally {
    button.disabled = false;
    button.innerHTML = original;
  }
}

// ================= NAVIGATION =================

function initNav() {
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".nav-item").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`view-${btn.dataset.view}`).classList.add("active");

      if (btn.dataset.view === "dashboard") loadDashboard();
      if (btn.dataset.view === "history") loadHistory();
      if (btn.dataset.view === "analytics") loadAnalytics();
      if (btn.dataset.view === "settings") loadSettings();
    });
  });
}

function initTabs() {
  document.querySelectorAll(".tabs").forEach((group) => {
    group.querySelectorAll(".tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        group.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");

        const groupName = group.dataset.group;
        const panels = document.querySelectorAll(
          groupName === "files"
            ? "[data-filepanel]"
            : `.tab-panel[data-panel]:not([data-filepanel])`
        );

        panels.forEach((p) => {
          if (groupName === "files") {
            p.classList.toggle("active", p.dataset.panel === tab.dataset.tab);
          }
        });

        if (groupName !== "files") {
          const section = group.closest(".view");
          section.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
          section.querySelector(`.tab-panel[data-panel="${tab.dataset.tab}"]`)?.classList.add("active");
        }
      });
    });
  });
}

// ================= SELECT POPULATION =================

function fillSelect(el, options) {
  el.innerHTML = options.map((o) => `<option value="${o}">${o}</option>`).join("");
}

async function initModels() {
  const { models } = await apiGet("/api/models");

  ["assistant-model", "settings-model"].forEach((id) => {
    const el = document.getElementById(id);
    fillSelect(el, models);
    el.value = settings.model || models[0];
    if (!settings.model) settings.model = models[0];
  });

  document.getElementById("assistant-model").addEventListener("change", (e) => {
    settings.model = e.target.value;
    document.getElementById("settings-model").value = e.target.value;
  });

  document.getElementById("settings-model").addEventListener("change", (e) => {
    settings.model = e.target.value;
    document.getElementById("assistant-model").value = e.target.value;
  });

  fillSelect(document.getElementById("gen-language"), LANGUAGES);
  fillSelect(document.getElementById("gen-type"), PROJECT_TYPES);
  fillSelect(document.getElementById("debug-language"), DEBUG_LANGUAGES);
  fillSelect(document.getElementById("review-language"), DEBUG_LANGUAGES);
  fillSelect(document.getElementById("security-language"), DEBUG_LANGUAGES);
  fillSelect(document.getElementById("document-language"), DEBUG_LANGUAGES);
}

function initRangeSync() {
  const pairs = [
    ["assistant-temp", "assistant-temp-val"],
    ["assistant-tokens", "assistant-tokens-val"],
    ["settings-temp", "settings-temp-val"],
    ["settings-tokens", "settings-tokens-val"],
  ];

  pairs.forEach(([inputId, labelId]) => {
    const input = document.getElementById(inputId);
    const label = document.getElementById(labelId);
    input.addEventListener("input", () => (label.textContent = input.value));
  });

  ["assistant-temp", "settings-temp"].forEach((id) => {
    document.getElementById(id).value = settings.temperature;
    document.getElementById(`${id}-val`).textContent = settings.temperature;
    document.getElementById(id).addEventListener("change", (e) => {
      settings.temperature = parseFloat(e.target.value);
      syncRangePair(id, "temp");
    });
  });

  ["assistant-tokens", "settings-tokens"].forEach((id) => {
    document.getElementById(id).value = settings.maxTokens;
    document.getElementById(`${id}-val`).textContent = settings.maxTokens;
    document.getElementById(id).addEventListener("change", (e) => {
      settings.maxTokens = parseInt(e.target.value, 10);
      syncRangePair(id, "tokens");
    });
  });
}

function syncRangePair(sourceId, kind) {
  const value = document.getElementById(sourceId).value;
  const targets = kind === "temp" ? ["assistant-temp", "settings-temp"] : ["assistant-tokens", "settings-tokens"];
  targets.forEach((id) => {
    document.getElementById(id).value = value;
    document.getElementById(`${id}-val`).textContent = value;
  });
}

// ================= DASHBOARD =================

async function loadDashboard() {
  try {
    const status = await apiGet("/api/status");

    document.getElementById("metric-version").textContent = status.version;
    document.getElementById("metric-model").textContent = status.model;

    const statusEl = document.getElementById("metric-status");
    statusEl.innerHTML = status.success
      ? '<span class="status-dot online"></span> Online'
      : '<span class="status-dot offline"></span> Offline';

    document.getElementById("metric-time").textContent = status.success ? `${status.response_time}s` : "—";

    setConnectionPill(status.success);
  } catch {
    setConnectionPill(false);
  }
}

function setConnectionPill(online) {
  const pill = document.getElementById("connection-pill");
  const text = document.getElementById("connection-text");
  pill.classList.toggle("online", online);
  pill.classList.toggle("offline", !online);
  text.textContent = online ? "Connected" : "Offline";
}

// ================= CHAT =================

const CHAT_AVATAR_ICON = { user: "icon-file", assistant: "icon-sparkles" };

function appendChatMessage(role, text) {
  const window_ = document.getElementById("chat-window");
  document.getElementById("chat-empty")?.remove();

  const wrap = document.createElement("div");
  wrap.className = `chat-message ${role}`;

  const avatar = document.createElement("div");
  avatar.className = "chat-avatar";
  avatar.innerHTML = `<svg class="icon"><use href="#${CHAT_AVATAR_ICON[role]}"/></svg>`;

  const bubbleWrap = document.createElement("div");
  bubbleWrap.className = "chat-bubble-wrap";

  const bubble = document.createElement("div");
  bubble.className = "chat-bubble";
  bubble.textContent = text;
  bubbleWrap.appendChild(bubble);

  wrap.append(avatar, bubbleWrap);
  window_.appendChild(wrap);
  window_.scrollTop = window_.scrollHeight;
  return { bubble, bubbleWrap };
}

function finalizeAssistantMessage(bubbleWrap, bubble, text, originalPrompt) {
  renderMarkdown(bubble, text);

  const actions = document.createElement("div");
  actions.className = "chat-msg-actions";

  const copyBtn = document.createElement("button");
  copyBtn.className = "chat-copy";
  copyBtn.title = "Copy response";
  copyBtn.innerHTML = '<svg class="icon"><use href="#icon-copy"/></svg>';
  copyBtn.addEventListener("click", () => copyToClipboard(text, copyBtn));
  actions.appendChild(copyBtn);

  if (originalPrompt) {
    const regenBtn = document.createElement("button");
    regenBtn.className = "chat-regenerate";
    regenBtn.title = "Regenerate response";
    regenBtn.innerHTML = '<svg class="icon"><use href="#icon-refresh"/></svg>';
    regenBtn.addEventListener("click", () => {
      bubbleWrap.closest(".chat-message").remove();
      streamAssistantResponse(originalPrompt);
    });
    actions.appendChild(regenBtn);
  }

  bubbleWrap.appendChild(actions);
}

async function streamAssistantResponse(message) {
  const input = document.getElementById("chat-input");
  const sendBtn = document.querySelector('#chat-form button[type="submit"]');
  input.disabled = true;
  sendBtn.disabled = true;

  const { bubble, bubbleWrap } = appendChatMessage("assistant", "");
  bubble.innerHTML = '<div class="chat-thinking"><span></span><span></span><span></span></div>';

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        model: settings.model,
        temperature: settings.temperature,
        max_tokens: settings.maxTokens,
      }),
    });

    if (!res.ok || !res.body) throw new Error("Chat request failed");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let full = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      full += decoder.decode(value, { stream: true });
      bubble.textContent = full + "▌";
      document.getElementById("chat-window").scrollTop = 1e9;
    }

    finalizeAssistantMessage(bubbleWrap, bubble, full, message);
  } catch (err) {
    bubble.textContent = err.message;
  } finally {
    input.disabled = false;
    sendBtn.disabled = false;
    input.focus();
  }
}

function submitUserMessage(message) {
  appendChatMessage("user", message);
  streamAssistantResponse(message);
}

function bindChatStarters() {
  document.querySelectorAll("#chat-starters .chip").forEach((chip) => {
    chip.addEventListener("click", () => submitUserMessage(chip.dataset.prompt));
  });
}

const CHAT_EMPTY_HTML = `
  <div class="chat-empty" id="chat-empty">
    <svg class="icon icon-lg"><use href="#icon-sparkles"/></svg>
    <p>Ask anything about code — generate, debug, or talk through an idea.</p>
    <div class="chat-starters" id="chat-starters">
      <button type="button" class="chip" data-prompt="Explain the difference between a process and a thread, with a real-world analogy.">Explain a concept</button>
      <button type="button" class="chip" data-prompt="Write a Python function that flattens an arbitrarily nested list.">Write a quick function</button>
      <button type="button" class="chip" data-prompt="What are the trade-offs between SQL and NoSQL databases for a booking system?">Compare two approaches</button>
      <button type="button" class="chip" data-prompt="Review this regex for catching email addresses and point out edge cases it misses: ^[\\w.+-]+@[\\w-]+\\.[a-zA-Z]{2,}$">Find edge cases</button>
    </div>
  </div>`;

function initChat() {
  const form = document.getElementById("chat-form");
  const input = document.getElementById("chat-input");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const message = input.value.trim();
    if (!message) return;
    input.value = "";
    input.style.height = "auto";
    submitUserMessage(message);
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
  });

  bindChatStarters();

  document.getElementById("chat-clear").addEventListener("click", () => {
    document.getElementById("chat-window").innerHTML = CHAT_EMPTY_HTML;
    bindChatStarters();
  });
}

// ================= ASSISTANT: CODE GENERATOR / DEBUG / EXPLAIN / OPTIMIZE =================

function initCodeGenerator() {
  const btn = document.getElementById("gen-submit");

  btn.addEventListener("click", () =>
    withLoading(btn, async () => {
      const task = document.getElementById("gen-task").value.trim();
      if (!task) return toast("Please enter your project description.", "error");

      const { result } = await apiPost("/api/code/generate", withRequestOptions({
        language: document.getElementById("gen-language").value,
        framework: document.getElementById("gen-framework").value,
        project_type: document.getElementById("gen-type").value,
        task,
        include_tests: document.getElementById("gen-include-tests").checked,
      }));

      const language = document.getElementById("gen-language").value.toLowerCase();
      const code = document.getElementById("gen-result");
      code.className = `language-${language}`;
      code.textContent = result;
      safeHighlight(code);
      document.getElementById("gen-result-card").classList.remove("hidden");

      document.getElementById("gen-download").onclick = () => download(`generated_code.${language}`, result);
      document.getElementById("gen-copy").onclick = (e) => copyToClipboard(result, e.currentTarget);
    })
  );
}

function initDebugger() {
  const btn = document.getElementById("debug-submit");

  btn.addEventListener("click", () =>
    withLoading(btn, async () => {
      const code = document.getElementById("debug-code").value.trim();
      if (!code) return toast("Please paste your code.", "error");

      const { result } = await apiPost("/api/code/debug", withRequestOptions({
        language: document.getElementById("debug-language").value,
        code,
      }));

      renderMarkdown(document.getElementById("debug-result"), result);
      document.getElementById("debug-result-card").classList.remove("hidden");
      document.getElementById("debug-download").onclick = () => download("debug_report.txt", result);
      document.getElementById("debug-copy").onclick = (e) => copyToClipboard(result, e.currentTarget);
    })
  );
}

function initExplainer() {
  const btn = document.getElementById("explain-submit");

  btn.addEventListener("click", () =>
    withLoading(btn, async () => {
      const code = document.getElementById("explain-code").value.trim();
      if (!code) return toast("Please paste your code.", "error");

      const { result } = await apiPost("/api/code/explain", withRequestOptions({
        level: document.getElementById("explain-level").value,
        code,
      }));

      renderMarkdown(document.getElementById("explain-result"), result);
      document.getElementById("explain-result-card").classList.remove("hidden");
      document.getElementById("explain-copy").onclick = (e) => copyToClipboard(result, e.currentTarget);
    })
  );
}

function initOptimizer() {
  document.querySelectorAll("#optimize-goals .chip").forEach((chip) => {
    chip.addEventListener("click", () => chip.classList.toggle("active"));
  });

  const btn = document.getElementById("optimize-submit");

  btn.addEventListener("click", () =>
    withLoading(btn, async () => {
      const code = document.getElementById("optimize-code").value.trim();
      if (!code) return toast("Please paste your code.", "error");

      const goals = [...document.querySelectorAll("#optimize-goals .chip.active")].map((c) => c.dataset.goal);

      const { result } = await apiPost("/api/code/optimize", withRequestOptions({ code, goals }));

      renderMarkdown(document.getElementById("optimize-result"), result);
      document.getElementById("optimize-result-card").classList.remove("hidden");
      document.getElementById("optimize-download").onclick = () => download("optimized_code.txt", result);
      document.getElementById("optimize-copy").onclick = (e) => copyToClipboard(result, e.currentTarget);
    })
  );
}

function initReviewer() {
  const btn = document.getElementById("review-submit");

  btn.addEventListener("click", () =>
    withLoading(btn, async () => {
      const code = document.getElementById("review-code").value.trim();
      if (!code) return toast("Please paste your code.", "error");

      const { result } = await apiPost("/api/code/review", withRequestOptions({
        language: document.getElementById("review-language").value,
        code,
      }));

      renderMarkdown(document.getElementById("review-result"), result);
      document.getElementById("review-result-card").classList.remove("hidden");
      document.getElementById("review-copy").onclick = (e) => copyToClipboard(result, e.currentTarget);
    })
  );
}

function initSecurityScanner() {
  const btn = document.getElementById("security-submit");

  btn.addEventListener("click", () =>
    withLoading(btn, async () => {
      const code = document.getElementById("security-code").value.trim();
      if (!code) return toast("Please paste your code.", "error");

      const { result } = await apiPost("/api/code/security", withRequestOptions({
        language: document.getElementById("security-language").value,
        code,
      }));

      renderMarkdown(document.getElementById("security-result"), result);
      document.getElementById("security-result-card").classList.remove("hidden");
      document.getElementById("security-copy").onclick = (e) => copyToClipboard(result, e.currentTarget);
    })
  );
}

function initDocumentGenerator() {
  const btn = document.getElementById("document-submit");

  btn.addEventListener("click", () =>
    withLoading(btn, async () => {
      const code = document.getElementById("document-code").value.trim();
      if (!code) return toast("Please paste your code.", "error");

      const { result } = await apiPost("/api/code/document", withRequestOptions({
        language: document.getElementById("document-language").value,
        code,
      }));

      const language = document.getElementById("document-language").value.toLowerCase();
      const codeEl = document.getElementById("document-result");
      codeEl.className = `language-${language}`;
      codeEl.textContent = result;
      safeHighlight(codeEl);
      document.getElementById("document-result-card").classList.remove("hidden");
      document.getElementById("document-download").onclick = () => download(`documented_code.${language}`, result);
      document.getElementById("document-copy").onclick = (e) => copyToClipboard(result, e.currentTarget);
    })
  );
}

function initCommitGenerator() {
  const btn = document.getElementById("commit-submit");

  btn.addEventListener("click", () =>
    withLoading(btn, async () => {
      const diff = document.getElementById("commit-diff").value.trim();
      if (!diff) return toast("Please paste a diff or describe the change.", "error");

      const { result } = await apiPost("/api/code/commit", withRequestOptions({ diff }));

      renderMarkdown(document.getElementById("commit-result"), result);
      document.getElementById("commit-result-card").classList.remove("hidden");
      document.getElementById("commit-copy").onclick = (e) => copyToClipboard(result, e.currentTarget);
    })
  );
}

// ================= PROJECT BUILDER =================

function initProjectBuilder() {
  const projectBtn = document.getElementById("project-submit");
  projectBtn.addEventListener("click", () =>
    withLoading(projectBtn, async () => {
      const name = document.getElementById("project-name").value.trim();
      const { result } = await apiPost("/api/project/generate", withRequestOptions({
        name,
        language: document.getElementById("project-language").value,
        framework: document.getElementById("project-framework").value,
        description: document.getElementById("project-description").value,
      }));
      renderMarkdown(document.getElementById("project-result"), result);
      document.getElementById("project-result-card").classList.remove("hidden");
      document.getElementById("project-download").onclick = () => download(`${name || "project"}.txt`, result);
      document.getElementById("project-copy").onclick = (e) => copyToClipboard(result, e.currentTarget);
      document.getElementById("project-zip").onclick = (e) => downloadZip(result, name, e.currentTarget);
    })
  );

  const sqlBtn = document.getElementById("sql-submit");
  sqlBtn.addEventListener("click", () =>
    withLoading(sqlBtn, async () => {
      const { result } = await apiPost("/api/project/sql", withRequestOptions({
        description: document.getElementById("sql-description").value,
        dialect: document.getElementById("sql-dialect").value,
      }));
      const code = document.getElementById("sql-result");
      code.textContent = result;
      safeHighlight(code);
      document.getElementById("sql-result-card").classList.remove("hidden");
      document.getElementById("sql-copy").onclick = (e) => copyToClipboard(result, e.currentTarget);
    })
  );

  const readmeBtn = document.getElementById("readme-submit");
  readmeBtn.addEventListener("click", () =>
    withLoading(readmeBtn, async () => {
      const { result } = await apiPost("/api/project/readme", withRequestOptions({
        details: document.getElementById("readme-details").value,
      }));
      renderMarkdown(document.getElementById("readme-result"), result);
      document.getElementById("readme-result-card").classList.remove("hidden");
      document.getElementById("readme-copy").onclick = (e) => copyToClipboard(result, e.currentTarget);
    })
  );

  const docsBtn = document.getElementById("docs-submit");
  docsBtn.addEventListener("click", () =>
    withLoading(docsBtn, async () => {
      const { result } = await apiPost("/api/project/docs", withRequestOptions({
        details: document.getElementById("docs-details").value,
      }));
      renderMarkdown(document.getElementById("docs-result"), result);
      document.getElementById("docs-result-card").classList.remove("hidden");
      document.getElementById("docs-copy").onclick = (e) => copyToClipboard(result, e.currentTarget);
    })
  );

  const testsBtn = document.getElementById("tests-submit");
  testsBtn.addEventListener("click", () =>
    withLoading(testsBtn, async () => {
      const { result } = await apiPost("/api/project/tests", withRequestOptions({
        language: document.getElementById("tests-language").value,
        code: document.getElementById("tests-code").value,
      }));
      const code = document.getElementById("tests-result");
      code.textContent = result;
      safeHighlight(code);
      document.getElementById("tests-result-card").classList.remove("hidden");
      document.getElementById("tests-copy").onclick = (e) => copyToClipboard(result, e.currentTarget);
    })
  );

  const apiBtn = document.getElementById("api-submit");
  apiBtn.addEventListener("click", () =>
    withLoading(apiBtn, async () => {
      const description = document.getElementById("api-description").value.trim();
      if (!description) return toast("Please describe the API.", "error");

      const { result } = await apiPost("/api/project/api", withRequestOptions({
        language: document.getElementById("api-language").value,
        framework: document.getElementById("api-framework").value,
        description,
      }));

      renderMarkdown(document.getElementById("api-result"), result);
      document.getElementById("api-result-card").classList.remove("hidden");
      document.getElementById("api-download").onclick = () => download("api_design.txt", result);
      document.getElementById("api-copy").onclick = (e) => copyToClipboard(result, e.currentTarget);
      document.getElementById("api-zip").onclick = (e) => downloadZip(result, "api", e.currentTarget);
    })
  );

  const databaseBtn = document.getElementById("database-submit");
  databaseBtn.addEventListener("click", () =>
    withLoading(databaseBtn, async () => {
      const description = document.getElementById("database-description").value.trim();
      if (!description) return toast("Please describe your data.", "error");

      const { result } = await apiPost("/api/project/database", withRequestOptions({ description }));

      renderMarkdown(document.getElementById("database-result"), result);
      document.getElementById("database-result-card").classList.remove("hidden");
      document.getElementById("database-copy").onclick = (e) => copyToClipboard(result, e.currentTarget);
    })
  );

  const architectureBtn = document.getElementById("architecture-submit");
  architectureBtn.addEventListener("click", () =>
    withLoading(architectureBtn, async () => {
      const description = document.getElementById("architecture-description").value.trim();
      if (!description) return toast("Please describe the system.", "error");

      const { result } = await apiPost("/api/project/architecture", withRequestOptions({ description }));

      renderMarkdown(document.getElementById("architecture-result"), result);
      document.getElementById("architecture-result-card").classList.remove("hidden");
      document.getElementById("architecture-copy").onclick = (e) => copyToClipboard(result, e.currentTarget);
    })
  );

  const dockerBtn = document.getElementById("docker-submit");
  dockerBtn.addEventListener("click", () =>
    withLoading(dockerBtn, async () => {
      const description = document.getElementById("docker-description").value.trim();
      if (!description) return toast("Please describe the service.", "error");

      const { result } = await apiPost("/api/project/docker", withRequestOptions({
        language: document.getElementById("docker-language").value,
        framework: document.getElementById("docker-framework").value,
        description,
      }));

      renderMarkdown(document.getElementById("docker-result"), result);
      document.getElementById("docker-result-card").classList.remove("hidden");
      document.getElementById("docker-download").onclick = () => download("docker_config.txt", result);
      document.getElementById("docker-copy").onclick = (e) => copyToClipboard(result, e.currentTarget);
    })
  );
}

// ================= FILE ANALYZER =================

function initFileAnalyzer() {
  const dropzone = document.getElementById("dropzone");
  const input = document.getElementById("file-input");
  let currentFile = null;

  dropzone.addEventListener("click", () => input.click());

  ["dragover", "dragleave", "drop"].forEach((evt) => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.toggle("drag", evt === "dragover");
    });
  });

  dropzone.addEventListener("drop", (e) => {
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  input.addEventListener("change", (e) => {
    if (e.target.files[0]) handleFile(e.target.files[0]);
  });

  function handleFile(file) {
    currentFile = file;

    const meta = document.getElementById("file-meta");
    meta.textContent = `Uploaded: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    meta.classList.remove("hidden");

    document.getElementById("file-tabs").classList.remove("hidden");
    document.querySelectorAll('[data-filepanel]').forEach((p) => p.classList.remove("hidden"));

    document.querySelectorAll('[data-file-result]').forEach((el) => {
      el.closest(".result-card").classList.add("hidden");
      el.innerHTML = "";
    });

    const reader = new FileReader();
    reader.onload = () => {
      const previewCard = document.getElementById("file-preview-card");
      const preview = document.getElementById("file-preview");
      preview.textContent = reader.result;
      safeHighlight(preview);
      previewCard.classList.remove("hidden");
    };
    reader.readAsText(file);
  }

  document.querySelectorAll("[data-file-action]").forEach((btn) => {
    btn.addEventListener("click", () =>
      withLoading(btn, async () => {
        if (!currentFile) return toast("Please upload a file first.", "error");

        const action = btn.dataset.fileAction;
        const formData = new FormData();
        formData.append("action", action);
        formData.append("file", currentFile);

        const res = await fetch("/api/file/analyze", { method: "POST", body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Analysis failed.");

        const target = document.querySelector(`[data-file-result="${action}"]`);
        renderMarkdown(target, data.result);
        target.closest(".result-card").classList.remove("hidden");

        const copyBtn = document.querySelector(`[data-copy-file="${action}"]`);
        if (copyBtn) copyBtn.onclick = (e) => copyToClipboard(data.result, e.currentTarget);
      })
    );
  });
}

// ================= REPORT GENERATOR =================

const REPORT_TYPES = [
  "Technical Report", "Research Paper", "Internship Report", "Project Report",
  "White Paper", "Case Study", "Business Report", "Thesis", "Dissertation",
  "Product Documentation", "User Manual", "Market Research Report",
];

const REPORT_STATE_KEY = "acg_report_state";

let reportChapterIdCounter = 0;

const reportState = {
  topic: "",
  reportType: REPORT_TYPES[0],
  template: "academic",
  wordCount: 3000,
  language: "English",
  style: "Professional",
  citationStyle: "IEEE",
  formats: ["docx", "pdf", "markdown"],
  chapters: [],
  originalChapters: [],
  references: "",
};

function makeReportChapter(title) {
  return { id: ++reportChapterIdCounter, title, subsections: [], collapsed: true, content: null };
}

function saveReportState() {
  try {
    localStorage.setItem(REPORT_STATE_KEY, JSON.stringify(reportState));
  } catch {
    /* storage full or unavailable — auto-save is a convenience, not critical */
  }
}

function showReportScreen(name) {
  document.querySelectorAll(".report-screen").forEach((s) => s.classList.remove("active"));
  document.getElementById(`report-screen-${name}`)?.classList.add("active");
}

function renderReportTypeChips() {
  document.getElementById("report-type-chips").innerHTML = REPORT_TYPES.map(
    (t, i) => `<button type="button" class="chip${i === 0 ? " active" : ""}" data-value="${t}">${t}</button>`
  ).join("");
}

function initRadioChipGroup(containerId, onChange) {
  const container = document.getElementById(containerId);
  container.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    container.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    onChange?.(chip.dataset.value);
  });
}

function getSelectedWordCount() {
  const active = document.querySelector("#report-wordcount-chips .chip.active");
  if (!active) return 3000;
  if (active.dataset.value === "custom") {
    return parseInt(document.getElementById("report-wordcount-custom").value, 10) || 3000;
  }
  return parseInt(active.dataset.value, 10);
}

function chapterMaxTokens(wordTarget) {
  return Math.min(8192, Math.max(1024, Math.round(wordTarget * 2.2)));
}

// ---------- TOC generation & editing ----------

async function generateReportToc() {
  const topic = document.getElementById("report-topic").value.trim();
  if (!topic) return toast("Please enter a report topic.", "error");

  const reportType = document.querySelector("#report-type-chips .chip.active")?.dataset.value || REPORT_TYPES[0];
  const template = document.querySelector('input[name="report-template"]:checked').value;

  const btn = document.getElementById("report-generate-toc");

  await withLoading(btn, async () => {
    const { chapters } = await apiPost("/api/report/toc", withRequestOptions({
      topic, report_type: reportType, template,
    }));

    if (!chapters || !chapters.length) throw new Error("Couldn't generate a table of contents — try again.");

    reportState.topic = topic;
    reportState.reportType = reportType;
    reportState.template = template;
    reportState.chapters = chapters.map(makeReportChapter);
    reportState.originalChapters = reportState.chapters.map((c) => ({ ...c, subsections: [...c.subsections] }));
    reportState.references = "";

    saveReportState();
    renderReportTocList();
    showReportScreen("toc");
  });
}

function renderReportTocList() {
  const list = document.getElementById("report-toc-list");

  list.innerHTML = reportState.chapters.map((ch, idx) => `
    <li class="toc-item" draggable="true" data-id="${ch.id}">
      <div class="toc-item-row">
        <svg class="icon toc-drag-handle"><use href="#icon-drag"/></svg>
        <span class="toc-number">${idx + 1}.</span>
        <input type="text" class="toc-title-input" value="${escapeHtml(ch.title)}" data-id="${ch.id}" />
        <button class="icon-btn-mini toc-collapse-toggle" data-id="${ch.id}" title="Sub-sections">
          <svg class="icon"><use href="#icon-${ch.collapsed ? "chevron-down" : "chevron-up"}"/></svg>
        </button>
        <button class="icon-btn-mini toc-add-sub" data-id="${ch.id}" title="Add sub-section"><svg class="icon"><use href="#icon-plus"/></svg></button>
        <button class="icon-btn-mini toc-duplicate" data-id="${ch.id}" title="Duplicate"><svg class="icon"><use href="#icon-duplicate"/></svg></button>
        <button class="icon-btn-mini toc-delete" data-id="${ch.id}" title="Delete"><svg class="icon"><use href="#icon-x"/></svg></button>
      </div>
      <ul class="toc-subsections ${ch.collapsed ? "hidden" : ""}" data-id="${ch.id}">
        ${ch.subsections.map((s, si) => `
          <li class="toc-sub-row">
            <input type="text" value="${escapeHtml(s)}" data-id="${ch.id}" data-sub-index="${si}" class="toc-sub-input" />
            <button class="icon-btn-mini toc-sub-delete" data-id="${ch.id}" data-sub-index="${si}"><svg class="icon"><use href="#icon-x"/></svg></button>
          </li>
        `).join("")}
      </ul>
    </li>
  `).join("");
}

function initReportTocEvents() {
  const list = document.getElementById("report-toc-list");

  list.addEventListener("input", (e) => {
    const id = Number(e.target.dataset.id);
    const chapter = reportState.chapters.find((c) => c.id === id);
    if (!chapter) return;

    if (e.target.classList.contains("toc-title-input")) {
      chapter.title = e.target.value;
    } else if (e.target.classList.contains("toc-sub-input")) {
      chapter.subsections[Number(e.target.dataset.subIndex)] = e.target.value;
    }
    saveReportState();
  });

  list.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const id = Number(btn.dataset.id);
    const idx = reportState.chapters.findIndex((c) => c.id === id);
    if (idx === -1) return;
    const chapter = reportState.chapters[idx];

    if (btn.classList.contains("toc-collapse-toggle")) {
      chapter.collapsed = !chapter.collapsed;
    } else if (btn.classList.contains("toc-add-sub")) {
      chapter.subsections.push("New sub-section");
      chapter.collapsed = false;
    } else if (btn.classList.contains("toc-sub-delete")) {
      chapter.subsections.splice(Number(btn.dataset.subIndex), 1);
    } else if (btn.classList.contains("toc-duplicate")) {
      reportState.chapters.splice(idx + 1, 0, {
        ...chapter, id: ++reportChapterIdCounter, subsections: [...chapter.subsections],
      });
    } else if (btn.classList.contains("toc-delete")) {
      reportState.chapters.splice(idx, 1);
    } else {
      return;
    }

    renderReportTocList();
    saveReportState();
  });

  let draggedId = null;

  list.addEventListener("dragstart", (e) => {
    const item = e.target.closest(".toc-item");
    if (!item) return;
    draggedId = Number(item.dataset.id);
    e.dataTransfer.effectAllowed = "move";
  });

  list.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.target.closest(".toc-item")?.classList.add("drag-over");
  });

  list.addEventListener("dragleave", (e) => {
    e.target.closest(".toc-item")?.classList.remove("drag-over");
  });

  list.addEventListener("drop", (e) => {
    e.preventDefault();
    const targetItem = e.target.closest(".toc-item");
    if (!targetItem || draggedId === null) return;
    targetItem.classList.remove("drag-over");

    const targetId = Number(targetItem.dataset.id);
    if (draggedId === targetId) return;

    const fromIdx = reportState.chapters.findIndex((c) => c.id === draggedId);
    const toIdx = reportState.chapters.findIndex((c) => c.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;

    const [moved] = reportState.chapters.splice(fromIdx, 1);
    reportState.chapters.splice(toIdx, 0, moved);
    draggedId = null;

    renderReportTocList();
    saveReportState();
  });
}

// ---------- Full report generation ----------

function extractMaxCitationNumber(text) {
  const matches = [...(text || "").matchAll(/\[(\d+)\]/g)].map((m) => parseInt(m[1], 10));
  return matches.length ? Math.max(...matches) : 0;
}

function buildChapterContext(chapters, upToIndex) {
  const parts = [];
  for (let i = 0; i < upToIndex; i++) {
    const c = chapters[i];
    if (!c.content) continue;
    const gist = c.content.replace(/```[\s\S]*?```/g, "").replace(/\s+/g, " ").trim().slice(0, 220);
    parts.push(`- ${c.title}: ${gist}${gist.length === 220 ? "…" : ""}`);
  }
  const joined = parts.join("\n");
  return joined.length > 2000 ? joined.slice(joined.length - 2000) : joined;
}

async function generateFullReport() {
  if (!reportState.chapters.length) return toast("Add at least one chapter first.", "error");

  const formSettings = {
    language: document.getElementById("report-language").value,
    style: document.getElementById("report-style").value,
    citationStyle: document.getElementById("report-citation-style").value,
    wordCount: getSelectedWordCount(),
    formats: [...document.querySelectorAll(".report-format:checked")].map((el) => el.value),
  };
  Object.assign(reportState, formSettings);

  showReportScreen("progress");

  const total = reportState.chapters.length;
  const wordPerChapter = Math.max(300, Math.round(reportState.wordCount / total));

  const stageEl = document.getElementById("report-progress-stage");
  const fillEl = document.getElementById("report-progress-fill");
  const percentEl = document.getElementById("report-progress-percent");
  const etaEl = document.getElementById("report-progress-eta");
  const logEl = document.getElementById("report-progress-log");
  logEl.innerHTML = "";

  const durations = [];

  function addLog(text) {
    const li = document.createElement("li");
    li.innerHTML = `<svg class="icon"><use href="#icon-sparkles"/></svg> ${escapeHtml(text)}`;
    logEl.appendChild(li);
    logEl.scrollTop = logEl.scrollHeight;
    return li;
  }

  function setProgress(done, stageLabel) {
    const pct = Math.round((done / (total + 1)) * 100);
    fillEl.style.width = `${pct}%`;
    percentEl.textContent = `${pct}%`;
    stageEl.textContent = stageLabel;
    if (durations.length) {
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      const remaining = Math.max(total + 1 - done, 0) * avg;
      etaEl.textContent = remaining > 1 ? `~${Math.ceil(remaining)}s remaining` : "Almost done…";
    }
  }

  setProgress(0, "Analyzing topic and preparing outline…");
  addLog("Analyzing topic and preparing outline…");

  let citationCounter = 1;

  for (let i = 0; i < total; i++) {
    const chapter = reportState.chapters[i];
    setProgress(i, `Writing: ${chapter.title}`);
    const logItem = addLog(`Writing "${chapter.title}"…`);
    const start = performance.now();

    try {
      const { result } = await apiPost("/api/report/chapter", {
        topic: reportState.topic,
        report_type: reportState.reportType,
        chapter_title: chapter.title,
        subsections: chapter.subsections,
        chapter_number: i + 1,
        total_chapters: total,
        word_target: wordPerChapter,
        language: reportState.language,
        style: reportState.style,
        citation_style: reportState.citationStyle,
        previous_context: buildChapterContext(reportState.chapters, i),
        citation_start: citationCounter,
        model: settings.model,
        temperature: settings.temperature,
        max_tokens: chapterMaxTokens(wordPerChapter),
      });
      chapter.content = result;
      const maxCited = extractMaxCitationNumber(result);
      if (maxCited >= citationCounter) citationCounter = maxCited + 1;
      logItem.classList.add("done");
      logItem.innerHTML = `<svg class="icon"><use href="#icon-check"/></svg> "${escapeHtml(chapter.title)}" complete`;
    } catch (err) {
      logItem.innerHTML = `<svg class="icon"><use href="#icon-alert"/></svg> "${escapeHtml(chapter.title)}" failed — ${escapeHtml(err.message)}`;
      toast(`Chapter "${chapter.title}" failed: ${err.message}`, "error");
    }

    durations.push((performance.now() - start) / 1000);
    saveReportState();
  }

  setProgress(total, "Generating references…");
  const refLog = addLog("Generating references from cited claims…");
  try {
    await regenerateReportReferences(true);
    refLog.classList.add("done");
    refLog.innerHTML = '<svg class="icon"><use href="#icon-check"/></svg> References generated';
  } catch (err) {
    refLog.innerHTML = `<svg class="icon"><use href="#icon-alert"/></svg> References failed — ${escapeHtml(err.message)}`;
    toast(`Reference generation failed: ${err.message}`, "error");
  }

  setProgress(total + 1, "Finalizing document…");
  addLog("Finalizing document…").classList.add("done");

  try {
    renderReportResults();
    showReportScreen("results");
  } catch (err) {
    toast(`Couldn't render results: ${err.message}`, "error");
  }
}

// ---------- Results screen ----------

function renderChapterWordBadge(chapter) {
  const el = document.querySelector(`.chapter-word-count[data-id="${chapter.id}"]`);
  if (!el) return;
  if (!chapter.content) {
    el.textContent = "";
    return;
  }
  const target = Math.max(300, Math.round(reportState.wordCount / Math.max(reportState.chapters.length, 1)));
  const written = chapter.content.split(/\s+/).filter(Boolean).length;
  const ratio = written / target;
  const cls = ratio >= 0.75 && ratio <= 1.3 ? "ok" : "off";
  el.innerHTML = `<span class="word-badge ${cls}">${written.toLocaleString()} / ${target.toLocaleString()} words</span>`;
}

function renderReportPreview() {
  const container = document.getElementById("report-preview-content");
  const today = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  const templateLabel = reportState.template === "academic" ? "Academic Style" : "Industry Style";

  const cover = `
    <div class="doc-cover">
      <div class="doc-type">${escapeHtml(reportState.reportType)} · ${escapeHtml(templateLabel)}</div>
      <h1>${escapeHtml(reportState.topic || "Untitled Report")}</h1>
      <div class="doc-meta">${today} · ${escapeHtml(reportState.language)} · ${escapeHtml(reportState.citationStyle)} citations</div>
    </div>
  `;

  const toc = `
    <div class="doc-toc">
      <h2>Table of Contents</h2>
      <ol>
        ${reportState.chapters.map((c) => `<li>${escapeHtml(c.title)}</li>`).join("")}
        ${reportState.references ? "<li>References</li>" : ""}
      </ol>
    </div>
  `;

  container.innerHTML = cover + toc;

  reportState.chapters.forEach((c, idx) => {
    const chapterDiv = document.createElement("div");
    chapterDiv.className = "doc-chapter";
    chapterDiv.innerHTML = `<h2>${idx + 1}. ${escapeHtml(c.title)}</h2><div class="markdown-body"></div>`;
    container.appendChild(chapterDiv);
    renderMarkdown(chapterDiv.querySelector(".markdown-body"), c.content || "_Not generated yet._");
  });

  if (reportState.references) {
    const refDiv = document.createElement("div");
    refDiv.className = "doc-chapter";
    refDiv.innerHTML = `<h2>References</h2><div class="markdown-body"></div>`;
    container.appendChild(refDiv);
    renderMarkdown(refDiv.querySelector(".markdown-body"), reportState.references);
  }
}

function renderReportResults() {
  document.getElementById("report-result-title").innerHTML =
    `<svg class="icon"><use href="#icon-report"/></svg> ${escapeHtml(reportState.topic || "Report")}`;

  const combined = reportState.chapters.map((c) => `${c.title}\n\n${c.content || ""}`).join("\n\n");

  apiPost("/api/report/readability", { text: combined })
    .then((m) => {
      document.getElementById("report-metrics").innerHTML = `
        <span><strong>${m.word_count.toLocaleString()}</strong> words</span>
        <span><strong>${m.flesch_reading_ease}</strong> reading ease — ${escapeHtml(m.level)}</span>
        <span><strong>Grade ${m.flesch_kincaid_grade}</strong> reading level</span>
      `;
    })
    .catch(() => {});

  const editOptions = [
    ["", "Edit with AI…"], ["expand", "Expand"], ["shorten", "Shorten"], ["rewrite", "Rewrite"],
    ["simplify", "Simplify"], ["humanize", "Humanize"], ["academic", "Academic tone"],
    ["professional", "Professional tone"], ["technical", "Technical tone"], ["formal", "Formal tone"],
    ["summarize", "Summarize"], ["continue", "Continue writing"], ["grammar", "Fix grammar"],
  ].map(([v, l]) => `<option value="${v}">${l}</option>`).join("");

  const list = document.getElementById("report-chapters-list");
  list.innerHTML = reportState.chapters.map((ch, idx) => `
    <div class="card result-card chapter-card" data-id="${ch.id}">
      <div class="result-header">
        <h3><svg class="icon"><use href="#icon-file"/></svg> ${idx + 1}. ${escapeHtml(ch.title)} <span class="chapter-word-count" data-id="${ch.id}"></span></h3>
        <div class="result-actions">
          <select class="chapter-edit-select" data-id="${ch.id}">${editOptions}</select>
          <button class="btn ghost icon-btn chapter-apply-edit" data-id="${ch.id}" title="Apply edit"><svg class="icon"><use href="#icon-bolt"/></svg></button>
          <button class="btn ghost icon-btn chapter-regenerate" data-id="${ch.id}" title="Regenerate"><svg class="icon"><use href="#icon-refresh"/></svg></button>
          <button class="btn ghost icon-btn chapter-copy" data-id="${ch.id}" title="Copy"><svg class="icon"><use href="#icon-copy"/></svg></button>
        </div>
      </div>
      <div class="markdown-body chapter-content" data-id="${ch.id}"></div>
    </div>
  `).join("");

  reportState.chapters.forEach((ch) => {
    const el = list.querySelector(`.chapter-content[data-id="${ch.id}"]`);
    if (el) renderMarkdown(el, ch.content || "_Not generated yet — use Regenerate above._");
    renderChapterWordBadge(ch);
  });

  renderMarkdown(
    document.getElementById("report-references-content"),
    reportState.references || "_Not generated yet._"
  );
}

async function regenerateReportChapter(chapter, btn) {
  const total = reportState.chapters.length;
  const wordPerChapter = Math.max(300, Math.round(reportState.wordCount / total));
  const chapterIndex = reportState.chapters.indexOf(chapter);

  let citationStart = 1;
  for (let i = 0; i < chapterIndex; i++) {
    citationStart = Math.max(citationStart, extractMaxCitationNumber(reportState.chapters[i].content) + 1);
  }

  await withLoading(btn, async () => {
    const { result } = await apiPost("/api/report/chapter", {
      topic: reportState.topic,
      report_type: reportState.reportType,
      chapter_title: chapter.title,
      subsections: chapter.subsections,
      chapter_number: chapterIndex + 1,
      total_chapters: total,
      word_target: wordPerChapter,
      language: reportState.language,
      style: reportState.style,
      citation_style: reportState.citationStyle,
      previous_context: buildChapterContext(reportState.chapters, chapterIndex),
      citation_start: citationStart,
      model: settings.model,
      temperature: settings.temperature,
      max_tokens: chapterMaxTokens(wordPerChapter),
    });
    chapter.content = result;
    saveReportState();
    const el = document.querySelector(`.chapter-content[data-id="${chapter.id}"]`);
    if (el) renderMarkdown(el, result);
    renderChapterWordBadge(chapter);
    toast("Chapter regenerated", "success");
  });
}

async function applyReportChapterEdit(chapter, instruction, btn) {
  if (!chapter.content) return toast("Generate this chapter first.", "error");

  await withLoading(btn, async () => {
    const { result } = await apiPost("/api/report/edit", {
      content: chapter.content,
      instruction,
      model: settings.model,
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
    });
    chapter.content = result;
    saveReportState();
    const el = document.querySelector(`.chapter-content[data-id="${chapter.id}"]`);
    if (el) renderMarkdown(el, result);
    toast("Chapter updated", "success");
  });
}

function initReportChapterListEvents() {
  const list = document.getElementById("report-chapters-list");

  list.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const id = Number(btn.dataset.id);
    const chapter = reportState.chapters.find((c) => c.id === id);
    if (!chapter) return;

    if (btn.classList.contains("chapter-copy")) {
      copyToClipboard(chapter.content || "", btn);
    } else if (btn.classList.contains("chapter-regenerate")) {
      regenerateReportChapter(chapter, btn);
    } else if (btn.classList.contains("chapter-apply-edit")) {
      const select = list.querySelector(`.chapter-edit-select[data-id="${id}"]`);
      if (!select.value) return toast("Choose an edit action first.", "error");
      applyReportChapterEdit(chapter, select.value, btn).then(() => (select.value = ""));
    }
  });
}

async function regenerateReportReferences(silent) {
  const combined = reportState.chapters.map((c) => c.content || "").join("\n\n");
  if (!combined.trim()) {
    if (!silent) toast("Generate chapters first.", "error");
    return;
  }

  const run = async () => {
    const { result } = await apiPost("/api/report/references", {
      combined_text: combined,
      citation_style: reportState.citationStyle,
      model: settings.model,
    });
    reportState.references = result;
    saveReportState();
    renderMarkdown(document.getElementById("report-references-content"), result);
  };

  if (silent) {
    await run();
  } else {
    await withLoading(document.getElementById("report-references-regen"), run);
  }
}

async function downloadReportFormat(format) {
  const payload = {
    title: reportState.topic || "Report",
    chapters: reportState.chapters.map((c) => ({ title: c.title, content: c.content || "" })),
    references: reportState.references || "",
  };

  const btnId = { docx: "report-download-docx", pdf: "report-download-pdf", markdown: "report-download-md" }[format];
  const btn = document.getElementById(btnId);
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>';

  try {
    const res = await fetch(`/api/report/export/${format}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Export failed.");
    const blob = await res.blob();
    const ext = format === "markdown" ? "md" : format;
    downloadBlob(`${(reportState.topic || "report").replace(/[^a-z0-9]+/gi, "_")}.${ext}`, blob);
  } catch (err) {
    toast(err.message, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = original;
  }
}

function resetReportState() {
  reportState.topic = "";
  reportState.chapters = [];
  reportState.originalChapters = [];
  reportState.references = "";
  localStorage.removeItem(REPORT_STATE_KEY);
  document.getElementById("report-topic").value = "";
}

function loadReportState() {
  try {
    const saved = localStorage.getItem(REPORT_STATE_KEY);
    if (!saved) return;
    Object.assign(reportState, JSON.parse(saved));
    reportChapterIdCounter = Math.max(
      0,
      ...reportState.chapters.map((c) => c.id || 0),
      ...reportState.originalChapters.map((c) => c.id || 0)
    );
  } catch {
    /* corrupt/old saved state — start fresh */
  }
}

function restoreReportScreen() {
  if (reportState.topic) document.getElementById("report-topic").value = reportState.topic;

  if (!reportState.chapters.length) return;

  renderReportTocList();

  if (reportState.chapters.some((c) => c.content)) {
    renderReportResults();
    showReportScreen("results");
  } else {
    showReportScreen("toc");
  }
}

function initReportGenerator() {
  renderReportTypeChips();
  initRadioChipGroup("report-type-chips");
  initRadioChipGroup("report-wordcount-chips", (value) => {
    document.getElementById("report-wordcount-custom").classList.toggle("hidden", value !== "custom");
  });

  initReportTocEvents();
  initReportChapterListEvents();

  document.getElementById("report-generate-toc").addEventListener("click", generateReportToc);

  document.getElementById("report-toc-add").addEventListener("click", () => {
    reportState.chapters.push(makeReportChapter("New Chapter"));
    renderReportTocList();
    saveReportState();
  });

  document.getElementById("report-toc-reset").addEventListener("click", () => {
    if (!reportState.originalChapters.length) return toast("No AI-generated version to reset to.", "error");
    reportState.chapters = reportState.originalChapters.map((c) => ({
      ...c, id: ++reportChapterIdCounter, subsections: [...c.subsections],
    }));
    renderReportTocList();
    saveReportState();
    toast("Reset to AI-generated table of contents", "success");
  });

  document.getElementById("report-back-to-settings").addEventListener("click", () => showReportScreen("settings"));
  document.getElementById("report-generate-full").addEventListener("click", generateFullReport);
  document.getElementById("report-regenerate-all").addEventListener("click", generateFullReport);

  document.getElementById("report-preview-btn").addEventListener("click", () => {
    renderReportPreview();
    showReportScreen("preview");
  });
  document.getElementById("report-preview-back").addEventListener("click", () => showReportScreen("results"));

  document.getElementById("report-start-over").addEventListener("click", () => {
    if (!confirm("Start a new report? This clears the current one.")) return;
    resetReportState();
    showReportScreen("settings");
  });

  document.getElementById("report-copy-all").addEventListener("click", (e) => {
    const combined =
      reportState.chapters.map((c) => `## ${c.title}\n\n${c.content || ""}`).join("\n\n") +
      (reportState.references ? `\n\n## References\n\n${reportState.references}` : "");
    copyToClipboard(combined, e.currentTarget);
  });

  document.getElementById("report-references-copy").addEventListener("click", (e) =>
    copyToClipboard(reportState.references || "", e.currentTarget)
  );
  document.getElementById("report-references-regen").addEventListener("click", () => regenerateReportReferences(false));

  document.getElementById("report-download-docx").addEventListener("click", () => downloadReportFormat("docx"));
  document.getElementById("report-download-pdf").addEventListener("click", () => downloadReportFormat("pdf"));
  document.getElementById("report-download-md").addEventListener("click", () => downloadReportFormat("markdown"));

  loadReportState();
  restoreReportScreen();
}

// ================= AI DETECTOR =================

const DEFAULT_DETECT_WEIGHTS = {
  low_burstiness: 0.28,
  low_vocabulary_richness: 0.22,
  repetition: 0.20,
  transition_uniformity: 0.15,
  paragraph_uniformity: 0.15,
};

const DETECT_SIGNAL_LABELS = {
  low_burstiness: "Low Burstiness",
  low_vocabulary_richness: "Low Vocabulary Richness",
  repetition: "Repetition",
  transition_uniformity: "Transition Uniformity",
  paragraph_uniformity: "Paragraph Uniformity",
};

const detectState = {
  filename: "",
  text: "",
  analysis: null,
  insights: "",
  humanized: "",
  weights: { ...DEFAULT_DETECT_WEIGHTS },
};

function showDetectScreen(name) {
  document.querySelectorAll(".detect-screen").forEach((s) => s.classList.remove("active"));
  document.getElementById(`detect-screen-${name}`)?.classList.add("active");
}

function bandClass(band) {
  return band.toLowerCase();
}

function buildGaugeSVG(score, band) {
  const radius = 80;
  const arcLength = Math.PI * radius;
  const filled = Math.max(0, Math.min(100, score)) / 100 * arcLength;
  const color = band === "Low" ? "var(--success)" : band === "Medium" ? "var(--warning)" : "var(--danger)";

  return `
    <svg width="200" height="115" viewBox="0 0 200 115" role="img" aria-label="Estimated AI-writing likelihood ${score}%, ${band}">
      <path d="M 20 100 A ${radius} ${radius} 0 0 1 180 100" fill="none" stroke="var(--border)" stroke-width="16" stroke-linecap="round"/>
      <path d="M 20 100 A ${radius} ${radius} 0 0 1 180 100" fill="none" stroke="${color}" stroke-width="16"
        stroke-linecap="round" stroke-dasharray="${filled} ${arcLength}"/>
      <text x="100" y="88" text-anchor="middle" font-size="30" font-weight="700" fill="var(--text)">${score}%</text>
      <text x="100" y="106" text-anchor="middle" font-size="11" fill="var(--text-faint)">estimated AI likelihood</text>
    </svg>
  `;
}

function initDetector() {
  const dropzone = document.getElementById("detect-dropzone");
  const fileInput = document.getElementById("detect-file-input");

  dropzone.addEventListener("click", () => fileInput.click());

  ["dragover", "dragleave", "drop"].forEach((evt) => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.toggle("drag", evt === "dragover");
    });
  });

  dropzone.addEventListener("drop", (e) => {
    const file = e.dataTransfer.files[0];
    if (file) handleDetectFile(file);
  });

  fileInput.addEventListener("change", (e) => {
    if (e.target.files[0]) handleDetectFile(e.target.files[0]);
  });

  async function handleDetectFile(file) {
    const meta = document.getElementById("detect-file-meta");
    meta.textContent = `Selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    meta.classList.remove("hidden");

    const btn = document.getElementById("detect-analyze-btn");
    await withLoading(btn, async () => {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/detect/analyze/file", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed.");

      detectState.filename = data.filename;
      detectState.text = data.text;
      detectState.analysis = data.analysis;
      detectState.insights = "";
      detectState.humanized = "";

      renderDetectResults();
      showDetectScreen("results");
    });
  }

  document.getElementById("detect-analyze-btn").addEventListener("click", async () => {
    const text = document.getElementById("detect-text-input").value.trim();
    if (!text && !fileInput.files[0]) return toast("Upload a file or paste some text first.", "error");
    if (fileInput.files[0] && !text) return; // handled by change listener already
    if (!text) return;

    const btn = document.getElementById("detect-analyze-btn");
    await withLoading(btn, async () => {
      const { text: fullText, analysis } = await apiPost("/api/detect/analyze/text", { text });

      detectState.filename = "pasted-text";
      detectState.text = fullText;
      detectState.analysis = analysis;
      detectState.insights = "";
      detectState.humanized = "";

      renderDetectResults();
      showDetectScreen("results");
    });
  });

  document.getElementById("detect-weights-reset").addEventListener("click", () => {
    detectState.weights = { ...DEFAULT_DETECT_WEIGHTS };
    renderWeightSliders();
    recomputeAILikelihood();
  });

  document.getElementById("detect-start-over").addEventListener("click", () => {
    detectState.filename = "";
    detectState.text = "";
    detectState.analysis = null;
    detectState.insights = "";
    detectState.humanized = "";
    document.getElementById("detect-text-input").value = "";
    document.getElementById("detect-file-meta").classList.add("hidden");
    fileInput.value = "";
    document.getElementById("detect-insights-content").classList.add("hidden");
    document.getElementById("detect-insights-content").innerHTML = "";
    document.getElementById("detect-humanize-content").classList.add("hidden");
    document.getElementById("detect-humanize-content").innerHTML = "";
    document.getElementById("detect-reanalyze-humanized").classList.add("hidden");
    showDetectScreen("upload");
  });

  document.getElementById("detect-insights-btn").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    await withLoading(btn, async () => {
      const { result } = await apiPost("/api/detect/insights", {
        text: detectState.text,
        analysis: detectState.analysis,
        model: settings.model,
        temperature: settings.temperature,
        max_tokens: settings.maxTokens,
      });
      detectState.insights = result;
      const content = document.getElementById("detect-insights-content");
      renderMarkdown(content, result);
      content.classList.remove("hidden");
      document.getElementById("detect-insights-copy").classList.remove("hidden");
      document.getElementById("detect-insights-copy").onclick = (ev) => copyToClipboard(result, ev.currentTarget);
    });
  });

  document.getElementById("detect-humanize-btn").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const weaknesses = (detectState.analysis?.ai_likelihood?.contributing_factors || [])
      .slice(0, 3)
      .map((f) => f.signal);

    await withLoading(btn, async () => {
      const { result, truncated } = await apiPost("/api/detect/humanize", {
        text: detectState.text,
        weaknesses,
        model: settings.model,
        temperature: settings.temperature,
        max_tokens: settings.maxTokens,
      });
      detectState.humanized = result;
      const content = document.getElementById("detect-humanize-content");
      renderMarkdown(content, result);
      content.classList.remove("hidden");
      document.getElementById("detect-humanize-copy").classList.remove("hidden");
      document.getElementById("detect-humanize-copy").onclick = (ev) => copyToClipboard(result, ev.currentTarget);
      document.getElementById("detect-humanize-download").classList.remove("hidden");
      document.getElementById("detect-humanize-download").onclick = () => download("humanized_text.txt", result);
      document.getElementById("detect-reanalyze-humanized").classList.remove("hidden");
      if (truncated) toast("Only the first ~1,200 words were rewritten — see the note at the end.", "info");
    });
  });

  document.getElementById("detect-reanalyze-humanized").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const before = detectState.analysis;

    await withLoading(btn, async () => {
      const { analysis } = await apiPost("/api/detect/analyze/text", { text: detectState.humanized });
      detectState.text = detectState.humanized;
      detectState.analysis = analysis;
      detectState.insights = "";
      detectState.humanized = "";
      document.getElementById("detect-insights-content").classList.add("hidden");
      document.getElementById("detect-humanize-content").classList.add("hidden");
      document.getElementById("detect-reanalyze-humanized").classList.add("hidden");
      renderDetectResults();
      renderDetectComparison(before, analysis);
      toast("Re-analyzed the rewritten text", "success");
    });
  });

  ["docx", "pdf", "markdown", "json", "csv"].forEach((format) => {
    const id = { docx: "detect-export-docx", pdf: "detect-export-pdf", markdown: "detect-export-md", json: "detect-export-json", csv: "detect-export-csv" }[format];
    document.getElementById(id).addEventListener("click", () => downloadDetectFormat(format));
  });
}

async function downloadDetectFormat(format) {
  if (!detectState.analysis) return toast("Run an analysis first.", "error");

  const btnId = { docx: "detect-export-docx", pdf: "detect-export-pdf", markdown: "detect-export-md", json: "detect-export-json", csv: "detect-export-csv" }[format];
  const btn = document.getElementById(btnId);
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>';

  try {
    const res = await fetch(`/api/detect/export/${format}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: detectState.filename || "document-analysis",
        text: detectState.text,
        analysis: detectState.analysis,
        insights: detectState.insights,
      }),
    });
    if (!res.ok) throw new Error("Export failed.");
    const blob = await res.blob();
    const ext = format === "markdown" ? "md" : format;
    downloadBlob(`${(detectState.filename || "document-analysis").replace(/[^a-z0-9]+/gi, "_")}.${ext}`, blob);
  } catch (err) {
    toast(err.message, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = original;
  }
}

function renderWeightSliders() {
  const container = document.getElementById("detect-weight-sliders");
  container.innerHTML = Object.keys(DEFAULT_DETECT_WEIGHTS).map((key) => `
    <div class="detect-factor-row">
      <div class="detect-factor-label">${DETECT_SIGNAL_LABELS[key]}</div>
      <input type="range" class="detect-weight-slider" data-key="${key}" min="0" max="1" step="0.01" value="${detectState.weights[key]}" />
      <div class="detect-factor-value" id="detect-weight-val-${key}">${Math.round(detectState.weights[key] * 100)}%</div>
    </div>
  `).join("");

  container.querySelectorAll(".detect-weight-slider").forEach((slider) => {
    slider.addEventListener("input", (e) => {
      const key = e.target.dataset.key;
      detectState.weights[key] = parseFloat(e.target.value);
      document.getElementById(`detect-weight-val-${key}`).textContent = `${Math.round(detectState.weights[key] * 100)}%`;
      recomputeAILikelihood();
    });
  });
}

function recomputeAILikelihood() {
  const a = detectState.analysis;
  if (!a) return;

  const signals = a.ai_likelihood.signals;
  const weights = detectState.weights;
  const weightSum = Object.values(weights).reduce((s, w) => s + w, 0) || 1;

  const weighted = Object.keys(signals).reduce((sum, key) => sum + signals[key] * (weights[key] ?? 0), 0);
  const score = Math.round((weighted / weightSum) * 1000) / 10;

  const band = score >= 65 ? "High" : score >= 35 ? "Medium" : "Low";

  document.getElementById("detect-gauge").innerHTML = buildGaugeSVG(score, band);
  const bandLabel = document.getElementById("detect-band-label");
  bandLabel.textContent = `${band} likelihood`;
  bandLabel.className = `detect-gauge-band ${bandClass(band)}`;
  document.getElementById("detect-confidence-label").textContent =
    `Confidence: ${a.ai_likelihood.confidence} · Human-writing complement: ${(100 - score).toFixed(1)}% · custom weights`;
}

function renderDocumentPreview() {
  const container = document.getElementById("detect-doc-preview");
  const paragraphs = detectState.analysis?.paragraphs || [];

  container.innerHTML = paragraphs.map((p) => {
    const intensity = Math.round(p.flag_score * 100);
    const color = `color-mix(in srgb, var(--accent) ${intensity}%, var(--border))`;
    return `<div class="detect-para-item" style="border-left-color:${color}">${escapeHtml(p.text || p.preview)}</div>`;
  }).join("");
}

function renderDetectComparison(before, after) {
  function deltaRow(label, beforeVal, afterVal, lowerIsBetter) {
    const delta = afterVal - beforeVal;
    const improved = lowerIsBetter ? delta < 0 : delta > 0;
    const arrow = delta === 0 ? "→" : delta > 0 ? "↑" : "↓";
    const cls = delta === 0 ? "" : improved ? "ok" : "off";
    return `
      <div class="row">
        <span>${label}</span>
        <strong>${beforeVal} → ${afterVal} <span class="word-badge ${cls}">${arrow} ${Math.abs(delta).toFixed(2)}</span></strong>
      </div>
    `;
  }

  document.getElementById("detect-comparison-content").innerHTML = `
    <div class="detect-kv-list">
      ${deltaRow("AI-Writing Likelihood %", before.ai_likelihood.estimated_ai_probability, after.ai_likelihood.estimated_ai_probability, true)}
      ${deltaRow("Structure Score", before.structure.structure_score, after.structure.structure_score, false)}
      ${deltaRow("Vocabulary Richness (TTR)", before.stylometry.type_token_ratio, after.stylometry.type_token_ratio, false)}
      ${deltaRow("Sentence Burstiness (CV)", before.stylometry.burstiness_cv, after.stylometry.burstiness_cv, false)}
      ${deltaRow("Repetition Ratio", before.stylometry.repetition_ratio, after.stylometry.repetition_ratio, true)}
    </div>
  `;
  document.getElementById("detect-comparison-card").classList.remove("hidden");
}

function renderDetectResults() {
  const a = detectState.analysis;
  if (!a) return;

  document.getElementById("detect-result-title").innerHTML =
    `<svg class="icon"><use href="#icon-shield"/></svg> ${escapeHtml(detectState.filename || "Analysis")}`;

  document.getElementById("detect-gauge").innerHTML = buildGaugeSVG(a.ai_likelihood.estimated_ai_probability, a.ai_likelihood.band);

  const bandLabel = document.getElementById("detect-band-label");
  bandLabel.textContent = `${a.ai_likelihood.band} likelihood`;
  bandLabel.className = `detect-gauge-band ${bandClass(a.ai_likelihood.band)}`;
  document.getElementById("detect-confidence-label").textContent =
    `Confidence: ${a.ai_likelihood.confidence} · Human-writing complement: ${a.ai_likelihood.human_probability_complement}%`;

  document.getElementById("detect-metrics-grid").innerHTML = `
    <div class="card metric"><div class="metric-label">Word Count</div><div class="metric-value">${a.stats.word_count.toLocaleString()}</div></div>
    <div class="card metric"><div class="metric-label">Reading Time</div><div class="metric-value">${a.stats.reading_time_minutes}m</div></div>
    <div class="card metric"><div class="metric-label">Language</div><div class="metric-value">${escapeHtml(a.stats.language)}</div></div>
    <div class="card metric"><div class="metric-label">Structure Score</div><div class="metric-value">${a.structure.structure_score}/100</div></div>
    <div class="card metric"><div class="metric-label">Mechanics Score</div><div class="metric-value">${a.mechanics.mechanics_score}/100</div></div>
    <div class="card metric"><div class="metric-label">Reading Ease</div><div class="metric-value">${a.readability.flesch_reading_ease}</div></div>
  `;

  document.getElementById("detect-factors").innerHTML = a.ai_likelihood.contributing_factors.map((f, i) => `
    <div class="detect-factor-row">
      <div class="detect-factor-label">${escapeHtml(f.signal)}</div>
      <div class="detect-factor-track"><div class="detect-factor-fill" style="width:${f.strength * 100}%; background:${SERIES_COLORS[i % SERIES_COLORS.length]}"></div></div>
      <div class="detect-factor-value">${Math.round(f.strength * 100)}%</div>
    </div>
  `).join("") + `<p class="detect-gauge-sub" style="margin-top:8px">${escapeHtml(a.ai_likelihood.methodology)}</p>`;

  const r = a.readability;
  document.getElementById("detect-readability-table").innerHTML = `
    <thead><tr><th>Index</th><th>Score</th></tr></thead>
    <tbody>
      <tr><td>Flesch Reading Ease</td><td>${r.flesch_reading_ease}</td></tr>
      <tr><td>Flesch-Kincaid Grade</td><td>${r.flesch_kincaid_grade}</td></tr>
      <tr><td>Gunning Fog Index</td><td>${r.gunning_fog_index}</td></tr>
      <tr><td>SMOG Index</td><td>${r.smog_index}</td></tr>
      <tr><td>Coleman-Liau Index</td><td>${r.coleman_liau_index}</td></tr>
      <tr><td>Automated Readability Index</td><td>${r.automated_readability_index}</td></tr>
      <tr><td>Avg Words / Sentence</td><td>${r.avg_words_per_sentence}</td></tr>
      <tr><td>Avg Syllables / Word</td><td>${r.avg_syllables_per_word}</td></tr>
    </tbody>
  `;

  const s = a.stylometry;
  document.getElementById("detect-stylometry-list").innerHTML = `
    <div class="row"><span>Avg Sentence Length</span><strong>${s.avg_sentence_length} words</strong></div>
    <div class="row"><span>Sentence-Length Burstiness (CV)</span><strong>${s.burstiness_cv}</strong></div>
    <div class="row"><span>Avg Paragraph Length</span><strong>${s.avg_paragraph_length} words</strong></div>
    <div class="row"><span>Vocabulary Richness (TTR)</span><strong>${s.type_token_ratio}</strong></div>
    <div class="row"><span>Lexical Density</span><strong>${s.lexical_density}</strong></div>
    <div class="row"><span>Avg Word Length</span><strong>${s.avg_word_length} chars</strong></div>
    <div class="row"><span>Passive Voice Ratio</span><strong>${s.passive_voice_ratio}</strong></div>
    <div class="row"><span>Transition-Phrase Diversity</span><strong>${s.transition_diversity}</strong></div>
    <div class="row"><span>Repetition Ratio</span><strong>${s.repetition_ratio}</strong></div>
    <div class="row"><span>Punctuation Diversity</span><strong>${s.punctuation_diversity} marks</strong></div>
  `;

  const c = a.citations;
  document.getElementById("detect-citations").innerHTML = c.has_citations ? `
    <div class="row"><span>Style Detected</span><strong>${escapeHtml(c.style_detected)}</strong></div>
    <div class="row"><span>Total Citations</span><strong>${c.total_citations}</strong></div>
    <div class="row"><span>Density (per 1,000 words)</span><strong>${c.citation_density_per_1000_words}</strong></div>
    <div class="row"><span>Numbering Gaps</span><strong>${c.numbering_gaps.length ? c.numbering_gaps.join(", ") : "None"}</strong></div>
  ` : `<p class="chart-empty">No citations detected in this document.</p>`;

  const m = a.mechanics;
  document.getElementById("detect-mechanics").innerHTML = m.issues.length ? `
    <p class="subtitle">Score: <strong>${m.mechanics_score}/100</strong> — ${m.total_issue_count} issue(s) found (${m.issues_per_1000_words} per 1,000 words)</p>
    <ul class="detect-issue-list">
      ${m.issues.map((i) => `<li><span>${escapeHtml(i.type)}</span><span>${i.count}×</span></li>`).join("")}
    </ul>
  ` : `<p class="chart-empty">No mechanical issues detected.</p>`;

  document.getElementById("detect-paragraphs").innerHTML = a.paragraphs.map((p) => {
    const intensity = Math.round(p.flag_score * 100);
    const color = `color-mix(in srgb, var(--accent) ${intensity}%, var(--border))`;
    return `
      <div class="detect-para-item" style="border-left-color:${color}">
        <div class="preview">${escapeHtml(p.preview)}</div>
        <div class="meta">${p.word_count} words · ${p.sentence_count} sentences · pattern uniformity ${intensity}%</div>
      </div>
    `;
  }).join("");

  detectState.weights = { ...DEFAULT_DETECT_WEIGHTS };
  renderWeightSliders();
  renderDocumentPreview();
  document.getElementById("detect-comparison-card").classList.add("hidden");
}

// ================= HISTORY =================

let historyCache = [];

async function loadHistory() {
  const { history } = await apiGet("/api/history");
  historyCache = history;
  renderHistory(history);
}

function renderHistory(rows) {
  const body = document.getElementById("history-body");
  const empty = document.getElementById("history-empty");
  const table = document.getElementById("history-table");

  if (rows.length === 0) {
    table.classList.add("hidden");
    empty.classList.remove("hidden");
    return;
  }

  table.classList.remove("hidden");
  empty.classList.add("hidden");

  body.innerHTML = rows
    .map(
      (r) => `
    <tr>
      <td>${r.id}</td>
      <td>${escapeHtml(r.feature)}</td>
      <td title="${escapeHtml(r.prompt)}">${escapeHtml(truncate(r.prompt, 60))}</td>
      <td title="${escapeHtml(r.response)}">${escapeHtml(truncate(r.response, 60))}</td>
      <td>${r.created_at}</td>
    </tr>`
    )
    .join("");
}

function truncate(str, n) {
  return str && str.length > n ? str.slice(0, n) + "…" : str || "";
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function initHistory() {
  document.getElementById("history-search").addEventListener("input", (e) => {
    const q = e.target.value.toLowerCase();
    const filtered = historyCache.filter((r) =>
      [r.feature, r.prompt, r.response].some((v) => (v || "").toLowerCase().includes(q))
    );
    renderHistory(filtered);
  });

  document.getElementById("history-export").addEventListener("click", () => {
    window.location.href = "/api/history/export";
  });

  document.getElementById("history-clear").addEventListener("click", async () => {
    await apiDelete("/api/history");
    toast("History cleared", "success");
    loadHistory();
  });
}

// ================= ANALYTICS =================

async function loadAnalytics() {
  const { analytics } = await apiGet("/api/analytics");
  renderAnalytics(analytics);
}

function renderAnalytics(rows) {
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  const max = Math.max(1, ...rows.map((r) => r.count));

  const metrics = document.getElementById("analytics-metrics");
  metrics.innerHTML = `
    <div class="card metric"><div class="metric-label">Total Requests</div><div class="metric-value">${total}</div></div>
    <div class="card metric"><div class="metric-label">Features Used</div><div class="metric-value">${rows.length}</div></div>
    <div class="card metric"><div class="metric-label">Top Feature</div><div class="metric-value">${rows[0] ? escapeHtml(rows[0].feature) : "—"}</div></div>
  `;

  const bar = document.getElementById("chart-bar");
  const donut = document.getElementById("chart-donut");
  const body = document.getElementById("analytics-body");

  if (rows.length === 0) {
    const emptyChart = '<p class="chart-empty"><svg class="icon"><use href="#icon-chart"/></svg> No usage data yet.</p>';
    bar.innerHTML = emptyChart;
    donut.innerHTML = emptyChart;
    body.innerHTML = `<tr><td colspan="2" class="empty-state">No activity recorded.</td></tr>`;
    return;
  }

  bar.innerHTML = rows
    .map(
      (r, i) => `
    <div class="bar-row">
      <div class="bar-label">${escapeHtml(r.feature)}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${(r.count / max) * 100}%; background:${SERIES_COLORS[i % SERIES_COLORS.length]}"></div></div>
      <div class="bar-value">${r.count}</div>
    </div>`
    )
    .join("");

  donut.innerHTML = renderDonut(rows, total);

  body.innerHTML = rows
    .map((r) => `<tr><td>${escapeHtml(r.feature)}</td><td>${r.count}</td></tr>`)
    .join("");
}

function renderDonut(rows, total) {
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  const segments = rows
    .map((r, i) => {
      const fraction = r.count / total;
      const length = fraction * circumference;
      const seg = `<circle cx="80" cy="80" r="${radius}" fill="none" stroke="${SERIES_COLORS[i % SERIES_COLORS.length]}"
        stroke-width="20" stroke-dasharray="${length} ${circumference - length}"
        stroke-dashoffset="${-offset}" transform="rotate(-90 80 80)"></circle>`;
      offset += length;
      return seg;
    })
    .join("");

  const legend = rows
    .map(
      (r, i) => `
    <li><span class="legend-swatch" style="background:${SERIES_COLORS[i % SERIES_COLORS.length]}"></span>
    ${escapeHtml(r.feature)} <span class="legend-value">${r.count}</span></li>`
    )
    .join("");

  return `
    <div class="donut-wrap">
      <svg width="160" height="160" viewBox="0 0 160 160" role="img" aria-label="Usage distribution by feature">${segments}</svg>
      <ul class="chart-legend">${legend}</ul>
    </div>
  `;
}

function initAnalytics() {
  document.getElementById("analytics-reset").addEventListener("click", async () => {
    await apiDelete("/api/analytics");
    toast("Analytics reset", "success");
    loadAnalytics();
  });
}

// ================= SETTINGS =================

async function loadSettings() {
  document.getElementById("settings-app-name").textContent = "DMIXERAI";

  try {
    const status = await apiGet("/api/status");
    document.getElementById("settings-app-version").textContent = status.version;

    const statusCard = document.getElementById("settings-status");
    statusCard.innerHTML = status.success
      ? `<h3><svg class="icon"><use href="#icon-bolt"/></svg> API Status</h3><p style="color:var(--success)">Groq API Connected</p><p>Model: ${status.model}</p><p>Response Time: ${status.response_time}s</p>`
      : `<h3><svg class="icon"><use href="#icon-bolt"/></svg> API Status</h3><p style="color:var(--danger)">${escapeHtml(status.message || "Disconnected")}</p>`;
  } catch {
    document.getElementById("settings-status").innerHTML = `<h3><svg class="icon"><use href="#icon-bolt"/></svg> API Status</h3><p style="color:var(--danger)">Unable to reach server</p>`;
  }
}

function initSettings() {
  document.getElementById("settings-reset").addEventListener("click", () => {
    settings.temperature = 0.2;
    settings.maxTokens = 8192;
    document.querySelectorAll("#assistant-temp, #settings-temp").forEach((el) => (el.value = 0.2));
    document.querySelectorAll("#assistant-temp-val, #settings-temp-val").forEach((el) => (el.textContent = "0.2"));
    document.querySelectorAll("#assistant-tokens, #settings-tokens").forEach((el) => (el.value = 8192));
    document.querySelectorAll("#assistant-tokens-val, #settings-tokens-val").forEach((el) => (el.textContent = "8192"));
    toast("Settings reset", "success");
  });
}

// ================= INIT =================

document.addEventListener("DOMContentLoaded", async () => {
  initNav();
  initTabs();
  initRangeSync();
  initChat();
  initCodeGenerator();
  initDebugger();
  initExplainer();
  initOptimizer();
  initReviewer();
  initSecurityScanner();
  initDocumentGenerator();
  initCommitGenerator();
  initProjectBuilder();
  initFileAnalyzer();
  initReportGenerator();
  initDetector();
  initHistory();
  initAnalytics();
  initSettings();

  await initModels();
  loadDashboard();
});
