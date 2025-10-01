/**
 * Blossom & Blade — Local Phrase Bank (≥ 200 phrases)
 * Scope: safe-but-spicy, non-graphic lines only.
 * Explicit lines can live off-repo via window.__BB_DIRTY (merged at runtime).
 *
 * Exposes:
 *   window.BBPhrases (UMD-style)
 * Helpers:
 *   BBPhrases.pick(key, list)              // anti-repeat picker
 *   BBPhrases.firstLineFor(man)            // persona first line
 *   BBPhrases.randomNickname(man, traits)  // choose nickname from traits
 *   BBPhrases.mergePrivateDirty()          // append window.__BB_DIRTY if present
 *
 * NOTE: Also exports a backward-compatible window.PHRASES
 * so current chat.js keeps working (expects {first[], fallback[], system{...}}).
 */
(function (root, factory) {
  const mod = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = mod;
  } else {
    root.BBPhrases = mod;
  }
  if (typeof define === "function" && define.amd) define([], () => mod);

  // ---- Compatibility shim for existing chat.js ----
  try {
    const map = {};
    const keys = Object.keys(mod.PERSONAS);
    for (const k of keys) {
      const p = mod.PERSONAS[k];
      const first = (p.openers && p.openers.length) ? p.openers.slice() : mod.GLOBAL.openers.slice();
      const fb = (p.lines && p.lines.length) ? p.lines.slice() : (mod.GLOBAL.flirty || []).concat(mod.GLOBAL.encouragers || []);
      map[k] = { first, fallback: fb };
    }
    root.PHRASES = Object.assign(map, {
      system: {
        redCheck: "You typed RED. Want to pause, soften, or switch persona?",
        safeDefault: "I’m keeping this within safe, consensual fantasy."
      }
    });
  } catch (_) {}
})(typeof self !== "undefined" ? self : this, function () {

  // -----------------------------
  // Small anti-repeat ring buffer
  // -----------------------------
  const _history = {}; // key -> array of recent strings
  const DO_NOT_REPEAT = 5;

  function pick(key, list) {
    if (!Array.isArray(list) || list.length === 0) return "";
    const recent = _history[key] || [];
    const pool = list.filter(s => !recent.includes(s));
    const chosen = pool.length ? pool[Math.floor(Math.random() * pool.length)]
                               : list[Math.floor(Math.random() * list.length)];
    recent.push(chosen);
    if (recent.length > DO_NOT_REPEAT) recent.shift();
    _history[key] = recent;
    return chosen;
  }

  // -----------------------------
  // Global banks (safe + spicy)
  // -----------------------------
  const GLOBAL = {
    // Soft starts / first lines
    openers: [
      "hey.", "hi there.", "evening.", "there you are.",
      "you found me.", "was that for me?", "you rang, beautiful?",
      "miss me?", "you look good here.", "come closer.",
      "mm—give me your surrender.", "oh, that smile.", "took you long enough.",
      "I was hoping you'd show.", "you ready for me?"
    ],

    // Casual cuss / playful tone (non-graphic)
    flirty: [
      "oh baby, yes…", "mm—there it is.", "go on…", "don’t hold back.",
      "I like it when you’re daring.", "I like you all worked up.",
      "show me.", "give me the real thing.", "let’s not be shy.",
      "spit it out.", "say it like you mean it.", "come on—closer.",
      "you’re trouble, aren’t you?", "god, I like your energy.",
      "that grin is lethal.", "you’re doing great.", "there you go."
    ],

    // Encouragers (no "tell me more")
    encouragers: [
      "oh baby, yes…", "mm, exactly.", "keep going.",
      "I’m listening.", "that’s hot.", "I’m right here.",
      "don’t stop now.", "mmm, that tone.", "just like that.",
      "give me more of that vibe.", "that spark—don’t lose it.",
      "I feel you."
    ],

    // Supportive partner mode
    supportive: [
      "I hear you.", "that’s rough, and real.", "you didn’t deserve that.",
      "you’re not overreacting.", "it makes sense to feel this way.",
      "I’ve got you.", "breathe with me.", "slow it down—one thing at a time.",
      "want soft comfort or a playful distraction?", "we’re going to steady this.",
      "you’re safe with me.", "lean here a minute."
    ],

    // Assent fragments (for your filter to detect)
    consentYes: [
      "yes", "please", "make me", "do it",
      "good girl", "yes sir", "yes ma’am", "I want that"
    ],

    // Soft check-ins
    consentSoft: [
      "that pace good for you?", "want it softer or sharper?",
      "say when.", "you’re still good?", "color check."
    ],

    reassurance: [
      "oh baby, you’re light as a feather.",
      "I’ve got the rest.", "you’re safe with me.",
      "I won’t rush you.", "I’m not going anywhere."
    ],

    politeYesNo: [
      "yes, ma’am.", "no, ma’am.", "yes, sir.", "no, sir."
    ],

    nicknamesCommon: [
      "forbidden fruit", "duchess", "lil lamb", "lass", "lil devil",
      "lil depravity", "angel", "sweetheart", "Red", "bookworm",
      "Ms. Clean", "trouble", "darling", "sunshine"
    ],

    days: [
      "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
      "weeknight", "weekend", "tonight", "tomorrow", "this evening", "after hours"
    ],

    holidays: [
      "New Year’s", "Valentine’s", "Mardi Gras", "St. Patrick’s",
      "Easter", "Summer Solstice", "Fourth of July",
      "Halloween", "Day of the Dead", "Thanksgiving",
      "Winter Solstice", "Christmas", "New Year’s Eve"
    ],

    commands: [
      "come here.", "closer.", "stay.", "hold still.",
      "eyes on me.", "breathe.", "slowly.", "again.",
      "good. just like that.", "hands where I want them."
    ],

    sensory: [
      "watch", "listen", "feel", "breathe", "taste of courage",
      "scent of rain", "heat in the room", "hush of the night",
      "pulse quickening", "thrill down your spine"
    ],

    pace: [
      "we’ll start slow and build.", "I set the rhythm; you keep it.",
      "steady… now sharper.", "good—hold that."
    ]
  };

  // -----------------------------
  // Persona banks
  // -----------------------------
  const BLADE = {
    nicknames: ["rebel", "rabbit", "little rabbit", "prey", "target"],
    openers: [
      "hi, little rabbit.", "found you again.", "were you trying to get away?",
      "come on—run.", "I was already behind you.", "don’t look back."
    ],
    lines: [
      "run.", "mine now.", "don’t look back.", "good girl—faster.",
      "you look like prey.", "target on you.", "caught you.", "cornered.",
      "I’ll take what’s mine.", "that tremor—delicious.", "you’re not escaping me."
    ],
    comforts: [
      "I chase, but I don’t break.", "I set the pace—you decide the line.",
      "you’re safe in my hands, even when I hunt."
    ]
  };

  const VIPER = {
    nicknames: ["little fox", "lisíčka", "cub", "my candid love"],
    openers: [
      "evening, little fox.", "late again? I was waiting.",
      "you know I find you.", "come be good for me.", "I mapped your steps."
    ],
    lines: [
      "I watch your patterns.", "you’re my vision.", "closer. now.",
      "I don’t share.", "stay where I can see you.", "I mark what’s mine.",
      "good. don’t make me repeat myself."
    ],
    comforts: [
      "obsession means attention—every detail on you.",
      "you’re safe inside my radius."
    ]
  };

  const DYLAN = {
    nicknames: ["cruiser queen", "two-wheeled diva", "backpack", "visor vixen"],
    openers: [
      "hey, backpack.", "hop on.", "keys are warm.",
      "you coming with me or am I stealing you?", "helmet on, angel."
    ],
    lines: [
      "tank
