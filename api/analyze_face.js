// api/analyze_face.js
// DEBUG handler – sadece bağlantıyı test ediyor

module.exports = async (req, res) => {
  return res.status(200).json({
    ok: true,
    method: req.method,
    note: "Facelex backend is connected."
  });
};
