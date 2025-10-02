/* Blossom & Blade — chat runtime (read-the-room + smooth scroll)
 * - No keyword needed (no "RED" requirement). We detect slow/stop/softer/switch intent.
 * - Persona-forward replies (1–3 sentences). No consent tagline spam.
 * - Local "boyfriend memory": nickname, likes, boundaries, vibe.
 * - Smooth page scroll after each message; you never have to hover a sub-box.
 * - Backend call (if available): https://api.blossomnblade.com/api/chat
 */
(() => {
  // --- Config ---
  const API_BASE = "https://api.blossomnblade.com"; // spelling: blossomnblade.com
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
  const redBadge = document.getElementById("redBadge"); // stays as an optional safety menu
  const bg = document.getElementById("bg");

  // --- Labels & backgrounds (images optional) ---
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
  const KEY_MEM = `bb.mem.${chosen}`;
  const cap = s => (!s ? s : s.replace(/\b\w/g, m => m.toUpperCase()));
  function loadMem(){
    try {
      const m = JSON.parse(localStorage.getItem(KEY_MEM) || "{}");
      return {
        nickname: m.nickname ? cap(m.nickname) : null,
        likes: Array.isArray(m.likes) ? m.likes.slice(0,20) : [],
        boundaries: Array.isArray(m.boundaries) ? m.boundaries.slice(0,20) : [],
        vibe: m.vibe || null,
        lastSeen: m.lastSeen || Date.now()
      };
    } catch { return { nickname:null, likes:[], boundaries:[], vibe:null, lastSeen:Date.now() }; }
  }
  function saveMem(m){ try { m.lastSeen = Date.now(); localStorage.setItem(KEY_MEM, JSON.stringify(m)); } catch {} }
  const MEM = loadMem();

  // --- Render helpers + smooth page scroll ---
  function escapeHtml(s){ return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function scrollPageToBottom(){
    // keep the feed and the whole window pinned to bottom
    try { feed.scrollTop = feed.scrollHeight; } catch {}
    try { window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" }); } catch {}
  }
  function addMsg(who, text){
    const div = document.createElement("div");
    div.className = "msg " + (who === "you" ? "you" : "him");
    div.innerHTML = `<div class="meta">${who === "you" ? "You" : LABEL[chosen]}</div>${escapeHtml(text)}`;
    feed.appendChild(div);
    scrollPageToBottom();
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
    if (MEM.nickname) line = line.replace(/\s*$/, "") + ` ${MEM.nickname}.`;
    addMsg("him", line);
    hist.push({role:"assistant", content:line});
    saveHist(hist);
  } else {
    hist.slice(-10).forEach(m => addMsg(m.role === "user" ? "you" : "him", m.content));
  }

  // --- Optional safety menu on click (no keyword required) ---
  redBadge.title = "Click to pause, soften, or switch";
  redBadge.onclick = () => {
    const txt = "Want to pause, soften, or switch personas?";
    addMsg("him", txt);
  };

  // --- Learn simple memory from her text ---
  function learnFrom(text){
    const t = text.trim();

    // nickname
    let m = t.match(/\bcall me\s+([A-Za-z][\w'-]{1,20}(?:\s+[A-Za-z][\w'-]{1,20})?)/i)
          || t.match(/\bmy name is\s+([A-Za-z][\w'-]{1,20}(?:\s+[A-Za-z][\w'-]{1,20})?)/i)
          || t.match(/\bi['’]m\s+([A-Za-z][\w'-]{1,20}(?:\s+[A-Za-z][\w'-]{1,20})?)\b/i);
    if (m) { MEM.nickname = cap(m[1]); }

    // vibe
    if (/\bsoft(er)?\b/i.test(t)) MEM.vibe = "soft";
    if (/\bsharp(er)?|rough(er)?|hard(er)?\b/i.test(t)) MEM.vibe = "sharper";
    if (/\bsupport(ive)?|comfort\b/i.test(t)) MEM.vibe = "supportive";

    // likes
    const likeMatch = t.match(/\b(i\s+(really\s+)?(like|love|enjoy|am into)\s+)([^.!,;]{1,40})/i);
    if (likeMatch) {
      const item = likeMatch[4].trim().toLowerCase();
      if (item && !MEM.likes.includes(item)) MEM.likes.push(item);
    }

    // boundaries
    const b = t.match(/\b(no|not into|don['’]t)\s+([^.!,;]{1,40})/i);
    if (b) {
      const bound = b[2].trim().toLowerCase();
      if (bound && !MEM.boundaries.includes(bound)) MEM.boundaries.push(bound);
    }

    MEM.likes = MEM.likes.slice(0,20);
    MEM.boundaries = MEM.boundaries.slice(0,20);
    saveMem(MEM);
  }

  // --- Read-the-room signals (no magic word) ---
  function detectIntent(text){
    const t = text.toLowerCase();
    if (/\b(pause|break|hold up|one sec|brb)\b/.test(t)) return "pause";
    if (/\b(too much|slow(er)?|softer|gentler|tone down|ease up)\b/.test(t)) return "softer";
    if (/\b(stop|no\b|not ok|uncomfortable|back off|boundary|line|no thanks)\b/.test(t)) return "stop";
    if (/\b(switch|different (guy|man|persona|one)|try (viper|blade|dylan|alexander|grayson|silas))\b/.test(t)) return "switch";
    return null;
  }

  function intentReply(kind){
    const nick = MEM.nickname ? ` ${MEM.nickname}` : "";
    switch(kind){
      case "pause":  return "Got you. Pausing—take your time." + nick;
      case "softer": return "I’ll soften and slow the pace." + nick;
      case "stop":   return "Stopped. You’re safe with me." + nick;
      case "switch": return "Pick the man and I’ll switch on your word." + nick;
      default:       return null;
    }
  }

  // --- Send handler ---
  sendBtn.onclick = async () => {
    const userText = (input.value || "").trim();
    if (!userText) return;
    input.value = "";
    addMsg("you", userText);

    learnFrom(userText);

    // Ambient safety: detect intent words/phrases (no keyword required)
    const sensed = detectIntent(userText);
    if (sensed) {
      const ir = intentReply(sensed);
      if (ir) {
        addMsg("him", ir);
        hist.push({role:"user", content:userText},{role:"assistant", content:ir});
        saveHist(hist);
        return;
      }
    }

    // Try backend (short replies); else persona fallback
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
          consented: true, // state only; we don't announce it
          memory: {
            nickname: MEM.nickname,
            likes: MEM.likes,
            boundaries: MEM.boundaries,
            vibe: MEM.vibe,
            plan: PLAN
          },
          signals: { budget: "short" },
          styleHint: "1–3 short sentences, persona-forward, vivid verbs, tease/worship/command cadence as appropriate, address her by nickname if known, follow her lead."
        })
      });
      clearTimeout(t);

      if (!res.ok) throw new Error("bad status " + res.status);
      const data = await res.json();
      let reply = (data && typeof data.reply === "string") ? data.reply : pickFallback();

      // Light tag nickname if absent
      if (MEM.nickname && reply && !new RegExp(`\\b${MEM.nickname}\\b`, "i").test(reply)) {
        reply = reply.replace(/\s*$/, "") + ` ${MEM.nickname}.`;
      }

      addMsg("him", reply);
      hist.push({role:"user", content:userText},{role:"assistant", content:reply});
      saveHist(hist);
    } catch (_) {
      const reply = pickFallback();
      addMsg("him", reply);
      hist.push({role:"user", content:userText},{role:"assistant", content:reply});
      saveHist(hist);
    }
  };

  // Enter to send
  input.addEventListener("keydown", (e)=>{ if (e.key === "Enter") sendBtn.click(); });

  // --- Persona-forward local fallback (cheap) ---
  function pickFallback(){
    const personaList =
      (window.PHRASES?.[chosen]?.fallback) ||
      (window.BBPhrases?.personas?.[chosen]?.fallback) ||
      [];
    const globalList = (window.PHRASES?.global?.fallback) || (window.BBPhrases?.global || {}).fallback || [];
    const pool = personaList.length ? personaList : globalList;
    let line = pool[Math.floor(Math.random()*Math.max(1, pool.length))] || "Your fantasy—set the pace; I’ll follow.";
    if (MEM.vibe === "soft") line = "Soft and steady. " + line;
    if (MEM.vibe === "supportive") line = "I’ve got you—breathe. " + line;
    if (MEM.nickname) line = line.replace(/\s*$/, "") + ` ${MEM.nickname}.`;
    return line;
  }
})();
