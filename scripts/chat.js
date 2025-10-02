/* ==========================================================================
   Blossom & Blade — chat.js (full rewrite)
   - Persona is chosen from ?man=… once, then remembered per-tab (sessionStorage)
   - Never flips to another man after first load
   - Natural greeting with short typing/jitter
   - Simple local phrase engine fallback (phrases.js if present), no consent lectures
   - Left portrait auto-wires from /images/characters/<man>/<man>-chat.webp
   - Plan badge + “Main” button visibility
   ========================================================================== */

(() => {
  /* ---------- Persona & display names ---------- */
  const SUPPORTED_MEN = ['blade', 'alexander', 'dylan', 'viper', 'grayson', 'silas'];

  const TITLE_MAP = {
    blade: 'Blade',
    alexander: 'Alexander',
    dylan: 'Dylan',
    viper: 'Viper',
    grayson: 'Grayson',
    silas: 'Silas',
  };
  // Friendly callsigns (nicknames) + helpers
  const CALLSIGNS = {
    blade:     ['rabbit', 'sweetheart', 'pretty thing'],
    alexander: ['love', 'darling', 'beautiful'],
    dylan:     ['angel', 'babygirl', 'sweetheart'],
    viper:     ['love', 'gorgeous', 'miu', 'baby'],
    grayson:   ['darlin’', 'trouble', 'sweet thing'],
    silas:     ['luv', 'darlin’', 'gorgeous'],
  };

  function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
  function maybe(p=0.45){ return Math.random() < p; }
  function sprinkleNick(text){
    const list = CALLSIGNS[state.man] || [];
    if (!list.length || !maybe()) return text;
    const pre = pick(['hey', 'mm', '']);
    const nick = pick(list);
    return `${pre ? pre + ' ' : ''}${nick}, ${text}`.replace(/\s+/g,' ').trim();
  }

  // Optional: background hints for CSS (some themes use body[data-man] selectors)
  const BG_HINT = {
    blade: 'woods',
    alexander: 'boardroom',
    dylan: 'garage',
    viper: 'city',
    grayson: 'lounge',
    silas: 'stage',
  };

  function getManFromURLorSession() {
    const q = new URLSearchParams(location.search);
    const fromURL = (q.get('man') || '').toLowerCase();
    const candidate = fromURL || (sessionStorage.getItem('bb:man') || 'blade').toLowerCase();
    return SUPPORTED_MEN.includes(candidate) ? candidate : 'blade';
  }

  const state = {
    man: getManFromURLorSession(),
    personaCard: '',
    seed: 0,          // tiny convo memory for our fallback engine
  };

  // Canonicalize URL to freeze the chosen man & remember for this tab
  try {
    history.replaceState(null, '', `?man=${state.man}`);
    sessionStorage.setItem('bb:man', state.man);
  } catch {}

  /* ---------- DOM helpers ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function scrollToEnd() {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  }

  function rnd(min, max) {
    return Math.random() * (max - min) + min;
  }

  function jitterDelay(min = 900, max = 1900) {
    return Math.round(rnd(min, max));
  }

  /* ---------- Chat UI: bubbles ---------- */
 const feed = $('#feed') || $('.feed') || $('#chat-feed') || document.body;


  function addBubble(role, text, opts = {}) {
    const wrap = el('div', 'msg ' + (role === 'you' ? 'you' : 'man'));
    const meta = el('span', 'meta', role === 'you' ? 'You' : TITLE_MAP[state.man] || 'Man');
    const body = el('div', 'text');

    if (opts.typing) {
      body.innerHTML = '<span class="dots"></span>'; // CSS animates .dots
      wrap.classList.add('typing');
    } else {
      body.textContent = text;
    }

    wrap.appendChild(meta);
    wrap.appendChild(body);
    feed.appendChild(wrap);
    scrollToEnd();
    return wrap;
  }

  function swapTypingToText(node, text) {
    if (!node) return;
    node.classList.remove('typing');
    const t = node.querySelector('.text');
    if (t) t.textContent = text;
    scrollToEnd();
  }

  /* ---------- Persona skin (portrait, labels, data attributes) ---------- */
  function portraitPath(man) {
    return `/images/characters/${man}/${man}-chat.webp`;
  }

  function applySkin() {
    // body[data-man] lets CSS theme per man if you’ve set that up
    document.body.setAttribute('data-man', state.man);
    document.title = `${TITLE_MAP[state.man] || 'Chat'} — Blossom & Blade`;

    // Update header label if present
    const headerName = $('#manName') || $('.manName') || $('header .name');
    if (headerName) headerName.textContent = TITLE_MAP[state.man] || 'Man';

    // Try to wire the portrait — we try a few common selectors
    const portTargets = $$('img[data-portrait], #portrait, .portrait img, .left img');
    const src = portraitPath(state.man);
    portTargets.forEach((img) => {
      img.src = src;
      img.alt = TITLE_MAP[state.man] || 'Portrait';
      img.setAttribute('loading', 'eager');
      img.decoding = 'async';
    });

    // Hint for CSS backgrounds (optional)
    document.body.style.setProperty('--bb-room', BG_HINT[state.man] || 'room');
  }

  /* ---------- Fallback phrase engine (uses phrases.js if available) ---------- */
  function chooseReply(userText) {
    // If project ships a phrases.js global (BBPHRASES), prefer that
    try {
      if (window.BBPHRASES && window.BBPHRASES[state.man]) {
        const arr = window.BBPHRASES[state.man];
        return arr[(state.seed++) % arr.length] || 'Tell me more.';
      }
    } catch {}

    // Minimal built-in flavor if phrases.js isn’t present
    const bank = {
      blade: [
        'Close the door and tell me what you need.',
        'I hear you. I move when you nod.',
        'You came to be caught—run if you like; I always find you.',
      ],
      alexander: [
        'Come here, love. I’ll take my time.',
        'Yield with pride and I’ll worship you properly.',
        'Velvet first, steel later.',
      ],
      dylan: [
        'There you are. Helmet’s off—eyes on you.',
        'Night’s ours. Say the word and hold tight.',
        'I like fast. Faster if you ask nicely.',
      ],
      viper: [
        'There you are.',
        'Strong arms, soft voice—what are you hungry for?',
        'Look at me and breathe. I’ll do the rest.',
      ],
      grayson: [
        'You clean up trouble beautifully.',
        'Tell me what’s burning and I’ll pour the good stuff.',
        'I’m patient—until you ask me not to be.',
      ],
      silas: [
        'Hey luv—front row or backstage?',
        'Play me a want and I’ll riff you an answer.',
        'C’mere, let me tune you properly.',
      ],
    };

    const list = bank[state.man] || ['Tell me more.'];
    return list[(state.seed++) % list.length];
  }

  async function reply(userText) {
    // Typing indicator
    const typing = addBubble('man', '', { typing: true });

    // (Optional) If you later wire an API, do it here.
    // For now we use a small delay + local phrase.
    const delay = jitterDelay(1100, 2100);
    await new Promise((r) => setTimeout(r, delay));

    const text = chooseReply(userText);
    swapTypingToText(typing, text);
  }

  /* ---------- Greetings ---------- */
function greet() {
  const greets = {
    blade:     ['there you are.', 'evening.', 'good girl—say what you want.'],
    alexander: ['come here, love.', 'morning, gorgeous.', 'there you are.'],
    dylan:     ['hey you.', 'helmet’s off—eyes on you.', 'miss me?'],
    viper:     ['there you are.', 'hey.', 'morning, gorgeous.'],
    grayson:   ['good to see you.', 'you again—lucky me.', 'trouble?'],
    silas:     ['hey luv.', 'backstage or front row, yeah?', 'c’mere.'],
  };
  const choices = greets[state.man] || ['hey.'];
  const line = choices[Math.floor(Math.random() * choices.length)];

  const typing = addBubble('man', '', { typing: true });
  setTimeout(() => swapTypingToText(typing, line), jitterDelay(800, 1400));
}

  /* ---------- Wire send box (robust Enter + button) ---------- */
function findComposerEl() {
  return (
    $('#composer') ||
    $('#message') ||
    $('.composer input') ||
    $('.composer textarea') ||
    $('.chat-input input') ||
    $('.chat-input textarea') ||
    $('textarea[placeholder]') ||
    $('input[placeholder]') ||
    $('[contenteditable="true"]')
  );
}

function readComposerText(el) {
  if (!el) return '';
  if (el.matches('[contenteditable="true"]')) return (el.textContent || '').trim();
  return (el.value || '').trim();
}

function clearComposer(el) {
  if (!el) return;
  if (el.matches('[contenteditable="true"]')) el.textContent = '';
  else el.value = '';
}

function wireComposer() {
  const button =
    $('#sendBtn') ||
    $('button[type="submit"]') ||
    $('button.send') ||
    $('button:has(> .send)');

  function send() {
    const el = findComposerEl();
    const val = readComposerText(el);
    if (!val) return;
    addBubble('you', val);
    clearComposer(el);
    reply(val);
  }

  // Enter (no Shift) inside any input/textarea/contenteditable
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.shiftKey) return;
    const el = document.activeElement;
    if (!el) return;
    if (el.matches('input, textarea, [contenteditable="true"]')) {
      if (el.id === 'composer' || el.closest('.composer, .chat-input, .input-row, form')) {
        e.preventDefault();
        send();
      }
    }
  });

  // Click on the visible Send button
  if (button) {
    button.addEventListener('click', (e) => {
      e.preventDefault?.();
      send();
    });
  }
}

    /* ---------- Plan badge / Main button / RED badge toggle ---------- */
  function wireHeaderBadges() {
    const plan = localStorage.getItem('bb_plan') || 'trial';
    const planBadge = $('#planBadge');
    if (planBadge) {
      planBadge.textContent =
        plan === 'monthly' ? 'Monthly' : plan === 'day' ? 'Day Pass' : 'Trial';
    }

    // Only show “Main” button when on monthly plan (if your markup has one)
    const mainBtn = $('.mainBtn');
    if (mainBtn) {
      mainBtn.classList.toggle('hidden', plan !== 'monthly');
    }

    // Hide RED unless you explicitly choose to show it
    const red = $('#redBadge');
    if (red) red.classList.add('hidden');
  }

  /* ---------- Boot ---------- */
  function boot() {
    applySkin();
    wireComposer();
    wireHeaderBadges();
    greet();
    scrollToEnd();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
