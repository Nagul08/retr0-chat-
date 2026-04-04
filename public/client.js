const messagesEl = document.getElementById("messages");
const whoEl = document.getElementById("who");
const formEl = document.getElementById("send-form");
const inputEl = document.getElementById("message-input");
const mentionListEl = document.getElementById("mention-list");
let latestFingerprint = "";
let currentUsername = "";
let onlineUsers = [];
let mentionCandidates = [];
let mentionCursor = -1;
let mentionRange = null;

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

function closeMentionList() {
  mentionCandidates = [];
  mentionCursor = -1;
  mentionRange = null;
  mentionListEl.classList.remove("is-open");
  mentionListEl.innerHTML = "";
}

function openMentionList(candidates, range) {
  mentionCandidates = candidates;
  mentionCursor = candidates.length ? 0 : -1;
  mentionRange = range;

  if (!candidates.length) {
    closeMentionList();
    return;
  }

  mentionListEl.innerHTML = candidates
    .map((name, index) => {
      const cls = index === mentionCursor ? "mention-item active" : "mention-item";
      return `<div class="${cls}" data-index="${index}" role="option"><strong>@${escapeHtml(name)}</strong></div>`;
    })
    .join("");

  mentionListEl.classList.add("is-open");
}

function updateMentionListSelection() {
  const items = mentionListEl.querySelectorAll(".mention-item");
  items.forEach((item, index) => {
    if (index === mentionCursor) {
      item.classList.add("active");
    } else {
      item.classList.remove("active");
    }
  });
}

function applyMention(username) {
  if (!mentionRange) {
    return;
  }

  const text = inputEl.value;
  const before = text.slice(0, mentionRange.start);
  const after = text.slice(mentionRange.end);
  const insert = `@${username} `;
  inputEl.value = `${before}${insert}${after}`;
  const cursorPos = before.length + insert.length;
  inputEl.setSelectionRange(cursorPos, cursorPos);
  inputEl.focus();
  closeMentionList();
}

function getMentionContext() {
  const caret = inputEl.selectionStart || 0;
  const before = inputEl.value.slice(0, caret);
  const match = before.match(/(^|\s)@([A-Za-z0-9_]*)$/);
  if (!match) {
    return null;
  }

  const query = match[2] || "";
  return {
    query,
    range: {
      start: caret - query.length - 1,
      end: caret
    }
  };
}

function updateMentionSuggestions() {
  const context = getMentionContext();
  if (!context) {
    closeMentionList();
    return;
  }

  const queryLower = context.query.toLowerCase();
  const candidates = onlineUsers
    .filter((name) => name.toLowerCase() !== currentUsername.toLowerCase())
    .filter((name) => !queryLower || name.toLowerCase().startsWith(queryLower))
    .slice(0, 8);

  openMentionList(candidates, context.range);
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

  await refreshOnlineUsers();
  await heartbeatPresence();
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

async function heartbeatPresence() {
  await fetch("/api/presence", {
    method: "POST",
    credentials: "same-origin"
  });
}

async function refreshOnlineUsers() {
  const onlineRes = await fetch("/api/online", { credentials: "same-origin" });
  if (!onlineRes.ok) {
    location.href = "/login";
    return;
  }

  const payload = await onlineRes.json();
  onlineUsers = Array.isArray(payload.users) ? payload.users : [];
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
  closeMentionList();
  await refreshMessages();
});

inputEl.addEventListener("input", () => {
  updateMentionSuggestions();
});

inputEl.addEventListener("click", () => {
  updateMentionSuggestions();
});

inputEl.addEventListener("keydown", (event) => {
  if (!mentionCandidates.length) {
    return;
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();
    mentionCursor = (mentionCursor + 1) % mentionCandidates.length;
    updateMentionListSelection();
    return;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    mentionCursor = (mentionCursor - 1 + mentionCandidates.length) % mentionCandidates.length;
    updateMentionListSelection();
    return;
  }

  if (event.key === "Enter" && mentionListEl.classList.contains("is-open")) {
    event.preventDefault();
    if (mentionCursor >= 0 && mentionCursor < mentionCandidates.length) {
      applyMention(mentionCandidates[mentionCursor]);
    }
    return;
  }

  if (event.key === "Escape") {
    closeMentionList();
  }
});

mentionListEl.addEventListener("mousedown", (event) => {
  const target = event.target.closest(".mention-item");
  if (!target) {
    return;
  }

  event.preventDefault();
  const index = Number(target.getAttribute("data-index"));
  if (!Number.isNaN(index) && mentionCandidates[index]) {
    applyMention(mentionCandidates[index]);
  }
});

document.addEventListener("click", (event) => {
  if (event.target === inputEl || mentionListEl.contains(event.target)) {
    return;
  }
  closeMentionList();
});

loadInitial().catch(() => {
  location.href = "/login";
});

setInterval(() => {
  refreshMessages().catch(() => {
    location.href = "/login";
  });
}, 2000);

setInterval(() => {
  heartbeatPresence().catch(() => {});
  refreshOnlineUsers().catch(() => {
    location.href = "/login";
  });
}, 10000);
