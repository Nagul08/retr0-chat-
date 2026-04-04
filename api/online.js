const { getUserFromRequest } = require("./_lib/auth");
const { sendJson } = require("./_lib/response");
const { touchPresence, getOnlineUsers } = require("./_lib/store");

const ONLINE_WINDOW_MS = 45000;

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).send("Method Not Allowed");
  }

  const username = getUserFromRequest(req);
  if (!username) {
    return sendJson(res, 401, { error: "Unauthorized" });
  }

  await touchPresence(username);
  const users = await getOnlineUsers(ONLINE_WINDOW_MS);
  return sendJson(res, 200, { users });
};
