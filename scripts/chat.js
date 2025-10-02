/* Blossom & Blade — chat runtime (lead-first + richer memory + typing delay + WEBP autodetect)
 * - Keeps your WEBP files. No renaming required.
 * - Finds first existing image among common names: chat-bg.webp/jpg, <man>-chat.webp/jpg.
 * - Guys lead confidently; casual cussing OK (non-graphic).
 * - Read-the-room safety (no RED keyword).
 * - Local boyfriend memory: nickname, hair, eyes, likes, boundaries, vibe.
 * - Smooth page scroll AND typing bubble with ~3s jittered delay.
 * - Backend (if up): https://api.blossomnblade.com/api/chat
 */
(() => {
  // --- Config ---
  const API_BASE = "https://api.blossomnblade.com"; // spelling: blossomnblade.com
  const MAX_TURNS = 12;            // keep token cost down
  const FETCH_TIMEOUT_MS = 12000;  // fail fast → local fallback
  const DELAY_MIN_MS = 2800;       // typing delay (min)
  const DELAY_JITTER_MS = 700;     // +[0..700)ms

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
  const redBadge = document.getElementById("redBadge"); // optional safety menu
  const bg = document.getElementById("bg");

  // --- Labels ---
  const LABEL = {blade:"Blade", viper:"Viper", dylan:"Dylan", alexander:"Alexander", grayson:"Grayson", silas:"Silas"};
  manName.textContent = LABEL[chosen];
  const PLAN = localStorage.getItem("bb.plan") || "Trial";
  planBadge.textContent = PLAN;

  // --- Image helpers (auto-detect your filenames) ---------------------------
  function testImage(url){
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(url);
      img.onerror = () => reject(url);
      img.src = url + (url.includes("?") ? "&" : "?") + "v=" + Date.now(); // bust cache
    });
  }
  async function firstExisting(candidates){
    for (const url of candidates) {
      try { const ok = await testImage(url); return ok; } catch {}
    }
    return null;
  }
  function bgCandidatesFor(m){
    // Try standard names first, then common personal ones you already use
    return [
      `/images/characters/${m}/chat-bg.webp`,
      `/images/characters/${m}/chat-bg.jpg`,
      `/images/characters/${m}/${m}-chat.webp`,
      `/images/characters/${m}/${m}-chat.jpg`,
      // a couple of likely alternates seen in your screenshots:
      `/images/characters/${m}/bg_${m}_boardroom.webp`,
      `/images/characters/${m}/bg_${m}_night.webp`
    ];
  }

  // Set a placeholder, then swap when we find a real one
  bg.style.backgroundImage = "linear-gradient(180deg,#0b0c0f,#151821)";
  firstExisting(bgCandidatesFor(chosen)).then(url => {
    if (url) bg.style.backgroundImage = `url('${url}')`;
  });

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

  // --- Render + smooth scroll + typing bubble --------------------------------
  function escapeHtml(s){ return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function scrollPageToBottom(){
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
  function startTyping(){
    const div = document.createElement("div");
    div.className = "msg him typing";
    div.innerHTML = `<div class="meta">${LABEL[chosen]}</div><span class="dots">•</span>`;
    feed.appendChild(div);
    scrollPageToBottom();
    const dots = div.querySelector(".dots");
    let i = 0;
    const frames = ["•", "••", "•••"];
    const timer = setInterval(()=>{ i=(i+1)%frames.length; dots.textContent = frames[i]; }, 450);
    return () => { clearInterval(timer); div.remove(); };
  }

  // --- First line (cheap local opener + nickname if known) -------------------
  const hist = loadHist();
  if (hist.length === 0) {
    let line = "";
    if (window.BBPhrases?.personas?.[chosen]?.first?.length) {
      const bank = window.BBPhrases.personas[chosen].first;
      line = bank[Math.floor(Math.random()*bank.length)];
    } else {
      const firsts = (window.PHRASES?.[chosen]?.first) || ["I’m here. Make room for me."];
      line = firsts[Math.floor(Math.random()*firsts.length)];
    }
    if (MEM.nickname) line = line.replace(/\s*$/, "") + ` ${MEM.nickname}.`;
    addMsg("him", line);
    hist.push({role:"assistant", content:line});
    saveHist(hist);
  } else {
    hist.slice(-10).forEach(m => addMsg(m.role === "user" ? "you" : "him", m.content));
  }

  // --- Optional safety menu (no keyword required) ----------------------------
  redBadge.title = "Click to pause, soften, or switch";
  redBadge.onclick = () => addMsg("him", "Want to pause, soften, or switch personas?");

  // --- Learn memory from her text --------------------------------------------
  function learnFrom(text){
    const t = text.trim();

    // nickname
    let m = t.match(/\bcall me\s+([A-Za-z][\w'-]{1,20}(?:\s+[A-Za-z][\w'-]{1,20})?)/i)
          || t.match(/\bmy name is\s+([A-Za-z][\w'-]{1,20}(?:\s+[A-Za-z][\w'-]{1,20})?)/i)
          || t.match(/\bi['’]m\s+([A-Za-z][\w'-]{1,20}(?:\s+[A-Za-z][\w'-]{1,20})?)\b/i);
    if (m) MEM.nickname = cap(m[1]);

    // vibe
    if (/\bsoft(er)?\b/i.test(t)) MEM.vibe = "soft";
    if (/\bsharp(er)?|rough(er)?|hard(er)?\b/i.test(t)) MEM.vibe = "sharper";
    if (/\bsupport(ive)?|comfort\b/i.test(t)) MEM.vibe = "supportive";

    // hair/eyes
    const hairMap = { redhead:"red", ginger:"red", auburn:"red", blonde:"blonde", blond:"blonde", brunette:"brunette", brown:"brunette", black:"black", pink:"pink", blue:"blue", purple:"purple", silver:"silver" };
    const hairHit = t.match(/\b(my\s+hair\s+is|i['’]m\s+a|i['’]ve\s+got)\s+(redhead|ginger|auburn|blonde|blond|brunette|brown|black|pink|blue|purple|silver)\b/i);
    if (hairHit) MEM.hair = hairMap[hairHit[2].toLowerCase()] || hairHit[2].toLowerCase();

    const eyeHit = t.match(/\b(my\s+eyes\s+are|my\s+eyes\s*[:\-]?)\s*(blue|green|brown|hazel|grey|gray|amber)\b/i)
                 || t.match(/\b(blue|green|brown|hazel|grey|gray|amber)\s+eyes\b/i);
    if (eyeHit) MEM.eyes = (eyeHit[2] || eyeHit[1]).toLowerCase().replace(/gray/,"grey");

    // likes / boundaries
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

  // --- Read-the-room (no magic word) -----------------------------------------
  function detectIntent(text){
    const t = text.toLowerCase();
    if (/\b(pause|break|hold up|one sec|brb)\b/.test(t)) return "pause";
    if (/\b(too much|slow(er)?|softer|gentler|tone down|ease up)\b/.test(t)) return "softer";
    if (/\b(stop|not ok|uncomfortable|back off|boundary|line|no thanks)\b/.test(t)) return "stop";
    if (/\b(switch|different (guy|man|persona|one)|try (viper|blade|dylan|alexander|grayson|silas))\b/.test(t)) return "switch";
    // lead invites
    if (/\b(what would you do|take control|show me|teach me|surprise me|you decide)\b/.test(t)) return "invite";
    // passive vibe → lead
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
      case "invite": return leadLine(chosen, MEM);
      default:       return null;
    }
  }

  // --- Persona-forward lead lines (non-graphic; a little filthy is fine) -----
  function leadLine(man, mem){
    const nick = mem.nickname ? ` ${mem.nickname}` : "";
    const hair = mem.hair ? ` with that ${mem.hair} hair` : "";
    const eyes = mem.eyes ? ` and those ${mem.eyes} eyes` : "";
    const x = {
      blade: [
        `Come here and let me set the pace${nick}.`,
        `I’m taking you out of your head and into my hands${hair}${eyes}.`,
        `You’re mine for the night—relax and let me run the scene${nick}.`
      ],
      viper: [
        `Chin up. I’ll handle the rest—watch me work${nick}.`,
        `I’m mapping you, inch by inch—don’t look away.`,
        `Be greedy. I’ll make you say my name, then thank me.`
      ],
      dylan: [
        `Hop on—I’ll steer hard and keep you laughing.`,
        `I’ve got the keys and a wicked route; hold tight${nick}.`,
        `I’ll pick the song and the sin—just say when to stop.`
      ],
      alexander: [
        `Yield with pride and I’ll worship you properly${nick}.`,
        `Velvet first, steel later—stand gorgeous and let me indulge you.`,
        `I’ll ruin your doubts and polish your crown.`
      ],
      grayson: [
        `Eyes up. I’ll give the orders and the praise when you earn it${nick}.`,
        `Square your shoulders; I’ll make you blush for it.`,
        `Stand here. I’ll handle the lesson—then the reward.`
      ],
      silas: [
        `Come curl in and let me tune you to my rhythm${nick}.`,
        `I’ll pour you through a chorus and make you shiver—damn, you’re pretty.`,
        `Let me be shameless for both of us tonight.`
      ]
    }[man] || [`I’ll take the lead and keep you smiling${nick}.`];
    return x[Math.floor(Math.random()*x.length)];
  }

  // --- Local fallback when API fails (assertive, 1–3 sentences) --------------
  function pickFallback(){
    const personaList =
      (window.PHRASES?.[chosen]?.fallback) ||
      (window.BBPhrases?.personas?.[chosen]?.fallback) ||
      [];
    let line = personaList.length
      ? personaList[Math.floor(Math.random()*personaList.length)]
      : leadLine(chosen, MEM);

    if (MEM.vibe === "soft") line = "Soft and steady. " + line;
    if (MEM.vibe === "supportive") line = "I’ve got you—breathe. " + line;
    if (MEM.nickname && !line.endsWith(`${MEM.nickname}.`)) line = line.replace(/\s*$/, "") + ` ${MEM.nickname}.`;
    return line;
  }

  // --- Utilities --------------------------------------------------------------
  const sleep = (ms)=> new Promise(res=>setTimeout(res, ms));

  async function getAPIReply(userText, leadMode){
    // try the backend; return string or null
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try{
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
          consented: true, // state only; no announcements
          memory: {
            nickname: MEM.nickname, hair: MEM.hair, eyes: MEM.eyes,
            likes: MEM.likes, boundaries: MEM.boundaries, vibe: MEM.vibe, plan: PLAN
          },
          signals: { budget: "short", lead: leadMode ? "assert" : "follow" },
          styleHint:
            "Be confident, suave, a little filthy if it fits; casual cussing allowed. " +
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

  // --- Send handler -----------------------------------------------------------
  sendBtn.onclick = async () => {
    const userText = (input.value || "").trim();
    if (!userText) return;
    input.value = "";
    addMsg("you", userText);

    learnFrom(userText);

    // Ambient intent (pause/softer/stop/switch/lead-invite)
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

    // Show typing, wait ~3s, then reply
    const stopTyping = startTyping();
    const delay = sleep(DELAY_MIN_MS + Math.random()*DELAY_JITTER_MS);

    // Simple lead heuristic
    const leadMode = /(\bwhat would you do\b|take control|show me|teach me|surprise me|you decide|\?)|(^\s*$)/i.test(userText) || sensed === "invite";

    let reply = await getAPIReply(userText, leadMode);
    if (!reply) reply = pickFallback();

    await delay; // ensure human-ish pause
    stopTyping();

    // Light nickname tag if absent
    if (MEM.nickname && reply && !new RegExp(`\\b${MEM.nickname}\\b`, "i").test(reply)) {
      reply = reply.replace(/\s*$/, "") + ` ${MEM.nickname}.`;
    }

    addMsg("him", reply);
    hist.push({role:"user", content:userText},{role:"assistant", content:reply});
    saveHist(hist);
  };

  // Enter to send
  input.addEventListener("keydown", (e)=>{ if (e.key === "Enter") sendBtn.click(); });
})();
