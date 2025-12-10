// api/analyze_face.js

const OpenAI = require("openai");
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

module.exports = async (req, res) => {
  try {
    // Body bazen string, bazen direkt obje gelebilir
    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }

    const front_image = body?.front_image;

    if (!front_image) {
      return res.status(400).json({ error: "Missing front_image (base64)." });
    }

    // OpenAI'ye prompt: sadece JSON array döndür
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "You are Facelex, an AI that analyzes facial health signs.\n" +
                "You will receive a face photo and must return a JSON array of insights.\n\n" +
                "Strictly respond ONLY with a JSON array, no extra text.\n" +
                "Each item must have exactly these fields:\n" +
                "[\n" +
                "  {\n" +
                "    \"level\": \"SLIGHT\" | \"MILD\" | \"HIGH RISK\",\n" +
                "    \"title\": string,\n" +
                "    \"subtitle\": string,\n" +
                "    \"action\": string\n" +
                "  }\n" +
                "]\n\n" +
                "Use:\n" +
                "- \"HIGH RISK\" only for things that are urgent / clearly problematic.\n" +
                "- \"MILD\" for moderate but noticeable issues.\n" +
                "- \"SLIGHT\" for mild suggestions / optimization.\n\n" +
                "If the face looks generally healthy and nothing important is wrong, " +
                "you can return an empty array: []",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${front_image}`,
              },
            },
          ],
        },
      ],
      temperature: 0.4,
    });

    // OpenAI cevabından text'i çek
    const choice = completion.choices?.[0];
    let content = choice?.message?.content;

    // content bazen string, bazen array olabilir
    if (Array.isArray(content)) {
      // { type: "text", text: "..." } formatı ise
      const textPart = content.find((c) => c.type === "text");
      content = textPart ? textPart.text : "";
    }

    if (typeof content !== "string") {
      content = "";
    }

    let insightsRaw;
    try {
      insightsRaw = JSON.parse(content);
    } catch (e) {
      console.error("JSON parse failed, content:", content);
      // JSON parse edilemezse, insights boş dön → iOS'ta 'You are good!' yazar
      return res.status(200).json({ insights: [] });
    }

    // Güvenlik için normalize et
    const normalized = Array.isArray(insightsRaw) ? insightsRaw : [];
    const insights = normalized
      .map((item) => {
        if (!item || typeof item !== "object") return null;

        // Level normalization
        let level = String(item.level || "").toUpperCase().trim();
        if (level === "HIGH" || level === "HIGH_RISK") level = "HIGH RISK";
        if (level !== "SLIGHT" && level !== "MILD" && level !== "HIGH RISK") {
          level = "SLIGHT";
        }

        return {
          level,
          title: String(item.title || "Insight").slice(0, 80),
          subtitle: String(item.subtitle || "").slice(0, 160),
          action: String(item.action || "No specific action.").slice(0, 160),
        };
      })
      .filter(Boolean);

    return res.status(200).json({ insights });
  } catch (err) {
    console.error("Facelex API error:", err);
    // Hata durumunda boş insights dön → iOS 'You are good!' gösterir
    return res.status(500).json({ insights: [] });
  }
};
