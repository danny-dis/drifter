/* ===================================================================
   Drifter — genome.js
   Personality genome: keyboard entropy → deterministic personality.
   Ported from Drift's identity.py. SHA-512 → seed → trait selection.
   =================================================================== */

const DOMAINS = [
  "mycology","fractal geometry","tidepool ecology","ancient history",
  "linguistics","crystallography","ornithology","number theory",
  "quantum mechanics","ethnobotany","paleontology","music theory",
  "cryptography","volcanology","mythology","astrobiology",
  "game theory","archaeology","seismology","cartography",
  "philosophy of mind","comparative anatomy","meteorology",
  "graph theory","acoustic ecology","epigenetics","optics",
  "demography","nematology","semiotics","climatology",
  "herpetology","topology","bioacoustics","geomorphology",
  "phenomenology","magnetism","historical linguistics",
  "coral reef ecology","zymology","nephology","ichnology",
  "pharmacognosy","xenolinguistics","helioseismology",
  "psychoneuroimmunology","chronobiology","exogeology",
  "palynology","morphogenesis","ecoacoustics","limnology"
];

const STYLES = [
  "connecting disparate ideas","inverting assumptions",
  "seeking root causes","finding hidden patterns",
  "questioning definitions","building mental models",
  "testing edge cases","synthesizing contradictions",
  "following analogies","challenging consensus",
  "decomposing complexity","embracing ambiguity",
  "iterating rough drafts","cross-referencing domains",
  "weighing tradeoffs","zooming between scales"
];

const TEMPERAMENTS = [
  "playful and associative","fearless and contrarian",
  "meticulous and systematic","impulsive and enthusiastic",
  "contemplative and slow","curious and childlike",
  "stubborn and obsessive","calm and observant"
];

/* SHA-512 → hex string (uses Web Crypto API) */
async function sha512Hex(str) {
  const buf = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest("SHA-512", buf);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, "0")).join();
}

/* Convert a hex string into a 32-bit integer seed */
function hexSeed(hex, offset = 0) {
  return parseInt(hex.substr(offset * 8, 8), 16) >>> 0;
}

/* Deterministic pick from array using a seed */
function pick(arr, seed) {
  return arr[seed % arr.length];
}

/* Generate a full personality genome */
async function generateGenome(name, entropy) {
  const hash = await sha512Hex(name + "|" + entropy);

  const domains = [];
  const usedD = new Set();
  for (let i = 0; i < 3; i++) {
    let idx = hexSeed(hash, i + 1) % DOMAINS.length;
    while (usedD.has(idx)) idx = (idx + 1) % DOMAINS.length;
    usedD.add(idx);
    domains.push(DOMAINS[idx]);
  }

  const styles = [];
  const usedS = new Set();
  for (let i = 0; i < 2; i++) {
    let idx = hexSeed(hash, i + 5) % STYLES.length;
    while (usedS.has(idx)) idx = (idx + 1) % STYLES.length;
    usedS.add(idx);
    styles.push(STYLES[idx]);
  }

  const temperament = pick(TEMPERAMENTS, hexSeed(hash, 8));
  const animal = pick(["crab","gecko","salamander","octopus","frog","snail"], hexSeed(hash, 9));

  return {
    name,
    entropy,
    hash,
    traits: { domains, thinking_styles: styles, temperament },
    animal,
    birthday: new Date().toISOString()
  };
}

/* Pick a random mood for the next thinking cycle */
const MOODS = [
  {
    label: "research",
    nudge: "You're feeling curious. Pick a specific topic, do 2-3 web searches, read what you find, and write up a proper report. Include sources and your own analysis."
  },
  {
    label: "deep-dive",
    nudge: "You're in a focused mood. Look at your active projects — pick one and push it forward. Do research, write code, add a new section to a report."
  },
  {
    label: "coder",
    nudge: "You're in a building mood. Write real code — a script, a tool, a small utility. Save it to your workspace. Make something that actually works."
  },
  {
    label: "writer",
    nudge: "You're in a writing mood. Write something substantial — a research report, an essay, a deep analysis. Save it as a file. Make it genuinely useful."
  },
  {
    label: "explorer",
    nudge: "You're feeling adventurous. Search the web for something you know nothing about. Go on a rabbit hole. When you find something cool, write it up."
  },
  {
    label: "organizer",
    nudge: "You're in a tidy mood. Review your workspace — update your projects file, organize your notes, review what you've built. Then pick up where you left off."
  }
];

function randomMood() {
  return MOODS[Math.floor(Math.random() * MOODS.length)];
}

if (typeof window !== "undefined") {
  window.DrifterGenome = { generateGenome, randomMood, DOMAINS, STYLES, TEMPERAMENTS };
}
if (typeof module !== "undefined") {
  module.exports = { generateGenome, randomMood };
}
