/* =====================================================
   Runner con objetos más visibles y coloridos
   - Colisiona con el computador 💻 para abrir preguntas
   - Tecla B: mostrar/ocultar hitboxes (depuración)
   ===================================================== */

/* ---------- Setup básico ---------- */
const canvas = document.createElement('canvas');
canvas.id = 'gameCanvas';
canvas.width = 900;
canvas.height = 320;

document.body.innerHTML = `
  <div id="gameWrapper">
    <div id="hud">
      <span id="scoreLabel">00000</span><br>
      <span id="hiLabel">HI 00000</span>
      <span class="lives" id="livesLabel">❤️❤️❤️</span>
    </div>
  </div>
  <div id="instructions">Espacio/↑: Saltar • ↓: Agacharse • Choca el 💻 para preguntas • B: Hitbox</div>
`;
document.getElementById('gameWrapper').appendChild(canvas);
const ctx = canvas.getContext('2d');

/* ---------- Overlay de preguntas ---------- */
const questionOverlay = document.createElement('div');
questionOverlay.id = 'questionOverlay';
questionOverlay.className = 'hidden';
questionOverlay.innerHTML = `
  <div id="questionPanel">
    <h2 id="questionText"></h2>
    <div class="options" id="optionsContainer"></div>
    <div id="feedback"></div>
    <button id="resumeBtn">Continuar ▶</button>
  </div>
`;
document.body.appendChild(questionOverlay);

/* ---------- Panel Game Over ---------- */
const gameOverPanel = document.createElement('div');
gameOverPanel.id = 'gameOverPanel';
gameOverPanel.className = 'hidden';
gameOverPanel.innerHTML = `
  <div class="inner">
    <h1>GAME OVER</h1>
    <p id="finalScore"></p>
    <p id="ecoMessage"></p>
    <button id="restartBtn">Reiniciar 🔄</button>
  </div>
`;
document.body.appendChild(gameOverPanel);

/* ---------- Preguntas ---------- */
const preguntas = [
  {
    texto:"¿Qué busca la Teoría General de Sistemas?",
    opciones:[
      {texto:"Aislar componentes.", correcta:false},
      {texto:"Comprender la relación entre elementos.", correcta:true},
      {texto:"Eliminar interacción entre sistemas.", correcta:false}
    ]
  },
  {
    texto:"¿Qué promueve el software verde?",
    opciones:[
      {texto:"Reducir consumo energético y residuos digitales.", correcta:true},
      {texto:"Usar más servidores para más potencia.", correcta:false},
      {texto:"Ignorar el impacto ambiental.", correcta:false}
    ]
  },
  {
    texto:"¿Cómo aplicas sostenibilidad en el ciclo de vida del software?",
    opciones:[
      {texto:"Solo en diseño.", correcta:false},
      {texto:"En todas las etapas.", correcta:true},
      {texto:"Solo al final.", correcta:false}
    ]
  },
  {
    texto:"¿Qué es la neguentropía en SmartCalc?",
    opciones:[
      {texto:"Tendencia al desorden.", correcta:false},
      {texto:"Capacidad de generar orden y reducir incertidumbre.", correcta:true},
      {texto:"Un error del sistema.", correcta:false}
    ]
  }
];

/* ---------- Estado del juego ---------- */
let gameSpeed = 6;
let gravity = 0.7;
let score = 0;
let hiScore = 0;
let lives = 3;
let distance = 0;
let running = true;
let pausedForQuestion = false;
let questionIndex = 0;
let jumpForce = 12;
let ducking = false;
let frameCount = 0;

let obstacles = [];
let clouds = [];
let computers = [];
const groundY = 260;

/* Depuración */
let debugHitboxes = false;

/* Control de spawn */
let lastComputerSpawnDist = -9999;
const minDistBetweenComputers = 380;
const maxComputersOnScreen = 1;

