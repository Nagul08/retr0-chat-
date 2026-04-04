const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const http = require("http");
const session = require("express-session");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const USERS_PATH = path.join(__dirname, "data", "users.json");
const MESSAGES_PATH = path.join(__dirname, "data", "messages.json");
const MAX_TEXT_LENGTH = 300;
const HISTORY_LIMIT = 100;
const MAX_STORED_MESSAGES = 2000;

function ensureJsonFile(filePath, fallbackValue) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(fallbackValue, null, 2), "utf8");
  }
}

function readJson(filePath, fallbackValue) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallbackValue;
  }
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function normalizeText(value) {
  return String(value || "").trim();
}

function isValidName(name) {
  return name.length >= 2 && name.length <= 24;
}

function isValidPassword(password) {
  return password.length >= 2 && password.length <= 64;
}

ensureJsonFile(USERS_PATH, {});
ensureJsonFile(MESSAGES_PATH, []);

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const sessionMiddleware = session({
  secret: "retr0-chat-dev-secret-change-this",
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 12
  }
});

app.use(sessionMiddleware);
app.use(express.static(path.join(__dirname, "public")));

function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.redirect("/login");
  }
  return next();
}

app.get("/", (req, res) => {
  if (req.session.user) {
    return res.redirect("/chat");
  }
  return res.redirect("/login");
});

app.get("/login", (req, res) => {
  if (req.session.user) {
    return res.redirect("/chat");
  }
  return res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.post("/auth", (req, res) => {
  const username = normalizeText(req.body.username);
  const password = normalizeText(req.body.password);

  if (!isValidName(username) || !isValidPassword(password)) {
    return res.status(400).send("Invalid credentials length.");
  }

  const users = readJson(USERS_PATH, {});
  const passwordHash = hashPassword(password);

  if (!users[username]) {
    users[username] = {
      passwordHash,
      createdAt: new Date().toISOString()
    };
    writeJson(USERS_PATH, users);
  } else if (users[username].passwordHash !== passwordHash) {
    return res.status(401).send("Wrong password.");
  }

  req.session.user = username;
  return req.session.save(() => res.redirect("/chat"));
});

app.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.redirect("/login");
  });
});

app.get("/chat", requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "chat.html"));
});

app.get("/api/me", requireLogin, (req, res) => {
  res.json({ username: req.session.user });
});

app.get("/api/messages", requireLogin, (req, res) => {
  const all = readJson(MESSAGES_PATH, []);
  const recent = all.slice(-HISTORY_LIMIT);
  res.json(recent);
});

io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

io.use((socket, next) => {
  const currentUser = socket.request.session && socket.request.session.user;
  if (!currentUser) {
    return next(new Error("Unauthorized"));
  }
  return next();
});

io.on("connection", (socket) => {
  const username = socket.request.session.user;
  socket.emit("whoami", { username });

  socket.on("send_message", (payload) => {
    const text = normalizeText(payload && payload.text);
    if (!text || text.length > MAX_TEXT_LENGTH) {
      return;
    }

    const message = {
      user: username,
      text,
      time: new Date().toISOString()
    };

    const all = readJson(MESSAGES_PATH, []);
    all.push(message);
    if (all.length > MAX_STORED_MESSAGES) {
      all.splice(0, all.length - MAX_STORED_MESSAGES);
    }
    writeJson(MESSAGES_PATH, all);

    io.emit("new_message", message);
  });
});

server.listen(PORT, () => {
  console.log(`retr0 chat running at http://localhost:${PORT}`);
});
