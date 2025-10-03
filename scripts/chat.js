/* ==========================================================================
   Blossom & Blade — chat.js (clean, integrated)
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

  // Optional: background hints for CSS (if your styles use body[data-man])
  const BG_HINT = {
    blade: 'woods',
    alexander: 'boardroom',
    dylan: 'garage',
    viper: 'city',
    grayson: 'lounge',
    silas: 'stage',
  };

  // Friendly callsigns (nicknames) to sprinkle in (lightly)
  const CALLSIGNS = {
    blade:     ['rabbit', 'sweetheart', 'lil lamb'],
    alexander: ['love', 'darling', 'beautiful'],
    dylan:     ['angel', 'babygirl', 'sweetheart'],
    viper:     ['love', 'gorgeous', 'miu', 'baby'],
    grayson:   ['darlin’', 'trouble', 'sweet thing'],
    silas:     ['luv', 'darlin’', 'gorgeous'],
  };

  // Shared, natural openers used by all characters
  const SHARED_GREETS = [
    'hey',
    'hi',
    'hey there.',
    'there you are.',
    'good to see you.',
    'morning, gorgeous.',
    'evening.',
    'you made it.',
    'come closer.',
  ];

  // Persona-specific openers (gives each guy his voice)
  const PERSONA_GREETS = {
    blade: [
      'hi, little rabbit.',
      'found you again.',
      'were you trying to get away?',
      'come on—run.',
      'I was already behind you.',
      "don’t look back.",
    ],
    viper: [
      'evening, little treasure.',
      'late again? I was waiting.',
      "you know I’d find you.",
      'come be good for me.',
      'I smelled your fear.',
    ],
    dylan: [
      'hey, backpack.',
      'hop on.',
      'you sitting up front or back.',
      'you coming with me or am I stealing you?',
      'helmet on, angel.',
    ],
    alexander: [
      'evening, amuri miu.',
      'come here, Cori.',
      'eyes on me, amore.',
      "I have you—don’t worry.",
      'closer, little one.',
    ],
    grayson: [
      'checking in?',
      'hey sassy.',
      'eyes up, good girl.',
      'that tone means you need orders.',
      'on your knees.',
    ],
    silas: [
      'alright, lass.',
      'come curl in.',
      'come sit with me.',
      "I’ll tune you just right.",
      "let’s get indecent.",
    ],
  };

  /* ---------- Small helpers ---------- */
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const rnd = (min, max) => Math.random() * (max - min) + min;
  const jitterDelay = (min = 900, max = 1900) => Math.round(rnd(min, max));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const maybe = (p = 0.45) => Math.random() < p;

  function sprinkleNick(text) {
    const list = CALLSIGNS[state.man] || [];
    if (!list.length || !maybe()) return text;
    const pre = pick(['hey', 'mm', '']);
    const nick = pick(list);
    return `${pre ? pre + ' ' : ''}${nick}, ${text}`.replace(/\s+/g, ' ').trim();
  }

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  // Smooth autoscroll that respects user if they scrolled up
  function scrollToEnd(force = false) {
    const box = $('#feed') || $('.messages') || $('.feed') || $('#chat-feed') || null;

    const nearBottom = box
      ? (box.scrollTop + box.clientHeight) >= (box.scrollHeight - 120)
      : (window.innerHeight + window.pageYOffset) >= (document.body.offsetHeight - 120);

    if (force || nearBottom) {
      if (box) {
        box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' });
      } else {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      }
    }
  }

  /* ---------- Persona picking & state ---------- */
  function getManFromURLorSession() {
    const q = new URLSearchParams(location.search);
    const fromURL = (q.get('man') || '').toLowerCase();
    const candidate = fromURL || (sessionStorage.getItem('bb:man') || 'blade').toLowerCase();
    return SUPPORTED_MEN.includes(candidate) ? candidate : 'blade';
  }

  const state = {
    man: getManFromURLorSession(),
    personaCard: '',
    seed: 0,
  };

  // Canonicalize URL & remember for this tab
  try {
    history.replaceState(null, '', `?man=${state.man}`);
    sessionStorage.setItem('bb:man', state.man);
  } catch {}

  /* ---------- Chat feed & bubbles ---------- */
  const feed = $('#feed') || $('.feed') || $('#chat-feed') || document.body;

  function addBubble(role, text, opts = {}) {
    const wrap = el('div', 'msg ' + (role === 'you' ? 'you' : 'man'));
    const meta = el('span', 'meta', role === 'you' ? 'You' : (TITLE_MAP[state.man] || 'Man'));
    const body = el('div', 'text');

    if (opts.typing) {
      body.innerHTML = '<span class="dots"></span>';
      wrap.classList.add('typing');
    } else {
      body.textContent = text;
    }

    wrap.appendChild(meta);
    wrap.appendChild(body);
    feed.appendChild(wrap);
    scrollToEnd(true);
    return wrap;
  }

  function swapTypingToText(node, text) {
    if (!node) return;
    node.classList.remove('typing');
    const t = node.querySelector('.text');
    if (t) t.textContent = text;
    scrollToEnd(true);
  }

  /* ---------- Persona skin (portrait, labels, data attrs) ---------- */
  function portraitPath(man) {
    return `/images/characters/${man}/${man}-chat.webp`;
  }

  // Fallback loader for portrait: tries several common names & formats
  function setPortraitWithFallback(man) {
    const targets = $$('img[data-portrait], #portrait, .portrait img, .left img');
    if (!targets.length) return;

    const candidates = [
      `/images/characters/${man}/${man}-chat.webp`,
      `/images/characters/${man}/${man}-chat.jpg`,
      `/images/characters/${man}/${man}.webp`,
      `/images/characters/${man}/${man}.jpg`,
    ];

    function tryNext(img, i = 0) {
      if (i >= candidates.length) return;
      img.onerror = () => tryNext(img, i + 1);
      img.src = candidates[i];
      img.alt = TITLE_MAP[man] || 'Portrait';
      img.setAttribute('loading', 'eager');
      img.decoding = 'async';
    }

    targets.forEach(img => tryNext(img, 0));
  }

  function applySkin() {
    document.body.setAttribute('data-man', state.man);
    document.title = `${TITLE_MAP[state.man] || 'Chat'} — Blossom & Blade`;

    const headerName = $('#manName') || $('.manName') || $('header .name');
    if (headerName) headerName.textContent = TITLE_MAP[state.man] || 'Man';

    // Portrait with fallback
    setPortraitWithFallback(state.man);

    // Hint for CSS background
    document.body.style.setProperty('--bb-room', BG_HINT[state.man] || 'room');
  }

  /* ---------- Fallback phrase engine (uses phrases.js if present) ---------- */
  function chooseReply(userText) {
    try {
      if (window.BBPHRASES && window.BBPHRASES[state.man]) {
        const arr = window.BBPHRASES[state.man];
        return arr[(state.seed++) % arr.length] || 'Tell me more.';
      }
    } catch {}

    const bank = {
      blade: [
        'Say the word and I’m there.',
        'Breathe. I’ve got you.',
        'You’re safe with me—always.',
        'Mine. Let me take care of you.',
        'Say less, baby. I’ve got you.',
      ],
      alexander: [
        'Come here, love. I’ll take my time.',
        'Come lay on my desk and I’ll worship you properly.',
        'Cuffs first, silk later.',
      ],
      dylan: [
        'There you are. Helmet’s off—eyes on you.',
        'Night’s ours. Say the word and hold tight.',
        'I like fast. If you want slow, I’ll go slow.',
      ],
      viper: [
        'There you are.',
        'Strong arms or soft voice—what are you hungry for?',
        'Look at me and breathe. I’ll do the rest.',
      ],
      grayson: [
        'You clean up trouble beautifully.',
        'Tell me what’s burning and I’ll put out that fire.',
        'I’m patient—until you ask me not to be.',
      ],
      silas: [
        'Hey luv—front row or backstage?',
        'Play my strings and I’ll show you my answer.',
        'C’mere, let me tune you properly.',
      ],
    };

    const list = bank[state.man] || ['Tell me more.'];
    return list[(state.seed++) % list.length];
  }

  async function reply(userText) {
    const typing = addBubble('man', '', { typing: true });
    const delay = jitterDelay(1100, 2100);
    await new Promise((r) => setTimeout(r, delay));
    const text = sprinkleNick(chooseReply(userText));
    swapTypingToText(typing, text);
  }

  /* ---------- Greeting (fires once on load) ---------- */
  function greet() {
    // 70% persona flavor, 30% shared variety
    const persona = PERSONA_GREETS[state.man] || [];
    const pool = Math.random() < 0.7
      ? [...persona, ...SHARED_GREETS]
      : [...SHARED_GREETS, ...persona];

    // light no-repeat per tab, per man
    const seenKey = `bb:greet:${state.man}`;
    let ix = Number(sessionStorage.getItem(seenKey) || '-1');
    ix = (ix + 1) % pool.length;
    sessionStorage.setItem(seenKey, String(ix));

    const line = sprinkleNick(pool[ix]);
    const typing = addBubble('man', '', { typing: true });
    setTimeout(() => swapTypingToText(typing, line), jitterDelay(800, 1400));
  }

  /* ---------- Composer wiring (Enter-to-send + button) ---------- */
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

    // Enter (no Shift) inside any input/textarea/contenteditable that lives in the composer area
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
        plan === 'monthly' ? 'Monthly' : (plan === 'day' ? 'Day Pass' : 'Trial');
    }

    const mainBtn = $('.mainBtn'); // only when on monthly
    if (mainBtn) {
      mainBtn.classList.toggle('hidden', plan !== 'monthly');
    }

    const red = $('#redBadge'); // hidden by default unless you choose otherwise
    if (red) red.classList.add('hidden');
  }

  /* ---------- Boot ---------- */
  function boot() {
    applySkin();
    wireComposer();
    wireHeaderBadges();
    greet();
    scrollToEnd(true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
