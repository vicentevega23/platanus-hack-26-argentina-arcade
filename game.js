// Platanus Escape — retro startup runner for Platanus Hack 26.
// Choose Rafa or Natochi, collect money, dodge angry programmers, and escape
// the giant Platanus banana.

const W = 800;
const H = 600;
const TRACK_Y = 468;
const GOAL_M = 1500;
const STORAGE_KEY = 'platanus-escape-26-scores';
const MAX_HI = 5;
const NAME_LEN = 3;

const BRAND_Y1 = 0xffec40;
const BRAND_Y2 = 0xf9bc12;
const BRAND_G = 0x7cc85b;
const BRAND_BG = 0x10162c;
const BRAND_CYAN = 0x8defff;
const BRAND_RED = 0xff6f66;
const BRAND_WHITE = 0xf6f7fb;

const CABINET_KEYS = {
  P1_U: ['w', 'ArrowUp'],
  P1_D: ['s', 'ArrowDown'],
  P1_L: ['a', 'ArrowLeft'],
  P1_R: ['d', 'ArrowRight'],
  P1_1: ['u', 'z', 'x'],
  P1_2: ['i'],
  P1_3: ['o'],
  P1_4: ['j'],
  P1_5: ['k'],
  P1_6: ['l'],
  P2_U: ['ArrowUp'],
  P2_D: ['ArrowDown'],
  P2_L: ['ArrowLeft'],
  P2_R: ['ArrowRight'],
  P2_1: ['r'],
  P2_2: ['t'],
  P2_3: ['y'],
  P2_4: ['f'],
  P2_5: ['g'],
  P2_6: ['h'],
  START1: ['Enter', ' '],
  START2: ['2'],
};

function normalizeKey(key) {
  if (typeof key !== 'string' || !key.length) return '';
  return key === ' ' ? 'space' : key.toLowerCase();
}

const KEY_TO_ARCADE = {};
for (const [code, keys] of Object.entries(CABINET_KEYS)) {
  for (const key of keys) KEY_TO_ARCADE[normalizeKey(key)] = code;
}

const held = Object.create(null);
const pressed = Object.create(null);

window.addEventListener('keydown', (event) => {
  const code = KEY_TO_ARCADE[normalizeKey(event.key)];
  if (!code) return;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
    event.preventDefault();
  }
  if (!held[code]) pressed[code] = true;
  held[code] = true;
});

window.addEventListener('keyup', (event) => {
  const code = KEY_TO_ARCADE[normalizeKey(event.key)];
  if (code) held[code] = false;
});

function consume(codes) {
  for (const code of codes) {
    if (pressed[code]) {
      pressed[code] = false;
      return true;
    }
  }
  return false;
}

function getStorage() {
  if (window.platanusArcadeStorage) return window.platanusArcadeStorage;
  return {
    async get(key) {
      try {
        const raw = window.localStorage.getItem(key);
        return raw === null
          ? { found: false, value: null }
          : { found: true, value: JSON.parse(raw) };
      } catch {
        return { found: false, value: null };
      }
    },
    async set(key, value) {
      window.localStorage.setItem(key, JSON.stringify(value));
    },
  };
}

async function loadScores() {
  const result = await getStorage().get(STORAGE_KEY);
  if (!result.found || !Array.isArray(result.value)) return [];
  return result.value
    .filter((entry) => entry && typeof entry.name === 'string' && typeof entry.score === 'number')
    .slice(0, MAX_HI);
}

async function saveScores(list) {
  return getStorage().set(STORAGE_KEY, list);
}

let AC = null;

function wakeAudio() {
  if (!AC) {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    AC = new AudioCtor();
  }
  if (AC.state === 'suspended') AC.resume();
}

function beep(freq, type, vol, dur, endFreq) {
  if (!AC) return;
  const osc = AC.createOscillator();
  const gain = AC.createGain();
  osc.type = type || 'square';
  osc.frequency.setValueAtTime(freq, AC.currentTime);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, AC.currentTime + dur);
  gain.gain.setValueAtTime(vol, AC.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + dur);
  osc.connect(gain);
  gain.connect(AC.destination);
  osc.start();
  osc.stop(AC.currentTime + dur);
}

