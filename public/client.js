const messagesEl = document.getElementById("messages");
const whoEl = document.getElementById("who");
const formEl = document.getElementById("send-form");
const inputEl = document.getElementById("message-input");
let latestFingerprint = "";
let currentUsername = "";

function formatTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatMessageText(text) {
  const mentionRegex = /(^|[^A-Za-z0-9_])@([A-Za-z0-9_]{2,24})/g;
  let cursor = 0;
  let html = "";
  let mentionsCurrentUser = false;

  for (const match of text.matchAll(mentionRegex)) {
    const fullMatch = match[0];
    const prefix = match[1] || "";
    const username = match[2];
    const startIndex = match.index || 0;
    const mentionStart = startIndex + prefix.length;
    const mentionEnd = mentionStart + username.length + 1;

    html += escapeHtml(text.slice(cursor, mentionStart));

    const isCurrent = currentUsername && username.toLowerCase() === currentUsername.toLowerCase();
    if (isCurrent) {
      mentionsCurrentUser = true;
    }

    const cls = isCurrent ? "mention mention-self" : "mention";
    html += `<span class="${cls}">@${escapeHtml(username)}</span>`;

    cursor = mentionEnd;

    if (!fullMatch.endsWith(`@${username}`)) {
      cursor = startIndex + fullMatch.length;
    }
  }

  html += escapeHtml(text.slice(cursor));

  return {
    html,
    mentionsCurrentUser
  };
}

function appendMessage(message) {
  const formatted = formatMessageText(message.text);
  const item = document.createElement("article");
  item.className = formatted.mentionsCurrentUser ? "msg msg-mentioned" : "msg";
  item.innerHTML = `
    <div class="msg-head">
      <strong>${escapeHtml(message.user)}</strong>
      <span>${formatTime(message.time)}</span>
    </div>
    <p>${formatted.html}</p>
  `;
  messagesEl.appendChild(item);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function renderMessages(messages) {
  const nextFingerprint = JSON.stringify(messages.map((msg) => [msg.user, msg.text, msg.time]));
  if (nextFingerprint === latestFingerprint) {
    return;
  }

  latestFingerprint = nextFingerprint;
  messagesEl.innerHTML = "";
  messages.forEach(appendMessage);
}

async function loadInitial() {
  const meRes = await fetch("/api/me", { credentials: "same-origin" });
  if (!meRes.ok) {
    location.href = "/login";
    return;
  }
  const me = await meRes.json();
  currentUsername = me.username;
  whoEl.textContent = me.username;

  await refreshMessages();
}

async function refreshMessages() {
  const messagesRes = await fetch("/api/messages", { credentials: "same-origin" });
  if (!messagesRes.ok) {
    location.href = "/login";
    return;
  }
  const history = await messagesRes.json();
  renderMessages(history);
}

formEl.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = inputEl.value.trim();
  if (!text) {
    return;
  }

  const sendRes = await fetch("/api/messages", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ text })
  });

  if (!sendRes.ok) {
    return;
  }

  inputEl.value = "";
  inputEl.focus();
  await refreshMessages();
});

loadInitial().catch(() => {
  location.href = "/login";
});

setInterval(() => {
  refreshMessages().catch(() => {
    location.href = "/login";
  });
}, 2000);
