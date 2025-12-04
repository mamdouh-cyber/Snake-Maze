// Snake Levels – Web Version
// "Database" implemented with localStorage for persistent levels.

const STORAGE_KEY = "snake_levels_v1";

class Level {
  constructor({
    id,
    name,
    speed,
    gridWidth,
    gridHeight,
    targetScore,
    wrapEdges,
    walls,
  }) {
    this.id = id;
    this.name = name;
    this.speed = speed;
    this.gridWidth = gridWidth;
    this.gridHeight = gridHeight;
    this.targetScore = targetScore;
    this.wrapEdges = wrapEdges;
    this.walls = walls || [];
  }
}

// ----- Level "database" using localStorage -----

function getDefaultLevels() {
  return [
    new Level({
      id: 1,
      name: "Classic Wide",
      speed: 8,
      gridWidth: 32,
      gridHeight: 24,
      targetScore: 10,
      wrapEdges: false,
      walls: [],
    }),
    new Level({
      id: 2,
      name: "Boxed In",
      speed: 10,
      gridWidth: 28,
      gridHeight: 20,
      targetScore: 15,
      wrapEdges: false,
      walls: borderWalls(28, 20),
    }),
    new Level({
      id: 3,
      name: "Maze Warp",
      speed: 11,
      gridWidth: 30,
      gridHeight: 12,
      targetScore: 100,
      wrapEdges: true,
      walls: circleBorderWalls(30, 12),
    }),
  ];
}

function loadLevels() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const defaults = getDefaultLevels();
    saveLevels(defaults);
    return defaults;
  }
  try {
    const arr = JSON.parse(raw);
    return arr.map(
      (o) =>
        new Level({
          id: o.id,
          name: o.name,
          speed: o.speed,
          gridWidth: o.gridWidth,
          gridHeight: o.gridHeight,
          targetScore: o.targetScore,
          wrapEdges: !!o.wrapEdges,
          walls: o.walls || [],
        })
    );
  } catch {
    const defaults = getDefaultLevels();
    saveLevels(defaults);
    return defaults;
  }
}

function saveLevels(levels) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(levels));
}

function resetLevelsToDefault() {
  const defaults = getDefaultLevels();
  saveLevels(defaults);
  return defaults;
}

function borderWalls(w, h) {
  const walls = [];
  for (let x = 0; x < w; x++) {
    walls.push([x, 0]);
    walls.push([x, h - 1]);
  }
  for (let y = 0; y < h; y++) {
    walls.push([0, y]);
    walls.push([w - 1, y]);
  }
  return walls;
}

function centerCrossWalls(w, h) {
  const walls = [];
  const midX = Math.floor(w / 2);
  const midY = Math.floor(h / 2);
  for (let x = Math.floor(w / 3); x < Math.floor((2 * w) / 3); x++) {
    walls.push([x, midY]);
  }
  for (let y = Math.floor(h / 3); y < Math.floor((2 * h) / 3); y++) {
    walls.push([midX, y]);
  }
  return walls;
}

function circleBorderWalls(w, h) {
  // Approximate an ellipse border that looks like a circular arena,
  // but leave an opening at the top so the ring is "open".
  const walls = [];
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  // Smaller radii so the ring is closer to the center (smaller circle).
  const rx = (w - 8) / 2;
  const ry = (h - 4) / 2;

  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      const d = dx * dx + dy * dy;
      // Keep cells that are near the ellipse radius.
      if (d > 0.82 && d < 1.2) {
        walls.push([x, y]);
      }
    }
  }

  // Create an opening at the top-center of the circle so it is not fully closed.
  return walls.filter(([x, y]) => {
    const isTopHalf = y <= cy - 1;
    const nearCenterX = Math.abs(x - cx) <= 1.5;
    if (isTopHalf && nearCenterX) {
      return false; // remove these walls to create the gap
    }
    return true;
  });
}

// ----- Game logic -----

