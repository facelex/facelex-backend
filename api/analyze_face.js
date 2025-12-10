import OpenAI from "openai";

export default async function handler(req, res) {
  try {
    const { front_image } = req.body;

    if (!front_image) {
      return res.status(400).json({ error: "Missing image." });
    }

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const completion = await client.responses.create({
      model: "gpt-4.1",
      reasoning: { effort: "medium" },
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: "Analyze this face photo and return insights exactly in this JSON format:\n\n[{ \"level\": \"HIGH RISK\", \"title\": \"Sunscreen\", \"subtitle\": \"High UV Exposure\", \"action\": \"Apply sunscreen\" }]" },
            { type: "input_image", image_url: `data:image/jpeg;base64,${front_image}` }
          ]
        }
      ]
    });

    const rawText = completion.output_text;

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      return res.status(200).json({ insights: [] });
    }

    return res.status(200).json({ insights: parsed });

  } catch (err) {
    console.error("Facelex API error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
