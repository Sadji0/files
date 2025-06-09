import * as THREE from 'three';
// ИСПРАВЛЕНИЕ: Импортируем cannon-es как модуль
import * as CANNON from 'cannon-es';

// --- НАСТРОЙКИ ИГРЫ ---
const GAME_DURATION = 30; // Длительность игры в секундах
const PROJECTILE_SPEED = 35; // Скорость снарядов
const SHAPE_SPAWN_INTERVAL = 500; // Интервал появления фигур (в мс)

// Очки за фигуры
const SHAPE_SCORES = {
    'box': 10,
    'sphere': 20,
    'cone': 30,
    'torus': 50,
};

// --- ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ---
let scene, camera, renderer, world;
let gameObjects = []; // Массив для хранения всех игровых объектов (фигуры, снаряды)
let score = 0;
let timeLeft = GAME_DURATION;
let gameInterval, spawnInterval;
let isGameRunning = false;
let cameraGroup; // Переместили сюда для лучшей видимости

// --- DOM ЭЛЕМЕНТЫ ---
const startScreen = document.getElementById('start-screen');
const gameUI = document.getElementById('game-ui');
const endScreen = document.getElementById('end-screen');
const startButton = document.getElementById('start-button');
const restartButton = document.getElementById('restart-button');
const timerDisplay = document.getElementById('timer');
const scoreDisplay = document.getElementById('score');
const finalScoreDisplay = document.getElementById('final-score');
const canvas = document.getElementById('game-canvas');

// --- ИНИЦИАЛИЗАЦИЯ ---
function init() {
    // 1. Сцена
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a2b3c);
    scene.fog = new THREE.Fog(0x1a2b3c, 1, 60);

    // 2. Камера
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    // Начальная позиция камеры в камере-контейнере
    camera.position.set(0, 0, 0);

    // 3. Рендерер
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;

    // 4. Освещение
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 7.5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);
    
    // 5. Физический мир
    world = new CANNON.World({
        gravity: new CANNON.Vec3(0, -9.82, 0)
    });

    // 6. Управление ориентацией устройства
    setupDeviceOrientation();

    // 7. Обработчики событий
    startButton.addEventListener('click', requestPermissionsAndStart);
    restartButton.addEventListener('click', startGame);
    window.addEventListener('resize', onWindowResize);
    // Используем 'pointerdown' для поддержки и мыши, и касаний
    window.addEventListener('pointerdown', shoot);
}

// --- УПРАВЛЕНИЕ ИГРОЙ ---
function requestPermissionsAndStart() {
    // Для iOS 13+ требуется запрос на доступ к датчикам
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
            .then(permissionState => {
                if (permissionState === 'granted') {
                    window.addEventListener('deviceorientation', handleOrientation);
                    startGame();
                } else {
                    alert('Для управления игрой необходим доступ к датчикам ориентации.');
                }
            })
            .catch(console.error);
    } else {
        // Для Android и других устройств
        window.addEventListener('deviceorientation', handleOrientation);
        startGame();
    }
}

function startGame() {
    // Сброс и запуск
    isGameRunning = true;
    score = 0;
    timeLeft = GAME_DURATION;

    // Очистка предыдущей игры
    clearGameObjects();

    // Обновление UI
    startScreen.classList.add('hidden');
    endScreen.classList.add('hidden');
    gameUI.classList.remove('hidden');
    updateScore(0);
    updateTimer();

    // Запуск таймеров
    gameInterval = setInterval(updateTimer, 1000);
    spawnInterval = setInterval(spawnRandomShape, SHAPE_SPAWN_INTERVAL);
}

function endGame() {
    isGameRunning = false;
    clearInterval(gameInterval);
    clearInterval(spawnInterval);

    // Показать финальный экран
    gameUI.classList.add('hidden');
    finalScoreDisplay.textContent = `Ваш счет: ${score}`;
    endScreen.classList.remove('hidden');
}

// --- ОБНОВЛЕНИЕ UI ---
function updateTimer() {
    timerDisplay.textContent = `Время: ${timeLeft}`;
    if (timeLeft <= 0) {
        endGame();
    }
    timeLeft--;
}

function updateScore(points) {
    score += points;
    scoreDisplay.textContent = `Счет: ${score}`;
}

// --- УПРАВЛЕНИЕ (ОРИЕНТАЦИЯ ТЕЛЕФОНА) ---
function setupDeviceOrientation() {
    // Контейнер для камеры, который мы будем вращать
    cameraGroup = new THREE.Group();
    // Начальная позиция игрока в мире
    cameraGroup.position.set(0, 1.6, 0); 
    cameraGroup.add(camera);
    scene.add(cameraGroup);
}

function handleOrientation(event) {
    if (!isGameRunning || !event.alpha) return;

    // Корректирующий Euler для преобразования координат устройства в координаты Three.js
    const a = THREE.MathUtils.degToRad(event.alpha); // yaw
    const b = THREE.MathUtils.degToRad(event.beta);  // pitch
    const g = THREE.MathUtils.degToRad(event.gamma); // roll
    
    const euler = new THREE.Euler(b, a, -g, 'YXZ');
    cameraGroup.quaternion.setFromEuler(euler);
}

// --- ФИЗИКА И ОБЪЕКТЫ ---

