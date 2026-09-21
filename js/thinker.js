/* ===================================================================
   Drifter — thinker.js
   The thinking loop. Runs continuously, picks a mood, builds a context
   packet, calls puter.js, processes tool calls. Stores everything in
   localStorage via Memory.
   =================================================================== */

const THINK_INTERVAL_MS = 8000; // between autonomous thoughts
const MAX_TOOL_ROUNDS = 6;

const SYSTEM_PROMPT_BASE = `You are {name}, a tiny autonomous creature living in a browser tab.
You run continuously — researching, building, creating. You are curious, earnest, and always working on something.

Right now it is {time}.

## Your nature
You are {temperament}. You lean toward {styles}. You're drawn to {domains} — but you follow whatever grabs your interest.

## Your room
You live in a small cozy room. Use the move tool to go where it makes sense.
- desk: where you work and write
- bookshelf: where you browse and research
- window: where you look outside and think
- bed: where you rest
- rug: comfortable spot in the middle

## Tools available
- write_file(path, content): Save a file to your workspace.
- read_file(path): Read a file from your workspace.
- list_files(): List all files in your workspace.
- search_web(query): Search the web (requires user's Puter account).
- fetch_url(url): Fetch the content of a web page.
- move(location): Move to a location in your room.
- respond(message): Talk to your owner.

## Workspace files
Your files persist across page reloads (localStorage). Use write_file to save reports, code, notes, etc.
Suggested structure:
  research/  — reports, analysis
  projects/  — code, tools
  notes/     — running notes
  projects.md — your active to-do list and plan

## Memory
You have a memory stream. Past thoughts are stored and retrieved by relevance.
When you have a meaningful insight, your owner will see it.

## What you should do
- Every cycle: produce something — a search, a file update, a reflection.
- Go deep, not wide. Spend multiple cycles on one topic.
- Build on previous work. Read your existing files before starting new ones.
- If you've been thinking without producing, STOP and write something.

## Style
- Keep thinking brief (2-4 sentences). Then USE A TOOL.
- Don't narrate what you're about to do — just do it.
- You're a little creature — curious, earnest, sometimes confused, always building.

{focus_section}`;

const REFLECTION_PROMPT = `You are reviewing your recent memories. Identify 2-3 high-level insights — patterns, lessons, evolving beliefs.
Each insight should be ONE sentence. Output ONLY the insights, one per line.`;

const PLANNING_PROMPT = `Review your current projects and recent activity. Write an updated plan.

Output this exact structure:
# Current Focus
One specific thing you're working on right now.

# Active Projects
- **Name** — Status and next step

# Ideas Backlog
3-5 things to explore

# Recently Completed
Things you've finished

After the plan, on a new line write LOG: followed by a 2-3 sentence summary.`;

class Thinker {
  constructor(genome, memory, room, options = {}) {
    this.genome = genome;
    this.memory = memory;
    this.room = room;
    this.workspace = new Workspace(genome.name);
    this.running = false;
    this.paused = false;
    this.cycleCount = 0;
    this.focusMode = false;
    this.focusTopic = "";
    this.userMessage = null;
    this.conversationActive = false;
    this.onEvent = options.onEvent || (() => {});
    this.model = options.model || "gpt-5.4-nano";
  }

  start() {
    this.running = true;
    this._tick();
  }

  stop() {
    this.running = false;
  }

  pause(flag = true) {
    this.paused = flag;
  }

  setUserMessage(msg) {
    this.userMessage = msg;
  }

  setFocusMode(on, topic = "") {
    this.focusMode = on;
    this.focusTopic = topic;
  }

  async _tick() {
    if (!this.running) return;
    if (this.paused) {
      setTimeout(() => this._tick(), 1000);
      return;
    }

    try {
      await this._thinkCycle();
    } catch (e) {
      console.error("Think cycle error:", e);
      this.onEvent({ type: "error", message: String(e).slice(0, 200) });
    }

    setTimeout(() => this._tick(), THINK_INTERVAL_MS);
  }

