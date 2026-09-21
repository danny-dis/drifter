/* ===================================================================
   Drifter — room.js
   Pixel-art room renderer. Crab character wanders between locations.
   Rendered on HTML5 Canvas. Pure client-side.
   =================================================================== */

const ROOM_TILES = 12;
const TILE_SIZE = 40; // 480x480 canvas → 12x12 grid

// Wall layout: X = blocked, . = open, D = desk, B = bookshelf,
// W = window, P = plant, K = bed, R = rug
const ROOM_LAYOUT = [
  "XXXX..XXXXXX",
  "..XX...XX...",
  ".......XXXX.",
  "..XX...XX...",
  "..XX...XX...",
  "........XX..",
  "............",
  "..XXXXXX..XX",
  "..XX...X..X.",
  "....XXX...X.",
  "XX...X.....X",
  "X....X......"
];

// Named locations (tile coordinates)
const LOCATIONS = {
  desk:      { x: 10, y: 1 },
  bookshelf: { x: 1, y: 2 },
  window:    { x: 4, y: 0 },
  plant:     { x: 0, y: 8 },
  bed:       { x: 3, y: 10 },
  rug:       { x: 5, y: 5 },
  center:    { x: 5, y: 5 }
};

// Crab colors per animal type
const ANIMAL_COLORS = {
  crab:       { body: "#e74c3c", shell: "#c0392b", legs: "#e67e22", eyes: "#fff" },
  gecko:      { body: "#2ecc71", shell: "#27ae60", legs: "#1abc9c", eyes: "#fff" },
  salamander: { body: "#e67e22", shell: "#d35400", legs: "#f39c12", eyes: "#fff" },
  octopus:    { body: "#9b59b6", shell: "#8e44ad", legs: "#a569bd", eyes: "#fff" },
  frog:       { body: "#27ae60", shell: "#1e8449", legs: "#58d68d", eyes: "#fff" },
  snail:       { body: "#f1c40f", shell: "#f39c12", legs: "#f7dc6f", eyes: "#fff" }
};

class RoomRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.position = { x: 5, y: 5 };
    this.target = null;
    this.frame = 0;
    this.activity = null; // 'thinking', 'writing', 'searching', 'idle'
    this.bubbleText = null;
    this.bubbleTimer = 0;

    // Parse blocked tiles
    this.blocked = new Set();
    for (let y = 0; y < ROOM_LAYOUT.length; y++) {
      for (let x = 0; x < ROOM_LAYOUT[y].length; x++) {
        if (ROOM_LAYOUT[y][x] === "X") this.blocked.add(`${x},${y}`);
      }
    }

    this._loop();
  }

  isBlocked(x, y) {
    return this.blocked.has(`${x},${y}`);
  }

  setPosition(x, y) {
    if (x >= 0 && x < ROOM_TILES && y >= 0 && y < ROOM_TILES && !this.isBlocked(x, y)) {
      this.position = { x, y };
    }
  }

  moveTo(locationName) {
    const loc = LOCATIONS[locationName];
    if (loc) {
      this.target = loc;
    }
  }

  setActivity(type) {
    this.activity = type;
  }

  showBubble(text) {
    this.bubbleText = text;
    this.bubbleTimer = 180; // ~3 seconds at 60fps
  }

  _loop() {
    this._render();
    this.frame++;

    // Move toward target
    if (this.target) {
      const dx = Math.sign(this.target.x - this.position.x);
      const dy = Math.sign(this.target.y - this.position.y);
      if (dx !== 0 || dy !== 0) {
        if (Math.random() < 0.05) {
          this.setPosition(this.position.x + dx, this.position.y + dy);
        }
      }
      if (this.position.x === this.target.x && this.position.y === this.target.y) {
        this.target = null;
      }
    }

    if (this.bubbleTimer > 0) this.bubbleTimer--;

    requestAnimationFrame(() => this._loop());
  }

  _render() {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;

    // Clear
    ctx.fillStyle = "#2c3e50";
    ctx.fillRect(0, 0, W, H);

    // Draw tiles
    for (let y = 0; y < ROOM_TILES; y++) {
      for (let x = 0; x < ROOM_TILES; x++) {
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;
        if (this.isBlocked(x, y)) {
          ctx.fillStyle = "#34495e";
        } else {
          ctx.fillStyle = (x + y) % 2 === 0 ? "#3d566e" : "#3a5268";
        }
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      }
    }

    // Draw furniture
    this._drawFurniture(ctx);

    // Draw crab
    this._drawCrab(ctx);

    // Draw activity indicator
    if (this.activity) {
      this._drawActivity(ctx);
    }

    // Draw bubble
    if (this.bubbleTimer > 0 && this.bubbleText) {
      this._drawBubble(ctx);
    }
  }

  _drawFurniture(ctx) {
    // Desk
    ctx.fillStyle = "#8B4513";
    ctx.fillRect(10 * TILE_SIZE, 1 * TILE_SIZE, TILE_SIZE * 2, TILE_SIZE);
    ctx.fillStyle = "#654321";
    ctx.fillRect(10 * TILE_SIZE, 1 * TILE_SIZE, TILE_SIZE * 2, 4);

    // Bookshelf
    ctx.fillStyle = "#654321";
    ctx.fillRect(0, 2 * TILE_SIZE, TILE_SIZE, TILE_SIZE * 2);
    ctx.fillStyle = "#e74c3c";
    ctx.fillRect(4, 2 * TILE_SIZE + 4, TILE_SIZE - 8, 8);
    ctx.fillStyle = "#3498db";
    ctx.fillRect(4, 2 * TILE_SIZE + 16, TILE_SIZE - 8, 8);
    ctx.fillStyle = "#2ecc71";
    ctx.fillRect(4, 2 * TILE_SIZE + 28, TILE_SIZE - 8, 8);

    // Window
    ctx.fillStyle = "#87CEEB";
    ctx.fillRect(4 * TILE_SIZE, 0, TILE_SIZE * 2, TILE_SIZE);
    ctx.fillStyle = "#fff";
    ctx.fillRect(4 * TILE_SIZE + 4, 4, TILE_SIZE * 2 - 8, TILE_SIZE - 8);
    ctx.strokeStyle = "#654321";
    ctx.lineWidth = 2;
    ctx.strokeRect(4 * TILE_SIZE, 0, TILE_SIZE * 2, TILE_SIZE);

    // Bed
    ctx.fillStyle = "#9b59b6";
    ctx.fillRect(3 * TILE_SIZE, 10 * TILE_SIZE, TILE_SIZE * 2, TILE_SIZE);
    ctx.fillStyle = "#ecf0f1";
    ctx.fillRect(3 * TILE_SIZE + 4, 10 * TILE_SIZE + 4, TILE_SIZE - 8, TILE_SIZE - 8);

    // Plant
    ctx.fillStyle = "#27ae60";
    ctx.beginPath();
    ctx.arc(TILE_SIZE / 2, 8 * TILE_SIZE + TILE_SIZE / 2, TILE_SIZE / 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#654321";
    ctx.fillRect(TILE_SIZE / 2 - 4, 8 * TILE_SIZE + TILE_SIZE / 2, 8, TILE_SIZE / 2);

    // Rug (center)
    ctx.fillStyle = "#c0392b";
    ctx.beginPath();
    ctx.ellipse(5.5 * TILE_SIZE, 5.5 * TILE_SIZE, TILE_SIZE * 0.8, TILE_SIZE * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawCrab(ctx) {
    const px = this.position.x * TILE_SIZE + TILE_SIZE / 2;
    const py = this.position.y * TILE_SIZE + TILE_SIZE / 2;
    const colors = ANIMAL_COLORS.crab; // default, could be parameterized

    const bob = Math.sin(this.frame * 0.1) * 2;
    const size = TILE_SIZE * 0.35;

    ctx.save();
    ctx.translate(px, py + bob);

    // Body
    ctx.fillStyle = colors.body;
    ctx.beginPath();
    ctx.ellipse(0, 0, size, size * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Shell
    ctx.fillStyle = colors.shell;
    ctx.beginPath();
    ctx.ellipse(0, -size * 0.2, size * 0.7, size * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = colors.eyes;
    ctx.beginPath();
    ctx.arc(-size * 0.3, -size * 0.4, size * 0.15, 0, Math.PI * 2);
    ctx.arc(size * 0.3, -size * 0.4, size * 0.15, 0, Math.PI * 2);
    ctx.fill();

    // Pupils
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.arc(-size * 0.3, -size * 0.4, size * 0.08, 0, Math.PI * 2);
    ctx.arc(size * 0.3, -size * 0.4, size * 0.08, 0, Math.PI * 2);
    ctx.fill();

    // Legs
    ctx.strokeStyle = colors.legs;
    ctx.lineWidth = 2;
    for (let i = -2; i <= 2; i++) {
      if (i === 0) continue;
      const lx = i * size * 0.3;
      ctx.beginPath();
      ctx.moveTo(lx, size * 0.3);
      ctx.lineTo(lx + i * 4, size * 0.7);
      ctx.stroke();
    }

    // Claws (crab-specific)
    ctx.fillStyle = colors.body;
    ctx.beginPath();
    ctx.ellipse(-size * 0.8, size * 0.1, size * 0.3, size * 0.2, -0.3, 0, Math.PI * 2);
    ctx.ellipse(size * 0.8, size * 0.1, size * 0.3, size * 0.2, 0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  _drawActivity(ctx) {
    const px = this.position.x * TILE_SIZE + TILE_SIZE / 2;
    const py = this.position.y * TILE_SIZE - 10;
    const icons = {
      thinking: "💭",
      writing: "✍️",
      searching: "🔍",
      coding: "💻",
      researching: "📚",
      idle: ""
    };
    const icon = icons[this.activity] || "";
    if (icon) {
      ctx.font = "20px serif";
      ctx.textAlign = "center";
      ctx.fillText(icon, px, py - (this.frame % 30) * 0.5);
    }
  }

  _drawBubble(ctx) {
    const px = this.position.x * TILE_SIZE + TILE_SIZE / 2;
    const py = this.position.y * TILE_SIZE - 40;
    const alpha = Math.min(1, this.bubbleTimer / 30);
    ctx.globalAlpha = alpha;

    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1;
    const text = this.bubbleText.length > 40 ? this.bubbleText.slice(0, 40) + "…" : this.bubbleText;
    const w = ctx.measureText(text).width + 20;
    ctx.beginPath();
    ctx.roundRect(px - w / 2, py - 20, w, 30, 8);
    ctx.fill();
    ctx.stroke();

    // Triangle
    ctx.beginPath();
    ctx.moveTo(px - 5, py + 10);
    ctx.lineTo(px + 5, py + 10);
    ctx.lineTo(px, py + 18);
    ctx.fill();

    ctx.fillStyle = "#333";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(text, px, py);

    ctx.globalAlpha = 1;
  }
}

if (typeof window !== "undefined") {
  window.DrifterRoom = { RoomRenderer, LOCATIONS };
}
if (typeof module !== "undefined") {
  module.exports = { RoomRenderer, LOCATIONS };
}
