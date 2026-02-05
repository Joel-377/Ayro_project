const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreDiv = document.getElementById("score");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const socket = io();
const id = Math.random().toString(36).slice(2);

const name = prompt("Name:") || "Player";
const isCamera = name.toLowerCase() === "camera";
const color = isCamera ? "#fff" : (prompt("Color (e.g. red, blue, #00ff00):") || "white");

socket.emit("join", { id, name, color });

let players = {};
let food = [];
let keys = {};
let cameraZoom = isCamera ? 0.2 : 1;

// ---------------- INPUT HANDLERS ----------------
let touchActive = false;
let touchStart = { x: 0, y: 0 };
let touchMove = { x: 0, y: 0 };

canvas.addEventListener("touchstart", e => {
  if (isCamera) return;
  const t = e.touches[0];
  touchActive = true;
  touchStart = { x: t.clientX, y: t.clientY };
  touchMove = { x: t.clientX, y: t.clientY };
}, { passive: false });

canvas.addEventListener("touchmove", e => {
  if (!touchActive) return;
  const t = e.touches[0];
  touchMove = { x: t.clientX, y: t.clientY };
  e.preventDefault(); 
}, { passive: false });

canvas.addEventListener("touchend", () => touchActive = false);

document.addEventListener("keydown", e => keys[e.key.toLowerCase()] = true);
document.addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);

// ---------------- GAME ENGINE ----------------
socket.on("state", data => {
  players = data.players;
  food = data.food;
});

socket.on("winner", w => alert(`${w} wins!`));

function move() {
  if (isCamera) return;

  let dx = 0;
  let dy = 0;

  // PC Controls
  if (keys["w"]) dy--;
  if (keys["s"]) dy++;
  if (keys["a"]) dx--;
  if (keys["d"]) dx++;

  // Mobile Controls
  if (touchActive) {
    dx = touchMove.x - touchStart.x;
    dy = touchMove.y - touchStart.y;
  }

  const mag = Math.hypot(dx, dy);
  if (mag > 0) {
    dx /= mag;
    dy /= mag;
    socket.emit("move", { id, dx, dy });
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();

  const zoom = isCamera ? cameraZoom : 1;
  ctx.scale(zoom, zoom);

  if (isCamera) {
    ctx.translate(canvas.width / 2 / zoom, canvas.height / 2 / zoom);
  } else if (players[id]) {
    const me = players[id];
    ctx.translate(canvas.width / 2 / zoom - me.x, canvas.height / 2 / zoom - me.y);
  }

  // Draw Border [cite: 21]
  ctx.strokeStyle = "#444";
  ctx.lineWidth = 5;
  ctx.strokeRect(-2000, -2000, 4000, 4000);

  // Draw Food [cite: 22, 23]
  for (const f of food) {
    ctx.beginPath();
    ctx.fillStyle = "#0f0";
    ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw Players [cite: 24, 25]
  for (const p of Object.values(players)) {
    ctx.beginPath();
    ctx.fillStyle = p.color;
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.font = "14px Arial";
    ctx.fillText(p.name, p.x, p.y - p.r - 8);
  }

  ctx.restore();

  // UI [cite: 26, 27]
  if (!isCamera && players[id]) {
    scoreDiv.innerText = `Score: ${players[id].score}`;
  } else if (isCamera) {
    scoreDiv.innerText = `🎥 Camera Mode | Zoom: ${cameraZoom.toFixed(2)}`;
  }

  // Draw Joystick Visual [cite: 29]
  if (touchActive) {
    ctx.beginPath();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    ctx.arc(touchStart.x, touchStart.y, 40, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.arc(touchMove.x, touchMove.y, 10, 0, Math.PI * 2);
    ctx.fill();
  }

  requestAnimationFrame(draw);
}

function loop() {
  move();
}
setInterval(loop, 1000 / 60);
draw();

window.onresize = () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
};


