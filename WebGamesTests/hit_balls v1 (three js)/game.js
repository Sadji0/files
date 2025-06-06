let scene, camera, renderer, raycaster, world;
let shapes = [];
let bullets = [];
let score = 0;
let timer = 30;
let gameInterval = null;
let isPlaying = false;

const canvas = document.getElementById('gameCanvas');
const startScreen = document.getElementById('startScreen');
const endScreen = document.getElementById('endScreen');
const finalScore = document.getElementById('finalScore');
const scoreDisplay = document.getElementById('score');
const timerDisplay = document.getElementById('timer');

// Инициализация игры
function init() {
  // Scene
  scene = new THREE.Scene();

  // Camera
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.z = 10;

  // Renderer
  renderer = new THREE.WebGLRenderer({ canvas: canvas });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(5, 10, 7.5);
  scene.add(directionalLight);

  // Raycaster for shooting
  raycaster = new THREE.Raycaster();

  // Physics
  world = new CANNON.World();
  world.gravity.set(0, -9.82, 0);

  animate();
}

// Запуск игры
function startGame() {
  startScreen.style.display = 'none';
  resetGame();
  isPlaying = true;
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
  shapes.forEach(({ mesh, body }) => {
    scene.remove(mesh);
    world.removeBody(body);
  });
  bullets.forEach(({ mesh, body }) => {
    scene.remove(mesh);
    world.removeBody(body);
  });
  shapes = [];
  bullets = [];
  score = 0;
  timer = 30;
  isPlaying = true;
  scoreDisplay.textContent = `Счет: ${score}`;
  timerDisplay.textContent = `Время: ${timer}`;
  gameInterval = setInterval(() => {
    timer--;
    timerDisplay.textContent = `Время: ${timer}`;
    if (timer <= 0) {
      endGame();
    }
  }, 1000);
}

// Создание фигур
function createShape() {
  const geometries = [
    { type: 'box', geometry: new THREE.BoxGeometry(1, 1, 1), points: 10 },
    { type: 'sphere', geometry: new THREE.SphereGeometry(0.5, 16, 16), points: 15 },
    { type: 'cone', geometry: new THREE.ConeGeometry(0.5, 1, 32), points: 20 },
    { type: 'torus', geometry: new THREE.TorusGeometry(0.5, 0.2, 16, 100), points: 25 },
  ];

  const shapeData = geometries[Math.floor(Math.random() * geometries.length)];
  const material = new THREE.MeshStandardMaterial({
    color: `hsl(${Math.random() * 360}, 80%, 60%)`,
    roughness: 0.5,
    metalness: 0.5,
  });

  const mesh = new THREE.Mesh(shapeData.geometry, material);
  mesh.position.set(
    (Math.random() - 0.5) * 10,
    Math.random() * 5 + 5,
    (Math.random() - 0.5) * 10
  );

  let cannonShape;
  switch (shapeData.type) {
    case 'box':
      cannonShape = new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5));
      break;
    case 'sphere':
      cannonShape = new CANNON.Sphere(0.5);
      break;
    case 'cone':
      cannonShape = new CANNON.Cylinder(0.5, 0.5, 1, 8);
      break;
    case 'torus':
      cannonShape = new CANNON.Sphere(0.2);
      break;
  }

  const body = new CANNON.Body({ mass: 1, shape: cannonShape });
  body.position.copy(mesh.position);
  body.angularVelocity.set(
    Math.random() - 0.5,
    Math.random() - 0.5,
    Math.random() - 0.5
  );
  body.angularFactor.set(1, 1, 1);
  world.addBody(body);

  shapes.push({ mesh, body, points: shapeData.points });
  scene.add(mesh);
}

// Цикл создания новых фигур
function createShapesLoop() {
  if (!isPlaying) return;
  createShape();
  setTimeout(createShapesLoop, 1000);
}

