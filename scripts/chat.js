/* Blossom N Blade — chat.js (persona wiring + composer)
   - Pulls ?man= from URL (defaults to 'blade')
   - Sets per-man hero portrait + full-bleed wallpaper
   - Uses BBPhrases for greeting + replies (no more robots)
   - Composer: click, Enter, and form submit all send
   - Feed autoscroll + focus after every send
*/

(function () {
  /* ---------- tiny utils ---------- */
  const $ = (sel) => document.querySelector(sel);
  const params = new URLSearchParams(location.search);
  const man = (params.get("man") || "blade").toLowerCase();

  // image paths (change paths here if you rename)
 // image paths (exactly as in your repo)
const ART = {
  blade:     { hero: "/images/characters/blade/blade-chat.webp",       wall: "/images/characters/blade/blade-woods.jpg" },
  alexander: { hero: "/images/characters/alexander/alexander-chat.webp", wall: "/images/characters/alexander/alexander-boardroom.jpg" },
  dylan:     { hero: "/images/characters/dylan/dylan-chat.webp",       wall: "/images/characters/dylan/dylan-garage.jpg" },
  viper:     { hero: "/images/characters/viper/viper-chat.webp",       wall: "/images/characters/viper/viper-bg.jpg" },
  grayson:   { hero: "/images/characters/grayson/grayson-chat.webp",   wall: "/images/characters/grayson/grayson-bg.jpg" },
  silas:     { hero: "/images/characters/silas/silas-chat.webp",       wall: "/images/characters/silas/silas-stage.jpg" },
};
 
  function setWall(url){
    // prefer CSS var so chat.css can control attachment/cover
    document.documentElement.style.setProperty("--wall-url", `url('${url}')`);
  }
  function el(type, cls, text){
    const n = document.createElement(type);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function scrollToBottom(){
    const feed = $("#feed");
    if (!feed) return;
    feed.scrollTop = feed.scrollHeight;
  }

  /* ---------- persona brain (phrases) ---------- */
  // Multilingual rule to be included in the LLM system prompt once wired:
const MULTILINGUAL_RULE = "Always reply in the user's language. Detect the language from the user's last message; if uncertain, default to English.";
 
  const P = (window.BBPhrases || {});
  const PERSONAS = P.PERSONAS || {};
  const GLOBAL = P.GLOBAL || {};

  function greetLine() {
    if (typeof P.firstLineFor === "function") return P.firstLineFor(man);
    // fallback if phrases not loaded
    const opens = (GLOBAL && GLOBAL.openers) || ["hey.", "evening.", "there you are."];
    return opens[Math.floor(Math.random() * opens.length)];
  }

  function replyLine() {
    const p = PERSONAS[man];
    if (p && Array.isArray(p.lines) && p.lines.length) {
      // use the no-repeat ring picker if available
      if (typeof P.pick === "function") return P.pick("line:"+man, p.lines);
      return p.lines[Math.floor(Math.random() * p.lines.length)];
    }
    // fallback blend so it never feels empty
    const pool = (GLOBAL.smallWords || []).concat(GLOBAL.openers || []);
    return pool[Math.floor(Math.random() * pool.length)] || "mm.";
  }

  /* ---------- render ---------- */
  function bubble(text, who){
    const feed = $("#feed");
    if (!feed) return;
    const b = el("div", "msg " + (who === "me" ? "me" : "them"));
    b.textContent = text;
    feed.appendChild(b);
    scrollToBottom();
  }

  function banner(text){
    const feed = $("#feed");
    if (!feed) return;
    const b = el("div", "banner", text);
    feed.appendChild(b);
    scrollToBottom();
  }

  /* ---------- composer ---------- */
  async function sendFromComposer(ev){

    if (ev) ev.preventDefault();
    const input = $("#input");
    if (!input) return;
    const txt = (input.value || "").trim();
    if (!txt) { input.focus(); return; }
  // --- SAFETY FILTER ---
  if (window.Safety) {
    if (!window.Safety.ready) {
      await window.Safety.load();
    }
    const check = window.Safety.check(txt);
    if (check.blocked) {
      const warn = document.getElementById("safetyWarn");
      if (warn) {
        warn.style.display = "block";
        warn.innerHTML =
          "<strong>Content blocked.</strong> This chat follows our " +
          '<a href="/safety.html" style="color:#f88;">Prohibited Content &amp; Safety Policy</a>.';
      }
      input.value = "";
      return; // stop send
    }
  }
  // --- END SAFETY FILTER ---

    // you → bubble
    bubble(txt, "me");

    // naive persona reply (local-only until backend/LLM)
    window.setTimeout(() => {
      bubble(replyLine(), "them");
    }, 450);

    // TODO: persistence (local or Supabase/Azure via adapter)
    try {
      if (window.BBMemory && typeof window.BBMemory.store === "function") {
        window.BBMemory.store({ man, from: "you", text: txt });
      }
    } catch (e) { /* non-fatal */ }

    input.value = "";
    input.focus();
  }

  function wireComposer(){
    const form = $("#composerForm");
    const sendBtn = $("#sendBtn");
    const input = $("#input");
    if (!form || !input) return;

    form.addEventListener("submit", sendFromComposer);
    if (sendBtn) sendBtn.addEventListener("click", sendFromComposer);
    input.addEventListener("keydown", (e)=>{
      // allow Enter to send (but Shift+Enter = newline)
      if (e.key === "Enter" && !e.shiftKey){
        e.preventDefault();
        sendFromComposer();
      }
    });
  }

  /* ---------- init ---------- */
  document.addEventListener("DOMContentLoaded", function(){
    // lock in correct wall + portrait per man
    const art = ART[man] || ART["blade"];
    if (art && art.wall) setWall(art.wall);
    const heroImg = document.querySelector(".hero img, #heroImg");
    if (heroImg && art && art.hero) heroImg.src = art.hero;

    // system banner + first persona line
    banner("Welcome. I'm here for you—talk to me.");
    bubble(greetLine(), "them");

    // wire composer
    wireComposer();
    scrollToBottom();
  });
})();
