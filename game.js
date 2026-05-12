// grab the three main pieces we need right away
const playBtn = document.getElementById("play-btn");
const startScreen = document.getElementById("startScreen");
const container = document.getElementById("container");

// when the player hits Play, hide the start screen and kick everything off
playBtn.addEventListener("click", function () {
  startScreen.style.visibility = "hidden";
  buildGameScreen();
  showCountdown();
});

// these are the six barrel positions laid out as [left%, top%, width%, height%]
// the first three sit in the back row and the last three are up front
const barrel = [
  // back row (smaller, higher)
  [13, 18, 22, 42],
  [39, 18, 22, 42],
  [65, 18, 22, 42],
  // front row (bigger, lower)
  [8, 48, 27, 48],
  [36, 48, 27, 48],
  [63, 48, 27, 48],
];

// how long a single round lasts in seconds
const gameSecond = 30;

// all the stuff we need to keep track of while a game is running
let score = 0;
let lives = 3;
let timeLeft = gameSecond;
let running = false;
let active = {}; // tracks which barrel slots currently have a monkey popped up
let spawnTimers = []; // we collect all the timeouts here so we can cancel them cleanly on game over
let countdownTimer = null;

// saves the highest score the player has reached this session using localStorage
let highScore = localStorage.getItem("wamHighScore") || 0;

// wipes the container and builds the actual game layout from scratch
function buildGameScreen() {
  container.innerHTML = "";
  container.style.backgroundImage = "url(images/bgd.png)";
  container.style.backgroundSize = "cover";
  container.style.backgroundPosition = "center";
  container.style.position = "relative";
  container.style.overflow = "hidden";

  // the heads up display at the top showing score, time, and banana lives
  const hud = document.createElement("div");
  hud.id = "hud";
  hud.innerHTML = `
    <span>SCORE: <span id="scoreDisplay">0</span></span>
    <span>TIME: <span id="timerDisplay">${gameSecond}</span>s</span>
    <span id="livesDisplay">🍌🍌🍌</span>
    <span>BEST: <span id="highScoreDisplay">${highScore}</span></span>
  `;
  container.appendChild(hud);

  // spin through the barrel positions and create a clickable slot for each one
  barrel.forEach(([l, t, w, h], i) => {
    const slot = document.createElement("div");
    slot.className = "barrel-slot";
    slot.dataset.index = i;
    slot.style.cssText = `left:${l}%;top:${t}%;width:${w}%;height:${h}%;`;

    // the monkey wrapper is slightly narrower on back row barrels to match the perspective
    const mw = document.createElement("div");
    mw.className = "monkey-wrap";
    mw.style.width = i < 3 ? "80%" : "90%";

    const img = document.createElement("img");
    img.className = "monkey-img";
    img.src = "images/monkey.png";
    img.alt = "monkey";
    mw.appendChild(img);
    slot.appendChild(mw);

    // clicking a barrel slot triggers the whack logic
    slot.addEventListener("click", () => whack(i, slot));
    container.appendChild(slot);
  });

  // the floating message element that flashes +10 or BOOM in the middle of the screen
  const msg = document.createElement("div");
  msg.id = "floatMsg";
  container.appendChild(msg);

  injectStyles();
}

// shows the 5 4 3 2 1 GO! overlay before the game actually starts
function showCountdown() {
  const overlay = document.createElement("div");
  overlay.id = "countdownScreen";
  overlay.innerHTML = `
    <h2>GET READY!</h2>
    <div id="countNum">5</div>
    <p>Whack the monkey avoid the MONKEYS WITH BOMB💣!</p>
  `;
  container.appendChild(overlay);

  let count = 5;
  const num = overlay.querySelector("#countNum");

  const tick = setInterval(() => {
    count--;
    if (count > 0) {
      num.textContent = count;
      // force the browser to reset the animation so the pop plays every tick
      num.style.animation = "none";
      void num.offsetWidth;
      num.style.animation = "popIn 0.4s ease-out";
    } else {
      // swap to GO! in green and then let the game begin a beat later
      num.textContent = "GO!";
      num.style.color = "#7eff7e";
      num.style.animation = "none";
      void num.offsetWidth;
      num.style.animation = "popIn 0.5s ease-out";
      clearInterval(tick);
      setTimeout(() => {
        overlay.remove();
        beginGame();
      }, 700);
    }
  }, 800);
}

