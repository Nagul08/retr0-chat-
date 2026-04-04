const messagesEl = document.getElementById("messages");
const whoEl = document.getElementById("who");
const formEl = document.getElementById("send-form");
const inputEl = document.getElementById("message-input");
let latestFingerprint = "";

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

function appendMessage(message) {
  const item = document.createElement("article");
  item.className = "msg";
  item.innerHTML = `
    <div class="msg-head">
      <strong>${escapeHtml(message.user)}</strong>
      <span>${formatTime(message.time)}</span>
    </div>
    <p>${escapeHtml(message.text)}</p>
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