function addRandomLevel(levels) {
  const id = levels.length ? Math.max(...levels.map((l) => l.id)) + 1 : 1;
  const gridWidthChoices = [20, 24, 28, 32];
  const gridHeightChoices = [16, 18, 20, 24];
  const gridWidth = gridWidthChoices[Math.floor(Math.random() * gridWidthChoices.length)];
  const gridHeight =
    gridHeightChoices[Math.floor(Math.random() * gridHeightChoices.length)];
  const speed = 8 + Math.floor(Math.random() * 7); // 8–14
  const targetScore = 8 + Math.floor(Math.random() * 18); // 8–25
  const wrapEdges = Math.random() < 0.5;
  const numWalls = 10 + Math.floor(Math.random() * 25);
  const walls = [];
  for (let i = 0; i < numWalls; i++) {
    const x = Math.floor(Math.random() * gridWidth);
    const y = Math.floor(Math.random() * gridHeight);
    walls.push([x, y]);
  }

  const level = new Level({
    id,
    name: `Random ${id}`,
    speed,
    gridWidth,
    gridHeight,
    targetScore,
    wrapEdges,
    walls,
  });
  levels.push(level);
  saveLevels(levels);
  return { levels, level };
}

class SnakeGame {
  constructor(canvas, level) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.level = level;
    this.gridW = level.gridWidth;
    this.gridH = level.gridHeight;
    this.speed = level.speed;
    this.wrapEdges = level.wrapEdges;
    this.targetScore = level.targetScore;
    this.score = 0;

    this.cellSize = Math.min(
      Math.floor(canvas.width / this.gridW),
      Math.floor((canvas.height - 80) / this.gridH)
    );
    const gridPxW = this.cellSize * this.gridW;
    const gridPxH = this.cellSize * this.gridH;
    this.gridOriginX = Math.floor((canvas.width - gridPxW) / 2);
    this.gridOriginY = Math.floor((canvas.height - gridPxH) / 2);

    this.walls = new Set(level.walls.map((w) => `${w[0]},${w[1]}`));
    this.snake = [];
    this.direction = [1, 0];
    this.pendingDir = [1, 0];
    this._initSnake();

    this.food = null;
    this.spawnFood();