// dumps all the game styles into the document head once since it wont full develop in style.css, avoids duplicates on restart
function injectStyles() {
  if (document.getElementById("wam-styles")) return;
  const style = document.createElement("style");
  style.id = "wam-styles";
  style.textContent = `
    #hud {
      position: absolute;
      top: 0; left: 0; right: 0;
      z-index: 20;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 20px;
      background: rgba(0,0,0,0.55);
      color: #f5d94e;
      font-size: 11px;
    }
    #livesDisplay { font-size: 18px; }

    .barrel-slot {
      position: absolute;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      overflow: hidden;
      cursor: pointer;
    }

    .monkey-wrap {
      position: absolute;
      bottom: 5%;
      left: 45%;
      transform: translateX(-50%) translateY(120%);
      transition: transform 0.2s ease-out;
      z-index: 4;
      pointer-events: none;
    }
    .barrel-slot.active .monkey-wrap {
      transform: translateX(-45%) translateY(0%);
    }
    .monkey-wrap img {
      width: 250%;
      display: block;
      object-fit: contain;
      mix-blend-mode: screen;
    }

    .barrel-slot.hit-good .monkey-wrap img { filter: brightness(1.8) saturate(2); }
    .barrel-slot.hit-bad  .monkey-wrap img { filter: hue-rotate(200deg) brightness(1.5); }

    #floatMsg {
      position: absolute;
      top: 38%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-family: "Press Start 2P", system-ui;
      font-size: 30px;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.15s;
      z-index: 30;
      text-shadow: 2px 2px 0 #000;
    }
    #floatMsg.good { opacity: 1; color: #7eff7e; }
    #floatMsg.bad  { opacity: 1; color: #ff6e6e; }

    #countdownScreen {
      position: absolute;
      inset: 0;
      background: rgba(0,0,0,0.82);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 14px;
      z-index: 40;
    }
    #countdownScreen h2 {
      color: #f5d94e;
      font-family: "Press Start 2P", system-ui;
      font-size: 16px;
      text-align: center;
    }
    #countdownScreen p {
      color: #ddd;
      font-family: "Press Start 2P", system-ui;
      font-size: 9px;
      text-align: center;
      line-height: 2.2;
    }
    #countNum {
      color: #f5d94e;
      font-family: "Press Start 2P", system-ui;
      font-size: 72px;
      animation: popIn 0.4s ease-out;
    }
    @keyframes popIn {
      0%   { transform: scale(0.4); opacity: 0; }
      70%  { transform: scale(0.9); opacity: 1; }
      100% { transform: scale(1);   opacity: 1; }
    }

    @keyframes shake {
      0%, 100% { transform: translate(0, 0); }
      20%      { transform: translate(-10px, 5px); }
      40%      { transform: translate(10px, -5px); }
      60%      { transform: translate(-8px, 8px); }
      80%      { transform: translate(8px, -3px); }
    }
    .shake { animation: shake 0.4s ease-out; }

    #gameOverScreen {
      position: absolute;
      inset: 0;
      background: rgba(0,0,0,0.82);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      z-index: 40;
    }
    #gameOverScreen h2 {
      color: #f5d94e;
      font-family: "Press Start 2P", system-ui;
      font-size: 16px;
      text-align: center;
    }
    #gameOverScreen p {
      color: #ddd;
      font-family: "Press Start 2P", system-ui;
      font-size: 9px;
      text-align: center;
      line-height: 2.2;
    }
    #restartBtn {
      background: #f5d94e;
      color: #1a1a1a;
      border: none;
      padding: 10px 24px;
      font-family: "Press Start 2P", system-ui;
      font-size: 9px;
      cursor: pointer;
      border-radius: 6px;
    }
    #restartBtn:hover { background: #ffe87a; }
  `;
  document.head.appendChild(style);
}

// resets all the values and gets the actual game ticking
function beginGame() {
  score = 0;
  lives = 3;
  timeLeft = gameSecond;
  running = true;
  active = {};
  updateHUD();
  spawnLoop();
  // this interval counts down the timer every second and ends the game when it hits zero
  countdownTimer = setInterval(() => {
    timeLeft--;
    const t = document.getElementById("timerDisplay");
    if (t) t.textContent = timeLeft;
    if (timeLeft <= 0) endGame();
  }, 1000);
}

// keeps calling itself to randomly pop monkeys up, picks from whatever slots are free
function spawnLoop() {
  if (!running) return;
  const slots = document.querySelectorAll(".barrel-slot");
  const available = Array.from(slots).filter((s) => !active[s.dataset.index]);
  if (available.length) {
    const slot = available[Math.floor(Math.random() * available.length)];
    popUp(slot);
  }
  // faster spawn: was 700 + 500, now 400 + 300
  const t = setTimeout(spawnLoop, 400 + Math.random() * 300);
  spawnTimers.push(t);
}

