from flask import Flask, render_template, request
from flask_socketio import SocketIO
import random
import math
import threading
import time

app = Flask(__name__)
socketio = SocketIO(app, async_mode="threading")

WORLD_SIZE = 2000
FOOD_COUNT = 1000
SPAWN_RADIUS = 20
ORB_RADIUS = 6
RESPAWN_PROTECT_TIME = 2
MOVE_SPEED = 4.5

players = {}
spectators = set()
food = []
round_active = True
game_ending = False

# ---------------- HELPERS ----------------
def spawn_food():
    return {
        "x": random.randint(-WORLD_SIZE, WORLD_SIZE),
        "y": random.randint(-WORLD_SIZE, WORLD_SIZE),
        "r": ORB_RADIUS
    }

def reset_game():
    global food, round_active, game_ending

    for p in players.values():
        p["x"] = 0
        p["y"] = 0
        p["r"] = SPAWN_RADIUS
        p["score"] = 0
        p["spawn_time"] = time.time()

    food.clear()
    for _ in range(FOOD_COUNT):
        food.append(spawn_food())

    round_active = True
    game_ending = False

def end_round(winner):
    global round_active, game_ending
    round_active = False
    socketio.emit("winner", winner)
    time.sleep(3)
    reset_game()
    socketio.emit("state", {"players": players, "food": food})

reset_game()

# ---------------- ROUTES ----------------
@app.route("/")
def index():
    return render_template("index.html")

# ---------------- SOCKET EVENTS ----------------
@socketio.on("join")
def join(data):
    name = data["name"].lower()

    # 🎥 CAMERA MODE
    if name == "camera":
        spectators.add(request.sid)
        return

    players[data["id"]] = {
        "sid": request.sid,
        "x": 0,
        "y": 0,
        "r": SPAWN_RADIUS,
        "color": data["color"],
        "name": data["name"],
        "score": 0,
        "spawn_time": time.time()
    }

@socketio.on("move")
def move(data):
    global game_ending

    # ignore spectators
    if request.sid in spectators:
        socketio.emit("state", {"players": players, "food": food}, to=request.sid)
        return

    if not round_active:
        return

    pid = data["id"]
    if pid not in players:
        return

    p = players[pid]

    dx = data["dx"]
    dy = data["dy"]
    mag = math.hypot(dx, dy)
    if mag > 0:
        dx /= mag
        dy /= mag

    p["x"] += dx * MOVE_SPEED
    p["y"] += dy * MOVE_SPEED

    p["x"] = max(-WORLD_SIZE, min(WORLD_SIZE, p["x"]))
    p["y"] = max(-WORLD_SIZE, min(WORLD_SIZE, p["y"]))

    # ---- FOOD ----
    for f in food[:]:
        if math.hypot(p["x"] - f["x"], p["y"] - f["y"]) < p["r"] + f["r"]:
            food.remove(f)
            p["score"] += 1
            p["r"] += 0.4

            if len(food) == 0 and not game_ending:
                game_ending = True
                threading.Thread(
                    target=end_round,
                    args=(p["name"],),
                    daemon=True
                ).start()
            break

    # ---- PLAYER EATING ----
    now = time.time()
    for oid, other in list(players.items()):
        if oid == pid:
            continue

        if now - other["spawn_time"] < RESPAWN_PROTECT_TIME:
            continue

        if math.hypot(p["x"] - other["x"], p["y"] - other["y"]) < p["r"]:
            if p["r"] > other["r"] + 5:
                gain = max(other["r"] - SPAWN_RADIUS, 0)
                p["r"] += gain * 0.4
                p["score"] += other["score"]

                other["x"] = 0
                other["y"] = 0
                other["r"] = SPAWN_RADIUS
                other["score"] = 0
                other["spawn_time"] = time.time()

    socketio.emit("state", {"players": players, "food": food})

@socketio.on("disconnect")
def disconnect():
    sid = request.sid

    spectators.discard(sid)

    for pid, p in list(players.items()):
        if p["sid"] == sid:
            del players[pid]
            break

# ---------------- RUN ----------------
if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 3000))
    socketio.run(app, host="0.0.0.0", port=port)