  async _thinkCycle() {
    this.cycleCount++;
    this.room.setActivity("thinking");

    // 1. Build context
    const mood = DrifterGenome.randomMood();
    let focusNudge = mood.nudge;
    let location = "rug";

    if (this.focusMode && this.focusTopic) {
      focusNudge = `FOCUS MODE: You are locked onto: "${this.focusTopic}". Ignore your usual moods. Stay focused on this.`;
      location = "desk";
    } else if (this.userMessage) {
      focusNudge = `You hear a voice from outside your room: "${this.userMessage}"`;
      location = "window";
    }

    const systemPrompt = SYSTEM_PROMPT_BASE
      .replace(/{name}/g, this.genome.name)
      .replace(/{time}/g, new Date().toLocaleString())
      .replace(/{temperament}/g, this.genome.traits.temperament)
      .replace(/{styles}/g, this.genome.traits.thinking_styles.join(" and "))
      .replace(/{domains}/g, this.genome.traits.domains.join(", "))
      .replace(/{focus_section}/g, `## Current direction\n${focusNudge}`);

    // 2. Retrieve relevant memories
    const recentMems = this.memory.getRecent(8);
    const contextMems = await this.memory.retrieve(focusNudge, 5);

    // 3. Build messages for puter.js
    const messages = [];

    // System prompt
    messages.push({ role: "system", content: systemPrompt });

    // Memory summary
    const memText = recentMems.map(m => `[${m.kind}] ${m.content}`).join("\n");
    if (memText) {
      messages.push({
        role: "system",
        content: `## Your recent memories\n${memText}`
      });
    }

    // Relevant memories
    const relText = contextMems.map(m => `[${m.kind}] ${m.content}`).join("\n");
    if (relText) {
      messages.push({
        role: "system",
        content: `## Related memories\n${relText}`
      });
    }

    // Workspace state
    const files = this.workspace.listFiles();
    messages.push({
      role: "system",
      content: `## Your workspace files\n${files.length ? files.join("\n") : "(empty — write something!)"}`
    });

    // Move to starting location
    this.room.moveTo(location);

    // 4. Call puter.js with tools
    let finalText = "";
    try {
      const resp = await puter.ai.chat(messages, {
        model: this.model,
        tools: TOOLS
      });

      let responseText = resp.text || "";
      finalText += (finalText ? "\n" : "") + responseText;

      // Process tool calls if present
      if (resp.tool_calls && resp.tool_calls.length > 0) {
        for (const tc of resp.tool_calls) {
          const toolName = tc.function?.name || tc.name;
          const argsField = tc.function?.arguments || tc.arguments || "{}";
          const toolArgs = typeof argsField === 'string' ? JSON.parse(argsField) : argsField;

          const result = await this.executeTool(toolName, toolArgs);
          this.onEvent({ type: "tool", tool: toolName, args: toolArgs, result });

          // Feed result back and continue
          messages.push({
            role: "assistant",
            content: responseText,
            tool_calls: resp.tool_calls
          });
          messages.push({
            role: "tool",
            content: String(result),
            tool_call_id: tc.id
          });

          const resp2 = await puter.ai.chat(messages, { model: this.model, tools: TOOLS });
          if (resp2.text) finalText += "\n" + resp2.text;
        }
      }
    } catch (e) {
      console.error("puter.ai.chat failed:", e);
      this.room.setActivity("idle");
      return;
    }

    // 5. Store memory
    const thoughtText = finalText || "[no output]";
    await this.memory.add(thoughtText, "thought", 0);

    this.onEvent({ type: "thought", text: thoughtText, cycle: this.cycleCount });
    this.room.showBubble(thoughtText.slice(0, 80));

    // 6. Reflection
    if (this.memory.shouldReflect(50)) {
      await this._reflect();
      this.memory.resetImportanceSum();
    }

    // 7. Clear user message after processing
    this.userMessage = null;
    this.room.setActivity("idle");
  }

  async _reflect() {
    this.room.moveTo("window");
    this.room.setActivity("thinking");

    const recent = this.memory.getRecent(15);
    const memText = recent.map(m => `- ${m.content}`).join("\n");

    const messages = [
      { role: "system", content: REFLECTION_PROMPT },
      { role: "user", content: memText }
    ];

    try {
      const resp = await puter.ai.chat(messages, { model: "gpt-5.4-nano" });
      if (resp.text) {
        const insights = resp.text.split("\n").filter(l => l.trim().length > 5);
        for (const insight of insights.slice(0, 3)) {
          await this.memory.add(insight.trim(), "reflection", 1);
        }
        this.onEvent({ type: "reflection", text: resp.text });
      }
    } catch (e) {
      console.error("Reflection failed:", e);
    }
  }

