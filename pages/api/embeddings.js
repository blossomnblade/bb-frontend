import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // server-side key
const sb = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { man, uid, from_role, text } = req.body;
    if (!man || !uid || !text || !from_role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // 1. Generate embedding via OpenAI server-side
    const embeddingRes = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: text,
        model: 'text-embedding-3-large',
      }),
    });

    const embeddingData = await embeddingRes.json();
    const embedding = embeddingData?.data?.[0]?.embedding;
    if (!embedding) throw new Error('Failed to get embedding');

    const now = new Date().toISOString();

    // 2. Insert message
    const { error: msgErr } = await sb.from('messages').insert({
      man, uid, from_role, text, ts: now,
    });
    if (msgErr) throw msgErr;

    // 3. Insert vector
    const { error: vecErr } = await sb.from('vectors').insert({
      man, uid, text, embedding, ts: now,
    });
    if (vecErr) throw vecErr;

    return res.status(200).json({ success: true });
  } catch (e) {
    console.error('Embedding API error:', e);
    return res.status(500).json({ error: e.message });
  }
}
