// pages/api/embeddings.js
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { text, man, uid } = req.body;
    if (!text || !man || !uid) return res.status(400).json({ error: "Missing text, man, or uid" });

    const openaiRes = await fetch("https://api.openai.com/v1/embeddings", { ... });
    const openaiData = await openaiRes.json();
    const embedding = openaiData?.data?.[0]?.embedding;
    if (!embedding) return res.status(500).json({ error: "Failed to generate embedding" });

    const { error } = await sb.from("vectors").insert({ man, uid, text, embedding, ts: new Date().toISOString() });
    if (error) throw error;

    return res.status(200).json({ success: true, embedding });
  } catch (err) {
    console.error("Embedding API error:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
}
