/* scripts/chat.js — persona voices + BBMemory layer
   - Hooks into BBMemory (localStorage now, Supabase later)
   - Greets with BBPhrases.firstLineFor(man)
   - Saves messages + learned facts via BBMemory
   - Loads message history at boot
*/

(function () {
  const ALLOWED = ["blade","alexander","dylan","viper","grayson","silas"];
  const qs = new URLSearchParams(location.search);
  const man = (qs.get("man") || "").toLowerCase();
  const chosen = ALLOWED.includes(man) ? man : "blade";

  const body = document.body;
  const feed = document.getElementById("feed");
  const messages = document.getElementById("messages");
  const portrait = document.getElementById("portrait");
  const form = document.getElementById("composerForm");
  const input = document.getElementById("input");
  const sendBtn = document.getElementById("sendBtn");

  const P = window.BBPhrases || {};
  const M = window.BBMemory || {};
  const PERSONAS = P.PERSONAS || {};
  const pick = P.pick || ((_, list) => (list && list[0]) || "");
  const persona = PERSONAS[chosen] || { greet: [], lines: [], nick: [] };

  // --- visuals --------------------------------------------------------------
  function preload(src){
    return new Promise(resolve=>{
      const img = new Image();
      img.onload = ()=>resolve({ok:true,src});
      img.onerror = ()=>resolve({ok:false,src});
      img.src = src;
    });
  }
  async function setupVisuals(){
    const por1 = `/images/characters/${chosen}/${chosen}-chat.webp`;
    const por2 = `/images/characters/${chosen}/${chosen}-card-on.webp`;
    const porRes = (await preload(por1)).ok ? por1 :
                   (await preload(por2)).ok ? por2 : "";
    if(porRes){ portrait.src = porRes; portrait.alt = cap(chosen) + " portrait"; }
    else { portrait?.remove(); }

    const bgTry = `/images/characters/${chosen}/${chosen}-bg.jpg`;
    const bgDefault = `/images/bg/default.webp`;
    const bgRes = (await preload(bgTry)).ok ? bgTry :
                  (await preload(bgDefault)).ok ? bgDefault : "";
    if(bgRes){ body.style.backgroundImage = `url('${bgRes}')`; }
  }

  // --- boyfriend memory helpers --------------------------------------------
  function saveMessage(from, text){
    try{ M.saveMessage?.(chosen, from, text); }catch(_){}
  }
  function saveFact(k, v){
    try{ M.saveFact?.(chosen, k, v); }catch(_){}
  }
  async function loadHistory(){
    try{
      const hist = await M.loadHistory?.(chosen);
      if(Array.isArray(hist)){
        hist.forEach(m => appendMessage(m.from_role, m.text, m.ts, false));
      }
    }catch(_){}
  }

  // --- fact extraction ------------------------------------------------------
  function ingestFacts(text){
    const t = " " + text.toLowerCase().trim() + " ";
    let m;
    m = t.match(/\b(my name is|i'm|im|call me)\s+([a-z][a-z'-]{1,20})\b/);
    if(m){ saveFact("name", title(m[2])); }
    m = t.match(/\b(i (live in|am from|from))\s+([a-z][a-z\s'-]{2,30})\b/);
    if(m){ saveFact("hometown", title(m[3].trim())); }
    m = t.match(/\bfavorite (color|drink|song|book|movie|necklace)\s*(is|=)?\s*([a-z0-9\s'-]{2,40})/);
    if(m){ saveFact(`fav_${m[1]}`, title(m[3].trim())); }
    m = t.match(/\bi (like|love)\s+([a-z0-9\s'-]{2,40})/);
    if(m){ saveFact("likes", title(m[2].trim())); }
    m = t.match(/\b(call me|you can call me)\s+([a-z][a-z\s'-]{2,20})\b/);
    if(m){ saveFact("pet", title(m[2].trim())); }
  }

  // --- personalization ------------------------------------------------------
  async function getFacts(){
    const f = {};
    const keys = ["name","pet","hometown","fav_color","fav_drink","fav_song","fav_book","fav_movie","fav_necklace","likes"];
    for(const k of keys){
      try{ f[k] = (await M.getFact?.(chosen, k)) || ""; }catch{ f[k] = ""; }
    }
    return f;
  }
  function nickChoice(f){
    if(f.pet) return f.pet;
    const nicks = Array.isArray(persona.nick) ? persona.nick : [];
    return nicks.length ? pick("nick:"+chosen, nicks) : "";
  }
  function personalize(line, f){
    const replacements = {
      "{name}": f.name || "",
      "{pet}": nickChoice(f),
      "{hometown}": f.hometown || "",
      "{fav_color}": f.fav_color || "",
      "{fav_drink}": f.fav_drink || "",
      "{fav_song}": f.fav_song || "",
      "{fav_book}": f.fav_book || "",
      "{fav_movie}": f.fav_movie || "",
      "{fav_necklace}": f.fav_necklace || "",
      "{likes}": f.likes || ""
    };
    let out = line;
    for(const k in replacements){ out = out.replaceAll(k, replacements[k]); }
    if(!/{pet}/.test(line) && Math.random()<0.45 && replacements["{pet}"]){
      out = out.replace(/\.$/, "") + `, ${replacements["{pet}"]}.`;
    }
    return out;
  }

  // --- messaging ------------------------------------------------------------
  function appendMessage(from, text, ts, save=true){
    const bubble = document.createElement("div");
    bubble.className = `msg ${from === "you" ? "you" : "them"}`;
    bubble.textContent = text;
    const meta = document.createElement("span");
    meta.className = "meta";
    meta.textContent = timeNow();
    bubble.appendChild(document.createTextNode(" "));
    bubble.appendChild(meta);
    messages.appendChild(bubble);
    if(save) saveMessage(from, text);
    requestAnimationFrame(scrollToBottom);
  }

  async function greetIfEmpty(){
    const has = messages && messages.querySelector(".msg");
    if(!has){
      const f = await getFacts();
      const line = P.firstLineFor ? P.firstLineFor(chosen) : "there you are.";
      appendMessage("them", personalize(line, f));
    }
  }

  async function botReply(userText){
    ingestFacts(userText);
    const f = await getFacts();
    const pool = [].concat(persona.lines || []);
    let line = pool.length ? pick("lines:"+chosen, pool) : (P.GLOBAL?.openers ? pick("open", P.GLOBAL.openers) : "i'm here.");
    const t = userText.trim();
    if(/\?$/.test(t) && Math.random()<0.5){
      line = line.replace(/\.$/,"") + " give me a beat more detail.";
    }
    return personalize(line, f);
  }

  async function sendFromComposer(){
    const val = (input.value || "").trim();
    if(!val) return;
    appendMessage("you", val);
    input.value = "";
    input.focus({preventScroll:true});
    const reply = await botReply(val);
    setTimeout(()=> appendMessage("them", reply), 300);
  }

  function scrollToBottom(){ feed.scrollTop = feed.scrollHeight; }
  function timeNow(){ const d=new Date(); return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`; }
  function title(s){ return s.split(/\s+/).map(cap).join(" "); }
  function cap(s){ return s? s[0].toUpperCase()+s.slice(1):""; }

  // --- events ---------------------------------------------------------------
  form.addEventListener("submit", e=>{ e.preventDefault(); sendFromComposer(); });
  sendBtn.addEventListener("click", e=>{ e.preventDefault(); sendFromComposer(); });
  input.addEventListener("focus", ()=> setTimeout(scrollToBottom, 50));

  // --- boot -----------------------------------------------------------------
  setupVisuals().then(async ()=>{
    await loadHistory();
    await greetIfEmpty();
    scrollToBottom();
  });
})();
