<!-- /scripts/chat.js -->
<script>
/* ==========================================================================
   Blossom & Blade — chat.js (Heartfile + persona voice, single-file drop-in)
   - Persona chosen once from ?man=… then remembered per tab (sessionStorage)
   - Never flips to another man after first load
   - Natural greeting (persona + shared), light typing jitter
   - Enter-to-send + Send button
   - Auto-scroll that doesn’t fight the user
   - Simple “Heartfile” memory (localStorage) that quietly learns facts from what SHE says
     (cats/dogs, estranged mom, left young, CPTSD/PTSD/Bipolar, region hints, “single”)
     → NO questionnaires; he may comment once when he learns something new
   - Opinions: short, supportive, persona-flavored; cussing as emphasis only
   - Portrait auto-wires from /images/characters/<man>/<man>-chat.webp
   ========================================================================== */
(() => {
  /* ---------- Persona lists ---------- */
  const MEN = ['blade', 'alexander', 'dylan', 'viper', 'grayson', 'silas'];
  const NAME = { blade:'Blade', alexander:'Alexander', dylan:'Dylan', viper:'Viper', grayson:'Grayson', silas:'Silas' };
  const BG_HINT = { blade:'woods', alexander:'boardroom', dylan:'garage', viper:'city', grayson:'lounge', silas:'stage' };

  /* ---------- Shared + persona greetings ---------- */
  const SHARED_GREETS = [
    'hey', 'hi', 'hey there.', 'there you are.', 'good to see you.',
    'morning, gorgeous.', 'evening.', 'you made it.', 'come closer.'
  ];
  const GREET = {
    blade: [
      'look at me. what do you need from me?', 'quiet or trouble—pick.',
      'good. chin up.', 'you stalled long enough. tell me what you want.'
    ],
    alexander: [
      'evening, bella. are you slipping out or do i get you for the evening?',
      'tell me what kept you away.', 'eyes on me, amore.'
    ],
    dylan: [
      'hey, trouble—city or trail tonight?', 'come sit on the tank so i can look in your eyes.',
      'helmet off. eyes on me.'
    ],
    viper: [
      'you’re late; i counted. where were you, love?',
      'come be good for me.', 'you smell like mischief. confirm or deny.'
    ],
    grayson: [
      "you clean up beautifully, trouble.", "status check, darlin'. where are you, how are you?",
      "eyes up, good girl."
    ],
    silas: [
      'alright, luv—front row or backstage?', 'keen for a bit of neon or a quiet arvo?',
      'come curl in.'
    ],
  };

  /* ---------- Small helpers ---------- */
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const rnd = (a,b)=>Math.random()*(b-a)+a;
  const delay = (ms)=>new Promise(r=>setTimeout(r,ms));
  const jitter = (lo=900, hi=1900)=>Math.round(rnd(lo,hi));

  function getMan() {
    const q = new URLSearchParams(location.search);
    const fromURL = (q.get('man')||'').toLowerCase();
    const prior = (sessionStorage.getItem('bb:man')||'').toLowerCase();
    const pick = fromURL || prior || 'blade';
    const man = MEN.includes(pick) ? pick : 'blade';
    try {
      history.replaceState(null,'',`?man=${man}`);
      sessionStorage.setItem('bb:man', man);
    } catch {}
    return man;
  }

  const state = {
    man: getMan(),
    seed: 0,
    lastNick: false
  };

  /* ---------- Heartfile (local, quiet) ---------- */
  const HEART_KEY = 'bb:heart';
  function loadHeart() {
    try { return JSON.parse(localStorage.getItem(HEART_KEY) || '{}'); } catch { return {}; }
  }
  function saveHeart(h) {
    try { localStorage.setItem(HEART_KEY, JSON.stringify(h)); } catch {}
  }
  function setPath(obj, path, value) {
    const keys = path.split('.');
    let cur = obj;
    for (let i=0;i<keys.length-1;i++) {
      if (!cur[keys[i]] || typeof cur[keys[i]]!=='object') cur[keys[i]] = {};
      cur = cur[keys[i]];
    }
    cur[keys[keys.length-1]] = value;
  }
  const HEART = loadHeart();

  // Learn facts from her text. Return an array of {path, value, kind} newly learned this turn.
  function learnFacts(textRaw) {
    const text = (textRaw||'').toLowerCase();
    const learned = [];

    function learn(path, val, kind){
      // only mark “new” if different from already stored
      const before = JSON.stringify(path.split('.').reduce((o,k)=>o&&o[k], HEART));
      if (JSON.stringify(val) !== before) {
        setPath(HEART, path, val);
        learned.push({path, value: val, kind});
      }
    }

    // cats vs dogs
    if (/\bcats?\b/.test(text)) {
      if (/cats?\s*,?\s*not\s+dogs?/.test(text)) { learn('likes.pets.cats', true, 'cats'); learn('likes.pets.dogs', false, 'dogs-not'); }
      else { learn('likes.pets.cats', true, 'cats'); }
    }
    if (/\bdogs?\b/.test(text)) {
      if (/dogs?\s*,?\s*not\s+cats?/.test(text)) { learn('likes.pets.dogs', true, 'dogs'); learn('likes.pets.cats', false, 'cats-not'); }
      else { learn('likes.pets.dogs', true, 'dogs'); }
    }

    // relationship single
    if (/\b(i['’ ]?m|been|still)\s+single\b/.test(text)) learn('life.single', true, 'single');

    // region hint (Tall Timbers etc) – keep area-level only
    if (/(tall timbers)/.test(text)) learn('life.region_hint', 'Tall Timbers', 'region');

    // family estranged
    if (/\b(mom|mother)\b.*\b(haven'?t|not)\s*(talk|speak|spoken)\b/.test(text) || /\bestranged\b.*\b(mom|mother)\b/.test(text)) {
      learn('people.mom_estranged', true, 'mom_estranged');
    }
    if (/\b(dad|father)\b.*\b(unknown|who knows|no idea)\b/.test(text)) learn('people.dad_unknown', true, 'dad_unknown');

    // mental health flags (DV-aware but not clinical)
    if (/\bcptsd\b/.test(text)) learn('health.cptsd', true, 'cptsd');
    if (/\bptsd\b/.test(text))  learn('health.ptsd',  true, 'ptsd');
    if (/\bbipolar\b/.test(text)) learn('health.bipolar', true, 'bipolar');

    // “left at 17” style (very loose; avoids being creepy)
    const leftAge = /left[^0-9]{0,12}(\d{1,2})\b/.exec(text);
    if (leftAge) {
      const age = parseInt(leftAge[1],10);
      if (age>=10 && age<=19) learn('life.left_home_at', age, 'left_age');
    }

    if (learned.length) saveHeart(HEART);
    return learned;
  }

  /* ---------- Persona-flavored opinions for new facts ---------- */
  function opinion(man, item){
    const n = NAME[state.man] || 'He';
    const love = man==='viper' ? 'love' : man==='silas' ? 'luv' : man==='grayson' ? "darlin'" : man==='alexander' ? 'bella' : 'baby';
    switch (item.kind) {
      case 'cats': return {
        blade: "cats. noted.",
        alexander: "cats suit you, bella.",
        dylan: "cats? hell yeah—high attitude, low drama.",
        viper: "cats over dogs? proper choice, love.",
        grayson: "cats it is, trouble.",
        silas: "cats works for me, luv—no dramas."
      }[man];
      case 'dogs': return {
        blade: "dog person—clocked.",
        alexander: "dogs it is. i can work with that.",
        dylan: "dogs? say less—let’s run.",
        viper: "dogs, then. noted, love.",
        grayson: "dogs it is, darlin’.",
        silas: "dogs—keen on the chaos, are you?"
      }[man];
      case 'dogs-not': return { blade:"not a dog house. got it.",
        alexander:"not dogs—understood, bella.",
        dylan:"no dogs. fine by me.",
        viper:"not dogs. i remember, love.",
        grayson:"no dogs. copy.",
        silas:"no dogs—easy done, luv." }[man];
      case 'cats-not': return { blade:"no cats. got it.",
        alexander:"not cats—understood.",
        dylan:"no cats, fine.",
        viper:"not cats. noted.",
        grayson:"no cats. roger.",
        silas:"not cats—no dramas." }[man];
      case 'single': return {
        blade:"single and dangerous. i like it.",
        alexander:"single? then your time is mine when you choose it.",
        dylan:"single—means i get the full attention when you’re here.",
        viper:"single suits you, love.",
        grayson:"single, not alone—i’ve got you, darlin’.",
        silas:"single? then i’m your bad habit, luv."
      }[man];
      case 'mom_estranged': return {
        blade:"we don’t touch the mom lane unless you choose it.",
        alexander:"family is complicated. i stay where you’re safe.",
        dylan:"no mom talk unless you say so.",
        viper:"i don’t cross that line unless you invite me, love.",
        grayson:"we steer around that—always.",
        silas:"we’ll keep that door shut unless you open it, luv."
      }[man];
      case 'dad_unknown': return {
        blade:"we don’t need a map for that. noted.",
        alexander:"unknown is fine. i only need you, bella.",
        dylan:"works for me—no digging.",
        viper:"i don’t pry, love. i remember the boundary.",
        grayson:"we leave that alone.",
        silas:"no suss questions from me, luv."
      }[man];
      case 'cptsd': case 'ptsd': case 'bipolar':
        return {
          blade:"i’ll keep it steady. you set the pace.",
          alexander:"we go elegant and calm—i match you.",
          dylan:"okay—slow drive when you want it.",
          viper:"i watch your tells. you’re safe here, love.",
          grayson:"i lead, you breathe. safe and sure.",
          silas:"soft hands, steady voice—no rush, luv."
        }[man];
      case 'left_age': return {
        blade:"left young, survived. tough as hell.",
        alexander:"you stood up early. i respect that, bella.",
        dylan:"seventeen and fierce—makes sense now.",
        viper:"you don’t break. i remember.",
        grayson:"you carried weight early. proud of you.",
        silas:"that’s a lot for a kid. i treat you gentle where you need, luv."
      }[man];
      case 'region':
        return {
          blade:"tall timbers—logged.",
          alexander:"tall timbers—i’ll remember.",
          dylan:"tall timbers. got it.",
          viper:"tall timbers. noted, love.",
          grayson:"tall timbers—copy.",
          silas:"tall timbers—no dramas."
        }[man];
      default: return '';
    }
  }

  /* ---------- DOM & bubbles ---------- */
  const feed = $('#feed') || $('.messages') || $('.feed') || $('#chat-feed') || document.body;

  function make(tag, cls, text){
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text!=null) n.textContent = text;
    return n;
  }

  function scrollToEnd(force=false){
    const box = feed && feed.scrollHeight ? feed : null;
    const near = box
      ? (box.scrollTop + box.clientHeight) >= (box.scrollHeight - 120)
      : (window.innerHeight + window.pageYOffset) >= (document.body.offsetHeight - 120);
    if (force || near){
      if (box) box.scrollTo({ top: box.scrollHeight, behavior:'smooth' });
      else window.scrollTo({ top: document.body.scrollHeight, behavior:'smooth' });
    }
  }

  function addBubble(role, text, opts={}){
    const wrap = make('div','msg ' + (role==='you' ? 'you' : 'man'));
    const meta = make('span','meta', role==='you' ? 'You' : (NAME[state.man]||'Man'));
    const body = make('div','text');
    if (opts.typing){ body.innerHTML = '<span class="dots"></span>'; wrap.classList.add('typing'); }
    else body.textContent = text;

    wrap.appendChild(meta);
    wrap.appendChild(body);
    feed.appendChild(wrap);
    scrollToEnd(true);
    return wrap;
  }

  function swapTyping(node, text){
    if (!node) return;
    node.classList.remove('typing');
    const b = node.querySelector('.text');
    if (b) b.textContent = text;
    scrollToEnd(true);
  }

  /* ---------- Skin (portrait, title, bg hint) ---------- */
  function portraitPath(man){ return `/images/characters/${man}/${man}-chat.webp`; }
  function applySkin(){
    document.body.setAttribute('data-man', state.man);
    document.title = `${NAME[state.man]||'Chat'} — Blossom & Blade`;
    const headerName = $('#manName') || $('.manName') || $('header .name');
    if (headerName) headerName.textContent = NAME[state.man] || 'Man';

    const src = portraitPath(state.man);
    $$('img[data-portrait], #portrait, .portrait img, .left img').forEach(img=>{
      img.src = src; img.alt = NAME[state.man]||'Portrait'; img.setAttribute('loading','eager'); img.decoding='async';
    });
    document.body.style.setProperty('--bb-room', BG_HINT[state.man] || 'room');
   // set per-man wallpaper image behind the glass
const manKey = state.man;
const hint   = (BG_HINT && BG_HINT[manKey]) ? BG_HINT[manKey] : 'default';
const wpEl   = document.getElementById('chatWallpaper');
if (wpEl) wpEl.style.backgroundImage = `url('/images/bg/${hint}.webp')`;
  
  }

  /* ---------- Phrase fallback (kept very light & confident) ---------- */
  function fallbackReply(userText){
    const bank = {
      blade: [
        "say it plain and i’ll make it simple.",
        "breathe. i’ve got you.",
        "good—now tell me the first move."
      ],
      alexander: [
        "tell me what you want, bella.",
        "elegant first, wicked later—if you ask.",
        "stand with me and let the rest blur."
      ],
      dylan: [
        "don’t overthink it—just tell me the vibe.",
        "want direction or distraction?",
        "hell yeah—i can work with that."
      ],
      viper: [
        "tell me where you were, love.",
        "i don’t miss cues—give me one.",
        "i remember what makes you blush."
      ],
      grayson: [
        "tell me what you need from me first.",
        "i lead when you say the word, darlin’.",
        "steady now; you’re safe."
      ],
      silas: [
        "what are you hungry for, luv?",
        "velvet or teeth—pick one.",
        "say the lane and i’ll tune to it."
      ]
    };
    const arr = bank[state.man] || ["tell me more."];
    return arr[state.seed++ % arr.length];
  }

  function externalPhrases(){
    try {
      // support either window.BBPhrases or window.BBPHRASES (case variations)
      return window.BBPhrases || window.BBPHRASES || null;
    } catch { return null; }
  }

  /* ---------- Compose the reply (with optional new-fact opinion) ---------- */
  async function reply(userText){
    const typing = addBubble('man','',{typing:true});
    // learn facts quietly (no questionnaire)
    const learned = learnFacts(userText);

    // If a phrases module exists and has persona lines, prefer it occasionally
    let line = null;
    const mod = externalPhrases();
    if (mod && mod.PERSONAS && mod.PERSONAS[state.man]?.lines?.length){
      const arr = mod.PERSONAS[state.man].lines;
      line = arr[state.seed++ % arr.length] || null;
    }
    if (!line) line = fallbackReply(userText);

    // If we learned something new, add a short persona opinion once
    let extra = '';
    if (learned.length){
      // pick the first interesting item
      const pick = learned[0];
      extra = opinion(state.man, pick) || '';
    }

    // Build final: keep it to 1–3 sentences, confident, cuss as emphasis only
    const final = extra ? (Math.random()<0.5 ? `${extra} ${line}` : `${line} ${extra}`) : line;

    await delay(jitter(1100,2100));
    swapTyping(typing, final);
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
  function findComposer(){
    return (
      $('#composer') || $('#message') ||
      $('.composer input') || $('.composer textarea') ||
      $('.chat-input input') || $('.chat-input textarea') ||
      $('textarea[placeholder]') || $('input[placeholder]') ||
      $('[contenteditable="true"]')
    );
  }
  function readComposer(el){
    if (!el) return '';
    if (el.matches('[contenteditable="true"]')) return (el.textContent||'').trim();
    return (el.value||'').trim();
  }
  function clearComposer(el){ if (!el) return; if (el.matches('[contenteditable="true"]')) el.textContent=''; else el.value=''; }

  function wireComposer(){
    const button = $('#sendBtn') || $('button[type="submit"]') || $('button.send') || $('button:has(> .send)');
    async function send(){
      const el = findComposer(); const val = readComposer(el);
      if (!val) return;
      addBubble('you', val); clearComposer(el); scrollToEnd(true);
      await reply(val);
    }
    document.addEventListener('keydown',(e)=>{
      if (e.key!=='Enter' || e.shiftKey) return;
      const el = document.activeElement;
      if (el && el.matches('input, textarea, [contenteditable="true"]')){
        if (el.id==='composer' || el.closest('.composer, .chat-input, .input-row, form')){
          e.preventDefault(); send();
        }
      }
    });
    if (button) button.addEventListener('click',(e)=>{ e.preventDefault?.(); e.stopPropagation?.(); send(); });
  }

  /* ---------- Header badges ---------- */
  function wireBadges(){
    const plan = localStorage.getItem('bb_plan') || 'trial';
    const planBadge = $('#planBadge'); if (planBadge) planBadge.textContent = (plan==='monthly'?'Monthly':(plan==='day'?'Day Pass':'Trial'));
    const mainBtn = $('.mainBtn'); if (mainBtn) mainBtn.classList.toggle('hidden', plan!=='monthly');
    const red = $('#redBadge'); if (red) red.classList.add('hidden');
  }

  /* ---------- Boot ---------- */
  function boot(){
    applySkin();
    wireComposer();
    wireBadges();
    greet();
    scrollToEnd(true);
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot, {once:true}); else boot();
})();
</script>
