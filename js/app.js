/* ===================================================================
   Drifter — app.js
   Orchestrator: onboarding, room, chat, thinker wiring. Pure browser.
   =================================================================== */

(function () {
  const { generateGenome, randomMood } = window.DrifterGenome;
  const { MemoryStream, scoreImportance } = window.DrifterMemory;
  const { RoomRenderer, LOCATIONS } = window.DrifterRoom;
  const { Thinker } = window.DrifterThinker;

  const STORAGE_KEY = "drifter_state";

  let genome = null;
  let memory = null;
  let room = null;
  let thinker = null;

  // --- DOM ---
  const $ = sel => document.querySelector(sel);
  const onboarding = $("#onboarding");
  const onboardName = $("#onboard-name");
  const onboardEntropy = $("#onboard-entropy");
  const onboardGo = $("#onboard-go");
  const entropyFill = $("#entropy-fill");
  const crabName = $("#crab-name");
  const crabStatus = $("#crab-status");
  const chatFeed = $("#chat-feed");
  const chatForm = $("#chat-form");
  const chatInput = $("#chat-input");
  const roomCanvas = $("#room-canvas");
  const btnPause = $("#btn-pause");
  const btnNew = $("#btn-new");

  let entropyCaptured = "";

  // --- State persistence ---
  function saveState() {
    if (!genome) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      genome,
      savedAt: new Date().toISOString()
    }));
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const state = JSON.parse(raw);
        if (state.genome) return state.genome;
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  // --- Onboarding ---
  if (onboardEntropy) {
    onboardEntropy.addEventListener("keydown", e => {
      entropyCaptured += e.key + Date.now() + ",";
      const pct = Math.min(100, entropyCaptured.length / 2);
      entropyFill.style.width = pct + "%";
      if (pct >= 100 && onboardName.value.trim()) {
        onboardGo.disabled = false;
      }
    });
  }

  if (onboardName) {
    onboardName.addEventListener("input", () => {
      if (entropyCaptured.length >= 2 && onboardName.value.trim()) {
        onboardGo.disabled = false;
      }
    });
  }

  if (onboardGo) {
    onboardGo.addEventListener("click", async () => {
      const name = onboardName.value.trim() || "Coral";
      onboardGo.disabled = true;
      onboardGo.textContent = "Generating personality...";

      const g = await generateGenome(name, entropyCaptured);
      genome = g;
      saveState();

      onboarding.classList.add("hidden");
      await bootCreature(g);
    });
  }

  // --- Boot ---
  async function bootCreature(g) {
    crabName.textContent = g.name;
    memory = new MemoryStream(g.name);
    room = new RoomRenderer(roomCanvas);
    room.setPosition(LOCATIONS.rug.x, LOCATIONS.rug.y);

    thinker = new Thinker(g, memory, room, {
      onEvent: handleThinkerEvent
    });

    // Welcome message
    await memory.addSync(`${g.name} was born! A tiny creature with a ${g.traits.temperament} personality.`, "system", 5);
    appendChat("system", `${g.name} the ${g.animal} is awake. Domains: ${g.traits.domains.join(", ")}.`);

    thinker.start();
    updateStatus("running");
  }

  // --- Handle thinker events ---
  function handleThinkerEvent(event) {
    switch (event.type) {
      case "thought":
        appendChat("crab", event.text, event.cycle);
        break;
      case "response":
        appendChat("crab", event.text);
        break;
      case "tool":
        appendToolLog(event.tool, event.args, event.result);
        break;
      case "reflection":
        appendChat("system", `💡 Reflection:\n${event.text}`);
        break;
      case "error":
        appendChat("error", `Error: ${event.message}`);
        break;
    }
  }

  // --- Chat UI ---
  function appendChat(role, text, cycle) {
    const div = document.createElement("div");
    div.className = `chat-msg chat-${role}`;
    const time = new Date().toLocaleTimeString();
    const cycleLabel = cycle ? `<span class="cycle">#${cycle}</span>` : "";
    div.innerHTML = `${cycleLabel}<span class="meta">${time}</span><br>${escapeHtml(text)}`;
    chatFeed.appendChild(div);
    chatFeed.scrollTop = chatFeed.scrollHeight;
  }

  function appendToolLog(tool, args, result) {
    const div = document.createElement("div");
    div.className = `chat-msg chat-tool`;
    const argsStr = args && Object.keys(args).length ? JSON.stringify(args).slice(0, 100) : "";
    div.innerHTML = `<span class="tool-name">⚙️ ${tool}</span> ${escapeHtml(argsStr)}<br><span class="tool-result">${escapeHtml(String(result).slice(0, 300))}</span>`;
    chatFeed.appendChild(div);
    chatFeed.scrollTop = chatFeed.scrollHeight;
  }

  function escapeHtml(s) {
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  // --- Chat input ---
  chatForm.addEventListener("submit", async e => {
    e.preventDefault();
    const msg = chatInput.value.trim();
    if (!msg) return;
    chatInput.value = "";
    appendChat("user", msg);

    if (thinker) {
      thinker.setUserMessage(msg);
      // If it's a /focus command, toggle focus mode
      if (msg.startsWith("/focus ")) {
        const topic = msg.slice(7);
        thinker.setFocusMode(true, topic);
        appendChat("system", `Focus mode ON: ${topic}`);
      } else if (msg === "/focus off") {
        thinker.setFocusMode(false);
        appendChat("system", "Focus mode OFF.");
      } else if (msg === "/pause") {
        thinker.pause(true);
        updateStatus("paused");
      } else if (msg === "/resume") {
        thinker.pause(false);
        updateStatus("running");
      }
    }
  });

  // --- Controls ---
  btnPause.addEventListener("click", () => {
    if (!thinker) return;
    const newPaused = !thinker.paused;
    thinker.pause(newPaused);
    btnPause.textContent = newPaused ? "▶" : "⏸";
    updateStatus(newPaused ? "paused" : "running");
  });

  btnNew.addEventListener("click", () => {
    if (confirm("Create a new drifter? Current one will be archived.")) {
      // Clear current state but keep workspace
      const name = genome?.name;
      localStorage.removeItem(STORAGE_KEY);
      if (name) {
        // Archive workspace
        const wsKey = `drifter_workspace_${name}`;
        const old = localStorage.getItem(wsKey);
        if (old) {
          localStorage.setItem(`drifter_archive_${name}_${Date.now()}`, old);
        }
      }
      location.reload();
    }
  });

  function updateStatus(s) {
    crabStatus.textContent = s;
    crabStatus.className = "status status-" + s;
  }

  // --- Init ---
  async function init() {
    const saved = loadState();
    if (saved) {
      genome = saved;
      onboarding.classList.add("hidden");
      await bootCreature(genome);
    } else {
      onboarding.classList.remove("hidden");
    }
  }

  // Wait for puter.js to load
  if (typeof puter !== "undefined") {
    init();
  } else {
    window.addEventListener("load", () => {
      // puter.js loads async from CDN, give it a moment
      const check = setInterval(() => {
        if (typeof puter !== "undefined") {
          clearInterval(check);
          init();
        }
      }, 100);
    });
  }
})();
