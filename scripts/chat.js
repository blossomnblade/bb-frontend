<!-- /scripts/chat.js -->
<script>
/* ==========================================================================
   Blossom & Blade — chat.js (persona voice + light memory)
   ========================================================================== */
(() => {
  /* ---------- Persona lists ---------- */
  const MEN = ['blade', 'alexander', 'dylan', 'viper', 'grayson', 'silas'];
  const NAME = { blade:'Blade', alexander:'Alexander', dylan:'Dylan', viper:'Viper', grayson:'Grayson', silas:'Silas' };

  // Hints and background JPG file names you already have in repo
  const BG_FILE = {
    blade:     'blade-woods.jpg',
    alexander: 'alexander-boardroom.jpg',
    dylan:     'dylan-garage.jpg',
    viper:     'viper-bg.jpg',
    grayson:   'grayson-bg.jpg',
    silas:     'silas-stage.jpg'
  };

  /* ---------- Greetings ---------- */
  const SHARED_GREETS = ['hey','hi','hey there.','there you are.','good to see you.','evening.','you made it.','come closer.'];
  const GREET = {
    blade: ["look at me. what do you need from me?","quiet or trouble—pick.","good. chin up."],
    alexander: ["evening, bella. are you slipping out or do i get you for the evening?","tell me what kept you away.","eyes on me, amore."],
    dylan: ["hey, trouble—city or trail tonight?","come sit on the tank so i can look in your eyes.","helmet off. eyes on me."],
    viper: ["you’re late; i counted. where were you, love?","come be good for me.","you smell like mischief. confirm or deny."],
    grayson: ["you clean up beautifully, trouble.","status check, darlin'. where are you, how are you?","eyes up, good girl."],
    silas: ["alright, luv—front row or backstage?","keen for a bit of neon or a quiet arvo?","come curl in."]
  };

  /* ---------- Small helpers ---------- */
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const delay = (ms)=>new Promise(r=>setTimeout(r,ms));
  const jitter = (lo=900, hi=1900)=>Math.round(Math.random()*(hi-lo)+lo);

  function getMan(){
    const q = new URLSearchParams(location.search);
    const fromURL = (q.get('man')||'').toLowerCase();
    const prior = (sessionStorage.getItem('bb:man')||'').toLowerCase();
    const pick = fromURL || prior || 'blade';
    const man = MEN.includes(pick) ? pick : 'blade';
    try{
      history.replaceState(null,'',`?man=${man}`);
      sessionStorage.setItem('bb:man', man);
    }catch{}
    return man;
  }

  const state = { man: getMan(), seed: 0 };

  /* ---------- DOM & bubbles ---------- */
  const feed = $('#feed');

  function make(tag, cls, text){
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text!=null) n.textContent = text;
    return n;
  }
  function scrollToEnd(){
    feed?.scrollTo({ top: feed.scrollHeight, behavior:'smooth' });
  }
  function addBubble(role, text, opts={}){
    const wrap = make('div','msg ' + (role==='you' ? 'you' : 'man'));
    const meta = make('span','meta', role==='you' ? 'You' : (NAME[state.man]||'Man'));
    const body = make('div','text');
    if (opts.typing){ body.innerHTML = '<span class="dots"></span>'; wrap.classList.add('typing'); }
    else body.textContent = text;
    wrap.append(meta, body);
    feed.appendChild(wrap);
    scrollToEnd();
    return wrap;
  }
  function swapTyping(node, text){
    if (!node) return;
    node.classList.remove('typing');
    const b = node.querySelector('.text');
    if (b) b.textContent = text;
    scrollToEnd();
  }

  /* ---------- Skin (portrait + wallpaper + title) ---------- */
  function portraitPath(man){ return `/images/characters/${man}/${man}-chat.webp`; }

  function applySkin(){
    document.body.setAttribute('data-man', state.man);
    document.title = `${NAME[state.man]||'Chat'} — Blossom & Blade`;

    // header name if present
    const headerName = $('#manName') || $('.manName') || $('header .name');
    if (headerName) headerName.textContent = NAME[state.man] || 'Man';

    // portrait(s)
    const src = portraitPath(state.man);
    $$('img[data-portrait], #portrait, .portrait img, .left img').forEach(img=>{
      img.src = src; img.alt = NAME[state.man]||'Portrait'; img.loading='eager'; img.decoding='async';
    });

    // wallpaper (uses your per-character JPGs)
    const file = BG_FILE[state.man];
    const wpEl = document.getElementById('chatWallpaper');
    if (wpEl && file){
      wpEl.style.backgroundImage = `url('/images/characters/${state.man}/${file}')`;
    }
  }

  /* ---------- Replies (simple, confident) ---------- */
  function externalPhrases(){
    try { return window.BBPhrases || window.BBPHRASES || null; } catch { return null; }
  }
  function fallbackReply(){
    const arr = {
      blade:["say it plain and i’ll make it simple.","breathe. i’ve got you.","good—now tell me the first move."],
      alexander:["tell me what you want, bella.","elegant first, wicked later—if you ask.","stand with me and let the rest blur."],
      dylan:["don’t overthink it—just tell me the vibe.","want direction or distraction?","hell yeah—i can work with that."],
      viper:["tell me where you were, love.","i don’t miss cues—give me one.","i remember what makes you blush."],
      grayson:["tell me what you need from me first.","i lead when you say the word, darlin’.","steady now; you’re safe."],
      silas:["what are you hungry for, luv?","velvet or teeth—pick one.","say the lane and i’ll tune to it."]
    }[state.man] || ["tell me more."];
    return arr[state.seed++ % arr.length];
  }
  async function reply(userText){
    const typing = addBubble('man','',{typing:true});
    let line = null;
    const mod = externalPhrases();
    if (mod && mod.PERSONAS?.[state.man]?.lines?.length){
      const arr = mod.PERSONAS[state.man].lines;
      line = arr[state.seed++ % arr.length] || null;
    }
    if (!line) line = fallbackReply();
    await delay(jitter(1100,2100));
    swapTyping(typing, line);
  }

  /* ---------- Greeting ---------- */
  function greet(){
    const persona = GREET[state.man] || [];
    const pool = (Math.random()<0.7) ? [...persona, ...SHARED_GREETS] : [...SHARED_GREETS, ...persona];
    const key = `bb:greet:${state.man}`;
    let ix = Number(sessionStorage.getItem(key) || '-1'); ix = (ix+1) % pool.length;
    sessionStorage.setItem(key, String(ix));
    const typing = addBubble('man','',{typing:true});
    setTimeout(()=>swapTyping(typing, pool[ix]), jitter(800,1400));
  }

  /* ---------- Composer wiring ---------- */
  function wireComposer(){
    const input  = $('#composer');
    const button = $('#sendBtn');

    async function send(){
      const val = (input?.value || '').trim();
      if (!val) return;
      addBubble('you', val);
      input.value = '';
      await reply(val);
    }

    button?.addEventListener('click', (e)=>{ e.preventDefault?.(); send(); });

    document.addEventListener('keydown', (e)=>{
      if (e.key !== 'Enter' || e.shiftKey) return;
      const el = document.activeElement;
      if (el && (el === input || el.matches('input, textarea, [contenteditable="true"]'))){
        e.preventDefault();
        send();
      }
    });
  }

  /* ---------- Boot ---------- */
  function boot(){
    applySkin();
    wireComposer();
    greet();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();
</script>
