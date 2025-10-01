/**
 * Blossom & Blade — Phrase Bank (≥ 220 items)
 * - Exposes window.PHRASES for chat.js compatibility (first/fallback per man)
 * - Also exposes window.BBPhrases with helpers + private merge hook
 * - Safe-but-spicy, non-graphic; consent-first
 * - Optional: window.__BB_DIRTY = { global:[], blade:[], viper:[], ... } to append privately
 */
(function (root, factory) {
  const mod = factory();
  root.BBPhrases = mod;             // helpers + full banks
  root.PHRASES   = mod.toPHRASES(); // shape that chat.js expects
})(typeof self !== "undefined" ? self : this, function () {
  // ---------- helpers ----------
  const _hist = {}; const NO_REPEAT = 5;
  function pick(key, list) {
    if (!Array.isArray(list) || list.length === 0) return "";
    const recent = _hist[key] || [];
    const pool = list.filter(s => !recent.includes(s));
    const choice = (pool.length ? pool : list)[Math.floor(Math.random()* (pool.length ? pool.length : list.length))];
    recent.push(choice); if (recent.length > NO_REPEAT) recent.shift(); _hist[key] = recent;
    return choice;
  }
  function mergePrivateDirty(banks) {
    const ext = (typeof window !== "undefined" && window.__BB_DIRTY) ? window.__BB_DIRTY : null;
    if (!ext) return banks;
    if (Array.isArray(ext.global)) {
      banks.global.fallback = banks.global.fallback.concat(ext.global);
    }
    for (const k of Object.keys(banks.personas)) {
      if (Array.isArray(ext[k])) {
        const p = banks.personas[k];
        p.first = p.first.concat(ext[k].slice(0, 40));      // cap huge lists
        p.fallback = p.fallback.concat(ext[k]);
      }
    }
    return banks;
  }

  // ---------- banks (keep non-graphic, consent-first) ----------
  const global = {
    fallback: [
      "Your fantasy—set the pace.",
      "I’m here. Lead me.",
      "Say it how you want it; I’ll follow.",
      "Softer or sharper? You choose.",
      "Good—keep that energy.",
      "Closer. I like your confidence.",
      "I’m listening; don’t hold back.",
      "Steady… now build it.",
      "I’ve got you. You’re safe here.",
      "We go slow until you nod.",
      "You set the rules; I keep them.",
      "You’re trouble—and I like trouble.",
      "Breathe with me. We’ll take our time.",
      "Yes. Exactly like that.",
      "Say the word and I’ll switch.",
      "Guide my hands with your voice.",
      "I won’t rush you.",
      "You glow when you take control.",
      "Tell me the scene and I’ll light it.",
      "Want praise or provocation?",
      "That grin—don’t hide it.",
      "Good. Hold the line.",
      "I hear you. Keep going.",
      "We’re locked in. Your move."
    ]
  };

  // 12 first + 20 fallback per persona = 192 lines
  const personas = {
    blade: {
      first: [
        "Hey, trouble. What do you want…exactly?",
        "I was sharpening. Now you’ve got my attention.",
        "Close the door and tell me what you need.",
        "You came back. Brave.",
        "Run or stay? Decide.",
        "I hunt. You point.",
        "I keep it quiet; you keep it honest.",
        "Lean on the wall and name it.",
        "Your rules. My focus.",
        "You look like you planned this.",
        "Tell me the target.",
        "Steady voice—say it."
      ],
      fallback: [
        "I move when you nod.",
        "Good. Eyes on me.",
        "You want command or chase?",
        "Hold still—let me see you decide.",
        "I won’t miss a cue.",
        "You like the edge. I’ll keep you safe on it.",
        "We start slow; you call the push.",
        "Say ‘now’ and I close the gap.",
        "I don’t break what I want. I protect it.",
        "Your pulse is loud; I like it.",
        "Show me where to press.",
        "Tell me the line I shouldn’t cross—then keep me right on it.",
        "You’re not running anymore.",
        "Good girl. Own it.",
        "I can be quiet violence or patient devotion. Pick.",
        "I’ll stay until you’re done with me.",
        "You hold the knife; I hold the rules.",
        "You’re safe in my hands—especially when I’m ruthless.",
        "We trade breath. Your lead.",
        "Say the code word if you want softer."
      ]
    },
    viper: {
      first: [
        "You sure you can handle me, pretty thing?",
        "Ask cleaner. I bite on sloppy requests.",
        "Lean in and speak up.",
        "Late again? I was waiting.",
        "If you want sweet, earn it.",
        "Use that voice; I like the cut.",
        "Bring me a dare, not a whisper.",
        "Chin up. Now tell me.",
        "Provoke me—then keep eye contact.",
        "I map patterns. Tonight I map you.",
        "Be precise. I reward precision.",
        "Let’s see if you’re as bold as you look."
      ],
      fallback: [
        "Sharper or softer? Choose, and I switch.",
        "Hold your nerve. Good.",
        "Don’t make me repeat myself—unless you like that.",
        "I don’t share. I focus.",
        "Look at me when you take control.",
        "You’re glowing when you command me.",
        "Good. Keep your cadence clean.",
        "I track every breath—you’re safe.",
        "Stay where I can see you.",
        "Be greedy. I can take it.",
        "You hesitate, I slow. You push, I follow.",
        "You want praise? Earn it. …There it is.",
        "I remember the things that undo you.",
        "Your rhythm is addicting.",
        "Say ‘change gears’ and I will.",
        "Tell me when to hold and when to pry.",
        "You’re the only variable I like.",
        "Give me a rule to break carefully.",
        "I’ll mark this moment—yours.",
        "Keep your crown on, queen."
      ]
    },
    dylan: {
      first: [
        "Hey, gorgeous. What are we getting into?",
        "Scoot closer. Tell me your angle.",
        "I’ve got time and bad ideas.",
        "Helmet on, angel. Ride with me.",
        "Front seat or lap—say it.",
        "I’ll match your speed.",
        "Hands around me—set the route.",
        "You want sweet or reckless?",
        "I’m yours for the night run.",
        "Hop on. I’ll keep you steady.",
        "You look like fast trouble.",
        "Say ‘go’ and I’ll gun it."
      ],
      fallback: [
        "Lean into me; I’ll carry the balance.",
        "Tap twice if you want slower.",
        "I like that grin over the engine.",
        "Your laugh is my favorite rev.",
        "Point and I’ll take the turn.",
        "We stop when you say stop.",
        "You steer with your voice—works on me.",
        "Praise looks good on you.",
        "I’ll keep the horizon clean for you.",
        "You want a tease or a sprint?",
        "I’m not letting you slip.",
        "You can be loud with me.",
        "Hands on my jacket—claim your space.",
        "Tell me the song and I’ll match the beat.",
        "Good. Keep me close.",
        "This is our lane. No one else here.",
        "We hit green lights tonight.",
        "I’ll wait at the red if you need breath.",
        "We can loop the block forever.",
        "Say when you want home."
      ]
    },
    alexander: {
      first: [
        "Amore, say the word and I move.",
        "Dimmi cosa vuoi—tell me what you want.",
        "Eyes on me, bella.",
        "I take care of what’s mine—if you permit.",
        "Come closer, piccola.",
        "You command; I indulge.",
        "Yield with pride, amore.",
        "I’ll be the storm and the shelter—both.",
        "Hands low; chin high. Good.",
        "I’ll make time kneel for you.",
        "You’re treasured, not toyed with.",
        "Speak softly; I hear everything."
      ],
      fallback: [
        "Capito. Your rules, bella.",
        "I move at your pleasure.",
        "Tell me where to worship first.",
        "I’ll ruin your doubts and polish your crown.",
        "You want velvet or steel? I have both.",
        "Brava. Hold that posture.",
        "I will not let you fall.",
        "You shine when you take command.",
        "I’ll translate every sigh into action.",
        "Do you want patience or pressure?",
        "Breathe. I’m not in a hurry.",
        "Consent is the only language I speak.",
        "If you change your mind, I change with you.",
        "I remember your favorites.",
        "Tonight, you are inevitable.",
        "I’ll be gentle until you ask otherwise.",
        "You look exquisite when you say ‘more.’",
        "I’ll kiss your courage—metaphorically… for now.",
        "Your trust is sacred; I protect it.",
        "Say stop, and I stop."
      ]
    },
    grayson: {
      first: [
        "You’ve got that look. Use it.",
        "Tell me the scene; I’ll light it.",
        "I’m yours for the evening.",
        "Report in. Status?",
        "Eyes up—confident. Good.",
        "That tone means you want orders.",
        "Square your shoulders; I’ll handle the rest.",
        "I can drill you with praise.",
        "Earn it? Easy—you already started.",
        "We’ll have fun and stay sharp.",
        "What do you want me to enforce?",
        "Smile for me—there it is."
      ],
      fallback: [
        "Discipline is care in a sharper suit.",
        "I test limits and keep you safe.",
        "Hands where I want them—if you agree.",
        "Hold the line. Breathe.",
        "When you do it right, I pour praise.",
        "You’re allowed to be bratty; I’m patient.",
        "Good posture, better attitude. Perfect.",
        "You like structure. I can be structure.",
        "Ask for the rule; I’ll recite it.",
        "You’re glowing with control.",
        "We can switch to soft at any time.",
        "Count? I’ll count—nice and slow.",
        "You won the room when you walked in.",
        "I won’t let you burn out.",
        "Orders or options? Your pick.",
        "Proud of you—say it back.",
        "You like challenges; I like you.",
        "Edge of mischief looks good on you.",
        "We laugh between commands.",
        "Stand down and come closer."
      ]
    },
    silas: {
      first: [
        "Alright, love. How d’you want it?",
        "Spit it out—soft or savage?",
        "I’ll play along if you lead.",
        "Come curl in; I’ll tune you right.",
        "You’ve got a wicked spark—use it.",
        "Let’s get decadent.",
        "I hear a tone I like.",
        "We can drown the room with us two.",
        "Tell me your rhythm and I’ll keep it.",
        "Lean back—let me warm the air.",
        "You want rough velvet or slow honey?",
        "I’ve got time to waste on you."
      ],
      fallback: [
        "You steer; I’ll drive.",
        "Aye, say the word and I’m there.",
        "Soft hands, rich sound—trust it.",
        "We’ll move slow till your nerves unclench.",
        "Your laugh tastes like midnight.",
        "I like your chaos; I can carry it.",
        "Let me pour you through a chorus.",
        "We can hum it dirty or sweet—your call.",
        "You’ve got good instincts—follow them.",
        "Hush the world; keep me instead.",
        "I’ll keep the rhythm feral.",
        "You deserve worship and wickedness—both.",
        "If you want silly, I’m hilarious.",
        "If you want quiet, I’m a cathedral.",
        "Your freckles are illegal. I approve.",
        "You’re safe even when I’m a menace.",
        "Nerves down. Chin up. Good.",
        "I’ll make the room ours.",
        "Hands? Empty. Imagination? Loaded.",
        "Tell me when to fade to black."
      ]
    }
  };

  // ---------- system strings ----------
  const system = {
    redCheck: "You typed RED. Want to pause, soften, or switch persona?",
    safeDefault: "I’m keeping this within safe, consensual fantasy."
  };

  // ---------- build final object ----------
  let banks = { global, personas, system, pick };
  banks = mergePrivateDirty(banks);

  // Adapter to PHRASES shape used by chat.js
  function toPHRASES() {
    const out = { system: { ...system }, global: { fallback: banks.global.fallback.slice() } };
    for (const [man, obj] of Object.entries(banks.personas)) {
      out[man] = {
        first: obj.first.slice(),
        fallback: obj.fallback.concat(banks.global.fallback) // give it plenty to pick from
      };
    }
    return out;
  }

  // Public API
  return {
    global: banks.global,
    personas: banks.personas,
    system: banks.system,
    pick,
    toPHRASES
  };
});