/* ---------- Jugador ---------- */
const player = {
  x: 70,
  y: groundY,
  w: 42,
  h: 50,
  vy: 0,
  jumping: false,
  spriteTick:0,
  draw() {
    // sombra
    drawShadow(this.x + this.w/2, this.y, this.w*0.9, 10, 0.22);

    // cuerpo con color visible
    ctx.save();
    ctx.fillStyle = '#1e88e5';
    ctx.strokeStyle = '#0d47a1';
    ctx.lineWidth = 3;

    // cuerpo principal
    ctx.fillRect(this.x, this.y - this.h, this.w, this.h);
    ctx.strokeRect(this.x, this.y - this.h, this.w, this.h);

    // cabeza
    ctx.fillStyle = '#42a5f5';
    ctx.strokeStyle = '#0d47a1';
    ctx.fillRect(this.x + 10, this.y - this.h - 22, 26, 22);
    ctx.strokeRect(this.x + 10, this.y - this.h - 22, 26, 22);

    // ojo
    ctx.fillStyle='#fff';
    ctx.fillRect(this.x + 28, this.y - this.h - 14, 6, 6);
    ctx.fillStyle='#000';
    ctx.fillRect(this.x + 30, this.y - this.h - 12, 3, 3);

    // patas animadas o postura agachada
    ctx.fillStyle = '#1565c0';
    if(!this.jumping && !ducking){
      if(Math.floor(this.spriteTick/8)%2===0){
        ctx.fillRect(this.x+6,this.y-6,12,6);
        ctx.fillRect(this.x+24,this.y-10,12,10);
      } else {
        ctx.fillRect(this.x+6,this.y-10,12,10);
        ctx.fillRect(this.x+24,this.y-6,12,6);
      }
    } else if(ducking){
      ctx.fillRect(this.x, this.y - this.h + 16, this.w, this.h - 16);
    }
    ctx.restore();

    if(debugHitboxes) drawHitbox(this);

    this.spriteTick++;
  },
  update(){
    this.y += this.vy;
    if(this.y >= groundY){
      this.y = groundY;
      this.vy = 0;
      this.jumping = false;
    } else {
      this.vy += gravity;
    }
  },
  jump(){
    if(!this.jumping){
      this.vy = -jumpForce;
      this.jumping = true;
    }
  }
};

/* ---------- Nubes ---------- */
function spawnCloud(){
  clouds.push({
    x: canvas.width + Math.random()*240,
    y: 30 + Math.random()*90,
    w: 50 + Math.random()*60,
    speed: 0.6 + Math.random()*0.6
  });
}
function drawCloud(c){
  ctx.save();
  const g = ctx.createLinearGradient(c.x, c.y, c.x, c.y+18);
  g.addColorStop(0,'#ffffffaa');
  g.addColorStop(1,'#e3f2fdcc');
  ctx.fillStyle=g;
  ctx.fillRect(c.x, c.y, c.w, 20);
  ctx.restore();
}