// Выстрел шариком
function shootBall(x, y, z) {
  const radius = 0.2;
  const ballGeometry = new THREE.SphereGeometry(radius, 16, 16);
  const ballMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
  const ballMesh = new THREE.Mesh(ballGeometry, ballMaterial);
  scene.add(ballMesh);

  const shape = new CANNON.Sphere(radius);
  const body = new CANNON.Body({
    mass: 1,
    position: new CANNON.Vec3(x, y, z),
    shape,
  });

  world.addBody(body);
  bullets.push({ mesh: ballMesh, body });

  raycaster.setFromCamera(pointer, camera);
  const direction = raycaster.ray.direction.clone().multiplyScalar(15);
  body.velocity.set(direction.x, direction.y, direction.z);
}

// Эффект разрушения
function explodeShape(index) {
  const { mesh } = shapes[index];
  score += shapes[index].points;
  scoreDisplay.textContent = `Счет: ${score}`;
  scene.remove(mesh);

  const particlesCount = 20;
  const particleGeometry = new THREE.SphereGeometry(0.1, 8, 8);
  const particleMaterial = new THREE.MeshStandardMaterial({ color: mesh.material.color });
  for (let i = 0; i < particlesCount; i++) {
    const particle = new THREE.Mesh(particleGeometry, particleMaterial);
    particle.position.copy(mesh.position);
    const velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 2,
      Math.random() * 2,
      (Math.random() - 0.5) * 2
    );
    scene.add(particle);
    setTimeout(() => scene.remove(particle), 1000);
    animateParticle(particle, velocity);
  }

  shapes.splice(index, 1);
}

function animateParticle(particle, velocity) {
  requestAnimationFrame(() => {
    particle.position.add(velocity);
    velocity.multiplyScalar(0.98);
    if (particle.position.y > -10) {
      animateParticle(particle, velocity);
    } else {
      scene.remove(particle);
    }
  });
}

// Конец игры
function endGame() {
  isPlaying = false;
  clearInterval(gameInterval);
  finalScore.textContent = `Счет: ${score}`;
  endScreen.classList.remove('hidden');
}

// Обновление физики
function updatePhysics() {
  world.step(1 / 60);

  shapes.forEach((shapeObj) => {
    shapeObj.mesh.position.copy(shapeObj.body.position);
    shapeObj.mesh.quaternion.copy(shapeObj.body.quaternion);
  });

  bullets.forEach((bullet, index) => {
    bullet.mesh.position.copy(bullet.body.position);
    bullet.mesh.quaternion.copy(bullet.body.quaternion);

    if (bullet.body.position.y < -10) {
      scene.remove(bullet.mesh);
      world.removeBody(bullet.body);
      bullets.splice(index, 1);
    }
  });

  bullets.forEach((bullet, bIndex) => {
    shapes.forEach((shapeObj, sIndex) => {
      const distance = bullet.body.position.distanceTo(shapeObj.body.position);
      if (distance < 0.7) {
        explodeShape(sIndex);
        scene.remove(bullet.mesh);
        world.removeBody(bullet.body);
        bullets.splice(bIndex, 1);
      }
    });
  });
}

// Анимация
function animate() {
  requestAnimationFrame(animate);
  updatePhysics();
  renderer.render(scene, camera);
}
animate();

// Управление прицелом через датчик движения
let pointer = new THREE.Vector2();
function handleDeviceMotion(event) {
  if (!isPlaying || !event.rotationRate) return;

  const gamma = event.rotationRate.gamma ? event.rotationRate.gamma : 0;
  const beta = event.rotationRate.beta ? event.rotationRate.beta : 0;

  pointer.x = Math.max(-1, Math.min(1, gamma * 0.1));
  pointer.y = Math.max(-1, Math.min(1, beta * 0.1));
}
window.addEventListener('devicemotion', handleDeviceMotion);

// Клик или тап
function handleClick(event) {
  if (!isPlaying) return;
  shootBall(0, 0, 0);
}
document.addEventListener('click', handleClick);
document.addEventListener('touchstart', handleClick);

// Изменение размера окна
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});