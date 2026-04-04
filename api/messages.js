const { getUserFromRequest, normalizeText } = require("./_lib/auth");
const { sendJson } = require("./_lib/response");
const { HISTORY_LIMIT, MAX_TEXT_LENGTH } = require("./_lib/config");
const { getMessages, appendMessage } = require("./_lib/store");
const { parseBody } = require("./_lib/body");

module.exports = async function handler(req, res) {
  const username = getUserFromRequest(req);
  if (!username) {
    return sendJson(res, 401, { error: "Unauthorized" });
  }

  if (req.method === "GET") {
    const all = await getMessages();
    return sendJson(res, 200, all.slice(-HISTORY_LIMIT));
  }

  if (req.method === "POST") {
    const body = await parseBody(req);
    const text = normalizeText(body.text);
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
  }

  return res.status(405).send("Method Not Allowed");
};
