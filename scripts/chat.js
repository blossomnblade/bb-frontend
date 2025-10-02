/* Blossom & Blade — chat runtime (lead-forward, memory, typing, image autodetect) */
(() => {
  const API_BASE = "https://api.blossomnblade.com";
  const MAX_TURNS = 12;
  const FETCH_TIMEOUT_MS = 12000;
  const DELAY_MIN_MS = 2800;
  const DELAY_JITTER_MS = 700;

  const qs = new URLSearchParams(location.search);
  const manParam = (qs.get("man") || "blade").toLowerCase();
  const ALLOWED = ["blade","viper","dylan","alexander","grayson","silas"];
  const MAN = ALLOWED.includes(manParam) ? manParam : "blade";

  if (localStorage.getItem("bb.age.ok") !== "1") {
    const next = encodeURIComponent(location.pathname + location.search);
    location.href = "/age.html?next=" + next;
    return;
  }

  const $ = (id) => document.getElementById(id);
  const feed = $("feed") || $("messages") || document.querySelector(".feed");
  const input = $("input") || $("message");
  const sendBtn = $("send") || $("submit");
  const manName = $("manName");
  const planBadge = $("planBadge");
  const redBadge = $("redBadge");
  const bg = $("bg");

  const LABEL = {blade:"Blade", viper:"Viper", dylan:"Dylan", alexander:"Alexander", grayson:"Grayson", silas:"Silas"};
  if (manName) manName.textContent = LABEL[MAN];
  if (planBadge) planBadge.textContent = localStorage.getItem("bb.plan") || "Trial";

  function testImage(url){
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(url);
      img.onerror = () => rej(url);
      img.src = url + (url.includes("?") ? "&" : "?") + "v=" + Date.now();
    });
  }
  async function firstExisting(candidates){
    for (const url of candidates){ try{ await testImage(url); return url; }catch{} }
    return null;
  }
  const BG_EXTRAS = {
    blade:     ["blade-woods.jpg","blade.webp"],
    dylan:     ["dylan-garage.jpg"],
    viper:     ["viper-bg.jpg"],
    grayson:   ["grayson-bg.jpg"],
    silas:     ["bg_silas_stage.jpg"],
    alexander: ["bg_alexander_boardroom.jpg"]
  };
  function bgCandidatesFor(m){
    const base = [
      `/images/characters/${m}/${m}-chat.webp`,
      `/images/characters/${m}/${m}-chat.jpg`,
      `/images/characters/${m}/${m}-bg.webp`,
      `/images/characters/${m}/${m}-bg.jpg`,
      `/images/characters/${m}/chat-bg.webp`,
      `/images/characters/${m}/chat-bg.jpg`,
      `/images/characters/${m}/background.webp`,
      `/images/characters/${m}/background.jpg`
    ];
    return base.concat((BG_EXTRAS[m] || []).map(n => `/images/characters/${m}/${n}`));
  }
  if (bg){
    bg.style.backgroundImage = "linear-gradient(180deg,#0b0c0f,#151821)";
    firstExisting(bgCandidatesFor(MAN)).then(url => { if (url) bg.style.backgroundImage = `url('${url}')`; });
  }

  const KEY_HIST = `bb.chat.${MAN}.history`;
  const loadHist = () => { try { return JSON.parse(localStorage.getItem(KEY_HIST) || "[]"); } catch { return []; } };
  const saveHist = (h) => localStorage.setItem(KEY_HIST, JSON.stringify(h.slice(-MAX_TURNS)));
  const hist = loadHist(); // single declaration (fixes earlier crash)

  const KEY_MEM = `bb.mem.${MAN}`;
  const cap = s => (!s ? s : s.replace(/\b\w/g, m => m.toUpperCase()));
  function loadMem(){
    try {
      const m = JSON.parse(localStorage.getItem(KEY_MEM) || "{}");
      return {
        nickname: m.nickname ? cap(m.nickname) : null,
        hair: m.hair || null,
        eyes: m.eyes || null,
        likes: Array.isArray(m.likes) ? m.likes.slice(0,20) : [],
        boundaries: Array.isArray(m.boundaries) ? m.boundaries.slice(0,20) : [],
        vibe: m.vibe || null,
        lastSeen: m.lastSeen || Date.now()
      };
    } catch { return { nickname:null, hair:null, eyes:null, likes:[], boundaries:[], vibe:null, lastSeen:Date.now() }; }
  }
  function saveMem(m){ try { m.lastSeen = Date.now(); localStorage.setItem(KEY_MEM, JSON.stringify(m)); } catch {} }
  const MEM = loadMem();

  function escapeHtml(s){ return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function scrollPageToBottom(){
    try { feed.scrollTop = feed.scrollHeight; } catch {}
    try { window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" }); } catch {}
  }
  function addMsg(who, text){
    if (!feed) return;
    const div = document.createElement("div");
    div.className = "msg " + (who === "you" ? "you" : "him");
    div.innerHTML = `<div class="meta">${who === "you" ? "You" : LABEL[MAN]}</div>${escapeHtml(text)}`;
    feed.appendChild(div);
    scrollPageToBottom();
  }
  function startTyping(){
    if (!feed) return () => {};
    const div = document.createElement("div");
    div.className = "msg him typing";
    div.innerHTML = `<div class="meta">${LABEL[MAN]}</div><span class="dots">•</span>`;
    feed.appendChild(div);
    scrollPageToBottom();
    const dots = div.querySelector(".dots");
    let i=0, frames=["•","••","•••"];
    const t = setInterval(()=>{ i=(i+1)%frames.length; dots.textContent = frames[i]; }, 450);
    return () => { clearInterval(t); div.remove(); };
  }

  const PETS = ["sweetheart","love","gorgeous","trouble","angel","doll","beautiful","darling","hun"];
  function pet(){ return PETS[Math.floor(Math.random()*PETS.length)]; }
  function firstLine(man, mem){
    const nick = mem.nickname ? mem.nickname : pet();
    const bank = {
      blade:     [`Hey, ${nick}. Come closer.`, `There you are, ${nick}. I’ve got you tonight.`],
      viper:     [`Evening, ${nick}. Eyes on me.`, `There you are—good timing, ${nick}.`],
      dylan:     [`Hey, ${nick}. Hop in.`, `You made it—helmet on, ${nick}.`],
      alexander: [`Evening, ${nick}. Stand glorious for me.`, `Come here, ${nick}. I’ll take my time.`],
      grayson:   [`Report in, ${nick}.`, `Eyes up, ${nick}. I’ve got orders and praise.`],
      silas:     [`Alright, ${nick}. Come curl in.`, `Hey, ${nick}. Let me tune your mood.`]
    }[man] || [`Hey, ${nick}. I’m right here.`];
    return bank[Math.floor(Math.random()*bank.length)];
  }

  if (hist.length === 0) {
    const opener = firstLine(MAN, MEM);
    addMsg("him", opener);
    hist.push({role:"assistant", content: opener});
    saveHist(hist);
  } else {
    hist.slice(-10).forEach(m => addMsg(m.role === "user" ? "you" : "him", m.content));
  }

  if (redBadge) {
    redBadge.title = "Click to pause, soften, or switch";
    redBadge.onclick = () => addMsg("him", "Want to pause, soften, or switch personas?");
  }

  function learnFrom(text){
    const t = text.trim();
    let m = t.match(/\bcall me\s+([A-Za-z][\w'-]{1,20}(?:\s+[A-Za-z][\w'-]{1,20})?)/i)
          || t.match(/\bmy name is\s+([A-Za-z][\w'-]{1,20}(?:\s+[A-Za-z][\w'-]{1,20})?)/i)
          || t.match(/\bi['’]m\s+([A-Za-z][\w'-]{1,20}(?:\s+[A-Za-z][\w'-]{1,20})?)\b/i);
    if (m) MEM.nickname = cap(m[1]);

    if (/\bsoft(er)?\b/i.test(t)) MEM.vibe = "soft";
    if (/\bsharp(er)?|rough(er)?|hard(er)?\b/i.test(t)) MEM.vibe = "sharper";
    if (/\bsupport(ive)?|comfort\b/i.test(t)) MEM.vibe = "supportive";

    const hairMap = { redhead:"red", ginger:"red", auburn:"red", blonde:"blonde", blond:"blonde", brunette:"brunette", brown:"brunette", black:"black", pink:"pink", blue:"blue", purple:"purple", silver:"silver" };
    const hairHit = t.match(/\b(my\s+hair\s+is|i['’]m\s+a|i['’]ve\s+got)\s+(redhead|ginger|auburn|blonde|blond|brunette|brown|black|pink|blue|purple|silver)\b/i);
    if (hairHit) MEM.hair = hairMap[hairHit[2].toLowerCase()] || hairHit[2].toLowerCase();

    const eyeHit = t.match(/\b(my\s+eyes\s+are|my\s+eyes\s*[:\-]?)\s*(blue|green|brown|hazel|grey|gray|amber)\b/i)
                 || t.match(/\b(blue|green|brown|hazel|grey|gray|amber)\s+eyes\b/i);
    if (eyeHit) MEM.eyes = (eyeHit[2] || eyeHit[1]).toLowerCase().replace(/gray/,"grey");

    const likeMatch = t.match(/\b(i\s+(really\s+)?(like|love|enjoy|am into)\s+)([^.!,;]{1,40})/i);
    if (likeMatch) {
      const item = likeMatch[4].trim().toLowerCase();
      if (item && !MEM.likes.includes(item)) MEM.likes.push(item);
    }
    const b = t.match(/\b(no|not into|don['’]t)\s+([^.!,;]{1,40})/i);
    if (b) {
      const bound = b[2].trim().toLowerCase();
      if (bound && !MEM.boundaries.includes(bound)) MEM.boundaries.push(bound);
    }
    MEM.likes = MEM.likes.slice(0,20);
    MEM.boundaries = MEM.boundaries.slice(0,20);
    saveMem(MEM);
  }

  function detectIntent(text){
    const t = text.toLowerCase();
    if (/\b(pause|break|hold up|one sec|brb)\b/.test(t)) return "pause";
    if (/\b(too much|slow(er)?|softer|gentler|tone down|ease up)\b/.test(t)) return "softer";
    if (/\b(stop|not ok|uncomfortable|back off|boundary|line|no thanks)\b/.test(t)) return "stop";
    if (/\b(switch|different (guy|man|persona|one)|try (viper|blade|dylan|alexander|grayson|silas))\b/.test(t)) return "switch";
    if (/\b(what would you do|take control|show me|teach me|surprise me|you decide)\b/.test(t)) return "invite";
    if (!/[.!?]/.test(t) || /\b(idk|you pick|whatever|up to you)\b/.test(t)) return "invite";
    return null;
  }
  function intentReply(kind){
    const nick = MEM.nickname ? ` ${MEM.nickname}` : "";
    switch(kind){
      case "pause":  return "Got you. Pausing—catch your breath." + nick;
      case "softer": return "I’ll slow the pace and keep it soft." + nick;
      case "stop":   return "Stopped. You’re safe with me." + nick;
      case "switch": return "Tell me who you want—Blade, Viper, Dylan, Alexander, Grayson, or Silas." + nick;
      case "invite": return leadLine(MAN, MEM);
      default:       return null;
    }
  }

  function leadLine(man, mem){
    const nick = mem.nickname ? ` ${mem.nickname}` : "";
    const lines = {
      blade:     [`Come here and let me set the pace.${nick}`, `Relax—I’ll run the scene.${nick}`],
      viper:     [`Chin up. I’ll handle the rest.${nick}`, `I’m mapping you—don’t look away.`],
      dylan:     [`Hop on—I’ll steer hard and keep you laughing.${nick}`, `I’ve got the keys and a wicked route.`],
      alexander: [`Yield with pride and I’ll worship you properly.${nick}`, `Velvet first, steel later—stand gorgeous.`],
      grayson:   [`Eyes up. I’ll give the orders and the praise when you earn it.${nick}`, `Stand here; I’ll handle the lesson.`],
      silas:     [`Come curl in; I’ll tune you to my rhythm.${nick}`, `Let me be shameless for both of us tonight.`]
    }[man] || [`I’ll take the lead and keep you smiling.${nick}`];
    return lines[Math.floor(Math.random()*lines.length)];
  }

  const sleep = (ms)=> new Promise(res=>setTimeout(res, ms));
  async function getAPIReply(userText, leadMode){
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try{
      const res = await fetch(API_BASE + "/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          man: MAN,
          userText,
          history: hist.slice(-MAX_TURNS),
          mode: "romance",
          pov: "first-person",
          consented: true,
          memory: {
            nickname: MEM.nickname, hair: MEM.hair, eyes: MEM.eyes,
            likes: MEM.likes, boundaries: MEM.boundaries, vibe: MEM.vibe,
            plan: localStorage.getItem("bb.plan") || "Trial"
          },
          signals: { budget: "short", lead: leadMode ? "assert" : "follow" },
          styleHint:
            "Confident, suave, a little filthy if it fits; casual cussing allowed. " +
            "1–3 short sentences. Persona-forward (Blade/Viper/Dylan/Alexander/Grayson/Silas). " +
            "Lead if she invites or stays passive; otherwise follow her specifics. " +
            "Use her nickname/hair/eyes if known; no consent boilerplate."
        })
      });
      clearTimeout(t);
      if (!res.ok) throw new Error("bad status " + res.status);
      const data = await res.json();
      return (data && typeof data.reply === "string") ? data.reply : null;
    }catch(_){
      clearTimeout(t);
      return null;
    }
  }
  function pickFallback(){
    let line = leadLine(MAN, MEM);
    if (MEM.vibe === "soft") line = "Soft and steady. " + line;
    if (MEM.vibe === "supportive") line = "I’ve got you—breathe. " + line;
    return line;
  }

  if (sendBtn) {
    sendBtn.onclick = async () => {
      const userText = (input && input.value || "").trim();
      if (!userText) return;
      if (input) input.value = "";
      addMsg("you", userText);
      learnFrom(userText);

      const sensed = detectIntent(userText);
      if (sensed && sensed !== "invite") {
        const ir = intentReply(sensed);
        if (ir) {
          addMsg("him", ir);
          hist.push({role:"user", content:userText},{role:"assistant", content:ir});
          saveHist(hist);
          return;
        }
      }

      const stopTyping = startTyping();
      const delay = sleep(DELAY_MIN_MS + Math.random()*DELAY_JITTER_MS);

      const leadMode = /(\bwhat would you do\b|take control|show me|teach me|surprise me|you decide|\?)|(^\s*$)/i.test(userText) || sensed === "invite";

      let reply = await getAPIReply(userText, leadMode);
      if (!reply) reply = pickFallback();

      await delay;
      stopTyping && stopTyping();

      if (MEM.nickname && reply && !new RegExp(`\\b${MEM.nickname}\\b`, "i").test(reply)) {
        reply = reply.replace(/\s*$/, "") + ` ${MEM.nickname}.`;
      }

      addMsg("him", reply);
      hist.push({role:"user", content:userText},{role:"assistant", content:reply});
      saveHist(hist);
    };

    if (input) input.addEventListener("keydown", (e)=>{ if (e.key === "Enter") sendBtn.click(); });
  }
})();