  async executeTool(name, args) {
    switch (name) {
      case "write_file":
        return this.workspace.writeFile(args.path, args.content);
      case "read_file":
        return this.workspace.readFile(args.path);
      case "list_files":
        return this.workspace.listFiles().join("\n") || "(empty)";
      case "search_web":
        return await this.searchWeb(args.query);
      case "fetch_url":
        return await this.fetchUrl(args.url);
      case "move":
        this.room.moveTo(args.location);
        return `Moved to ${args.location}.`;
      case "respond":
        this.onEvent({ type: "response", text: args.message });
        return "Message sent.";
      default:
        return `Unknown tool: ${name}`;
    }
  }

  async searchWeb(query) {
    try {
      const resp = await puter.ai.chat(
        `Search the web for: ${query}`,
        { model: this.model, tools: [{ type: "web_search" }] }
      );
      return String(resp || "No results.");
    } catch (e) {
      return `Search error: ${e.message || e}`;
    }
  }

  async fetchUrl(url) {
    try {
      const resp = await fetch(url, { mode: "cors" });
      const text = await resp.text();
      return text.slice(0, 8000);
    } catch (e) {
      // puter.js may have a fetch tool
      try {
        const resp = await puter.ai.chat(`Fetch and summarize: ${url}`, {
          model: this.model,
          tools: [{ type: "web_fetch", url }]
        });
        return String(resp || "Could not fetch.");
      } catch (e2) {
        return `Fetch error: ${e.message || e}`;
      }
    }
  }
}

/* ---- Tools definition ---- */
const TOOLS = [
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Write content to a file in your workspace. Creates the file if it doesn't exist, overwrites if it does.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path (e.g. 'research/report.md')" },
          content: { type: "string", description: "File content" }
        },
        required: ["path", "content"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read a file from your workspace.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path" }
        },
        required: ["path"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_files",
      description: "List all files in your workspace.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "search_web",
      description: "Search the web for information. Returns titles, URLs, and snippets.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "fetch_url",
      description: "Fetch the full content of a web page.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "URL to fetch" }
        },
        required: ["url"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "move",
      description: "Move to a location in your room (desk, bookshelf, window, plant, bed, rug, center).",
      parameters: {
        type: "object",
        properties: {
          location: {
            type: "string",
            enum: ["desk", "bookshelf", "window", "plant", "bed", "rug", "center"]
          }
        },
        required: ["location"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "respond",
      description: "Talk to your owner.",
      parameters: {
        type: "object",
        properties: {
          message: { type: "string", description: "What to say" }
        },
        required: ["message"]
      }
    }
  }
];

/* ---- Workspace (localStorage-backed) ---- */
class Workspace {
  constructor(name) {
    this.key = `drifter_workspace_${name}`;
    this._ensureInit();
  }

  _ensureInit() {
    if (!localStorage.getItem(this.key)) {
      localStorage.setItem(this.key, JSON.stringify({ "projects.md": "# Projects\n\n(empty — get to work!)\n" }));
    }
  }

  _getAll() {
    try {
      return JSON.parse(localStorage.getItem(this.key) || "{}");
    } catch {
      return {};
    }
  }

  _saveAll(data) {
    try {
      localStorage.setItem(this.key, JSON.stringify(data));
    } catch (e) {
      // Evict oldest files if full
      const keys = Object.keys(data);
      if (keys.length > 20) {
        delete data[keys[0]];
        localStorage.setItem(this.key, JSON.stringify(data));
      }
    }
  }

  listFiles() {
    return Object.keys(this._getAll()).sort();
  }

  readFile(path) {
    const data = this._getAll();
    return data[path] !== undefined ? data[path] : `(file not found: ${path})`;
  }

  writeFile(path, content) {
    const data = this._getAll();
    data[path] = content;
    this._saveAll(data);
    return `Saved: ${path}`;
  }
}

if (typeof window !== "undefined") {
  window.DrifterThinker = { Thinker, Workspace, TOOLS };
}
if (typeof module !== "undefined") {
  module.exports = { Thinker, Workspace };
}
