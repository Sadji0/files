import * as THREE from 'three';

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
let deviceOrientationControls;

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
    camera.position.z = 1;

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
    window.addEventListener('pointerdown', shoot);
}

// --- УПРАВЛЕНИЕ ИГРОЙ ---
function requestPermissionsAndStart() {
    // Для iOS 13+ требуется запрос на доступ к датчикам
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
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
let cameraGroup;
function setupDeviceOrientation() {
    cameraGroup = new THREE.Group();
    cameraGroup.add(camera);
    scene.add(cameraGroup);
}

function handleOrientation(event) {
    if (!isGameRunning || !event.alpha) return;

    const alpha = THREE.MathUtils.degToRad(event.alpha); // Y-axis rotation
    const beta = THREE.MathUtils.degToRad(event.beta);  // X-axis rotation
    const gamma = THREE.MathUtils.degToRad(event.gamma); // Z-axis rotation
    
    // 'YXZ' порядок лучше всего подходит для FPS-подобного управления
    const euler = new THREE.Euler(beta, alpha, -gamma, 'YXZ');
    cameraGroup.quaternion.setFromEuler(euler);
}

// --- ФИЗИКА И ОБЪЕКТЫ ---

// Стрельба
function shoot() {
    if (!isGameRunning) return;

    // Создаем геометрию и материал для снаряда
    const projectileGeometry = new THREE.SphereGeometry(0.1, 8, 8);
    const projectileMaterial = new THREE.MeshStandardMaterial({ color: 0xffef00 });
    const projectileMesh = new THREE.Mesh(projectileGeometry, projectileMaterial);
    projectileMesh.castShadow = true;

    // Создаем физическое тело для снаряда
    const projectileShape = new CANNON.Sphere(0.1);
    const projectileBody = new CANNON.Body({ mass: 1, shape: projectileShape });
    projectileBody.isProjectile = true; // Кастомное свойство для идентификации

    // Устанавливаем начальную позицию и скорость
    const shootDirection = new THREE.Vector3();
    camera.getWorldDirection(shootDirection);
    
    // Позиция снаряда - это позиция камеры
    camera.getWorldPosition(projectileBody.position);
    projectileMesh.position.copy(projectileBody.position);

    // Скорость снаряда
    projectileBody.velocity.set(
        shootDirection.x * PROJECTILE_SPEED,
        shootDirection.y * PROJECTILE_SPEED,
        shootDirection.z * PROJECTILE_SPEED
    );

    // Добавляем объект в мир и на сцену
    addGameObject(projectileMesh, projectileBody);
}

// Создание фигур
function spawnRandomShape() {
    const shapeTypes = Object.keys(SHAPE_SCORES);
    const type = shapeTypes[Math.floor(Math.random() * shapeTypes.length)];

    let geometry, cannonShape;
    const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(Math.random(), Math.random(), Math.random()),
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
            // Для простоты используем сферу как коллайдер для тора
            cannonShape = new CANNON.Sphere(0.7); 
            break;
    }

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const body = new CANNON.Body({ mass: 5, shape: cannonShape });
    body.isShape = true; // Кастомное свойство
    body.shapeType = type; // Для определения очков

    // Начальная позиция и скорость
    const x = (Math.random() - 0.5) * 20;
    const y = Math.random() * 10 + 5;
    const z = -20 - Math.random() * 20;
    body.position.set(x, y, z);
    
    body.velocity.set(
        (Math.random() - 0.5) * 5,
        (Math.random() - 0.5) * 10,
        Math.random() * 10 + 10
    );
    
    body.angularVelocity.set(
        (Math.random() - 0.5) * 5,
        (Math.random() - 0.5) * 5,
        (Math.random() - 0.5) * 5
    );

    // Обработчик столкновений
    body.addEventListener('collide', (event) => handleCollision(event, body, mesh));

    addGameObject(mesh, body);
}

// Обработка столкновений
function handleCollision(event, body, mesh) {
    // Проверяем, было ли столкновение со снарядом
    if (event.body.isProjectile) {
        // 1. Создать эффект взрыва
        createExplosion(body.position);

        // 2. Начислить очки
        updateScore(SHAPE_SCORES[body.shapeType]);

        // 3. Удалить фигуру и снаряд
        removeGameObject(mesh, body);
        
        // Находим и удаляем снаряд, который попал
        const projectile = gameObjects.find(obj => obj.body === event.body);
        if (projectile) {
            removeGameObject(projectile.mesh, projectile.body);
        }
    }
}

// Эффект взрыва
function createExplosion(position) {
    const particleCount = 20;
    const particleGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const particleMaterial = new THREE.MeshStandardMaterial({ color: 0xffa500 });

    for (let i = 0; i < particleCount; i++) {
        const particleMesh = new THREE.Mesh(particleGeometry, particleMaterial);
        const particleBody = new CANNON.Body({ mass: 0.1, shape: new CANNON.Box(new CANNON.Vec3(0.05, 0.05, 0.05)) });
        particleBody.position.copy(position);
        
        const force = 15;
        particleBody.velocity.set(
            (Math.random() - 0.5) * force,
            (Math.random() - 0.5) * force,
            (Math.random() - 0.5) * force
        );

        addGameObject(particleMesh, particleBody);
        
        // Удаляем частицы через некоторое время
        setTimeout(() => {
            removeGameObject(particleMesh, particleBody);
        }, 1000 + Math.random() * 1000);
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
    
    // Очистка памяти GPU
    if(mesh.geometry) mesh.geometry.dispose();
    if(mesh.material) mesh.material.dispose();

    // Удаление из нашего массива
    gameObjects = gameObjects.filter(obj => obj.body !== body);
}

function clearGameObjects() {
    gameObjects.forEach(obj => {
        scene.remove(obj.mesh);
        world.removeBody(obj.body);
        if(obj.mesh.geometry) obj.mesh.geometry.dispose();
        if(obj.mesh.material) obj.material.dispose();
    });
    gameObjects = [];
}

// --- ОСНОВНОЙ ЦИКЛ АНИМАЦИИ ---
const clock = new THREE.Clock();
let lastTime;

function animate(time) {
    requestAnimationFrame(animate);

    if (lastTime === undefined) {
        lastTime = time;
    }
    const dt = (time - lastTime) / 1000;
    
    // Обновляем физический мир
    world.step(1 / 60, dt);

    // Синхронизируем визуальные объекты с физическими телами
    for (const obj of gameObjects) {
        obj.mesh.position.copy(obj.body.position);
        obj.mesh.quaternion.copy(obj.body.quaternion);
    }

    renderer.render(scene, camera);
    lastTime = time;
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- ЗАПУСК ---
init();
animate();