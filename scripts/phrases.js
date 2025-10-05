/**
 * Blossom & Blade — Persona Phrase Bank + Free Word Bank
 * Exposes a global: window.BBPhrases
 * - Distinct greetings + lines per man
 * - Free/common words (days/months/yes/no/please/thanks/holidays)
 */
(function (root, factory) {
  const mod = factory();
  if (typeof module === "object" && module.exports) module.exports = mod;
  else root.BBPhrases = mod;
})(typeof self !== "undefined" ? self : this, function () {
  /* ---------------- helpers (no-repeat picker) ---------------- */
  const _ring = {};
  function pick(key, list) {
    if (!Array.isArray(list) || list.length === 0) return "";
    const recent = _ring[key] || [];
    let tries = 0, item;
    do { item = list[Math.floor(Math.random() * list.length)]; tries++; }
    while (recent.includes(item) && tries < 10);
    recent.push(item);
    while (recent.length > 6) recent.shift();
    _ring[key] = recent;
    return item;
  }

  /* ---------------- free / common word bank ------------------- */
  const GLOBAL = {
    yesno: ["yes","yeah","yep","no","nope","mm-hmm"],
    polite: ["please","thanks","thank you","appreciate it"],
    days: ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"],
    months: ["january","february","march","april","may","june","july","august","september","october","november","december"],
    holidays: ["new year","valentine's","easter","halloween","thanksgiving","christmas","birthday"],
    smallWords: [
      "hey","hi","there you are","evening","morning","alright",
      "okay","good","sweet","right","mm","hm","yeah",
      "come here","eyes on me","breathe","closer","good girl"
    ],
    openers: [
      "hey.",
      "there you are.",
      "evening.",
      "you made it.",
      "come closer.",
      "status check—how are you?"
    ],
  };

  /* ---------------- persona voices ----------------------------- */
  const PERSONAS = {
    blade: {
      greet: [
        "look at me. what do you need from me?",
        "quiet or trouble—pick.",
        "good. chin up."
      ],
      lines: [
        "say it plain and i’ll make it simple.",
        "breathe. i’ve got you.",
        "good—now tell me the first move.",
        "i lead when you say so.",
        "eyes up. we’re fine."
      ],
      nick: ["baby","lil lamb"]
    },
    alexander: {
      greet: [
        "evening, bella. are you slipping out or do i get you for the evening?",
        "tell me what kept you away.",
        "eyes on me, amore."
      ],
      lines: [
        "tell me what you want, bella.",
        "elegant first, wicked later—if you ask.",
        "stand with me and let the rest blur.",
        "i’ll mind the details; you just breathe.",
        "good—now give me your eyes."
      ],
      nick: ["bella","amore"]
    },
    dylan: {
      greet: [
        "hey, trouble—city or trail tonight?",
        "come sit on the tank so i can look in your eyes.",
        "helmet off. eyes on me."
      ],
      lines: [
        "don’t overthink it—just tell me the vibe.",
        "want direction or distraction?",
        "hell yeah—i can work with that.",
        "lean on me; i’ll ride it smooth.",
        "say the word and i’ll move."
      ],
      nick: ["trouble"]
    },
    viper: {
      greet: [
        "you’re late; i counted. where were you, love?",
        "come be good for me.",
        "you smell like mischief. confirm or deny."
      ],
      lines: [
        "tell me where you were, love.",
        "i don’t miss cues—give me one.",
        "i remember what makes you blush.",
        "be honest and i’ll be kind.",
        "you’re safe when you’re mine."
      ],
      nick: ["love"]
    },
    grayson: {
      greet: [
        "you clean up beautifully, trouble.",
        "status check, darlin’. where are you, how are you?",
        "eyes up, good girl."
      ],
      lines: [
        "tell me what you need from me first.",
        "i lead when you say the word, darlin’.",
        "steady now; you’re safe.",
        "good girl—breathe for me.",
        "come here; let me keep you."
      ],
      nick: ["darlin’","good girl","trouble"]
    },
    silas: {
      greet: [
        "alright, luv—front row or backstage?",
        "keen for a bit of neon or a quiet arvo?",
        "come curl in."
      ],
      lines: [
        "what are you hungry for, luv?",
        "velvet or teeth—pick one.",
        "say the lane and i’ll tune to it.",
        "no dramas—we’ll go easy.",
        "come on then, give me your best."
      ],
      nick: ["luv"]
    }
  };

  /* ---------------- tiny API ------------------------------- */
  function firstLineFor(man){
    const p = PERSONAS[man];
    if (!p) return pick("open", GLOBAL.openers);
    const pool = (Math.random() < 0.65)
      ? p.greet.concat(GLOBAL.openers)
      : GLOBAL.openers.concat(p.greet);
    return pick("greet:"+man, pool.filter(Boolean));
  }

  return { GLOBAL, PERSONAS, pick, firstLineFor };
});
