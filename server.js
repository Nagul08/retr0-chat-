const express = require("express");
const path = require("path");

const {
  normalizeText,
  isValidName,
  isValidPassword,
  hashPassword,
  createAuthToken,
  getUserFromRequest,
  setAuthCookie,
  clearAuthCookie
} = require("./api/_lib/auth");
const { sendJson } = require("./api/_lib/response");
const { HISTORY_LIMIT, MAX_TEXT_LENGTH } = require("./api/_lib/config");
const { getUsers, saveUsers, getMessages, appendMessage } = require("./api/_lib/store");

const app = express();

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function requireUser(req, res, next) {
  const username = getUserFromRequest(req);
  if (!username) {
    return res.redirect("/login");
  }

  req.username = username;
  return next();
}

app.get("/", (_req, res) => {
  res.redirect(302, "/login");
});

app.get("/login", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.get("/chat", requireUser, (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "chat.html"));
});

app.post("/api/auth", async (req, res) => {
  const username = normalizeText(req.body.username);
  const password = normalizeText(req.body.password);

  if (!isValidName(username) || !isValidPassword(password)) {
    return res.status(400).send("Invalid credentials length.");
  }

  const users = await getUsers();
  const passwordHash = hashPassword(password);

  if (!users[username]) {
    users[username] = {
      passwordHash,
      createdAt: new Date().toISOString()
    };
    await saveUsers(users);
  } else if (users[username].passwordHash !== passwordHash) {
    return res.status(401).send("Wrong password.");
  }

  const token = createAuthToken(username);
  setAuthCookie(res, token);
  return res.redirect(302, "/chat");
});

app.post("/api/logout", (_req, res) => {
  clearAuthCookie(res);
  res.redirect(302, "/login");
});

app.get("/api/me", (req, res) => {
  const username = getUserFromRequest(req);
  if (!username) {
    return sendJson(res, 401, { error: "Unauthorized" });
  }

  return sendJson(res, 200, { username });
});

app.get("/api/messages", async (req, res) => {
  const username = getUserFromRequest(req);
  if (!username) {
    return sendJson(res, 401, { error: "Unauthorized" });
  }

  const all = await getMessages();
  return sendJson(res, 200, all.slice(-HISTORY_LIMIT));
});

app.post("/api/messages", async (req, res) => {
  const username = getUserFromRequest(req);
  if (!username) {
    return sendJson(res, 401, { error: "Unauthorized" });
  }

  const text = normalizeText(req.body.text);
  if (!text || text.length > MAX_TEXT_LENGTH) {
    return sendJson(res, 400, { error: "Invalid message." });
  }

  const message = {
    user: username,
    text,
    time: new Date().toISOString()
  };

  await appendMessage(message);
  return sendJson(res, 200, { ok: true, message });
});

module.exports = app;
