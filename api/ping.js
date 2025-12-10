// api/ping.js
module.exports = async (req, res) => {
  return res.status(200).json({
    ok: true,
    note: "ping from Facelex backend",
    method: req.method
  });
};