    this.gameOver = false;
    this.win = false;
    this.paused = false;
    this.moveTimer = 0;
    this.lastTimestamp = null;
  }

  _initSnake() {
    const startX = Math.floor(this.gridW / 3);
    const startY = Math.floor(this.gridH / 2);
    this.snake = [];
    for (let i = 0; i < 4; i++) {
      this.snake.push([startX - i, startY]);
    }
  }

  spawnFood() {
    const free = [];
    const snakeSet = new Set(this.snake.map((s) => `${s[0]},${s[1]}`));
    for (let x = 0; x < this.gridW; x++) {
      for (let y = 0; y < this.gridH; y++) {
        const key = `${x},${y}`;
        if (!snakeSet.has(key) && !this.walls.has(key)) {
          free.push([x, y]);
        }
      }
    }
    if (!free.length) {
      this.win = true;
      return;
    }
    this.food = free[Math.floor(Math.random() * free.length)];
  }

  handleKeyDown(e) {
    if (e.key === " " || e.key === "Enter") {
      this.paused = !this.paused;
      return;
    }
    if (e.key === "ArrowUp" || e.key === "w") {
      if (!(this.direction[0] === 0 && this.direction[1] === 1)) {
        this.pendingDir = [0, -1];
      }
    } else if (e.key === "ArrowDown" || e.key === "s") {
      if (!(this.direction[0] === 0 && this.direction[1] === -1)) {
        this.pendingDir = [0, 1];
      }
    } else if (e.key === "ArrowLeft" || e.key === "a") {
      if (!(this.direction[0] === 1 && this.direction[1] === 0)) {
        this.pendingDir = [-1, 0];
      }
    } else if (e.key === "ArrowRight" || e.key === "d") {
      if (!(this.direction[0] === -1 && this.direction[1] === 0)) {
        this.pendingDir = [1, 0];
      }
    }
  }

  update(dt) {
    if (this.gameOver || this.win || this.paused) return;
    this.moveTimer += dt;
    const stepInterval = 1 / this.speed;
    while (this.moveTimer >= stepInterval) {
      this.moveTimer -= stepInterval;
      this._stepSnake();
    }
  }

  _stepSnake() {
    this.direction = [...this.pendingDir];
    const [hx, hy] = this.snake[0];
    let [dx, dy] = this.direction;
    let nx = hx + dx;
    let ny = hy + dy;

    if (this.wrapEdges) {
      nx = (nx + this.gridW) % this.gridW;
      ny = (ny + this.gridH) % this.gridH;
    } else {
      if (nx < 0 || nx >= this.gridW || ny < 0 || ny >= this.gridH) {
        this.gameOver = true;
        return;
      }
    }

    const key = `${nx},${ny}`;
    if (this.walls.has(key)) {
      this.gameOver = true;
      return;
    }

    const bodyExceptTail = this.snake.slice(0, this.snake.length - 1);
    if (bodyExceptTail.some((s) => s[0] === nx && s[1] === ny)) {
      this.gameOver = true;
      return;
    }

    this.snake.unshift([nx, ny]);

    if (this.food && nx === this.food[0] && ny === this.food[1]) {
      this.score += 1;
      if (this.score >= this.targetScore) {
        this.win = true;
      } else {
        this.spawnFood();
      }
    } else {
      this.snake.pop();
    }
  }

  draw() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);

    // background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, "#0f1722");
    bgGrad.addColorStop(1, "#050609");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // grid background
    const gridPxW = this.cellSize * this.gridW;
    const gridPxH = this.cellSize * this.gridH;
    const gx = this.gridOriginX;
    const gy = this.gridOriginY;

    ctx.save();
    ctx.fillStyle = "#141821";
    roundRect(ctx, gx, gy, gridPxW, gridPxH, 14, true, false);

    // checkerboard
    for (let x = 0; x < this.gridW; x++) {
      for (let y = 0; y < this.gridH; y++) {
        if ((x + y) % 2 === 0) {
          ctx.fillStyle = "#151b26";
          roundRect(
            ctx,
            gx + x * this.cellSize,
            gy + y * this.cellSize,
            this.cellSize,
            this.cellSize,
            4,
            true,
            false
          );
        }
      }
    }

    // walls
    ctx.fillStyle = "#34495e";
    this.walls.forEach((k) => {
      const [wx, wy] = k.split(",").map((n) => parseInt(n, 10));
      roundRect(
        ctx,
        gx + wx * this.cellSize,
        gy + wy * this.cellSize,
        this.cellSize,
        this.cellSize,
        5,
        true,
        false
      );
    });

    // food
    if (this.food) {
      const [fx, fy] = this.food;
      ctx.fillStyle = "#e74c3c";
      roundRect(
        ctx,
        gx + fx * this.cellSize + 3,
        gy + fy * this.cellSize + 3,
        this.cellSize - 6,
        this.cellSize - 6,
        10,
        true,
        false
      );
    }

    // snake
    this.snake.forEach(([sx, sy], i) => {
      const isHead = i === 0;
      ctx.fillStyle = isHead ? "#27ae60" : "#2ecc71";
      roundRect(
        ctx,
        gx + sx * this.cellSize + 2,
        gy + sy * this.cellSize + 2,
        this.cellSize - 4,
        this.cellSize - 4,
        6,
        true,
        false
      );
    });

    ctx.restore();
  }
}

function roundRect(ctx, x, y, w, h, r, fill, stroke) {
  if (typeof r === "number") {
    r = { tl: r, tr: r, br: r, bl: r };
  } else {
    r = {
      tl: r.tl || 0,
      tr: r.tr || 0,
      br: r.br || 0,
      bl: r.bl || 0,
    };
  }
  ctx.beginPath();
  ctx.moveTo(x + r.tl, y);
  ctx.lineTo(x + w - r.tr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r.tr);
  ctx.lineTo(x + w, y + h - r.br);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r.br, y + h);
  ctx.lineTo(x + r.bl, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r.bl);
  ctx.lineTo(x, y + r.tl);
  ctx.quadraticCurveTo(x, y, x + r.tl, y);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

// ----- UI wiring -----

const canvas = document.getElementById("game-canvas");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlaySubtitle = document.getElementById("overlay-subtitle");
const overlayClose = document.getElementById("overlay-close");

const levelListEl = document.getElementById("level-list");
const levelDetailsEl = document.getElementById("level-details");

const btnPlay = document.getElementById("btn-play");
const btnNewLevel = document.getElementById("btn-new-level");
const btnReset = document.getElementById("btn-reset");
const targetInput = document.getElementById("target-input");

const hudLevel = document.getElementById("hud-level");
const hudScore = document.getElementById("hud-score");
const hudSpeed = document.getElementById("hud-speed");
const hudWrap = document.getElementById("hud-wrap");

let levels = loadLevels();
let selectedLevelId = levels[0]?.id ?? null;
let game = null;
let running = false;

