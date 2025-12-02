/* Blossom & Blade — memory-config.js (vector-enabled)
   - Messages + vector embeddings
   - Facts stored normally
   Env (public): NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, OPENAI_API_KEY
*/

(function (root, factory) {
  const mod = factory();
  if (typeof module === "object" && module.exports) module.exports = mod;
  else root.BBMemory = mod;
})(typeof self !== "undefined" ? self : this, function () {

  const ONE_DAY_MS = 24*60*60*1000;
  const PLAN_KEY = "bb:mm:plan";

  function getPlan(){
    try{ return localStorage.getItem(PLAN_KEY) || "trial"; }catch(_){ return "trial"; }
  }
  function setPlan(p){
    const v = (p==="day"||p==="monthly") ? p : "trial";
    try{ localStorage.setItem(PLAN_KEY, v); }catch(_){}
    return v;
  }
  function retentionDays(plan = getPlan()){
    if (plan === "monthly") return 31;
    if (plan === "day") return 1;
    return 0;
  }

  function uid(){
    try{
      let id = localStorage.getItem("bb:mm:uid");
      if (!id){
        id = "u_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
        localStorage.setItem("bb:mm:uid", id);
      }
      return id;
    }catch(_){
      return "u_" + Math.random().toString(36).slice(2);
    }
  }

  // --- Supabase client -----------------------------------------------------
  let _sb = null;
  async function ensureSupabase(){
    if (_sb) return _sb;
    const url = (root.NEXT_PUBLIC_SUPABASE_URL || "").trim();
    const key = (root.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
    if (!url || !key) throw new Error("Supabase env missing.");
    if (!root.supabase){
      await loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.46.1/dist/umd/supabase.min.js");
    }
    _sb = root.supabase.createClient(url, key, { auth: { persistSession: false } });
    return _sb;
  }

  function loadScript(src){
    return new Promise((res, rej)=>{
      const s = document.createElement("script");
      s.src = src; s.async = true;
      s.onload = ()=>res();
      s.onerror = ()=>rej(new Error("script load failed: "+src));
      document.head.appendChild(s);
    });
  }

  // --- OpenAI embedding ----------------------------------------------------
  async function getEmbedding(text){
    const key = root.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY missing");
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`
      },
      body: JSON.stringify({
        input: text,
        model: "text-embedding-3-large"
      })
    });
    const data = await res.json();
    if (!data.data || !data.data[0] || !data.data[0].embedding) throw new Error("Failed to get embedding");
    return data.data[0].embedding;
  }

  // --- Supabase message/fact operations -----------------------------------
  async function sbSaveMessage(man, from_role, text, ts){
    const sb = await ensureSupabase();
    const when = ts ? new Date(ts).toISOString() : new Date().toISOString();
    // insert message
    const { error: msgErr } = await sb.from("messages").insert({
      man, uid: uid(), from_role, text, ts: when
    });
    if (msgErr) throw msgErr;

    // insert vector
    const embedding = await getEmbedding(text);
    const { error: vecErr } = await sb.from("vectors").insert({
      man, uid: uid(), text, embedding, ts: when
    });
    if (vecErr) throw vecErr;
  }

  async function sbLoadHistory(man){
    const sb = await ensureSupabase();
    const days = retentionDays();
    const since = new Date(Date.now() - (days||1)*ONE_DAY_MS).toISOString();
    const { data, error } = await sb
      .from("messages")
      .select("from_role,text,ts")
      .eq("uid", uid())
      .eq("man", man)
      .gte("ts", since)
      .order("ts", { ascending: true })
      .limit(2000);
    if (error) throw error;
    return (data || []).map(r=>({from_role:r.from_role, text:r.text, ts:r.ts}));
  }

  async function sbSaveFact(man, key, value, ts){
    const sb = await ensureSupabase();
    const when = ts ? new Date(ts).toISOString() : new Date().toISOString();
    const { error } = await sb.from("facts").upsert({
      man, uid: uid(), key, value, ts: when
    }, { onConflict: "uid,man,key" });
    if (error) throw error;
  }

  async function sbGetFact(man, key){
    const sb = await ensureSupabase();
    const { data, error } = await sb.from("facts")
      .select("value")
      .eq("uid", uid()).eq("man", man).eq("key", key)
      .order("ts", { ascending:false }).limit(1).maybeSingle();
    if (error && error.code !== "PGRST116") throw error;
    return (data && data.value) ? String(data.value) : "";
  }

  async function sbClearOld(man){
    return;
  }

  // --- public adapter -------------------------------------------------------
  const state = { useSupabase: true };

  async function saveMessage(man, from_role, text, ts){
    try { await sbSaveMessage(man, from_role, text, ts); } 
    catch(e){ console.error("Error saving message:", e); }
  }

  async function loadHistory(man){
    try { return await sbLoadHistory(man); } 
    catch(e){ console.error("Error loading history:", e); return []; }
  }

  async function saveFact(man, key, value, ts){
    try { await sbSaveFact(man, key, value, ts); } 
    catch(e){ console.error("Error saving fact:", e); }
  }

  async function getFact(man, key){
    try { return await sbGetFact(man, key); } 
    catch(e){ console.error("Error getting fact:", e); return ""; }
  }

  async function clearOld(man){ return; }

  return {
    useSupabase: true,
    getPlan, setPlan, retentionDays,
    saveMessage, loadHistory, saveFact, getFact, clearOld,
    uid
  };
});
