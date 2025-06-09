import * as THREE from 'three';

// Ожидаем загрузки Ammo.js, прежде чем запускать основной код
Ammo().then(function (AmmoLib) {

	Ammo = AmmoLib; // Делаем Ammo доступным в глобальной области видимости скрипта

	// Глобальные переменные
	let container, camera, scene, renderer;
	let physicsWorld;
	const rigidBodies = [];
	const margin = 0.05;
	const mouseCoords = new THREE.Vector2();
	const raycaster = new THREE.Raycaster();
	const ballMaterial = new THREE.MeshPhongMaterial({ color: 0x202020 });
	let transformAux1 = new Ammo.btTransform();

	// --- Инициализация ---

	function init() {
		initGraphics();
		initPhysics();
		createObjects();
		initInput();
		animate();
	}

	function initGraphics() {
		container = document.getElementById('container');

		camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.2, 2000);
		camera.position.set(0, 15, 35);

		scene = new THREE.Scene();
		scene.background = new THREE.Color(0xbfd1e5);

		const ambientLight = new THREE.AmbientLight(0x404040);
		scene.add(ambientLight);

		const light = new THREE.DirectionalLight(0xffffff, 1.5);
		light.position.set(-10, 15, 20);
		light.castShadow = true;
		const d = 20;
		light.shadow.camera.left = -d;
		light.shadow.camera.right = d;
		light.shadow.camera.top = d;
		light.shadow.camera.bottom = -d;
		light.shadow.camera.near = 2;
		light.shadow.camera.far = 100;
		light.shadow.mapSize.x = 2048;
		light.shadow.mapSize.y = 2048;
		scene.add(light);

		renderer = new THREE.WebGLRenderer({ antialias: true });
		renderer.setPixelRatio(window.devicePixelRatio);
		renderer.setSize(window.innerWidth, window.innerHeight);
		renderer.shadowMap.enabled = true;
		container.appendChild(renderer.domElement);

		window.addEventListener('resize', onWindowResize);
	}

	function onWindowResize() {
		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();
		renderer.setSize(window.innerWidth, window.innerHeight);
	}

	function initPhysics() {
		const collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
		const dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration);
		const broadphase = new Ammo.btDbvtBroadphase();
		const solver = new Ammo.btSequentialImpulseConstraintSolver();
		physicsWorld = new Ammo.btDiscreteDynamicsWorld(dispatcher, broadphase, solver, collisionConfiguration);
		physicsWorld.setGravity(new Ammo.btVector3(0, -9.82, 0));
	}
	
	function createRigidBody(threeObject, physicsShape, mass, pos, quat) {
		threeObject.position.copy(pos);
		threeObject.quaternion.copy(quat);

		const transform = new Ammo.btTransform();
		transform.setIdentity();
		transform.setOrigin(new Ammo.btVector3(pos.x, pos.y, pos.z));
		transform.setRotation(new Ammo.btQuaternion(quat.x, quat.y, quat.z, quat.w));
		const motionState = new Ammo.btDefaultMotionState(transform);

		physicsShape.setMargin(margin);

		const localInertia = new Ammo.btVector3(0, 0, 0);
		physicsShape.calculateLocalInertia(mass, localInertia);

		const rbInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, physicsShape, localInertia);
		const body = new Ammo.btRigidBody(rbInfo);

		threeObject.userData.physicsBody = body;
		scene.add(threeObject);

		if (mass > 0) {
			rigidBodies.push(threeObject);
			body.setActivationState(4); // Отключить "засыпание"
		}

		physicsWorld.addRigidBody(body);
		return threeObject;
	}

	function createRandomObject(mass, halfExtents, pos, quat) {
		const shapeType = Math.floor(Math.random() * 4);
		let geometry;
		let ammoShape;
		const material = new THREE.MeshPhongMaterial({ color: Math.random() * 0xffffff });

		switch (shapeType) {
			case 0: // Куб
				geometry = new THREE.BoxGeometry(halfExtents.x * 2, halfExtents.y * 2, halfExtents.z * 2);
				ammoShape = new Ammo.btBoxShape(new Ammo.btVector3(halfExtents.x, halfExtents.y, halfExtents.z));
				break;
			case 1: // Сфера
				geometry = new THREE.SphereGeometry(halfExtents.x);
				ammoShape = new Ammo.btSphereShape(halfExtents.x);
				break;
			case 2: // Цилиндр
				geometry = new THREE.CylinderGeometry(halfExtents.x, halfExtents.x, halfExtents.y * 2, 20, 1);
				ammoShape = new Ammo.btCylinderShape(new Ammo.btVector3(halfExtents.x, halfExtents.y, halfExtents.x));
				break;
			case 3: // Конус
				geometry = new THREE.ConeGeometry(halfExtents.x, halfExtents.y * 2, 20, 1);
				ammoShape = new Ammo.btConeShape(halfExtents.x, halfExtents.y * 2);
				break;
		}

		const mesh = new THREE.Mesh(geometry, material);
		mesh.castShadow = true;
		mesh.receiveShadow = true;

		createRigidBody(mesh, ammoShape, mass, pos, quat);
	}

	function createObjects() {
		// Пол
		const groundPos = new THREE.Vector3(0, -0.5, 0);
		const groundQuat = new THREE.Quaternion(0, 0, 0, 1);
		const groundMesh = new THREE.Mesh(new THREE.BoxGeometry(80, 1, 80), new THREE.MeshPhongMaterial({ color: 0xCCCCCC }));
		groundMesh.receiveShadow = true;
		const groundShape = new Ammo.btBoxShape(new Ammo.btVector3(40, 0.5, 40));
		createRigidBody(groundMesh, groundShape, 0, groundPos, groundQuat);

		// Башня из случайных объектов
		const halfExtents = new THREE.Vector3(1.5, 1.5, 1.5);
		const towerHeight = 8;
		const objectsPerRow = 3;
		const objectMass = 1;

		for (let i = 0; i < towerHeight; i++) {
			for (let j = 0; j < objectsPerRow; j++) {
				const pos = new THREE.Vector3(
					(j - (objectsPerRow - 1) / 2) * halfExtents.x * 2.2,
					halfExtents.y + i * halfExtents.y * 2.2,
					0
				);
				const quat = new THREE.Quaternion(0, 0, 0, 1);
				createRandomObject(objectMass, halfExtents, pos, quat);
			}
		}
	}

	function initInput() {
		window.addEventListener('pointerdown', function (event) {
			mouseCoords.set(
				(event.clientX / window.innerWidth) * 2 - 1,
				-(event.clientY / window.innerHeight) * 2 + 1
			);

			raycaster.setFromCamera(mouseCoords, camera);

			const ballMass = 35;
			const ballRadius = 0.5;
			const ballMesh = new THREE.Mesh(new THREE.SphereGeometry(ballRadius, 20, 20), ballMaterial);
			ballMesh.castShadow = true;
			ballMesh.receiveShadow = true;
			const ballShape = new Ammo.btSphereShape(ballRadius);

			const pos = new THREE.Vector3();
			pos.copy(raycaster.ray.origin);
			const quat = new THREE.Quaternion(0, 0, 0, 1);
			const ballBody = createRigidBody(ballMesh, ballShape, ballMass, pos, quat).userData.physicsBody;

			const dir = new THREE.Vector3();
			dir.copy(raycaster.ray.direction);
			dir.multiplyScalar(40);
			ballBody.setLinearVelocity(new Ammo.btVector3(dir.x, dir.y, dir.z));
		});
	}

	function animate() {
		requestAnimationFrame(animate);
		const deltaTime = 1 / 60;
		updatePhysics(deltaTime);
		renderer.render(scene, camera);
	}

	function updatePhysics(deltaTime) {
		physicsWorld.stepSimulation(deltaTime, 10);

		for (let i = 0, il = rigidBodies.length; i < il; i++) {
			const objThree = rigidBodies[i];
			const objPhys = objThree.userData.physicsBody;
			const ms = objPhys.getMotionState();
			if (ms) {
				ms.getWorldTransform(transformAux1);
				const p = transformAux1.getOrigin();
				const q = transformAux1.getRotation();
				objThree.position.set(p.x(), p.y(), p.z());
				objThree.quaternion.set(q.x(), q.y(), q.z(), q.w());
			}
		}
	}

	// Запуск
	init();
});