// api/analyze_face.js
// Facelex backend: face image -> OpenAI -> structured wellness insights

const OpenAI = require("openai");
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

module.exports = async (req, res) => {
  try {
    // Body bazen string, bazen JSON gelebilir
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

    // --- OpenAI çağrısı ---
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: [
            {
              type: "text",
              text:
                "You are Facelex, an AI that gives *non-medical* wellness insights " +
                "from a single face photo. You are NOT a doctor and you do NOT " +
                "diagnose diseases. You only comment on visible patterns and " +
                "lifestyle-related suggestions.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Look at this face and return at most 5 wellness insights.\n\n" +
                "You MUST respond with a JSON array ONLY, no extra text.\n\n" +
                "Each item in the array MUST have exactly these fields:\n" +
                "[\n" +
                "  {\n" +
                "    \"level\": \"SLIGHT\" | \"MILD\" | \"HIGH RISK\",\n" +
                "    \"title\": string,\n" +
                "    \"subtitle\": string,\n" +
                "    \"action\": string\n" +
                "  }\n" +
                "]\n\n" +
                "INTERPRETATION RULES:\n" +
                "- Work only from what is visibly plausible in the image (skin, eyes, lips, posture, etc.).\n" +
                "- Do NOT mention specific diseases or diagnoses.\n" +
                "- Use \"HIGH RISK\" only if the visible signs look clearly concerning and justify a stronger warning.\n" +
                "- \"MILD\" is for moderate issues or things that should be improved.\n" +
                "- \"SLIGHT\" is for small optimizations or soft suggestions.\n" +
                "- Each subtitle should briefly explain what you are seeing.\n" +
                "- Each action should be a concrete, realistic suggestion (sun exposure, sleep hygiene, hydration, skincare, stress management, etc.).\n" +
                "- If the face looks generally healthy and you see no important issues, answer with an empty array: [].\n" +
                "- For serious-looking issues, recommend speaking with a health professional, but still stay non-diagnostic.\n",
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
    });

    // --- OpenAI cevabını al ---
    const choice = completion.choices?.[0];
    let content = choice?.message?.content;

    // content bazen string, bazen {type:"text"} array'i olabilir
    if (Array.isArray(content)) {
      const textPart = content.find((c) => c.type === "text");
      content = textPart ? textPart.text : "";
    }
    if (typeof content !== "string") {
      content = "";
    }

    // --- JSON parse ---
    let insightsRaw;
    try {
      insightsRaw = JSON.parse(content);
    } catch (e) {
      console.error("[Facelex] JSON parse failed. Raw content:", content);
      // Parse edilemezse: uygulama "You are good!" desin diye boş dön.
      return res.status(200).json({ insights: [] });
    }

    // --- Normalize: Swift tarafının beklediği shape'e çevir ---
    const normalizedArray = Array.isArray(insightsRaw) ? insightsRaw : [];

    const insights = normalizedArray
      .map((item) => {
        if (!item || typeof item !== "object") return null;

        let level = String(item.level || "").toUpperCase().trim();

        if (level === "HIGH" || level === "HIGH_RISK") level = "HIGH RISK";
        if (!["SLIGHT", "MILD", "HIGH RISK"].includes(level)) {
          level = "SLIGHT";
        }

        return {
          level,
          title: String(item.title || "Insight").slice(0, 80),
          subtitle: String(item.subtitle || "").slice(0, 160),
          action: String(item.action || "Consider small lifestyle improvements.").slice(0, 200),
        };
      })
      .filter(Boolean);

    return res.status(200).json({ insights });
   } catch (err) {
    console.error("[Facelex] API error:", err);
    // Herhangi bir hata olursa yine boş dön → iOS 'You are good!' mesajı gösterir.
    return res.status(500).json({ insights: [] });
  }
};