// pops a monkey (or bomb monkey) up out of a barrel slot for a short window
function popUp(slot) {
  const i = slot.dataset.index;
  if (active[i]) return; // bail if something is already in this slot
  const isBomb = Math.random() < 0.3; // roughly 30% chance it is a bomb monkey
  slot.querySelector(".monkey-img").src = isBomb
    ? "images/monkey_bomb.png"
    : "images/monkey.png";
  slot.dataset.type = isBomb ? "bomb" : "monkey";
  slot.classList.add("active");
  active[i] = true;
  // shorter stay: was 1000 + 700, now 700 + 400
  const stay = 700 + Math.random() * 400;
  const t = setTimeout(() => {
    // monkey ducked back down on its own without being whacked, just clean up
    slot.classList.remove("active", "hit-good", "hit-bad");
    delete active[i];
  }, stay);
  spawnTimers.push(t);
}

// handles what happens when the player clicks a barrel slot
function whack(i, slot) {
  if (!running || !active[i]) return; // ignore clicks on empty barrels or when the game is stopped
  const type = slot.dataset.type;
  slot.classList.remove("active");
  delete active[i];

  if (type === "monkey") {
    score += 10;
    slot.classList.add("hit-good");
    showMsg("+10!", "good");
    setTimeout(() => slot.classList.remove("hit-good"), 350);
  } else {
    // ouch, player hit a bomb monkey
    lives--;
    slot.classList.add("hit-bad");
    showMsg("BOOM! -1 🍌", "bad");
    triggerBombEffect();
    setTimeout(() => slot.classList.remove("hit-bad"), 350);
    if (lives <= 0) {
      endGame();
      return;
    }
  }
  updateHUD();
}

// the satisfying punishment for hitting a bomb: red flash + screen shake
function triggerBombEffect() {
  // slap a red overlay on the screen and fade it out
  const flash = document.createElement("div");
  flash.style.cssText =
    "position:absolute;inset:0;background:rgba(255,0,0,0.5);z-index:35;pointer-events:none;transition:opacity 0.4s;";
  container.appendChild(flash);
  setTimeout(() => {
    flash.style.opacity = "0";
  }, 50);
  setTimeout(() => flash.remove(), 500);

  // remove and re-add the shake class so the animation always replays from the start
  container.classList.remove("shake");
  void container.offsetWidth;
  container.classList.add("shake");
  setTimeout(() => container.classList.remove("shake"), 400);
}

// keeps the score, timer, and banana icons in sync with the actual values
function updateHUD() {
  const s = document.getElementById("scoreDisplay");
  const l = document.getElementById("livesDisplay");
  const h = document.getElementById("highScoreDisplay");
  if (s) s.textContent = score;
  if (l) l.textContent = "🍌".repeat(lives) + "❌".repeat(3 - lives);
  if (h) h.textContent = highScore;
}

// flashes a message in the center of the screen for a moment then hides it
function showMsg(text, type) {
  const el = document.getElementById("floatMsg");
  if (!el) return;
  el.textContent = text;
  el.className = type;
  setTimeout(() => (el.className = ""), 650);
}

// saves the high score to localStorage if the player beat their previous best
function saveHighScore() {
  if (score > highScore) {
    highScore = score;
    localStorage.setItem("wamHighScore", highScore);
  }
}

// wraps everything up: stops all timers, shows the final score, and sets up the play again button
function endGame() {
  running = false;
  spawnTimers.forEach(clearTimeout);
  spawnTimers = [];
  clearInterval(countdownTimer);

  // check and save high score before showing the screen
  saveHighScore();

  // give the player a little feedback based on how well they did
  const praise =
    score >= 100
      ? "🏆 BANANA MASTER!"
      : score >= 50
        ? "🐒 Nice moves!"
        : "🍌 Keep swinging!";

  // let the player know if they set a new record
  const newBest = score >= highScore ? "<br><br>🌟 NEW HIGH SCORE!" : "";

  const screen = document.createElement("div");
  screen.id = "gameOverScreen";
  screen.innerHTML = `
    <h2>GAME OVER!</h2>
    <p>FINAL SCORE: ${score}${newBest}<br><br>${praise}</p>
    <button id="restartBtn">▶ PLAY AGAIN</button>
  `;
  container.appendChild(screen);

  // play again clears out the old state and runs the countdown again
  document.getElementById("restartBtn").addEventListener("click", () => {
    screen.remove();
    document.querySelectorAll(".barrel-slot").forEach((s) => {
      s.classList.remove("active", "hit-good", "hit-bad");
      delete active[s.dataset.index];
    });
    showCountdown();
  });
}
