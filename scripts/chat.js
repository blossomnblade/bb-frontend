/* Blossom & Blade — chat runtime (human cadence, typing, persona cards)
   - Distinct voices wired from BBPhrases (phrases.js)
   - Typing indicator with jitter
   - Normal greetings (no consent lectures)
   - Fixed left portrait set via #bg
   - Graceful offline fallback if API is down
*/

(() => {
  // ---------- DOM ----------
  const qs = s => document.querySelector(s);
  const feed = qs('#feed');
  const input = qs('#input');
  const sendBtn = qs('#send');
  const manNameEl = qs('#manName');
  const bgEl = qs('#bg');

  // ---------- URL / Persona ----------
  const url = new URL(location.href);
  const man = (url.searchParams.get('man') || 'blade').toLowerCase();

  const TITLE_MAP = {
    blade: 'Blade',
    viper: 'Viper',
    dylan: 'Dylan',
    alexander: 'Alexander',
    grayson: 'Grayson',
    silas: 'Silas'
  };

  // Your uploaded image filenames (from /images/characters/*)
  const PORTRAITS = {
    alexander: { chat: '/images/characters/alexander/alexander-chat.webp', bg: '/images/characters/alexander/bg_alexander_boardroom.jpg' },
    blade:     { chat: '/images/characters/blade/blade.webp',               bg: '/images/characters/blade/blade-woods.jpg' },
    dylan:     { chat: '/images/characters/dylan/dylan-chat.webp',         bg: '/images/characters/dylan/dylan-garage.jpg' },
    grayson:   { chat: '/images/characters/grayson/grayson-chat.webp',     bg: '/images/characters/grayson/grayson-bg.jpg' },
    silas:     { chat: '/images/characters/silas/silas-chat.webp',         bg: '/images/characters/silas/bg_silas_stage.jpg' },
    viper:     { chat: '/images/characters/viper/viper-chat.webp',         bg: '/images/characters/viper/viper-bg.jpg' }
  };

  // ---------- State ----------
  const state = {
    history: [],           // [{role:'user'|'assistant', content:'...'}]
    typingTimer: null,
    dotsTimer: null,
    personaCard: '',
    nicknameGuess: null,   // e.g., "Red", "bookworm", etc.
    apiBase: 'https://api.blossomnblade.com',  // backend base
    netTimeoutMs: 12000
  };

  // ---------- Helpers ----------
  function el(tag, cls, text){
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  function scrollToEnd(){
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  }

  function addBubble(role, text, opts = {}){
    const wrap = el('div', 'msg' + (role === 'you' ? ' you' : ''));
    if (opts.typing) wrap.classList.add('typing');
    const name = role === 'you' ? 'You' : TITLE_MAP[man] || 'Man';
    const meta = el('span', 'meta', name);
    const body = el('div', 'text');
    if (opts.typing){
      body.innerHTML = `<span class="dots">…</span>`;
    } else {
      body.textContent = text;
    }
    wrap.appendChild(meta);
    wrap.appendChild(body);
    feed.appendChild(wrap);
    scrollToEnd();
    return wrap;
  }

  function updateTypingDots(node){
    if (!node) return;
    const dotsEl = node.querySelector('.dots');
    if (!dotsEl) return;
    let i = 0;
    state.dotsTimer && clearInterval(state.dotsTimer);
    state.dotsTimer = setInterval(() => {
      i = (i + 1) % 3;
      dotsEl.textContent = '.'.repeat(i + 1);
    }, 400);
  }

  function replaceTypingWithText(node, text){
    if (!node) return;
    node.classList.remove('typing');
    const body = node.querySelector('.text');
    if (body) body.textContent = text;
    state.dotsTimer && clearInterval(state.dotsTimer);
    scrollToEnd();
  }

  function jitter(minMs, maxMs){
    return Math.floor(minMs + Math.random() * (maxMs - minMs));
  }

  function looksLikeSmallTalk(s){
    const t = (s||'').toLowerCase();
    return /(how (was|is) (your|ya) (night|day|morning)|what.*up|wyd|how are you)/.test(t);
  }

  // Very soft “name catcher”: “call me ___”
  function captureName(s){
    const m = (s||'').match(/\b(call\s+me|my\s+name\s+is)\s+([a-z][a-z\-']{1,20})\b/i);
    if (m) return m[2];
    return null;
  }

  // ---------- Persona wiring from phrases.js ----------
  const P = window.BBPhrases || {};
  function personaFirstLine(){
    if (P.firstLineFor) return P.firstLineFor(man);
    return "hey.";
  }
  function personaSmallTalk(){
    if (P.smallTalk) return P.smallTalk(man);
    return "day was a blur—this is the part I was waiting on.";
  }
  function personaCard(){
    if (P.systemPersonaCard) return P.systemPersonaCard(man);
    return "";
  }

  // ---------- Header + Portrait ----------
  function initHeader(){
    manNameEl && (manNameEl.textContent = TITLE_MAP[man] || 'Chat');
    const pack = PORTRAITS[man];
    if (pack && bgEl){
      bgEl.style.backgroundImage = `url('${pack.bg}')`;
    }
  }

  // ---------- Greeting on load ----------
  function greet(){
    // Persona intro, then a second quick line (varies)
    const opening = personaFirstLine();
    addBubble('bot', opening);
    state.history.push({ role: 'assistant', content: opening });

    // A quick second tease/affirm (pull from persona lines if present)
    try{
      const persona = (P.PERSONAS && P.PERSONAS[man]);
      const line = persona && persona.lines ? P.pick(`warm:${man}`, persona.lines) : P.pick('warm:global', (P.GLOBAL?.affirm||["mm—yes."]));
      if (line){
        addBubble('bot', line);
        state.history.push({ role: 'assistant', content: line });
      }
    }catch(_){}
  }

  // ---------- Backend call with timeout + graceful fallback ----------
  async function callAPI(userText){
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), state.netTimeoutMs);

    const payload = {
      man,
      userText,
      history: state.history,
      mode: 'romance',
      memory: {}, // can be extended later
      pov: 'first-person',
      signals: {},
      personaCard: state.personaCard   // backend can use or ignore safely
    };

    const url = `${state.apiBase}/api/chat`;
    try{
      const res = await fetch(url, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(t);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data && typeof data.reply === 'string' && data.reply.trim()){
        return data.reply.trim();
      }
      throw new Error('Bad payload');
    }catch(err){
      clearTimeout(t);
      // Fallback: local phrase-bank reply (keeps the show rolling)
      return localFallback(userText);
    }
  }

  // Local “human-ish” fallback
  function localFallback(userText){
    // If she asked small talk, give small talk
    if (looksLikeSmallTalk(userText)) {
      return personaSmallTalk();
    }

    // If she gave a name
    const gotName = captureName(userText);
    if (gotName){
      state.nicknameGuess = gotName[0].toUpperCase() + gotName.slice(1);
      return `Noted, ${state.nicknameGuess}. Come closer.`;
    }

    // Otherwise pick a persona line, and sprinkle with a short encourager
    try{
      const persona = (P.PERSONAS && P.PERSONAS[man]);
      const line = persona && persona.lines ? P.pick(`line:${man}`, persona.lines) : "mm—come here.";
      const bump = P.pick('enc', (P.GLOBAL?.encouragers||[]));
      return bump ? `${line} ${bump}` : line;
    }catch(_){
      return "come here.";
    }
  }

  // ---------- Send flow ----------
  async function onSend(){
    const text = (input.value || '').trim();
    if (!text) return;

    // You bubble
    addBubble('you', text);
    state.history.push({ role: 'user', content: text });
    input.value = '';
    input.focus();

    // Typing bubble
    const typingNode = addBubble('bot', '', { typing:true });
    updateTypingDots(typingNode);

    // Jittered human pause
    await new Promise(r => setTimeout(r, jitter(650, 1400)));

    // Ask backend (or fallback)
    const reply = await callAPI(text);

    // Slight extra pause for realism if the reply is short
    if (reply.length < 40){
      await new Promise(r => setTimeout(r, jitter(300, 700)));
    }

    // Replace typing with real text
    replaceTypingWithText(typingNode, reply);
    state.history.push({ role: 'assistant', content: reply });
  }

  // ---------- Wire UI ----------
  function wire(){
    sendBtn?.addEventListener('click', onSend);
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey){
        e.preventDefault();
        onSend();
      }
    });
  }

  // ---------- Boot ----------
  function boot(){
    initHeader();
    state.personaCard = personaCard(); // to help the model keep voice
    greet();
    wire();
    // Focus the composer on load
    setTimeout(() => input && input.focus(), 150);
  }

  boot();
})();
document.addEventListener('DOMContentLoaded', () => {
  // Show the user's plan in the header
  const plan = localStorage.getItem('bb_plan') || 'trial'; // 'trial' | 'day' | 'monthly'
  const planBadge = document.getElementById('planBadge');
  if (planBadge) {
    planBadge.textContent = (plan === 'monthly') ? 'Monthly' : (plan === 'day' ? 'Day Pass' : 'Trial');
  }

  // Show "Main" button only for monthly plans
  const mainBtn = document.querySelector('.mainBtn');
  if (mainBtn) {
    mainBtn.classList.toggle('hidden', plan !== 'monthly');
  }

  // Keep RED hidden unless you decide to show it on purpose
  const red = document.getElementById('redBadge');
  if (red) red.classList.add('hidden');
});
