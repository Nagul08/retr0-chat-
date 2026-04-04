const { clearAuthCookie } = require("./_lib/auth");

module.exports = function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  clearAuthCookie(res);
  return res.redirect(302, "/login");
};