function noise(vol, dur) {
  if (!AC) return;
  const buf = AC.createBuffer(1, AC.sampleRate * dur, AC.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = AC.createBufferSource();
  const gain = AC.createGain();
  src.buffer = buf;
  gain.gain.setValueAtTime(vol, AC.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + dur);
  src.connect(gain);
  gain.connect(AC.destination);
  src.start();
}

const SFX = {
  move: () => beep(750, 'square', 0.05, 0.05, 980),
  jump: () => beep(350, 'square', 0.07, 0.12, 620),
  hit: () => {
    beep(180, 'sawtooth', 0.17, 0.18, 60);
    noise(0.08, 0.12);
  },
  pickup: () => {
    beep(620, 'triangle', 0.08, 0.05);
    setTimeout(() => beep(930, 'triangle', 0.08, 0.07), 45);
  },
  cash: () => {
    beep(860, 'square', 0.05, 0.03);
    setTimeout(() => beep(1180, 'square', 0.05, 0.05), 25);
  },
  select: () => beep(680, 'square', 0.08, 0.08, 1180),
  start: () => {
    [330, 495, 660].forEach((f, i) => setTimeout(() => beep(f, 'square', 0.07, 0.08), i * 70));
  },
  lose: () => {
    beep(150, 'sawtooth', 0.24, 0.38, 55);
    noise(0.12, 0.2);
  },
  clear: () => {
    [392, 523, 659, 784].forEach((f, i) => setTimeout(() => beep(f, 'triangle', 0.09, 0.12), i * 90));
  },
};

const ACTORS = [
  {
    name: 'RAFA',
    hair: 0x101010,
    hair2: 0x2a2a2a,
    skin: 0xe8c3aa,
    shirt: 0x18a867,
    pants: 0x314fcd,
    shoe: 0x111111,
    accent: BRAND_Y1,
    shirtStripe: 0x0e6d42,
    shaggy: false,
  },
  {
    name: 'NATOCHI',
    hair: 0x111111,
    hair2: 0x3a3a3a,
    skin: 0xe0b59f,
    shirt: 0x18a867,
    pants: 0x5d2a97,
    shoe: 0x111111,
    accent: BRAND_CYAN,
    shirtStripe: 0x0f7a4b,
    shaggy: true,
  },
];

const LETTER_GRID = [
  ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
  ['H', 'I', 'J', 'K', 'L', 'M', 'N'],
  ['O', 'P', 'Q', 'R', 'S', 'T', 'U'],
  ['V', 'W', 'X', 'Y', 'Z', '.', '-'],
  ['DEL', 'END'],
];

let STATE = 'boot';
let highScores = [];
let hiScore = 0;
let selectedChar = 0;
let outcomeText = '';
let finishBonus = 0;
let scoreValue = 0;
let moneyValue = 0;
let distanceM = 0;
let worldSpeed = 5.35;
let bananaGap = 122;
let spawnCd = 62;
let gameTick = 0;
let entryName = [];
let letterRow = 0;
let letterCol = 0;
let moveCd = 0;
let savedMessage = '';

const player = {
  x: 176,
  y: TRACK_Y,
  vy: 0,
  vx: 0,
  onGround: true,
  duck: false,
  hitT: 0,
  boostT: 0,
  anim: 0,
};

const OBSTACLES = [];
const PICKUPS = [];
const DUST = [];

const SKY_STARS = [];
for (let i = 0; i < 44; i++) {
  SKY_STARS.push({
    x: Math.random() * W,
    y: 34 + Math.random() * 220,
    r: 1 + Math.random() * 2,
    a: 0.25 + Math.random() * 0.55,
  });
}

const LAYERS = [
  makeBuildings(0x162447, 0.22, 210, 14, 26),
  makeBuildings(0x22356b, 0.38, 255, 18, 32),
  makeBuildings(0x2f4f88, 0.64, 312, 24, 40),
];

function makeBuildings(color, speed, baseY, minW, maxW) {
  const out = [];
  let x = -40;
  while (x < W + 120) {
    const w = minW + Math.random() * (maxW - minW);
    const h = 60 + Math.random() * 120;
    out.push({
      x,
      w,
      h,
      y: baseY - h,
      color,
      speed,
      tone: 0.18 + Math.random() * 0.22,
    });
    x += w + 10 + Math.random() * 24;
  }
  return out;
}

function resetRun() {
  STATE = 'play';
  outcomeText = '';
  finishBonus = 0;
  scoreValue = 0;
  moneyValue = 0;
  distanceM = 0;
  worldSpeed = 5.35;
  bananaGap = 122;
  spawnCd = 62;
  gameTick = 0;
  OBSTACLES.length = 0;
  PICKUPS.length = 0;
  DUST.length = 0;
  player.x = 176;
  player.y = TRACK_Y;
  player.vx = 0;
  player.vy = 0;
  player.onGround = true;
  player.duck = false;
  player.hitT = 0;
  player.boostT = 0;
  player.anim = 0;
}

function playerHeight() {
  return player.duck && player.onGround ? 30 : 46;
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function playerRect() {
  const h = playerHeight();
  return { x: player.x - 13, y: player.y - h, w: 26, h };
}

function gapAt(x) {
  for (const o of OBSTACLES) {
    if (o.kind === 'gap' && x > o.x + 8 && x < o.x + o.w - 8) return true;
  }
  return false;
}

function addDust(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI;
    const speed = 0.4 + Math.random() * 2.6;
    DUST.push({
      x,
      y,
      vx: Math.cos(angle) * speed - 0.6,
      vy: -Math.sin(angle) * speed,
      life: 16 + Math.random() * 18,
      maxLife: 30,
      color,
      r: 2 + Math.random() * 3,
    });
  }
}

function tickDust() {
  for (let i = DUST.length - 1; i >= 0; i--) {
    const p = DUST[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.12;
    p.vx *= 0.96;
    p.life--;
    if (p.life <= 0) DUST.splice(i, 1);
  }
}

function tickBackdrop() {
  for (const layer of LAYERS) {
    let maxX = -9999;
    for (const b of layer) {
      b.x -= worldSpeed * b.speed;
      if (b.x + b.w < -40) {
        b.x = W + 20 + Math.random() * 40;
        b.w = Math.max(16, b.w + (Math.random() * 8 - 4));
        b.h = 60 + Math.random() * 120;
        b.y = TRACK_Y - 100 - Math.random() * 100;
      }
      if (b.x > maxX) maxX = b.x + b.w;
      b.y = Math.min(TRACK_Y - 64, TRACK_Y - 28 - b.h);
    }
    for (const b of layer) {
      if (b.x + b.w < -40) {
        b.x = maxX + 10 + Math.random() * 28;
        b.w = Math.max(16, 14 + Math.random() * 30);
        b.h = 60 + Math.random() * 120;
        b.y = TRACK_Y - 28 - b.h;
        b.tone = 0.18 + Math.random() * 0.22;
        maxX = b.x + b.w;
      }
    }
  }
}

function spawnObstacle(kind, x) {
  if (kind === 'gap') {
    OBSTACLES.push({
      kind,
      x,
      w: 76 + Math.random() * 32,
      h: H - TRACK_Y + 20,
    });
  } else if (kind === 'dev') {
    OBSTACLES.push({
      kind,
      x,
      y: TRACK_Y - 36,
      w: 30,
      h: 36,
      mood: Math.random() < 0.5 ? 'angry' : 'rage',
    });
  } else if (kind === 'scooter') {
    OBSTACLES.push({
      kind,
      x,
      y: TRACK_Y - 34,
      w: 40,
      h: 34,
      phase: Math.random() * Math.PI * 2,
    });
  } else if (kind === 'drone') {
    OBSTACLES.push({
      kind,
      x,
      y: TRACK_Y - 92,
      w: 34,
      h: 22,
      phase: Math.random() * Math.PI * 2,
    });
  } else {
    OBSTACLES.push({
      kind: 'rant',
      x,
      y: TRACK_Y - 54,
      w: 68,
      h: 18,
      text: Math.random() < 0.5 ? '404' : 'BUG',
    });
  }
}

function spawnMoney(x, y, value, kind) {
  PICKUPS.push({
    kind: kind || 'cash',
    x,
    y,
    w: 18,
    h: 18,
    bob: Math.random() * Math.PI * 2,
    value: value || 120,
  });
}

function spawnMoneyArc(x, count, arcTop) {
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const y = TRACK_Y - arcTop + Math.sin(t * Math.PI) * -28;
    spawnMoney(x + i * 24, y, 80 + i * 10, i % 2 === 0 ? 'cash' : 'term');
  }
}

function setSpawnDelay(base, spread, intensity) {
  spawnCd = Math.max(32, base - intensity * 18 + Math.random() * spread);
}

function spawnPattern() {
  const x = W + 96;
  const roll = Math.random();
  const intensity = Math.min(distanceM / GOAL_M, 1);
  if (roll < 0.15) {
    spawnObstacle('gap', x);
    if (intensity > 0.45 && Math.random() < 0.45) spawnObstacle('drone', x + 42);
    spawnMoneyArc(x + 12, 4, 112 + intensity * 12);
    setSpawnDelay(96, 24, intensity);
  } else if (roll < 0.34) {
    spawnObstacle('scooter', x);
    if (intensity > 0.28 && Math.random() < 0.55) spawnObstacle('dev', x + 62);
    spawnMoneyArc(x + 6, 3 + (intensity > 0.6 ? 1 : 0), 88);
    setSpawnDelay(68, 18, intensity);
  } else if (roll < 0.52) {
    spawnObstacle('dev', x);
    if (Math.random() < 0.35 + intensity * 0.3) spawnObstacle('dev', x + 52);
    if (intensity > 0.4 && Math.random() < 0.45) spawnObstacle('drone', x + 104);
    spawnMoneyArc(x - 8, 3, 82);
    setSpawnDelay(70, 20, intensity);
  } else if (roll < 0.68) {
    spawnObstacle('drone', x);
    if (intensity > 0.5 && Math.random() < 0.5) spawnObstacle('drone', x + 78);
    spawnMoneyArc(x + 8, 3, 120);
    setSpawnDelay(72, 18, intensity);
  } else if (roll < 0.84) {
    spawnObstacle('rant', x);
    if (intensity > 0.25 && Math.random() < 0.5) spawnObstacle('scooter', x + 92);
    spawnMoneyArc(x + 10, 3, 96);
    setSpawnDelay(78, 18, intensity);
  } else if (roll < 0.93) {
    spawnMoneyArc(x, 4 + (intensity > 0.55 ? 1 : 0), 92 + Math.random() * 24);
    if (intensity > 0.65 && Math.random() < 0.5) spawnObstacle('drone', x + 54);
    setSpawnDelay(52, 14, intensity);
  } else {
    spawnObstacle('scooter', x);
    spawnObstacle('rant', x + 86);
    if (intensity > 0.38) spawnObstacle('dev', x + 156);
    if (intensity > 0.72) spawnObstacle('drone', x + 122);
    spawnMoneyArc(x + 18, 5, 106);
    setSpawnDelay(96, 18, intensity);
  }
}

function hitPenalty(amount) {
  if (player.hitT > 0) return;
  player.hitT = 32;
  player.vx = -3.2;
  bananaGap -= amount;
  addDust(player.x + 2, player.y - 10, 0xff9b6b, 14);
  SFX.hit();
}

function pickupMoney(pickup) {
  const gapGain = pickup.kind === 'term' ? 16 : 10;
  bananaGap += gapGain;
  moneyValue += pickup.value;
  scoreValue += pickup.value;
  if (pickup.kind === 'term') player.boostT = Math.max(player.boostT, 60);
  addDust(pickup.x, pickup.y, pickup.kind === 'term' ? BRAND_CYAN : BRAND_Y1, 9);
  if (pickup.kind === 'term') SFX.pickup();
  else SFX.cash();
}

function endRun(text, clear) {
  outcomeText = text;
  finishBonus = clear ? 1400 : 0;
  scoreValue = Math.floor(distanceM * 10) + moneyValue + finishBonus;
  STATE = qualifiesForScore(scoreValue) ? 'entry' : 'result';
  savedMessage = clear ? 'DEMO DAY UNLOCKED' : 'PRESS START TO TRY AGAIN';
  entryName = [];
  letterRow = 0;
  letterCol = 0;
  moveCd = 0;
  if (clear) SFX.clear();
  else SFX.lose();
}

function qualifiesForScore(score) {
  return highScores.length < MAX_HI || score > highScores[highScores.length - 1].score;
}

function currentAxisX() {
  return (held.P1_R ? 1 : 0) - (held.P1_L ? 1 : 0);
}

function currentAxisY() {
  return (held.P1_D ? 1 : 0) - (held.P1_U ? 1 : 0);
}

function updatePlay() {
  if (consume(['START1'])) {
    STATE = 'pause';
    return;
  }

  gameTick++;
  worldSpeed = 5.35 + Math.min(distanceM / 370, 2.85) + (player.boostT > 0 ? 0.7 : 0);
  distanceM += worldSpeed * 0.16;
  if (distanceM >= GOAL_M) {
    endRun('SAFE AT DEMO DAY', true);
    return;
  }

  player.duck = held.P1_D && player.onGround;
  const axisX = currentAxisX();
  const moveSpeed = player.duck ? 2.3 : 3.35;
  player.x += axisX * moveSpeed + player.vx;
  player.vx *= 0.76;
  player.x = Phaser.Math.Clamp(player.x, 94, 310);

  if (consume(['P1_U', 'P1_1']) && player.onGround) {
    player.vy = -13;
    player.onGround = false;
    player.duck = false;
    addDust(player.x, player.y, 0xeee3b0, 8);
    SFX.jump();
  }

  player.vy += 0.68;
  player.y += player.vy;
  const overGap = gapAt(player.x);
  if (!overGap && player.y >= TRACK_Y) {
    if (!player.onGround && player.vy > 3) addDust(player.x, TRACK_Y + 1, BRAND_CYAN, 5);
    player.y = TRACK_Y;
    player.vy = 0;
    player.onGround = true;
  } else {
    player.onGround = false;
  }

  if (player.y > H + 70) {
    endRun('BURN RATE GAP', false);
    return;
  }

  bananaGap -= 0.028;
  bananaGap += (player.x - 176) * 0.0011;
  if (!player.onGround) bananaGap -= 0.006;
  if (player.boostT > 0) {
    player.boostT--;
    bananaGap += 0.076;
  }
  if (player.hitT > 0) player.hitT--;
  bananaGap = Phaser.Math.Clamp(bananaGap, 8, 168);
  if (bananaGap <= 24) {
    endRun('BANANA CAUGHT YOU', false);
    return;
  }

  spawnCd--;
  if (spawnCd <= 0) spawnPattern();

  for (let i = OBSTACLES.length - 1; i >= 0; i--) {
    const o = OBSTACLES[i];
    o.x -= worldSpeed;
    if (o.kind === 'drone') {
      o.phase += 0.14;
      o.y = TRACK_Y - 96 + Math.sin(o.phase) * 10;
    } else if (o.kind === 'scooter') {
      o.phase += 0.18;
      o.y = TRACK_Y - 34 + Math.sin(o.phase) * 2;
    }
    if (o.x + o.w < -100) OBSTACLES.splice(i, 1);
  }

  for (let i = PICKUPS.length - 1; i >= 0; i--) {
    const p = PICKUPS[i];
    p.x -= worldSpeed;
    p.bob += 0.14;
    if (p.x + p.w < -70) PICKUPS.splice(i, 1);
  }

  const pRect = playerRect();
  for (let i = OBSTACLES.length - 1; i >= 0; i--) {
    const o = OBSTACLES[i];
    if (o.kind === 'gap') continue;
    const oRect = { x: o.x, y: o.y, w: o.w, h: o.h };
    if (rectsOverlap(pRect, oRect)) {
      if (o.kind === 'dev') hitPenalty(36);
      else if (o.kind === 'scooter') hitPenalty(42);
      else if (o.kind === 'drone') hitPenalty(32);
      else if (!player.duck) hitPenalty(28);
      OBSTACLES.splice(i, 1);
    }
  }

  for (let i = PICKUPS.length - 1; i >= 0; i--) {
    const p = PICKUPS[i];
    const pickRect = { x: p.x, y: p.y + Math.sin(p.bob) * 4, w: p.w, h: p.h };
    if (rectsOverlap(pRect, pickRect)) {
      pickupMoney(p);
      PICKUPS.splice(i, 1);
    }
  }

  if (player.onGround && Math.abs(axisX) > 0) {
    player.anim += 0.26 + worldSpeed * 0.016;
  } else if (player.onGround) {
    player.anim += 0.18 + worldSpeed * 0.012;
  } else {
    player.anim += 0.09;
  }

  if (player.onGround && gameTick % 8 === 0) addDust(player.x - 8, player.y + 2, 0x95d8ff, 1);

  scoreValue = Math.floor(distanceM * 10) + moneyValue;
  tickBackdrop();
  tickDust();
}

function updateEntry(time, scene) {
  if (time >= moveCd) {
    const axisX = currentAxisX();
    const axisY = currentAxisY();
    if (axisY !== 0) {
      letterRow = Phaser.Math.Wrap(letterRow + axisY, 0, LETTER_GRID.length);
      letterCol = Math.min(letterCol, LETTER_GRID[letterRow].length - 1);
      moveCd = time + 170;
      SFX.move();
    } else if (axisX !== 0) {
      letterCol = Phaser.Math.Wrap(letterCol + axisX, 0, LETTER_GRID[letterRow].length);
      moveCd = time + 170;
      SFX.move();
    }
  }

  if (consume(['P1_1', 'START1'])) {
    SFX.select();
    const value = LETTER_GRID[letterRow][letterCol];
    if (value === 'DEL') {
      entryName.pop();
    } else if (value === 'END') {
      if (entryName.length > 0) submitScore(scene);
    } else {
      if (entryName.length >= NAME_LEN) entryName.shift();
      entryName.push(value);
    }
  }
}

async function submitScore(scene) {
  const next = highScores
    .concat({
      name: entryName.join(''),
      score: scoreValue,
      char: ACTORS[selectedChar].name,
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_HI);
  highScores = next;
  hiScore = next.length ? next[0].score : 0;
  await saveScores(next);
  savedMessage = 'RUN SAVED';
  STATE = 'result';
  refreshBoard(scene);
}

function refreshBoard(scene) {
  if (!highScores.length) {
    scene.ui.board.setText('NO FOUNDERS YET');
    return;
  }
  scene.ui.board.setText(highScores.map((entry, index) =>
    `${String(index + 1).padStart(2, '0')}  ${entry.name.padEnd(3, ' ')}  ${String(entry.score).padStart(6, ' ')}`
  ).join('\n'));
}

function drawPixelRect(g, x, y, w, h, color, alpha) {
  g.fillStyle(color, alpha == null ? 1 : alpha);
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function drawPlatanusLogo(g, x, y, s) {
  drawPixelRect(g, x - 7 * s, y + 1 * s, 4 * s, 11 * s, BRAND_Y1);
  drawPixelRect(g, x - 1 * s, y - 1 * s, 4 * s, 13 * s, BRAND_Y1);
  drawPixelRect(g, x + 5 * s, y + 1 * s, 4 * s, 11 * s, BRAND_Y1);
  drawPixelRect(g, x - 7 * s, y + 7 * s, 4 * s, 5 * s, BRAND_Y2);
  drawPixelRect(g, x - 1 * s, y + 8 * s, 4 * s, 4 * s, BRAND_Y2);
  drawPixelRect(g, x + 5 * s, y + 6 * s, 4 * s, 6 * s, BRAND_Y2);
  drawPixelRect(g, x - 8 * s, y - 1 * s, 2 * s, 4 * s, BRAND_G);
  drawPixelRect(g, x + 0 * s, y - 3 * s, 2 * s, 4 * s, BRAND_G);
  drawPixelRect(g, x + 6 * s, y - 1 * s, 2 * s, 4 * s, BRAND_G);
}

function drawSky(g) {
  drawPixelRect(g, 0, 0, W, H, 0x06070d);
  drawPixelRect(g, 0, 0, W, 264, BRAND_BG);
  g.fillStyle(0x22295c, 1);
  g.fillCircle(652, 114, 72);
  g.fillStyle(0x11d6b4, 0.15);
  g.fillCircle(138, 140, 132);
  for (const star of SKY_STARS) drawPixelRect(g, star.x, star.y, star.r, star.r, BRAND_WHITE, star.a);
}

function drawBuildings(g) {
  for (const layer of LAYERS) {
    for (const b of layer) {
      drawPixelRect(g, b.x, b.y, b.w, b.h, b.color);
      const step = 8;
      for (let wy = b.y + 8; wy < b.y + b.h - 8; wy += 12) {
        for (let wx = b.x + 5; wx < b.x + b.w - 5; wx += step) {
          if (((wx + wy) | 0) % 3 === 0) drawPixelRect(g, wx, wy, 3, 5, 0xbbe8ff, b.tone);
        }
      }
    }
  }
}

function drawRoad(g) {
  drawPixelRect(g, 0, TRACK_Y, W, H - TRACK_Y, 0x111523);
  drawPixelRect(g, 0, TRACK_Y, W, 10, 0x495487);
  for (let i = 0; i < 21; i++) {
    const x = ((i * 54 - (distanceM * 6)) % (W + 54)) - 28;
    drawPixelRect(g, x, TRACK_Y + 36, 28, 4, 0x3b456b);
  }
  for (const o of OBSTACLES) {
    if (o.kind !== 'gap') continue;
    drawPixelRect(g, o.x, TRACK_Y - 2, o.w, H - TRACK_Y + 8, 0x030303);
    drawPixelRect(g, o.x, TRACK_Y - 2, o.w, 4, BRAND_RED);
    for (let i = 0; i < o.w; i += 16) {
      drawPixelRect(g, o.x + i + 2, TRACK_Y + 4, 10, 4, BRAND_Y1);
      drawPixelRect(g, o.x + i + 4, TRACK_Y + 8, 6, 2, BRAND_G);
    }
  }
}

function drawFinish(g) {
  const x = W + (GOAL_M - distanceM) * 6 - 120;
  if (x > W + 120 || x < -180) return;
  drawPixelRect(g, x, TRACK_Y - 150, 14, 150, 0xdedede);
  drawPixelRect(g, x + 112, TRACK_Y - 150, 14, 150, 0xdedede);
  drawPixelRect(g, x - 8, TRACK_Y - 162, 142, 22, 0x19a868);
  drawPixelRect(g, x + 12, TRACK_Y - 155, 100, 10, 0x0c1020);
  drawPixelRect(g, x + 18, TRACK_Y - 154, 10, 7, BRAND_Y1);
  drawPixelRect(g, x + 34, TRACK_Y - 154, 34, 7, BRAND_Y1);
  drawPixelRect(g, x + 74, TRACK_Y - 154, 10, 7, BRAND_Y1);
}

function drawBananaFace(g, x, y, s) {
  drawPixelRect(g, x - 7 * s, y - 7 * s, 4 * s, 18 * s, BRAND_Y1);
  drawPixelRect(g, x - 6 * s, y + 8 * s, 3 * s, 4 * s, BRAND_Y2);
  drawPixelRect(g, x - 1 * s, y - 10 * s, 4 * s, 21 * s, BRAND_Y1);
  drawPixelRect(g, x - 1 * s, y + 7 * s, 4 * s, 4 * s, BRAND_Y2);
  drawPixelRect(g, x + 5 * s, y - 7 * s, 4 * s, 18 * s, BRAND_Y1);
  drawPixelRect(g, x + 5 * s, y + 7 * s, 3 * s, 5 * s, BRAND_Y2);
  drawPixelRect(g, x - 8 * s, y - 10 * s, 2 * s, 5 * s, BRAND_G);
  drawPixelRect(g, x + 0 * s, y - 13 * s, 2 * s, 5 * s, BRAND_G);
  drawPixelRect(g, x + 6 * s, y - 10 * s, 2 * s, 5 * s, BRAND_G);
  drawPixelRect(g, x - 2 * s, y - 1 * s, 2 * s, 2 * s, 0x181818);
  drawPixelRect(g, x + 3 * s, y - 1 * s, 2 * s, 2 * s, 0x181818);
  drawPixelRect(g, x, y + 4 * s, 3 * s, 2 * s, 0x181818);
  drawPixelRect(g, x, y + 7 * s, 3 * s, 1 * s, BRAND_RED);
}

function drawBanana(g) {
  const x = Math.round(player.x - bananaGap);
  const y = Math.round(TRACK_Y - 12 + Math.sin(gameTick * 0.18) * 2);
  drawPixelRect(g, x - 32, y - 60, 18, 58, BRAND_Y1);
  drawPixelRect(g, x - 30, y - 12, 14, 10, BRAND_Y2);
  drawPixelRect(g, x - 12, y - 72, 18, 70, BRAND_Y1);
  drawPixelRect(g, x - 10, y - 12, 14, 10, BRAND_Y2);
  drawPixelRect(g, x + 10, y - 62, 16, 60, BRAND_Y1);
  drawPixelRect(g, x + 11, y - 10, 12, 8, BRAND_Y2);
  drawPixelRect(g, x - 34, y - 74, 6, 14, BRAND_G);
  drawPixelRect(g, x - 8, y - 86, 6, 14, BRAND_G);
  drawPixelRect(g, x + 20, y - 76, 6, 14, BRAND_G);
  drawBananaFace(g, x - 1, y - 40, 2);
}

function drawHumanSprite(g, actor, x, y, scale, duck, altFrame, facing, enemyMode) {
  const s = scale;
  const bodyY = y - (duck ? 17 * s : 26 * s);
  const shirt = enemyMode ? 0x7c2230 : actor.shirt;
  const shirtStripe = enemyMode ? 0x5a1722 : actor.shirtStripe;
  const pants = enemyMode ? 0x242a4c : actor.pants;
  const accent = enemyMode ? BRAND_RED : actor.accent;
  const skin = enemyMode ? 0xddb8a0 : actor.skin;
  const hair = actor.hair;
  const hair2 = actor.hair2;
  const step = altFrame ? 1 : -1;
  const dir = facing < 0 ? -1 : 1;

  if (actor.shaggy) {
    drawPixelRect(g, x - 5 * s, bodyY - 1 * s, 10 * s, 4 * s, hair2);
    drawPixelRect(g, x - 6 * s, bodyY + 1 * s, 2 * s, 2 * s, hair);
    drawPixelRect(g, x + 4 * s, bodyY + 1 * s, 2 * s, 2 * s, hair);
  } else {
    drawPixelRect(g, x - 4 * s, bodyY, 8 * s, 3 * s, hair);
  }

  drawPixelRect(g, x - 4 * s, bodyY + 3 * s, 8 * s, 6 * s, skin);
  drawPixelRect(g, x - 4 * s, bodyY + 4 * s, 2 * s, 1 * s, hair);
  drawPixelRect(g, x + 2 * s, bodyY + 4 * s, 2 * s, 1 * s, hair);
  drawPixelRect(g, x - 3 * s, bodyY + 5 * s, 3 * s, 2 * s, 0x181818);
  drawPixelRect(g, x + 0 * s, bodyY + 5 * s, 3 * s, 2 * s, 0x181818);
  drawPixelRect(g, x - 1 * s, bodyY + 5 * s, 2 * s, 1 * s, BRAND_WHITE);
  drawPixelRect(g, x + 2 * s, bodyY + 5 * s, 2 * s, 1 * s, BRAND_WHITE);
  drawPixelRect(g, x - 1 * s, bodyY + 8 * s, 2 * s, 1 * s, 0x5c2a17);

  drawPixelRect(g, x - 5 * s, bodyY + 9 * s, 10 * s, duck ? 5 * s : 8 * s, shirt);
  drawPixelRect(g, x - 5 * s, bodyY + 11 * s, 10 * s, 1 * s, shirtStripe);
  if (!enemyMode) drawPlatanusLogo(g, x, bodyY + 12 * s, s / 2);
  else {
    drawPixelRect(g, x - 1 * s, bodyY + 12 * s, 2 * s, 2 * s, BRAND_WHITE);
    drawPixelRect(g, x + 2 * s, bodyY + 12 * s, 1 * s, 1 * s, BRAND_RED);
  }

  drawPixelRect(g, x - 7 * s, bodyY + 10 * s, 2 * s, 6 * s, skin);
  drawPixelRect(g, x + 5 * s, bodyY + 10 * s, 2 * s, 6 * s, skin);

  drawPixelRect(g, x - 1 * s, bodyY + 17 * s, 2 * s, 1 * s, accent);
  if (duck) {
    drawPixelRect(g, x - 4 * s, bodyY + 16 * s, 10 * s, 4 * s, pants);
    drawPixelRect(g, x + 4 * s, bodyY + 17 * s, 5 * s, 3 * s, pants);
    drawPixelRect(g, x - 5 * s, bodyY + 20 * s, 5 * s, 2 * s, actor.shoe);
    drawPixelRect(g, x + 2 * s, bodyY + 20 * s, 5 * s, 2 * s, actor.shoe);
  } else {
    drawPixelRect(g, x - 4 * s, bodyY + 17 * s, 3 * s, 6 * s, pants);
    drawPixelRect(g, x + 1 * s, bodyY + 17 * s, 3 * s, 6 * s, pants);
    drawPixelRect(g, x - 5 * s + step * s * dir, bodyY + 21 * s, 3 * s, 4 * s, pants);
    drawPixelRect(g, x + 2 * s - step * s * dir, bodyY + 21 * s, 3 * s, 4 * s, pants);
    drawPixelRect(g, x - 5 * s + step * s * dir, bodyY + 24 * s, 4 * s, 2 * s, actor.shoe);
    drawPixelRect(g, x + 1 * s - step * s * dir, bodyY + 24 * s, 4 * s, 2 * s, actor.shoe);
  }
}

function drawRunner(g, actor, x, y, big, duck, altFrame) {
  drawHumanSprite(g, actor, x, y, big ? 4 : 2, duck, altFrame, 1, false);
}

function drawDevObstacle(g, o) {
  const angryActor = {
    hair: 0x111111,
    hair2: 0x373737,
    skin: 0xddb8a0,
    shirt: 0x7c2230,
    shirtStripe: 0x5a1722,
    pants: 0x242a4c,
    shoe: 0x111111,
    accent: BRAND_RED,
    shaggy: Math.random() < 0.5,
  };
  drawHumanSprite(g, angryActor, o.x + 15, TRACK_Y, 2, false, Math.floor(gameTick / 8) % 2, -1, true);
  drawPixelRect(g, o.x - 4, TRACK_Y - 18, 16, 10, 0x7f8798);
  drawPixelRect(g, o.x - 2, TRACK_Y - 16, 12, 7, BRAND_CYAN);
  drawPixelRect(g, o.x + 7, TRACK_Y - 8, 2, 9, 0x5e6575);
  drawPixelRect(g, o.x + 20, TRACK_Y - 38, 12, 8, BRAND_RED);
  drawPixelRect(g, o.x + 22, TRACK_Y - 36, 8, 2, BRAND_WHITE);
}

function drawScooterObstacle(g, o) {
  drawDevObstacle(g, { x: o.x + 6 });
  drawPixelRect(g, o.x + 4, TRACK_Y - 10, 28, 4, 0x5e6575);
  drawPixelRect(g, o.x + 8, TRACK_Y - 14, 8, 4, BRAND_RED);
  drawPixelRect(g, o.x + 20, TRACK_Y - 14, 8, 4, BRAND_RED);
  drawPixelRect(g, o.x + 10, TRACK_Y - 4, 4, 4, 0xcfd6e7);
  drawPixelRect(g, o.x + 22, TRACK_Y - 4, 4, 4, 0xcfd6e7);
}

function drawDroneObstacle(g, o) {
  drawPixelRect(g, o.x + 6, o.y + 8, 22, 8, 0x7f8798);
  drawPixelRect(g, o.x + 4, o.y + 10, 4, 4, BRAND_RED);
  drawPixelRect(g, o.x + 26, o.y + 10, 4, 4, BRAND_RED);
  drawPixelRect(g, o.x + 12, o.y + 6, 10, 2, BRAND_CYAN);
  drawPixelRect(g, o.x + 10, o.y + 2, 2, 6, 0xd7dde9);
  drawPixelRect(g, o.x + 22, o.y + 2, 2, 6, 0xd7dde9);
  drawPixelRect(g, o.x + 2, o.y + 0, 10, 2, 0xd7dde9);
  drawPixelRect(g, o.x + 22, o.y + 0, 10, 2, 0xd7dde9);
}

function drawRantObstacle(g, o) {
  drawPixelRect(g, o.x + 7, o.y + 10, 4, 18, 0x6f7898);
  drawPixelRect(g, o.x + o.w - 11, o.y + 10, 4, 18, 0x6f7898);
  drawPixelRect(g, o.x, o.y, o.w, 14, 0x15a868);
  drawPixelRect(g, o.x + 4, o.y + 3, o.w - 8, 8, BRAND_WHITE);
  drawPixelRect(g, o.x + 12, o.y + 5, 10, 2, BRAND_RED);
  drawPixelRect(g, o.x + 30, o.y + 5, 20, 2, BRAND_RED);
}

function drawObstacle(g, o) {
  if (o.kind === 'dev') drawDevObstacle(g, o);
  else if (o.kind === 'scooter') drawScooterObstacle(g, o);
  else if (o.kind === 'drone') drawDroneObstacle(g, o);
  else if (o.kind === 'rant') drawRantObstacle(g, o);
}

function drawPickup(g, p) {
  const y = p.y + Math.sin(p.bob) * 4;
  if (p.kind === 'term') {
    drawPixelRect(g, p.x + 2, y, 14, 18, BRAND_WHITE);
    drawPixelRect(g, p.x + 4, y + 3, 8, 2, BRAND_CYAN);
    drawPixelRect(g, p.x + 4, y + 7, 10, 2, BRAND_G);
    drawPixelRect(g, p.x + 4, y + 11, 8, 2, BRAND_Y2);
    drawPixelRect(g, p.x + 10, y + 1, 4, 4, BRAND_RED);
  } else {
    drawPixelRect(g, p.x, y + 3, 18, 10, BRAND_Y1);
    drawPixelRect(g, p.x + 2, y + 5, 14, 6, BRAND_Y2);
    drawPixelRect(g, p.x + 4, y + 1, 10, 3, BRAND_G);
    drawPixelRect(g, p.x + 7, y + 5, 4, 4, 0x15894e);
  }
}

function drawPortraitCard(g, actor, x, active) {
  drawPixelRect(g, x, 160, 240, 254, active ? 0x162347 : 0x0f1324);
  g.lineStyle(4, active ? actor.accent : 0x39415f, 1);
  g.strokeRect(x, 160, 240, 254);
  drawRunner(g, actor, x + 120, 314, true, false, false);
  drawPixelRect(g, x + 28, 336, 184, 52, 0x0c1020);
  drawPixelRect(g, x + 38, 350, 164, 10, actor.accent);
  drawPlatanusLogo(g, x + 120, 364, 2);
}

function drawScanlines(g) {
  g.fillStyle(0x000000, 0.08);
  for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 1);
}

function drawTitle(scene) {
  const g = scene.gfx;
  drawSky(g);
  drawBuildings(g);
  drawRoad(g);
  drawBanana(g);
  drawRunner(g, ACTORS[0], 226, TRACK_Y, false, false, Math.floor(gameTick / 8) % 2);
  drawRunner(g, ACTORS[1], 268, TRACK_Y, false, false, Math.floor(gameTick / 8) % 2 === 0);
  drawScanlines(g);
}

function drawSelect(scene) {
  const g = scene.gfx;
  drawSky(g);
  drawBuildings(g);
  drawPixelRect(g, 40, 116, 720, 334, 0x0a0d18, 0.76);
  drawPortraitCard(g, ACTORS[0], 90, selectedChar === 0);
  drawPortraitCard(g, ACTORS[1], 470, selectedChar === 1);
  drawScanlines(g);
}

function drawPlay(scene) {
  const g = scene.gfx;
  drawSky(g);
  drawBuildings(g);
  drawFinish(g);
  drawRoad(g);
  for (const o of OBSTACLES) {
    if (o.kind !== 'gap') drawObstacle(g, o);
  }
  for (const p of PICKUPS) drawPickup(g, p);
  drawBanana(g);
  for (const p of DUST) {
    const a = Phaser.Math.Clamp(p.life / p.maxLife, 0, 1);
    drawPixelRect(g, p.x, p.y, p.r, p.r, p.color, a);
  }
  if (!(player.hitT > 0 && player.hitT % 6 < 3)) {
    drawRunner(g, ACTORS[selectedChar], Math.round(player.x), Math.round(player.y), false, player.duck, Math.floor(player.anim) % 2 === 0);
  }
  drawScanlines(g);
}

function drawEntry(scene) {
  const g = scene.gfx;
  drawSky(g);
  drawBuildings(g);
  drawRoad(g);
  drawPixelRect(g, 88, 108, 624, 376, 0x000000, 0.74);
  g.lineStyle(4, ACTORS[selectedChar].accent, 1);
  g.strokeRect(88, 108, 624, 376);
  drawScanlines(g);
}

function drawResult(scene) {
  const g = scene.gfx;
  drawSky(g);
  drawBuildings(g);
  drawRoad(g);
  drawPixelRect(g, 120, 110, 560, 360, 0x000000, 0.74);
  g.lineStyle(4, BRAND_Y1, 1);
  g.strokeRect(120, 110, 560, 360);
  drawScanlines(g);
}

function syncUI(scene) {
  const ui = scene.ui;
  ui.topLeft.setVisible(false);
  ui.topMid.setVisible(false);
  ui.topRight.setVisible(false);
  ui.centerTitle.setVisible(true);
  ui.centerSub.setVisible(true);
  ui.status.setVisible(true);
  ui.board.setVisible(false);
  ui.bottom.setVisible(true);
  ui.helper.setVisible(false);

  if (STATE === 'title') {
    ui.centerTitle.setText('PLATANUS ESCAPE');
    ui.centerSub.setText('RETRO STARTUP PANIC');
    ui.status.setText('PRESS START');
    ui.bottom.setText('RUN FROM THE GIANT BANANA • GET TO DEMO DAY • SINGLE PLAYER');
    ui.board.setVisible(true);
    refreshBoard(scene);
    ui.helper.setVisible(true);
    ui.helper.setText('ARROWS / WASD MOVE • U OR Z JUMP • DOWN DUCKS');
  } else if (STATE === 'select') {
    ui.centerTitle.setText('CHOOSE YOUR FOUNDER');
    ui.centerSub.setText(ACTORS[selectedChar].name);
    ui.status.setText('LEFT / RIGHT TO CHOOSE • START TO RUN');
    ui.bottom.setText('JUMP OVER ANGRY DEVS + SCOOTERS • DUCK UNDER DRONES + BUG RANTS');
  } else if (STATE === 'play' || STATE === 'pause') {
    ui.topLeft.setVisible(true);
    ui.topMid.setVisible(true);
    ui.topRight.setVisible(true);
    ui.centerTitle.setVisible(false);
    ui.centerSub.setVisible(false);
    ui.bottom.setVisible(false);
    ui.status.setVisible(STATE === 'pause');
    ui.helper.setVisible(true);
    ui.helper.setText('U / Z JUMP • DOWN DUCKS • ENTER PAUSES');
    ui.topLeft.setText(`1UP ${String(scoreValue).padStart(6, '0')}`);
    ui.topMid.setText(`HI ${String(hiScore).padStart(6, '0')} • CASH ${String(moneyValue).padStart(4, '0')}`);
    ui.topRight.setText(`${Math.floor(distanceM)}m / ${GOAL_M}m`);
    ui.status.setText('PAUSED');
  } else if (STATE === 'entry') {
    ui.centerTitle.setText(outcomeText);
    ui.centerSub.setText(`SCORE ${scoreValue}`);
    ui.status.setText(entryName.length ? entryName.join('') : '_ _ _');
    ui.bottom.setText('MOVE WITH ARROWS • U OR ENTER PICKS A LETTER');
    ui.board.setVisible(true);
    ui.board.setText(LETTER_GRID.map((row, r) =>
      row.map((value, c) => (r === letterRow && c === letterCol ? `[${value}]` : ` ${value} `)).join(' ')
    ).join('\n'));
  } else if (STATE === 'result') {
    ui.centerTitle.setText(outcomeText);
    ui.centerSub.setText(`SCORE ${scoreValue} • CASH ${moneyValue}`);
    ui.status.setText(savedMessage);
    ui.bottom.setText('PRESS START TO RETURN');
    ui.board.setVisible(true);
    refreshBoard(scene);
  }
}

function create() {
  const scene = this;
  scene.gfx = scene.add.graphics();
  scene.ui = {
    topLeft: scene.add.text(20, 14, '', { fontFamily: 'monospace', fontSize: '16px', color: '#ffe95e', fontStyle: 'bold' }),
    topMid: scene.add.text(W / 2, 14, '', { fontFamily: 'monospace', fontSize: '15px', color: '#ffffff', fontStyle: 'bold', align: 'center' }).setOrigin(0.5, 0),
    topRight: scene.add.text(W - 20, 14, '', { fontFamily: 'monospace', fontSize: '16px', color: '#8cf6ff', fontStyle: 'bold' }).setOrigin(1, 0),
    centerTitle: scene.add.text(W / 2, 86, '', { fontFamily: 'monospace', fontSize: '40px', color: '#f4ef72', fontStyle: 'bold', align: 'center' }).setOrigin(0.5),
    centerSub: scene.add.text(W / 2, 134, '', { fontFamily: 'monospace', fontSize: '18px', color: '#8cf6ff', align: 'center' }).setOrigin(0.5),
    status: scene.add.text(W / 2, 196, '', { fontFamily: 'monospace', fontSize: '27px', color: '#ffffff', fontStyle: 'bold', align: 'center' }).setOrigin(0.5),
    board: scene.add.text(W / 2, 250, '', { fontFamily: 'monospace', fontSize: '18px', color: '#ffffff', align: 'center', lineSpacing: 6 }).setOrigin(0.5, 0),
    bottom: scene.add.text(W / 2, H - 34, '', { fontFamily: 'monospace', fontSize: '14px', color: '#a0a6be', align: 'center' }).setOrigin(0.5),
    helper: scene.add.text(W / 2, H - 62, '', { fontFamily: 'monospace', fontSize: '13px', color: '#7ff1a3', align: 'center' }).setOrigin(0.5),
  };
  for (const key of Object.keys(scene.ui)) scene.ui[key].setDepth(10);

  loadScores().then((list) => {
    highScores = list;
    hiScore = list.length ? list[0].score : 0;
    refreshBoard(scene);
    STATE = 'title';
    syncUI(scene);
  });
}

function update(time) {
  const scene = this;
  scene.gfx.clear();

  if (STATE === 'boot') {
    drawSky(scene.gfx);
    drawScanlines(scene.gfx);
    return;
  }

  gameTick++;

  if (STATE === 'title') {
    if (consume(['START1', 'P1_1'])) {
      wakeAudio();
      SFX.select();
      STATE = 'select';
    }
    drawTitle(scene);
  } else if (STATE === 'select') {
    if (consume(['P1_L']) && selectedChar > 0) {
      wakeAudio();
      selectedChar--;
      SFX.move();
    }
    if (consume(['P1_R']) && selectedChar < ACTORS.length - 1) {
      wakeAudio();
      selectedChar++;
      SFX.move();
    }
    if (consume(['START1', 'P1_1'])) {
      wakeAudio();
      SFX.start();
      resetRun();
    }
    drawSelect(scene);
  } else if (STATE === 'play') {
    updatePlay();
    drawPlay(scene);
  } else if (STATE === 'pause') {
    if (consume(['START1'])) {
      STATE = 'play';
      SFX.select();
    }
    tickBackdrop();
    tickDust();
    drawPlay(scene);
  } else if (STATE === 'entry') {
    tickBackdrop();
    tickDust();
    updateEntry(time, scene);
    drawEntry(scene);
  } else if (STATE === 'result') {
    tickBackdrop();
    tickDust();
    if (consume(['START1', 'P1_1'])) {
      STATE = 'title';
      refreshBoard(scene);
      SFX.select();
    }
    drawResult(scene);
  }

  syncUI(scene);
}

const config = {
  type: Phaser.AUTO,
  width: W,
  height: H,
  parent: 'game-root',
  backgroundColor: '#05070b',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: { create, update },
};

new Phaser.Game(config);
