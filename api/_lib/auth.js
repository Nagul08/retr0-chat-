const crypto = require("crypto");
const { AUTH_COOKIE } = require("./config");
const { parseCookies } = require("./response");

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

function getAuthSecret() {
  return process.env.AUTH_SECRET || "retr0-dev-secret";
}

function signValue(value) {
  const secret = getAuthSecret();
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

function createAuthToken(username) {
  const payload = Buffer.from(JSON.stringify({ user: username, v: 1 }), "utf8").toString("base64url");
  const signature = signValue(payload);
  return `${payload}.${signature}`;
}

function verifyAuthToken(token) {
  if (!token || !token.includes(".")) {
    return null;
  }

  const [payload, signature] = token.split(".");
  const expected = signValue(payload);
  if (signature !== expected) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const username = normalizeText(decoded.user);
    if (!isValidName(username)) {
      return null;
    }
    return username;
  } catch {
    return null;
  }
}

function getUserFromRequest(req) {
  const cookies = parseCookies(req);
  const token = cookies[AUTH_COOKIE];
  return verifyAuthToken(token);
}

function setAuthCookie(res, token) {
  const maxAge = 60 * 60 * 12;
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${AUTH_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`
  );
}

function clearAuthCookie(res) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${AUTH_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`
  );
}

module.exports = {
  hashPassword,
  normalizeText,
  isValidName,
  isValidPassword,
  createAuthToken,
  getUserFromRequest,
  setAuthCookie,
  clearAuthCookie
};
