/* Blossom & Blade — chat runtime (frontend-only)
 * - Uses window.PHRASES for first/fallback lines (cheap local)
 * - Tries backend at https://api.blossomnblade.com/api/chat
 * - Keeps history per-man in localStorage (last 12 turns)
 * - Safety: RED badge + "RED" message triggers check-in
 * - Reply style: short (1–3 sentences); backend gets a styleHint to keep cost down
 */
(() => {
  // --- Config ---
  const API_BASE = "https://api.blossomnblade.com"; // double-check spelling: blossomnblade.com
  const MAX_TURNS = 12; // keep context small to save tokens
  const FETCH_TIMEOUT_MS = 12000; // fail fast to local fallback

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

  // --- Labels & backgrounds (swap to your actual files) ---
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
  planBadge.textContent = localStorage.getItem("bb.plan") || "Trial";
  bg.style.backgroundImage = `url('${BG[chosen]}')`;

  // --- History per man ---
  const KEY = `bb.chat.${chosen}.history`;
  const loadHist = () => { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } };
  const saveHist = (h) => localStorage.setItem(KEY, JSON.stringify(h.slice(-MAX_TURNS)));

  // --- Render helpers ---
  function escapeHtml(s){ return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function addMsg(who, text){
    const div = document.createElement("div");
    div.className = "msg " + (who === "you" ? "you" : "him");
    div.innerHTML = `<div class="meta">${who === "you" ? "You" : LABEL[chosen]}</div>${escapeHtml(text)}`;
    feed.appendChild(div);
    feed.scrollTop = feed.scrollHeight;
  }

  // --- First line (cheap local opener) ---
  const hist = loadHist();
  if (hist.length === 0) {
    // Prefer BBPhrases if present (anti-repeat), else PHRASES
    let line = "";
    if (window.BBPhrases && window.BBPhrases.personas?.[chosen]?.first?.length) {
      const bank = window.BBPhrases.personas[chosen].first;
      line = bank[Math.floor(Math.random()*bank.length)];
    } else {
      const firsts = (window.PHRASES?.[chosen]?.first) || ["I’m here. Lead the scene."];
      line = firsts[Math.floor(Math.random()*firsts.length)];
    }
    addMsg("him", line);
    hist.push({role:"assistant", content:line});
    saveHist(hist);
  } else {
    hist.slice(-10).forEach(m => addMsg(m.role === "user" ? "you" : "him", m.content));
  }

  // --- RED handling ---
  redBadge.onclick = () => addMsg("him", (window.PHRASES?.system?.redCheck) || "RED noted. Pause, soften, or switch?");

  // --- Send handler ---
  sendBtn.onclick = async () => {
    const userText = (input.value || "").trim();
    if (!userText) return;
    input.value = "";
    addMsg("you", userText);

    // If she types RED explicitly
    if (userText.toUpperCase() === "RED") {
      addMsg("him", (window.PHRASES?.system?.redCheck) || "RED noted. Pause, soften, or switch?");
      hist.push({role:"user", content:userText});
      saveHist(hist);
      return;
    }

    // Try backend with short style hint; fall back to local
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
          signals: { budget: "short", safety: "consent-first" },
          styleHint: "Reply in 1-3 short sentences, vivid but non-graphic, follow her lead."
        })
      });
      clearTimeout(t);

      if (!res.ok) throw new Error("bad status " + res.status);
      const data = await res.json();
      const reply = (data && data.reply && typeof data.reply === "string") ? data.reply : pickFallback();
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
    // Prefer persona fallback; then global; then generic
    const personaList =
      (window.PHRASES?.[chosen]?.fallback) ||
      (window.BBPhrases?.personas?.[chosen]?.fallback) ||
      [];
    const globalList = (window.PHRASES?.global?.fallback) || (window.BBPhrases?.global || {}).fallback || [];
    const pool = personaList.concat(globalList);
    const line = pool.length ? pool[Math.floor(Math.random()*pool.length)] : "Your fantasy—set the pace; I’ll follow.";
    return safe ? (line + " " + ((window.PHRASES?.system?.safeDefault) || "Staying within safe, consensual fantasy.")) : line;
  }
})();
