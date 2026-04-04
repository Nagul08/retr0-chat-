const { getUserFromRequest } = require("./_lib/auth");
const { sendJson } = require("./_lib/response");
const { HISTORY_LIMIT } = require("./_lib/config");
const { touchPresence, getOnlineUsers, getMessages, getMessagesState } = require("./_lib/store");

const ONLINE_WINDOW_MS = 45000;

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).send("Method Not Allowed");
  }

  const username = getUserFromRequest(req);
  if (!username) {
    return sendJson(res, 401, { error: "Unauthorized" });
  }

  const since = String((req.query && req.query.since) || "");

  await touchPresence(username);
  const [users, stateToken] = await Promise.all([
    getOnlineUsers(ONLINE_WINDOW_MS),
    getMessagesState()
  ]);

  if (since && since === stateToken) {
    return sendJson(res, 200, {
      username,
      users,
      stateToken,
      messagesChanged: false
    });
  }

  const allMessages = await getMessages();
  return sendJson(res, 200, {
    username,
    users,
    stateToken,
    messagesChanged: true,
    messages: allMessages.slice(-HISTORY_LIMIT)
  });
};
