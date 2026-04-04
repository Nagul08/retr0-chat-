function sendJson(res, status, payload) {
  res.status(status).json(payload);
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseCookies(req) {
  const raw = req.headers.cookie || "";
  const map = {};

  raw.split(";").forEach((piece) => {
    const trimmed = piece.trim();
    if (!trimmed) {
      return;
    }
    const splitIndex = trimmed.indexOf("=");
    if (splitIndex <= 0) {
      return;
    }
    const key = trimmed.slice(0, splitIndex).trim();
    const value = trimmed.slice(splitIndex + 1).trim();
    map[key] = safeDecode(value);
  });

  return map;
}

module.exports = {
  sendJson,
  parseCookies
};
