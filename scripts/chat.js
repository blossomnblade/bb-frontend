/* Blossom & Blade — chat runtime with local "boyfriend memory"
 * - Keeps short-term memory per-man in localStorage (nickname, likes, vibe, boundaries)
 * - Uses window.PHRASES for cheap openers/fallbacks
 * - Tries backend at https://api.blossomnblade.com/api/chat (sends memory{})
 * - Safe mode: RED badge + "RED" message triggers check-in
 * - Style: 1–3 sentences, vivid, non-graphic, follow her lead
 */
(() => {
  // --- Config ---
  const API_BASE = "https://api.blossomnblade.com"; // spelling check: blossomnblade.com
  const MAX_TURNS = 12;           // keep token cost down
  const FETCH_TIMEOUT_MS = 12000; // fail fast → local fallback

  // --- URL & age gate ---
  const qs = new URLSearchParams(location.search);
  const man = (qs.get("man") || "blade").toLowerCase();
  const allowed = ["blade","viper","dylan","alexander","grayson","silas"];
  const chosen = allowed.includes(man) ? man : "blade";

  if (localStorage.getItem("bb.age.ok") !== "1") {
    const next = encodeURIComponent(location.pathname + location.search);
    location.href = "/age.html?next=" + next;
    return;
  }

  // --- DOM refs ---
  const feed = document.getElementById("feed");
  const input = document.getElementById("input");
  const sendBtn = document.getElementById("send");
  const manName = document.getElementById("manName");
  const planBadge = document.getElementById("planBadge");
  const redBadge = document.getElementById("redBadge");
  const bg = document.getElementById("bg");

  // --- Labels & backgrounds (swap to your actual images later) ---
  const LABEL = {blade:"Blade", viper:"Viper", dylan:"Dylan", alexander:"Alexander", grayson:"Grayson", silas:"Silas"};
  const BG = {
    blade: "/images/characters/blade/chat-bg.jpg",
    viper: "/images/characters/viper/chat-bg.jpg",
    dylan: "/images/characters/dylan/chat-bg.jpg",
    alexander: "/images/characters/alexander/chat-bg.jpg",
    grayson: "/images/characters/grayson/chat-bg.jpg",
    silas: "/images/characters/silas/chat-bg.jpg"
  };

  manName.textContent = LABEL[chosen];
  const PLAN = localStorage.getItem("bb.plan") || "Trial";
  planBadge.textContent = PLAN;
  bg.style.backgroundImage = `url('${BG[chosen]}')`;

  // --- History per man ---
  const KEY_HIST = `bb.chat.${chosen}.history`;
  const loadHist = () => { try { return JSON.parse(localStorage.getItem(KEY_HIST) || "[]"); } catch { return []; } };
  const saveHist = (h) => localStorage.setItem(KEY_HIST, JSON.stringify(h.slice(-MAX_TURNS)));

  // --- Local "boyfriend memory" per man ---
  const KEY_MEM = `bb.mem.${chosen}`; // persisted per persona
  function loadMem(){
    try {
      const m = JSON.parse(localStorage.getItem(KEY_MEM) || "{}");
      // shape defaults
      return {
        nickname: m.nickname || null,     // e.g., "Red"
        likes: Array.isArray(m.likes) ? m.likes.slice(0,20) : [], // "soft", "knife fantasy", "praise"
        boundaries: Array.isArray(m.boundaries) ? m.boundaries.slice(0,20) : [], // "no choking", "no slurs"
        vibe: m.vibe || null,             // "soft", "sharper", "supportive"
        lastSeen: m.lastSeen || Date.now()
      };
    } catch { return { nickname:null, likes:[], boundaries:[], vibe:null, lastSeen:Date.now() }; }
  }
  function saveMem(m){ try { m.lastSeen = Date.now(); localStorage.setItem(KEY_MEM, JSON.stringify(m)); } catch {} }
  const MEM = loadMem();

  // --- Render helpers ---
  function escapeHtml(s){ return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function addMsg(who, text){
    const div = document.createElement("div");
    div.className = "msg " + (who === "you" ? "you" : "him");
    div.innerHTML = `<div class="meta">${who === "you" ? "You" : LABEL[chosen]}</div>${escapeHtml(text)}`;
    feed.appendChild(div);
    feed.scrollTop = feed.scrollHeight;
  }

  // --- First line (cheap local opener + nickname if known) ---
  const hist = loadHist();
  if (hist.length === 0) {
    let line = "";
    if (window.BBPhrases?.personas?.[chosen]?.first?.length) {
      const bank = window.BBPhrases.personas[chosen].first;
      line = bank[Math.floor(Math.random()*bank.length)];
    } else {
      const firsts = (window.PHRASES?.[chosen]?.first) || ["I’m here. Lead the scene."];
      line = firsts[Math.floor(Math.random()*firsts.length)];
    }
    if (MEM.nickname) line = line.replace(/^\s*/,"") + ` ${MEM.nickname}.`;
    addMsg("him", line);
    hist.push({role:"assistant", content:line});
    saveHist(hist);
  } else {
    hist.slice(-10).forEach(m => addMsg(m.role === "user" ? "you" : "him", m.content));
  }

  // --- RED handling ---
  redBadge.onclick = () => addMsg("him", (window.PHRASES?.system?.redCheck) || "RED noted. Pause, soften, or switch?");

  // --- Memory extraction from her message (very simple, safe regexes) ---
  function learnFrom(text){
    const t = text.trim();

    // nickname: "call me X", "my name is X", "I'm X" (one word or two)
    let m = t.match(/\bcall me\s+([A-Za-z][\w'-]{1,20})(?:\s+([A-Za-z][\w'-]{1,20}))?/i)
          || t.match(/\bmy name is\s+([A-Za-z][\w'-]{1,20})(?:\s+([A-Za-z][\w'-]{1,20}))?/i)
          || t.match(/\bi['’]m\s+([A-Za-z][\w'-]{1,20})(?:\s+([A-Za-z][\w'-]{1,20}))?\b/i);
    if (m) {
      const nick = m.slice(1).filter(Boolean).join(" ");
      if (nick && nick.length <= 24) MEM.nickname = nick;
    }

    // vibe prefs
    if (/\bsoft(er)?\b/i.test(t)) MEM.vibe = "soft";
    if (/\bsharp(er)?|rough(er)?|hard(er)?\b/i.test(t)) MEM.vibe = "sharper";
    if (/\bsupport(ive)?|comfort\b/i.test(t)) MEM.vibe = "supportive";

    // likes: "I like/love/am into/enjoy X"
    const likeMatch = t.match(/\b(i\s+(really\s+)?(like|love|enjoy|am into)\s+)([^.!,;]{1,40})/i);
    if (likeMatch) {
      const item = likeMatch[4].trim().toLowerCase();
      if (item && !MEM.likes.includes(item)) MEM.likes.push(item);
    }

    // boundaries: "no X", "not into X", "don't X"
    const b = t.match(/\b(no|not into|don['’]t)\s+([^.!,;]{1,40})/i);
    if (b) {
      const bound = b[2].trim().toLowerCase();
      if (bound && !MEM.boundaries.includes(bound)) MEM.boundaries.push(bound);
    }

    // Cap lists
    MEM.likes = MEM.likes.slice(0,20);
    MEM.boundaries = MEM.boundaries.slice(0,20);
    saveMem(MEM);
  }

  // --- Send handler ---
  sendBtn.onclick = async () => {
    const userText = (input.value || "").trim();
    if (!userText) return;
    input.value = "";
    addMsg("you", userText);

    // Learn from her message (nickname/prefs)
    learnFrom(userText);

    // If she types RED explicitly
    if (userText.toUpperCase() === "RED") {
      addMsg("him", (window.PHRASES?.system?.redCheck) || "RED noted. Pause, soften, or switch?");
      hist.push({role:"user", content:userText});
      saveHist(hist);
      return;
    }

    // Try backend with memory; fallback locally
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      const res = await fetch(API_BASE + "/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          man: chosen,
          userText,
          history: hist.slice(-MAX_TURNS),
          mode: "romance",
          pov: "first-person",
          consented: true,
          memory: {
            nickname: MEM.nickname,
            likes: MEM.likes,
            boundaries: MEM.boundaries,
            vibe: MEM.vibe,
            plan: PLAN
          },
          signals: { budget: "short", safety: "consent-first" },
          styleHint: "Reply in 1-3 short sentences, vivid but non-graphic, address her by nickname if known, follow her lead."
        })
      });
      clearTimeout(t);

      if (!res.ok) throw new Error("bad status " + res.status);
      const data = await res.json();
      let reply = (data && typeof data.reply === "string") ? data.reply : pickFallback();

      // If backend forgot nickname, add a light tag on local side
      if (MEM.nickname && !/(\bRed\b|\b\s?@?${MEM.nickname}\b)/i.test(reply)) {
        reply = reply.replace(/\.$/,"") + ` ${MEM.nickname}.`;
      }

      addMsg("him", reply);
      hist.push({role:"user", content:userText},{role:"assistant", content:reply});
      saveHist(hist);
    } catch (_) {
      const reply = pickFallback(true);
      addMsg("him", reply);
      hist.push({role:"user", content:userText},{role:"assistant", content:reply});
      saveHist(hist);
    }
  };

  // Enter to send
  input.addEventListener("keydown", (e)=>{ if (e.key === "Enter") sendBtn.click(); });

  // --- Local fallback (cheap) ---
  function pickFallback(safe=false){
    const personaList =
      (window.PHRASES?.[chosen]?.fallback) ||
      (window.BBPhrases?.personas?.[chosen]?.fallback) ||
      [];
    const globalList = (window.PHRASES?.global?.fallback) || (window.BBPhrases?.global || {}).fallback || [];
    let line = (personaList.concat(globalList))[Math.floor(Math.random()*Math.max(1, personaList.length + globalList.length))] || "Your fantasy—set the pace; I’ll follow.";
    if (MEM.nickname) line = line.replace(/\.$/,"") + ` ${MEM.nickname}.`;
    if (MEM.vibe === "soft") line = "Soft and steady. " + line;
    if (MEM.vibe === "supportive") line = "I’ve got you—breathe. " + line;
    return safe ? (line + " " + ((window.PHRASES?.system?.safeDefault) || "Staying within safe, consensual fantasy.")) : line;
  }
})();
