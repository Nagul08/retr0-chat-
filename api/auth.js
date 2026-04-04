const {
  normalizeText,
  isValidName,
  isValidPassword,
  hashPassword,
  createAuthToken,
  setAuthCookie
} = require("./_lib/auth");
const { getUsers, saveUsers } = require("./_lib/store");
const { parseBody } = require("./_lib/body");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const body = await parseBody(req);
  const username = normalizeText(body.username);
  const password = normalizeText(body.password);

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
};