function renderLevelList() {
  levelListEl.innerHTML = "";
  levels.forEach((lvl) => {
    const li = document.createElement("li");
    li.className = "level-item";
    if (lvl.id === selectedLevelId) {
      li.classList.add("selected");
    }
    li.dataset.id = String(lvl.id);

    const left = document.createElement("div");
    left.textContent = `${String(lvl.id).padStart(2, "0")}. ${lvl.name}`;

    const right = document.createElement("div");
    right.className = "level-meta";
    right.textContent = `spd ${lvl.speed}, tgt ${lvl.targetScore}, ${
      lvl.wrapEdges ? "wrap" : "walls"
    }`;

    li.appendChild(left);
    li.appendChild(right);
    li.addEventListener("click", () => {
      selectedLevelId = lvl.id;
      renderLevelList();
      renderLevelDetails();
    });
    levelListEl.appendChild(li);
  });
}

function renderLevelDetails() {
  const lvl = levels.find((l) => l.id === selectedLevelId);
  if (!lvl) {
    levelDetailsEl.innerHTML = "<p>No level selected</p>";
    return;
  }
  levelDetailsEl.innerHTML = `
    <h3>${lvl.name}</h3>
    <p><strong>Grid:</strong> ${lvl.gridWidth} × ${lvl.gridHeight}</p>
    <p><strong>Speed:</strong> ${lvl.speed}</p>
    <p><strong>Target score:</strong> ${lvl.targetScore}</p>
    <p><strong>Wrap edges:</strong> ${lvl.wrapEdges ? "Yes (portal-style)" : "No (classic walls)"} </p>
    <p><strong>Obstacles:</strong> ${lvl.walls.length} cells</p>
  `;
}

function updateHUD() {
  if (!game) {
    hudLevel.textContent = "Level: –";
    hudScore.textContent = "Score: 0 / 0";
    hudSpeed.textContent = "Speed: –";
    hudWrap.textContent = "Wrap: –";
    return;
  }
  hudLevel.textContent = `Level: ${game.level.name}`;
  hudScore.textContent = `Score: ${game.score} / ${game.targetScore}`;
  hudSpeed.textContent = `Speed: ${game.speed}`;
  hudWrap.textContent = `Wrap: ${game.wrapEdges ? "ON" : "OFF"}`;
}

function startGame() {
  const lvl = levels.find((l) => l.id === selectedLevelId);
  if (!lvl) return;
  game = new SnakeGame(canvas, lvl);
  // Override target score for all levels if user specified a value.
  const overrideRaw = targetInput.value.trim();
  const overrideVal = Number(overrideRaw);
  if (!Number.isNaN(overrideVal) && overrideVal > 0) {
    game.targetScore = Math.floor(overrideVal);
  }
  running = true;
  overlay.classList.add("hidden");
  updateHUD();
}

function stopGame() {
  running = false;
  game = null;
  updateHUD();
}

btnPlay.addEventListener("click", () => {
  startGame();
});

btnNewLevel.addEventListener("click", () => {
  const result = addRandomLevel(levels);
  levels = result.levels;
  selectedLevelId = result.level.id;
  renderLevelList();
  renderLevelDetails();
});

btnReset.addEventListener("click", () => {
  levels = resetLevelsToDefault();
  selectedLevelId = levels[0]?.id ?? null;
  renderLevelList();
  renderLevelDetails();
});

overlayClose.addEventListener("click", () => {
  overlay.classList.add("hidden");
  stopGame();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (running) {
      overlayTitle.textContent = "Stopped";
      overlaySubtitle.textContent = "You returned to the level menu.";
      overlay.classList.remove("hidden");
      stopGame();
    }
    return;
  }
  if (game && running) {
    game.handleKeyDown(e);
  }
});

function loop(timestamp) {
  requestAnimationFrame(loop);
  if (!running || !game) return;
  if (game.lastTimestamp == null) {
    game.lastTimestamp = timestamp;
  }
  const dt = (timestamp - game.lastTimestamp) / 1000;
  game.lastTimestamp = timestamp;
  game.update(dt);
  game.draw();
  updateHUD();

  if (game.gameOver || game.win) {
    running = false;
    overlayTitle.textContent = game.win ? "Level Cleared!" : "Game Over";
    overlaySubtitle.textContent = `Score: ${game.score} / ${game.targetScore}`;
    overlay.classList.remove("hidden");
  }
}

// initial UI render
renderLevelList();
renderLevelDetails();
updateHUD();
requestAnimationFrame(loop);


