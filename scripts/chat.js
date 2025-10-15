/* scripts/chat.js — full replacement
   Responsibilities:
   - Parse ?man=<name> and wire portrait + wallpaper (with graceful fallbacks)
   - Composer wiring: submit/click/Enter -> sendFromComposer()
   - Append messages, keep focus, autoscroll #feed
   - No backend yet; stubbed bot reply for UX smoke test
*/

(function(){
  const ALLOWED = ["blade","alexander","dylan","viper","grayson","silas"];

  const qs = new URLSearchParams(location.search);
  const man = (qs.get("man") || "").toLowerCase();
  const chosen = ALLOWED.includes(man) ? man : "blade"; // sensible default

  const body = document.body;
  const feed = document.getElementById("feed");
  const messages = document.getElementById("messages");
  const portrait = document.getElementById("portrait");
  const form = document.getElementById("composerForm");
  const input = document.getElementById("input");
  const sendBtn = document.getElementById("sendBtn");

  body.dataset.man = chosen;

  // ---- Image helpers -------------------------------------------------------
  function preload(src){
    return new Promise(resolve=>{
      const img = new Image();
      img.onload = ()=>resolve({ok:true,src});
      img.onerror = ()=>resolve({ok:false,src});
      img.src = src;
    });
  }

  async function setupVisuals(){
    // Portrait: prefer <man>-chat.webp, fallback to -card-on.webp, else hide
    const por1 = `/images/characters/${chosen}/${chosen}-chat.webp`;
    const por2 = `/images/characters/${chosen}/${chosen}-card-on.webp`;
    const porRes = (await preload(por1)).ok ? por1 :
                   (await preload(por2)).ok ? por2 : "";

    if(porRes){
      portrait.src = porRes;
      portrait.alt = `${capitalize(chosen)} portrait`;
    }else{
      portrait.remove(); // no broken boxes
    }

    // Wallpaper: try per-man bg, else default
    const bgTry = `/images/characters/${chosen}/${chosen}-bg.jpg`;
    const bgDefault = `/images/bg/default.webp`;
    const bgRes = (await preload(bgTry)).ok ? bgTry :
                  (await preload(bgDefault)).ok ? bgDefault : "";

    if(bgRes){
      body.style.backgroundImage = `url('${bgRes}')`;
    }else{
      // last-resort: solid background already provided by CSS
    }
  }

  // ---- Messaging -----------------------------------------------------------
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

  function scrollToBottom(){
    // ensures only the feed scrolls
    feed.scrollTop = feed.scrollHeight;
  }

  function timeNow(){
    const d = new Date();
    const h = String(d.getHours()).padStart(2,"0");
    const m = String(d.getMinutes()).padStart(2,"0");
    return `${h}:${m}`;
  }

  function sendFromComposer(){
    const val = (input.value || "").trim();
    if(!val) return;
    appendMessage("you", val);
    input.value = "";
    input.focus({preventScroll:true});
    // stubbed AI reply for UX smoke test
    setTimeout(()=>{
      appendMessage("them", pickTypingReply(val));
    }, 350);
  }

  function pickTypingReply(userText){
    // tiny placeholder; real personas hook in later
    // keep safe & neutral
    const lowers = userText.toLowerCase();
    if(lowers.includes("hi") || lowers.includes("hello")) return "Hey. I’m here.";
    if(lowers.includes("how are")) return "Better now. Tell me what’s on your mind.";
    if(lowers.endsWith("?")) return "I’ve got you—give me a little more detail.";
    return "Say more. I’m listening.";
  }

  // ---- Composer wiring -----------------------------------------------------
  form.addEventListener("submit", (e)=>{
    e.preventDefault();
    sendFromComposer();
  });

  sendBtn.addEventListener("click", (e)=>{
    e.preventDefault();
    sendFromComposer();
  });

  // Keep focus behavior predictable; avoid body scrolling jumps
  input.addEventListener("focus", ()=> {
    // On some mobile browsers, a quick defer helps keep composer pinned
    setTimeout(scrollToBottom, 50);
  });

  // Optional: enter-to-send on desktop if we ever switch to <textarea>
  // document.addEventListener("keydown", (e)=>{
  //   if(e.key === "Enter" && !e.shiftKey && document.activeElement === input){
  //     e.preventDefault();
  //     sendFromComposer();
  //   }
  // });

  // ---- Boot ---------------------------------------------------------------
  setupVisuals().then(scrollToBottom);

  // Utility
  function capitalize(s){ return s ? s[0].toUpperCase() + s.slice(1) : s; }
})();
