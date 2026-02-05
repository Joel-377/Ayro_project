const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreDiv = document.getElementById("score");

canvas.width = innerWidth;
canvas.height = innerHeight;

const socket = io();
const id = Math.random().toString(36).slice(2);

const name = prompt("Name:");
const isCamera = name.toLowerCase() === "camera";
const color = isCamera ? "#fff" : prompt("Color (red / #00ff00)");

socket.emit("join", { id, name, color });

let players = {};
let food = {};
let keys = {};
let cameraZoom = isCamera ? 0.2 : 1;

// ---------------- MOBILE JOYSTICK ----------------
let touchActive = false;
let touchStart = { x: 0, y: 0 };
let touchMove = { x: 0, y: 0 };

canvas.addEventListener("touchstart", e => {
  if (isCamera) return;
  const t = e.touches[0];
  touchActive = true;
  touchStart = { x: t.clientX, y: t.clientY };
  touchMove = { x: t.clientX, y: t.clientY };
});

canvas.addEventListener("touchmove", e => {
  if (!touchActive) return;
  const t = e.touches[0];
  touchMove = { x: t.clientX, y: t.clientY };
});

canvas.addEventListener("touchend", () => {
  touchActive = false;
});

// ---------------- KEYBOARD ----------------
document.addEventListener("keydown", e => keys[e.key.toLowerCase()] = true);
document.addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);

// ---------------- CAMERA ZOOM ----------------
window.addEventListener("wheel", e => {
  if (!isCamera) return;
  cameraZoom = Math.min(Math.max(cameraZoom + e.deltaY * -0.001, 0.1), 1);
});

// ---------------- NETWORK ----------------
socket.on("state", data => {
  players = data.players;
  food = data.food;
});

socket.on("winner", w => alert(`${w} wins!`));

// ---------------- MOVE ----------------
function move() {
  if (isCamera) return;

  let dx = 0;
  let dy = 0;

  // Keyboard
  if (keys["w"]) dy--;
  if (keys["s"]) dy++;
  if (keys["a"]) dx--;
  if (keys["d"]) dx++;

  // Mobile joystick
  if (touchActive) {
    dx = touchMove.x - touchStart.x;
    dy = touchMove.y - touchStart.y;

    const mag = Math.hypot(dx, dy);
    if (mag > 0) {
      dx /= mag;
      dy /= mag;
    }
  }

  socket.emit("move", { id, dx, dy });
}

// ---------------- DRAW ----------------
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();

  const zoom = isCamera ? cameraZoom : 1;
  ctx.scale(zoom, zoom);

  if (isCamera) {
    ctx.translate(canvas.width / 2 / zoom, canvas.height / 2 / zoom);
  } else {
    const me = players[id];
    if (!me) return;
    ctx.translate(
      canvas.width / 2 / zoom - me.x,
      canvas.height / 2 / zoom - me.y
    );
  }

  // World border
  ctx.strokeStyle = "#444";
  ctx.lineWidth = 4;
  ctx.strokeRect(-1000, -1000, 2000, 2000);

  // Food
  for (const f of food) {
    ctx.beginPath();
    ctx.fillStyle = "#0f0";
    ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Players
  for (const p of Object.values(players)) {
    ctx.beginPath();
    ctx.fillStyle = p.color;
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.fillText(p.name, p.x, p.y - p.r - 8);
  }

  ctx.restore();

  // UI
  if (!isCamera && players[id]) {
    scoreDiv.innerText = `Score: ${players[id].score}`;
  } else {
    scoreDiv.innerText = `🎥 Camera | Zoom ${cameraZoom.toFixed(2)}`;
  }

  // Draw joystick
  if (touchActive) {
    ctx.beginPath();
    ctx.strokeStyle = "white";
    ctx.arc(touchStart.x, touchStart.y, 40, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.fillStyle = "white";
    ctx.arc(touchMove.x, touchMove.y, 10, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---------------- LOOP ----------------
function loop() {
  move();
  draw();
  requestAnimationFrame(loop);
}
loop();

window.onresize = () => {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
};




