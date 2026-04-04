const { getUserFromRequest } = require("./_lib/auth");
const { sendJson } = require("./_lib/response");
const { touchPresence } = require("./_lib/store");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const username = getUserFromRequest(req);
  if (!username) {
    return sendJson(res, 401, { error: "Unauthorized" });
  }

  await touchPresence(username);
  return sendJson(res, 200, { ok: true });
};
