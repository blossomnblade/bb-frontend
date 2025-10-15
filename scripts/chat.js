/* scripts/chat.js — persona voices + lightweight boyfriend memory (front-end)
   - Uses window.BBPhrases (loaded by /scripts/phrases.js)
   - Greets with BBPhrases.firstLineFor(man)
   - Replies with persona-specific lines (no-repeat) + nicknames
   - Extracts simple facts and stores them per-man in localStorage
     (name, nickname preference, hometown, favorites)
   - Keeps hero/wallpaper behavior + mobile composer wiring
*/

(function () {
  // ----- config -------------------------------------------------------------
  const ALLOWED = ["blade","alexander","dylan","viper","grayson","silas"];
  const STORAGE_PREFIX = "bb:mm:"; // boyfriend memory key prefix

  // URL param
  const qs = new URLSearchParams(location.search);
  const man = (qs.get("man") || "").toLowerCase();
  const chosen = ALLOWED.includes(man) ? man : "blade";

  // DOM
  const body = document.body;
  const feed = document.getElementById("feed");
  const messages = document.getElementById("messages");
  const portrait = document.getElementById("portrait");
  const form = document.getElementById("composerForm");
  const input = document.getElementById("input");
  const sendBtn = document.getElementById("sendBtn");

  body.dataset.man = chosen;

  // Safety: phrases presence
  const P = (window.BBPhrases || {});
  const PERSONAS = P.PERSONAS || {};
  const pick = P.pick || ((_, list) => (list && list[0]) || "");
  const persona = PERSONAS[chosen] || { greet: [], lines: [], nick: [] };

  // ----- visuals (portrait + wallpaper) ------------------------------------
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

  // ----- boyfriend memory (front-end only) ---------------------------------
  function storeKey(k){ return `${STORAGE_PREFIX}${chosen}:${k}`; }
  function setMem(k, v){ try{ localStorage.setItem(storeKey(k), v); }catch(_){} }
  function getMem(k){ try{ return localStorage.getItem(storeKey(k)) || ""; }catch(_){ return ""; } }
  function hasMem(k){ return !!getMem(k); }

  // extract simple facts
  function ingestFacts(text){
    const t = " " + text.toLowerCase().trim() + " ";
    // name
    let m = t.match(/\b(my name is|i'm|im|call me)\s+([a-z][a-z'-]{1,20})\b/);
    if(m){ setMem("name", title(m[2])); }
    // hometown
    m = t.match(/\b(i (live in|am from|from))\s+([a-z][a-z\s'-]{2,30})\b/);
    if(m){ setMem("hometown", title(m[3].trim())); }
    // favorites: color / drink / song / book / necklace
    m = t.match(/\bfavorite (color|drink|song|book|movie|necklace)\s*(is|=)?\s*([a-z0-9\s'-]{2,40})/);
    if(m){ setMem(`fav_${m[1]}`, title(m[3].trim())); }
    // likes: "i like/love X"
    m = t.match(/\bi (like|love)\s+([a-z0-9\s'-]{2,40})/);
    if(m){ setMem("likes", title(m[2].trim())); }
    // desired nickname: "call me babe/bunny/etc."
    m = t.match(/\b(call me|you can call me)\s+([a-z][a-z\s'-]{2,20})\b/);
    if(m){ setMem("pet", title(m[2].trim())); }
  }

  function nickChoice(){
    const userPet = getMem("pet");
    if(userPet) return userPet;
    const nicks = Array.isArray(persona.nick) ? persona.nick : [];
    return nicks.length ? pick("nick:"+chosen, nicks) : "";
  }

  function personalize(line){
    // slots: {name}, {pet}, {hometown}, {fav_color}, etc.
    const replacements = {
      "{name}": getMem("name") || "",
      "{pet}": nickChoice(),
      "{hometown}": getMem("hometown") || "",
      "{fav_color}": getMem("fav_color") || "",
      "{fav_drink}": getMem("fav_drink") || "",
      "{fav_song}": getMem("fav_song") || "",
      "{fav_book}": getMem("fav_book") || "",
      "{fav_movie}": getMem("fav_movie") || "",
      "{fav_necklace}": getMem("fav_necklace") || "",
      "{likes}": getMem("likes") || ""
    };
    let out = line;
    Object.keys(replacements).forEach(k=>{
      out = out.replaceAll(k, replacements[k]);
    });
    // sprinkle nickname if not already present
    if(!/{pet}/.test(line) && Math.random()<0.45){
      const pet = replacements["{pet}"];
      if(pet){
        out = out.replace(/\.$/, "") + `, ${pet}.`;
      }
    }
    return out;
  }

  // ----- messaging ----------------------------------------------------------
  function appendMessage(from, text){
    const bubble = document.createElement("div");
    bubble.className = `msg ${from === "you" ? "you" : "them"}`;
    bubble.textContent = text;
    const meta = document.createElement("span");
    meta.className = "meta";
    meta.textContent = timeNow();
    bubble.appendChild(document.createTextNode(" "));
    bubble.appendChild(meta);
    messages.appendChild(bubble);
    requestAnimationFrame(scrollToBottom);
  }

  function greetIfEmpty(){
    if(messages && messages.children.length === 0){
      // dynamic first line from phrase bank, with personalization pass
      const line = (P.firstLineFor ? P.firstLineFor(chosen) : "there you are.") || "there you are.";
      appendMessage("them", personalize(line));
    }else{
      // If chat.html had a seeded system line, we leave it; next reply will be persona.
    }
  }

  function botReply(userText){
    // learn facts
    ingestFacts(userText);

    // reply from persona lines with fallback to global openers
    const pool = []
      .concat(persona.lines || [])
      .filter(Boolean);

    let line = pool.length ? pick("lines:"+chosen, pool) : (P.GLOBAL?.openers ? pick("open", P.GLOBAL.openers) : "i'm here.");

    // Occasionally mirror context gently
    const t = userText.trim();
    if(/\?$/.test(t) && Math.random() < 0.5){
      line = line.replace(/\.$/,"") + " give me a beat more detail.";
    }
    // Personalize with memory slots
    return personalize(line);
  }

  function sendFromComposer(){
    const val = (input.value || "").trim();
    if(!val) return;
    appendMessage("you", val);
    input.value = "";
    input.focus({preventScroll:true});
    setTimeout(()=> appendMessage("them", botReply(val)), 320);
  }

  function scrollToBottom(){
    feed.scrollTop = feed.scrollHeight;
  }

  // ----- events -------------------------------------------------------------
  form.addEventListener("submit", (e)=>{ e.preventDefault(); sendFromComposer(); });
  sendBtn.addEventListener("click", (e)=>{ e.preventDefault(); sendFromComposer(); });
  input.addEventListener("focus", ()=> setTimeout(scrollToBottom, 50));

  // ----- boot ---------------------------------------------------------------
  setupVisuals().then(()=>{
    // If you left a hardcoded welcome in chat.html, you can clear it once:
    // messages.innerHTML = "";
    greetIfEmpty();
    scrollToBottom();
  });

  // ----- utils --------------------------------------------------------------
  function timeNow(){ const d=new Date(); return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`; }
  function title(s){ return s.split(/\s+/).map(cap).join(" "); }
  function cap(s){ return s? s[0].toUpperCase()+s.slice(1):""; }
})();
