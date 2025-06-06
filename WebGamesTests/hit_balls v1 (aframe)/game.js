let score = 0;
let timer = 30;
let isPlaying = false;
let gameInterval = null;

const scoreDisplay = document.getElementById('score');
const timerDisplay = document.getElementById('timer');
const finalScore = document.getElementById('finalScore');
const startScreen = document.getElementById('startScreen');
const endScreen = document.getElementById('endScreen');

// Объекты игры
const shapes = [];
const bullets = [];

// Запуск игры
function startGame() {
  startScreen.style.display = 'none';
  resetGame();
  createShapesLoop();
}

// Перезапуск игры
function restartGame() {
  endScreen.classList.add('hidden');
  resetGame();
  createShapesLoop();
}

// Сброс игры
function resetGame() {
  clearInterval(gameInterval);
  score = 0;
  timer = 30;
  scoreDisplay.textContent = `Счет: ${score}`;
  timerDisplay.textContent = `Время: ${timer}`;
  isPlaying = true;

  // Очистка фигур
  shapes.forEach(shape => {
    if (shape.el && shape.el.parentNode) {
      shape.el.parentNode.removeChild(shape.el);
    }
  });
  shapes.length = 0;

  // Очистка шариков
  bullets.forEach(bullet => {
    if (bullet.el && bullet.el.parentNode) {
      bullet.el.parentNode.removeChild(bullet.el);
    }
  });
  bullets.length = 0;

  gameInterval = setInterval(() => {
    timer--;
    timerDisplay.textContent = `Время: ${timer}`;
    if (timer <= 0) {
      endGame();
    }
  }, 1000);
}

// Создание случайной фигуры
function createShape() {
  const el = document.createElement('a-entity');
  const types = ['box', 'sphere', 'cone', 'torus'];
  const type = types[Math.floor(Math.random() * types.length)];

  const color = `hsl(${Math.random() * 360}, 80%, 60%)`;
  const position = `${(Math.random() - 0.5) * 10} ${Math.random() * 5 + 5} ${(Math.random() - 0.5) * 10}`;

  let geometry;
  let points = 0;

  switch (type) {
    case 'box':
      geometry = 'box';
      points = 10;
      break;
    case 'sphere':
      geometry = 'sphere';
      points = 15;
      break;
    case 'cone':
      geometry = 'cone';
      points = 20;
      break;
    case 'torus':
      geometry = 'torus';
      points = 25;
      break;
  }

  el.setAttribute('geometry', { primitive: geometry });
  el.setAttribute('material', { color, roughness: 0.5, metalness: 0.5 });
  el.setAttribute('position', position);
  el.setAttribute('dynamic-body', '');
  el.setAttribute('id', 'shape');

  // Добавляем вращение
  el.setAttribute('animation', {
    property: 'rotation',
    to: '360 360 360',
    loop: 'true',
    dur: Math.random() * 3000 + 2000,
  });

  document.querySelector('a-scene').appendChild(el);

  shapes.push({ el, points });
}

// Цикл создания новых фигур
function createShapesLoop() {
  if (!isPlaying) return;
  if (shapes.length < 10) createShape();
  setTimeout(createShapesLoop, 1000);
}

// Выстрел шариком
function shootBall() {
  const cameraEl = document.getElementById('camera');
  const pos = cameraEl.getAttribute('position');
  const direction = cameraEl.getObject3D('camera').getWorldDirection(new THREE.Vector3());

  const el = document.createElement('a-entity');
  el.setAttribute('geometry', { primitive: 'sphere', radius: 0.2 });
  el.setAttribute('material', { color: '#ff0000' });
  el.setAttribute('position', pos.x + ' ' + pos.y + ' ' + pos.z);
  el.setAttribute('dynamic-body', '');
  el.setAttribute('velocity', {
    x: direction.x * 10,
    y: direction.y * 10,
    z: direction.z * 10,
  });

  document.querySelector('a-scene').appendChild(el);
  bullets.push({ el });
}

// Обнаружение столкновений
document.addEventListener('collide', function (e) {
  const target = e.detail.target.el;
  const other = e.detail.body.el;

  // Если это пуля и фигура
  if (target.getAttribute('id') === 'shape' || other.getAttribute('id') === 'shape') {
    const shape = target.getAttribute('id') === 'shape' ? target : other;
    const bullet = target.getAttribute('id') !== 'shape' ? target : other;

    // Найдём объект фигуры
    const shapeObj = shapes.find(s => s.el === shape);
    if (shapeObj) {
      score += shapeObj.points;
      scoreDisplay.textContent = `Счет: ${score}`;
      explodeShape(shape);
    }

    // Удаляем пулю
    if (bullet && bullet.parentNode) {
      bullet.parentNode.removeChild(bullet);
    }
  }
});

// Эффект разрушения
function explodeShape(mesh) {
  const count = 20;
  for (let i = 0; i < count; i++) {
    const particle = document.createElement('a-entity');
    const pos = mesh.getAttribute('position');
    particle.setAttribute('geometry', { primitive: 'sphere', radius: 0.1 });
    particle.setAttribute('material', { color: mesh.getAttribute('material').color });
    particle.setAttribute('position', pos);

    const velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 2,
      Math.random() * 2,
      (Math.random() - 0.5) * 2
    );

    particle.setAttribute('dynamic-body', '');
    particle.setAttribute('velocity', {
      x: velocity.x * 5,
      y: velocity.y * 5,
      z: velocity.z * 5,
    });

    document.querySelector('a-scene').appendChild(particle);

    setTimeout(() => {
      if (particle.parentNode) {
        particle.parentNode.removeChild(particle);
      }
    }, 1000);
  }

  if (mesh && mesh.parentNode) {
    mesh.parentNode.removeChild(mesh);
  }

  const index = shapes.findIndex(s => s.el === mesh);
  if (index > -1) shapes.splice(index, 1);
}

// Конец игры
function endGame() {
  isPlaying = false;
  clearInterval(gameInterval);
  finalScore.textContent = `Счет: ${score}`;
  endScreen.classList.remove('hidden');
}

// Обработка клика или тапа
document.addEventListener('click', () => {
  if (isPlaying) shootBall();
});
document.addEventListener('touchstart', () => {
  if (isPlaying) shootBall();
});

// Управление прицелом через акселерометр
if (window.DeviceOrientationEvent && typeof window.DeviceOrientationEvent.requestPermission === 'function') {
  window.DeviceOrientationEvent.requestPermission()
    .catch(() => {})
    .then(permissionState => {
      if (permissionState === 'granted') {
        window.addEventListener('deviceorientation', handleDeviceOrientation);
      }
    });
}

function handleDeviceOrientation(event) {
  if (!isPlaying) return;
  const gamma = event.gamma ? event.gamma : 0;
  const beta = event.beta ? event.beta : 0;

  const cameraRig = document.getElementById('cameraRig');
  cameraRig.setAttribute('rotation', {
    x: -beta / 2,
    y: gamma / 2,
    z: 0
  });
}