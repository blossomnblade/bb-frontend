/* Blossom & Blade — memory-config.js (full replacement)
   Lightweight "boyfriend memory" with a single switch:
   - Local mode (default): localStorage per-man (name, facts, messages)
   - Supabase mode: same API; writes to tables with RLS
     Tables (you'll create next week):
       messages(man text, uid text, from_role text, text text, ts timestamptz default now())
       facts(man text, uid text, key text, value text, ts timestamptz default now())
   Env (public): NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY

   Global API: window.BBMemory
   Methods:
     .useSupabase (bool)
     .getPlan() / .setPlan("trial" | "day" | "monthly")
     .saveMessage(man, from_role, text, ts?)
     .loadHistory(man) -> Promise<[{from_role,text,ts}]>
     .saveFact(man, key, value, ts?)
     .getFact(man, key) -> Promise<string | "">
     .clearOld(man) -> Promise<void>  // apply retention window
*/
(function (root, factory) {
  const mod = factory();
  if (typeof module === "object" && module.exports) module.exports = mod;
  else root.BBMemory = mod;
})(typeof self !== "undefined" ? self : this, function () {
  const STORAGE_PREFIX = "bb:mm:";
  const MSGS_KEY = (man)=> `${STORAGE_PREFIX}${man}:msgs`;
  const FACT_KEY = (man,k)=> `${STORAGE_PREFIX}${man}:fact:${k}`;
  const UID_KEY = `${STORAGE_PREFIX}uid`;
  const PLAN_KEY = `${STORAGE_PREFIX}plan`; // "trial" | "day" | "monthly"
  const ONE_DAY_MS = 24*60*60*1000;

  // --- plan + retention -----------------------------------------------------
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
    return 0; // "trial": keep only session-ish; we still store but clear aggressively
  }

  // --- uid (anonymous per-browser) -----------------------------------------
  function uid(){
    try{
      let id = localStorage.getItem(UID_KEY);
      if (!id){
        id = "u_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
        localStorage.setItem(UID_KEY, id);
      }
      return id;
    }catch(_){
      // cookie-less fallback
      return "u_" + Math.random().toString(36).slice(2);
    }
  }

  // --- localStorage mode ----------------------------------------------------
  function lsReadMsgs(man){
    try{
      return JSON.parse(localStorage.getItem(MSGS_KEY(man)) || "[]");
    }catch(_){ return []; }
  }
  function lsWriteMsgs(man, list){
    try{ localStorage.setItem(MSGS_KEY(man), JSON.stringify(list)); }catch(_){}
  }
  function lsSaveFact(man, key, value){
    try{ localStorage.setItem(FACT_KEY(man,key), String(value)); }catch(_){}
  }
  function lsGetFact(man, key){
    try{ return localStorage.getItem(FACT_KEY(man,key)) || ""; }catch(_){ return ""; }
  }
  function lsClearOld(man){
    const days = retentionDays();
    const msgs = lsReadMsgs(man);
    if (days === 0){
      // keep only today + last 20 messages
      const cutoff = Date.now() - ONE_DAY_MS;
      const pruned = msgs.filter(m => (new Date(m.ts)).getTime() >= cutoff).slice(-20);
      lsWriteMsgs(man, pruned);
      // facts: drop if older than a day (we don’t timestamp facts locally; leave as-is)
      return;
    }
    const cutoff = Date.now() - days*ONE_DAY_MS;
    const pruned = msgs.filter(m => (new Date(m.ts)).getTime() >= cutoff);
    lsWriteMsgs(man, pruned);
  }

  // --- Supabase mode (lazy-load client) ------------------------------------
  let _sb = null;
  async function ensureSupabase(){
    if (_sb) return _sb;
    const url = (root.NEXT_PUBLIC_SUPABASE_URL || root.SUPABASE_URL || "").trim();
    const key = (root.NEXT_PUBLIC_SUPABASE_ANON_KEY || root.SUPABASE_ANON_KEY || "").trim();
    if (!url || !key) throw new Error("Supabase env missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
    if (!root.supabase){
      // lazy-load UMD bundle
      await loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.46.1/dist/umd/supabase.min.js");
    }
    _sb = root.supabase.createClient(url, key, { auth: { persistSession: false } });
    return _sb;
  }
  function loadScript(src){
    return new Promise((res, rej)=>{
      const s = document.createElement("script");
      s.src = src; s.async = true; s.onload = ()=>res(); s.onerror = ()=>rej(new Error("script load failed: "+src));
      document.head.appendChild(s);
    });
  }

  async function sbSaveMessage(man, from_role, text, ts){
    const sb = await ensureSupabase();
    const when = ts ? new Date(ts).toISOString() : new Date().toISOString();
    const { error } = await sb.from("messages").insert({
      man, uid: uid(), from_role, text, ts: when
    });
    if (error) throw error;
  }
  async function sbLoadHistory(man){
    const sb = await ensureSupabase();
    const days = retentionDays();
    const since = new Date(Date.now() - (days||1)*ONE_DAY_MS).toISOString(); // at least 1 day window
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
    // upsert on (uid, man, key)
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
    if (error && error.code !== "PGRST116") throw error; // ignore "no rows"
    return (data && data.value) ? String(data.value) : "";
  }
  async function sbClearOld(man){
    // nothing to do client-side; RLS retention can be enforced with a cron or policies.
    return;
  }

  // --- public adapter -------------------------------------------------------
  const state = {
    useSupabase: false, // flip to true when ready
  };

  async function saveMessage(man, from_role, text, ts){
    if (state.useSupabase){
      try { await sbSaveMessage(man, from_role, text, ts); } catch(e){ /* fail over to local */ lsSaveMessage(man, from_role, text, ts); }
    } else {
      lsSaveMessage(man, from_role, text, ts);
    }
  }
  function lsSaveMessage(man, from_role, text, ts){
    const list = lsReadMsgs(man);
    list.push({ from_role, text, ts: ts || new Date().toISOString() });
    lsWriteMsgs(man, list);
    lsClearOld(man);
  }

  async function loadHistory(man){
    if (state.useSupabase){
      try { return await sbLoadHistory(man); } catch(e){ return lsReadMsgs(man); }
    } else {
      return lsReadMsgs(man);
    }
  }

  async function saveFact(man, key, value, ts){
    if (state.useSupabase){
      try { await sbSaveFact(man, key, value, ts); } catch(e){ lsSaveFact(man, key, value); }
    } else {
      lsSaveFact(man, key, value);
    }
  }

  async function getFact(man, key){
    if (state.useSupabase){
      try { return await sbGetFact(man, key); } catch(e){ return lsGetFact(man, key); }
    } else {
      return lsGetFact(man, key);
    }
  }

  async function clearOld(man){
    if (state.useSupabase){
      try { await sbClearOld(man); } finally { /* optional local sweep */ }
    } else {
      lsClearOld(man);
    }
  }

  // export
  return {
    get useSupabase(){ return state.useSupabase; },
    set useSupabase(v){ state.useSupabase = !!v; },
    getPlan, setPlan, retentionDays,
    saveMessage, loadHistory, saveFact, getFact, clearOld,
    uid
  };
});