/* ---------- Obstáculos con colores y contorno ---------- */
function spawnObstacle(){
  const types = [
    {type:'cactus', w:28, h:64, color:'#2e7d32', stroke:'#1b5e20'},
    {type:'cone',   w:34, h:42, color:'#ff6f00', stroke:'#bf360c'},
    {type:'crate',  w:40, h:40, color:'#8d6e63', stroke:'#5d4037'}
  ];
  const t = types[Math.floor(Math.random()*types.length)];
  obstacles.push({
    type: t.type,
    x: canvas.width + 20,
    y: groundY,
    w: t.w,
    h: t.h,
    color: t.color,
    stroke: t.stroke
  });
}
function drawObstacle(o){
  // sombra
  drawShadow(o.x + o.w/2, o.y, o.w, 10, 0.18);

  ctx.save();
  ctx.fillStyle = o.color;
  ctx.strokeStyle = o.stroke;
  ctx.lineWidth = 3;

  if(o.type === 'cactus'){
    // tallo principal
    ctx.fillRect(o.x + o.w/2 - 8, o.y - o.h, 16, o.h);
    // brazos laterales
    ctx.fillRect(o.x + 2, o.y - o.h*0.55, 10, 18);
    ctx.fillRect(o.x + o.w - 12, o.y - o.h*0.35, 10, 18);
    // contornos
    ctx.strokeRect(o.x + o.w/2 - 8, o.y - o.h, 16, o.h);
    ctx.strokeRect(o.x + 2, o.y - o.h*0.55, 10, 18);
    ctx.strokeRect(o.x + o.w - 12, o.y - o.h*0.35, 10, 18);
  } else if(o.type === 'cone'){
    ctx.beginPath();
    ctx.moveTo(o.x, o.y);
    ctx.lineTo(o.x + o.w/2, o.y - o.h);
    ctx.lineTo(o.x + o.w, o.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // franjas
    ctx.strokeStyle='#ffe082';
    ctx.lineWidth=2;
    ctx.beginPath();
    ctx.moveTo(o.x + 6, o.y - o.h*0.35);
    ctx.lineTo(o.x + o.w - 6, o.y - o.h*0.35);
    ctx.moveTo(o.x + 10, o.y - o.h*0.6);
    ctx.lineTo(o.x + o.w - 10, o.y - o.h*0.6);
    ctx.stroke();
  } else {
    // caja
    ctx.fillRect(o.x, o.y - o.h, o.w, o.h);
    ctx.strokeRect(o.x, o.y - o.h, o.w, o.h);
    // tablones
    ctx.strokeStyle='#6d4c41';
    ctx.lineWidth=2;
    ctx.beginPath();
    ctx.moveTo(o.x+6, o.y - o.h + 10);
    ctx.lineTo(o.x + o.w - 6, o.y - o.h + 10);
    ctx.moveTo(o.x+6, o.y - 10);
    ctx.lineTo(o.x + o.w - 6, o.y - 10);
    ctx.stroke();
  }

  ctx.restore();

  if(debugHitboxes) drawHitbox(o);
}

/* ---------- Computadores (disparan preguntas) coloridos ---------- */
function canSpawnComputer(){
  if(questionIndex >= preguntas.length) return false;
  if(computers.length >= maxComputersOnScreen) return false;
  if(distance - lastComputerSpawnDist < minDistBetweenComputers) return false;
  return true;
}

function spawnComputer(){
  let x = canvas.width + 60 + Math.random()*160;
  const w = 52, h = 48;
  computers.push({ x, y: groundY, w, h });
  lastComputerSpawnDist = distance;
}

function drawComputer(c){
  // sombra
  drawShadow(c.x + c.w/2, c.y, c.w*0.9, 10, 0.22);

  const pulse = 0.5 + 0.5*Math.sin(frameCount*0.15);

  ctx.save();
  // base y soporte
  ctx.fillStyle = '#263238';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 3;
  ctx.fillRect(c.x + 8, c.y - 8, c.w - 16, 8);
  ctx.fillRect(c.x + c.w/2 - 5, c.y - 16, 10, 8);

  // monitor
  ctx.fillStyle = '#37474f';
  ctx.fillRect(c.x, c.y - c.h, c.w, c.h - 16);
  ctx.strokeRect(c.x, c.y - c.h, c.w, c.h - 16);

  // pantalla con gradiente y brillo
  const g = ctx.createLinearGradient(0, c.y - c.h + 6, 0, c.y - 28);
  g.addColorStop(0, '#b3e5fc');
  g.addColorStop(1, '#4fc3f7');
  ctx.fillStyle = g;
  ctx.fillRect(c.x + 6, c.y - c.h + 6, c.w - 12, c.h - 28);

  // marco brillante pulsante
  ctx.strokeStyle = `rgba(46,125,50,${0.7 + 0.3*pulse})`;
  ctx.lineWidth = 3;
  ctx.strokeRect(c.x + 5, c.y - c.h + 5, c.w - 10, c.h - 26);

  // signo ? grande
  ctx.fillStyle = '#1b5e20';
  ctx.font = 'bold 18px Courier New';
  ctx.fillText('?', c.x + c.w/2 - 5, c.y - c.h + 26);

  // aura
  ctx.globalAlpha = 0.25 + 0.25*pulse;
  ctx.fillStyle = '#69f0ae';
  ctx.fillRect(c.x + 4, c.y - c.h + 4, c.w - 8, c.h - 22);
  ctx.restore();

  if(debugHitboxes) drawHitbox(c, '#00e676');
}

/* ---------- Utils ---------- */
function aabb(a, b){
  return a.x < b.x + b.w &&
         a.x + a.w > b.x &&
         a.y - a.h < b.y &&
         a.y > b.y - b.h;
}

function drawHitbox(ent, color='#e53935'){
  ctx.save();
  ctx.strokeStyle=color;
  ctx.lineWidth=1.5;
  ctx.setLineDash([4,3]);
  ctx.strokeRect(ent.x, ent.y - ent.h, ent.w, ent.h);
  ctx.restore();
}

function drawShadow(cx, cy, w, h, alpha=0.2){
  ctx.save();
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  ctx.beginPath();
  ctx.ellipse(cx, cy-2, w/2, h/2, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();
}

/* ---------- Fondo y suelo coloridos ---------- */
function drawSky(){
  const g = ctx.createLinearGradient(0,0,0,canvas.height);
  g.addColorStop(0, '#a1c4fd');  // azul cielo
  g.addColorStop(0.5, '#c2ffd8'); // verde suave
  g.addColorStop(1, '#f5f5f5');   // claro
  ctx.fillStyle = g;
  ctx.fillRect(0,0,canvas.width,canvas.height);

  // sol
  ctx.save();
  const sunX = canvas.width - 90, sunY = 70;
  const sg = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 40);
  sg.addColorStop(0, '#fff59d');
  sg.addColorStop(1, 'rgba(255,235,59,0)');
  ctx.fillStyle = sg;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 40, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();
}

function drawGround(){
  // banda de pasto
  ctx.fillStyle='#8bc34a';
  ctx.fillRect(0, groundY+2, canvas.width, canvas.height - (groundY+2));
  // línea suelo
  ctx.strokeStyle='#33691e';
  ctx.lineWidth=3;
  ctx.beginPath();
  ctx.moveTo(0, groundY+2);
  ctx.lineTo(canvas.width, groundY+2);
  ctx.stroke();

  // césped
  ctx.strokeStyle='#558b2f';
  ctx.lineWidth=2;
  for(let i=0;i<canvas.width;i+=20){
    ctx.beginPath();
    ctx.moveTo(i + (frameCount%20), groundY+2);
    ctx.lineTo(i + 6 + (frameCount%20), groundY - 2);
    ctx.stroke();
  }
}

/* ---------- Control de preguntas ---------- */
function triggerQuestionFromComputer(computer){
  computers = computers.filter(c => c !== computer);
  pauseForQuestion();
}

function pauseForQuestion(){
  pausedForQuestion = true;
  running = false;
  showQuestion(preguntas[questionIndex]);
}

function showQuestion(pregunta){
  questionOverlay.classList.remove('hidden');
  const qText = document.getElementById('questionText');
  const optsContainer = document.getElementById('optionsContainer');
  const feedback = document.getElementById('feedback');
  const resumeBtn = document.getElementById('resumeBtn');

  qText.textContent = `Pregunta ${questionIndex+1}: ${pregunta.texto}`;
  optsContainer.innerHTML = '';
  feedback.textContent = '';
  resumeBtn.style.display='none';

  pregunta.opciones.forEach(op=>{
    const btn = document.createElement('button');
    btn.textContent = op.texto;
    btn.addEventListener('click', ()=>{
      if(op.correcta){
        btn.classList.add('correct');
        feedback.textContent = '✅ ¡Correcto! Continúa corriendo sostenible.';
        score += 50;
        gameSpeed += 0.3;
      } else {
        btn.classList.add('wrong');
        feedback.textContent = '❌ Respuesta no sostenible. Pierdes una vida.';
        loseLife();
        canvas.classList.add('flashDamage');
        setTimeout(()=>canvas.classList.remove('flashDamage'), 600);
      }
      [...optsContainer.children].forEach(b=>b.disabled=true);
      resumeBtn.style.display='inline-block';
    });
    optsContainer.appendChild(btn);
  });

  resumeBtn.onclick = ()=>{
    questionIndex++;
    questionOverlay.classList.add('hidden');
    pausedForQuestion = false;
    running = true;
  };
}

/* ---------- Vidas ---------- */
function updateLivesLabel(){
  document.getElementById('livesLabel').textContent =
    '❤️'.repeat(lives) + '🖤'.repeat(3 - lives);
}

function loseLife(){
  lives--;
  updateLivesLabel();
  if(lives <= 0){
    endGame();
  }
}

/* ---------- Fin de juego ---------- */
function endGame(){
  running = false;
  pausedForQuestion = false;
  gameOverPanel.classList.remove('hidden');
  document.getElementById('finalScore').textContent = `Puntaje: ${score}`;
  const ecoMessage = lives<=0
    ? 'Necesitas mejorar tus decisiones ecológicas.'
    : '¡Buen rendimiento sostenible!';
  document.getElementById('ecoMessage').textContent = ecoMessage;
}

/* ---------- Reiniciar ---------- */
document.getElementById('restartBtn').addEventListener('click', ()=>{
  obstacles = [];
  clouds = [];
  computers = [];
  score = 0;
  distance = 0;
  lives = 3;
  updateLivesLabel();
  questionIndex = 0;
  gameSpeed = 6;
  player.y = groundY;
  player.vy = 0;
  player.jumping = false;
  running = true;
  pausedForQuestion = false;
  lastComputerSpawnDist = -9999;
  gameOverPanel.classList.add('hidden');
  questionOverlay.classList.add('hidden');
});

/* ---------- Input ---------- */
window.addEventListener('keydown', (e)=>{
  if(e.code === 'Space' || e.code === 'ArrowUp'){
    if(running) player.jump();
    e.preventDefault();
  }
  if(e.code === 'ArrowDown'){
    ducking = true;
    e.preventDefault();
  }
  if(e.code === 'KeyB'){
    debugHitboxes = !debugHitboxes;
  }
});
window.addEventListener('keyup', (e)=>{
  if(e.code === 'ArrowDown'){
    ducking = false;
    e.preventDefault();
  }
});

/* ---------- Loop principal ---------- */
function update(){
  if(running){
    frameCount++;
    distance += gameSpeed;
    score = Math.floor(distance / 5);
    if(score > hiScore) hiScore = score;

    // Spawn nubes
    if(frameCount % 180 === 0) spawnCloud();
    clouds.forEach(c => c.x -= c.speed);
    clouds = clouds.filter(c => c.x + c.w > 0);

    // Spawn obstáculos (menos agresivo para mayor claridad)
    if(frameCount % 70 === 0 && Math.random() < 0.5){
      spawnObstacle();
    }
    obstacles.forEach(o => o.x -= gameSpeed);
    obstacles = obstacles.filter(o => o.x + o.w > 0);

    // Spawn computador
    if(canSpawnComputer() && Math.random() < 0.02){
      spawnComputer();
    }
    computers.forEach(c => c.x -= gameSpeed);
    computers = computers.filter(c => c.x + c.w > 0);

    // Colisiones con obstáculos
    for(const o of obstacles){
      if(aabb(
        {x:player.x, y:player.y, w:player.w, h:player.h},
        {x:o.x, y:o.y, w:o.w, h:o.h}
      )){
        loseLife();
        obstacles = obstacles.filter(ob=>ob!==o);
        canvas.classList.add('flashDamage');
        setTimeout(()=>canvas.classList.remove('flashDamage'), 600);
        break;
      }
    }

    // Colisión con computador
    for(const c of computers){
      if(aabb(
        {x:player.x, y:player.y, w:player.w, h:player.h},
        {x:c.x, y:c.y, w:c.w, h:c.h}
      )){
        triggerQuestionFromComputer(c);
        break;
      }
    }

    // Actualizar jugador
    player.update();
  }

  draw();
  requestAnimationFrame(update);
}

/* ---------- Dibujar ---------- */
function draw(){
  // Cielo y sol
  drawSky();

  // Nubes
  clouds.forEach(drawCloud);

  // Suelo y césped
  drawGround();

  // Obstáculos
  obstacles.forEach(drawObstacle);

  // Computadores
  computers.forEach(drawComputer);

  // Jugador
  player.draw();

  // HUD
  document.getElementById('scoreLabel').textContent =
    String(score).padStart(5,'0');
  document.getElementById('hiLabel').textContent =
    'HI ' + String(hiScore).padStart(5,'0');

  // capas de estado
  if(pausedForQuestion){
    ctx.fillStyle='rgba(0,0,0,0.15)';
    ctx.fillRect(0,0,canvas.width,canvas.height);
  }
  if(!running && !pausedForQuestion){
    ctx.fillStyle='rgba(0,0,0,0.3)';
    ctx.fillRect(0,0,canvas.width,canvas.height);
  }
}

/* ---------- Inicio ---------- */
function init(){
  updateLivesLabel();
  update();
}
init();