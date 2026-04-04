const { getUserFromRequest } = require("./_lib/auth");
const { sendJson } = require("./_lib/response");

module.exports = function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).send("Method Not Allowed");
  }

  const username = getUserFromRequest(req);
  if (!username) {
    return sendJson(res, 401, { error: "Unauthorized" });
  }

  return sendJson(res, 200, { username });
};
