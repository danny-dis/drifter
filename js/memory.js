/* ===================================================================
   Drifter — memory.js
   Smallville-inspired memory stream. Append-only JSON store in
   localStorage. Three-factor retrieval: recency × importance × relevance.
   Cosine similarity via puter.js embeddings.
   =================================================================== */

const MEMORY_KEY = "drifter_memories";
const MAX_MEMORIES = 500;

/* ---- Pure-Python-style cosine similarity (no deps) ---- */
function cosineSim(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/* Ask puter.js to rate importance 1-10 */
async function scoreImportance(text) {
  try {
    const resp = await puter.ai.chat(
      `Rate the importance of this thought on a scale of 1–10.\n1 = mundane routine.\n10 = life-changing discovery.\n\nThought: "${text}"\n\nReply with ONLY a number:`,
      { model: "gpt-5.4-nano" }
    );
    const m = String(resp).match(/\d+/);
    if (m) {
      const v = parseInt(m[0]);
      return Math.max(1, Math.min(10, v));
    }
  } catch (e) { /* fall through */ }
  return 5;
}

/* Get an embedding vector via puter.js */
async function embedText(text) {
  try {
    const resp = await puter.ai.embed(text);
    if (resp && resp.embedding) return resp.embedding;
  } catch (e) { /* fall through */ }
  return [];
}

/* Recency score: exponential decay */
function recencyScore(timestamp, decayRate = 0.995) {
  const hours = (Date.now() - new Date(timestamp).getTime()) / 3600000;
  return Math.exp(-(1 - decayRate) * hours);
}

class MemoryStream {
  constructor(boxId) {
    this.key = `${MEMORY_KEY}_${boxId}`;
    this.memories = [];
    this.importanceSum = 0;
    this._nextId = 0;
    this._load();
  }

  _load() {
    try {
      const raw = localStorage.getItem(this.key);
      if (raw) {
        this.memories = JSON.parse(raw);
        if (this.memories.length > 0) {
          const maxId = Math.max(...this.memories.map(m => parseInt(m.id.split("_")[1])));
          this._nextId = maxId + 1;
        }
      }
    } catch (e) {
      console.error("Memory load failed:", e);
      this.memories = [];
    }
  }

  _save() {
    try {
      localStorage.setItem(this.key, JSON.stringify(this.memories));
    } catch (e) {
      // localStorage full — prune oldest
      this.memories = this.memories.slice(-MAX_MEMORIES);
      try { localStorage.setItem(this.key, JSON.stringify(this.memories)); } catch (_) {}
    }
  }

  /* Add a new memory entry. Returns the stored entry. */
  async add(content, kind = "thought", depth = 0) {
    const importance = await scoreImportance(content);
    const embedding = await embedText(content);

    const entry = {
      id: `m_${String(this._nextId).padStart(4, "0")}`,
      timestamp: new Date().toISOString(),
      kind,
      content,
      importance,
      depth,
      embedding
    };

    this.memories.push(entry);
    this._nextId++;
    this.importanceSum += importance;
    this._save();
    return entry;
  }

  /* Quick add without importance scoring (for system events) */
  addSync(content, kind = "thought", importance = 5) {
    const entry = {
      id: `m_${String(this._nextId).padStart(4, "0")}`,
      timestamp: new Date().toISOString(),
      kind,
      content,
      importance,
      depth: 0,
      embedding: []
    };
    this.memories.push(entry);
    this._nextId++;
    this.importanceSum += importance;
    this._save();
    return entry;
  }

  /* Three-factor retrieval: recency + importance + relevance */
  async retrieve(query, topK = 5) {
    if (this.memories.length === 0) return [];
    const qEmbed = await embedText(query);

    const scored = this.memories.map(m => {
      const recency = recencyScore(m.timestamp);
      const imp = m.importance / 10;
      const rel = qEmbed.length > 0 && m.embedding?.length > 0
        ? cosineSim(qEmbed, m.embedding)
        : 0;
      return { mem: m, score: recency + imp + rel };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK).map(s => s.mem);
  }

  /* Get most recent N memories */
  getRecent(n = 10, kind = null) {
    let pool = kind ? this.memories.filter(m => m.kind === kind) : this.memories;
    return pool.slice(-n);
  }

  shouldReflect(threshold = 50) {
    return this.importanceSum >= threshold;
  }

  resetImportanceSum() {
    this.importanceSum = 0;
  }

  get size() {
    return this.memories.length;
  }
}

if (typeof window !== "undefined") {
  window.DrifterMemory = { MemoryStream, cosineSim, scoreImportance, embedText };
}
if (typeof module !== "undefined") {
  module.exports = { MemoryStream, cosineSim };
}