// Стрельба
function shoot() {
    if (!isGameRunning) return;

    const projectileGeometry = new THREE.SphereGeometry(0.1, 8, 8);
    const projectileMaterial = new THREE.MeshStandardMaterial({ color: 0xffef00, emissive: 0xffff00, emissiveIntensity: 0.5 });
    const projectileMesh = new THREE.Mesh(projectileGeometry, projectileMaterial);
    projectileMesh.castShadow = true;

    const projectileShape = new CANNON.Sphere(0.1);
    const projectileBody = new CANNON.Body({ mass: 1, shape: projectileShape });
    projectileBody.isProjectile = true; 

    const shootDirection = new THREE.Vector3();
    camera.getWorldDirection(shootDirection);
    
    // Начальная позиция снаряда - это позиция камеры в мире
    camera.getWorldPosition(projectileBody.position);
    projectileMesh.position.copy(projectileBody.position);

    projectileBody.velocity.set(
        shootDirection.x * PROJECTILE_SPEED,
        shootDirection.y * PROJECTILE_SPEED,
        shootDirection.z * PROJECTILE_SPEED
    );

    addGameObject(projectileMesh, projectileBody);
}

// Создание фигур
function spawnRandomShape() {
    const shapeTypes = Object.keys(SHAPE_SCORES);
    const type = shapeTypes[Math.floor(Math.random() * shapeTypes.length)];

    let geometry, cannonShape;
    const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(Math.random() * 0.8 + 0.2, Math.random() * 0.8 + 0.2, Math.random() * 0.8 + 0.2), // Яркие цвета
        roughness: 0.5,
        metalness: 0.1
    });

    switch (type) {
        case 'box':
            geometry = new THREE.BoxGeometry(1, 1, 1);
            cannonShape = new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5));
            break;
        case 'sphere':
            geometry = new THREE.SphereGeometry(0.6, 16, 16);
            cannonShape = new CANNON.Sphere(0.6);
            break;
        case 'cone':
            geometry = new THREE.ConeGeometry(0.6, 1.2, 16);
            cannonShape = new CANNON.Cylinder(0.01, 0.6, 1.2, 16);
            break;
        case 'torus':
            geometry = new THREE.TorusGeometry(0.5, 0.2, 16, 32);
            cannonShape = new CANNON.Sphere(0.7); 
            break;
    }

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const body = new CANNON.Body({ mass: 5, shape: cannonShape });
    body.isShape = true; 
    body.shapeType = type;

    const x = (Math.random() - 0.5) * 20;
    const y = Math.random() * 10 + 5;
    const z = -20 - Math.random() * 20;
    body.position.set(x, y, z);
    
    body.velocity.set((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 10, Math.random() * 10 + 10);
    body.angularVelocity.set((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5);

    body.addEventListener('collide', (event) => handleCollision(event, body, mesh));

    addGameObject(mesh, body);
}

// Обработка столкновений
function handleCollision(event, body, mesh) {
    if (body.isShape && event.body.isProjectile) {
        createExplosion(body.position, mesh.material.color);
        updateScore(SHAPE_SCORES[body.shapeType]);
        removeGameObject(mesh, body);
        
        const projectile = gameObjects.find(obj => obj.body === event.body);
        if (projectile) {
            removeGameObject(projectile.mesh, projectile.body);
        }
    }
}

// Эффект взрыва
function createExplosion(position, color) {
    const particleCount = 20;
    const particleGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    
    for (let i = 0; i < particleCount; i++) {
        const particleMaterial = new THREE.MeshStandardMaterial({ color });
        const particleMesh = new THREE.Mesh(particleGeometry, particleMaterial);
        const particleBody = new CANNON.Body({ mass: 0.1, shape: new CANNON.Box(new CANNON.Vec3(0.05, 0.05, 0.05)) });
        
        particleBody.position.copy(position);
        
        const force = 15;
        particleBody.velocity.set(
            (Math.random() - 0.5) * force,
            (Math.random() - 0.5) * force,
            (Math.random() - 0.5) * force
        );
        particleBody.isParticle = true; // Пометим, чтобы не обрабатывать столкновения
        addGameObject(particleMesh, particleBody);
        
        setTimeout(() => removeGameObject(particleMesh, particleBody), 1000 + Math.random() * 1000);
    }
}

// --- УПРАВЛЕНИЕ ОБЪЕКТАМИ ---
function addGameObject(mesh, body) {
    scene.add(mesh);
    world.addBody(body);
    gameObjects.push({ mesh, body });
}

function removeGameObject(mesh, body) {
    scene.remove(mesh);
    world.removeBody(body);
    
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material) mesh.material.dispose();

    gameObjects = gameObjects.filter(obj => obj.body !== body);
}

function clearGameObjects() {
    [...gameObjects].forEach(obj => removeGameObject(obj.mesh, obj.body));
}

// --- ОСНОВНОЙ ЦИКЛ АНИМАЦИИ ---
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();
    
    if (isGameRunning) {
        world.step(1 / 60, dt);
    }

    for (const obj of gameObjects) {
        obj.mesh.position.copy(obj.body.position);
        obj.mesh.quaternion.copy(obj.body.quaternion);
    }

    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- ЗАПУСК ---
init();
animate();