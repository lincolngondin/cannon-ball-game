// js/scene.js

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";
import * as CANNON from "cannon-es";
import { Cannon } from "./cannon.js";
import { createWorld } from "./world.js";

// --- VARIÁVEIS GLOBAIS ---
let camera, scene, renderer, composer, physicsWorld, particleSystem, controls;
let gameCannon;
let staticCollidables = [];
const clock = new THREE.Clock();
const objectsToUpdate = [];
let defaultMaterial, projectileMaterial;

let isAiming = false;
let isOrbiting = false;
let lastFreeCameraPosition = new THREE.Vector3();
let lastFreeCameraQuaternion = new THREE.Quaternion();

const keysPressed = {
  KeyW: false,
  KeyA: false,
  KeyS: false,
  KeyD: false,
};

// --- ESTADO DO JOGO E DOM ---
let gameState = {
  currentLevel: 0,
  targets: 0,
  projectiles: 100,
  isGameOver: false,
  waitingForLevelEnd: false, // Controla a transição de nível limpa
};
const targetMaterial = new THREE.MeshStandardMaterial({
  color: 0xffd700,
  emissive: 0xee9900,
  roughness: 0.3,
  metalness: 0.8,
});
const targetsDisplay = document.getElementById("targets-display"),
  projectilesDisplay = document.getElementById("projectiles-display"),
  crosshair = document.getElementById("crosshair"),
  uiContainer = document.getElementById("ui-container"),
  toggleUiButton = document.getElementById("toggle-ui-button");

let dynamicAimMesh;

const uiElements = {
  azimuthInput: document.getElementById("azimuth"),
  elevationInput: document.getElementById("elevation"),
  powerInput: document.getElementById("power"),
  azimuthValueDisplay: document.getElementById("azimuth-value"),
  elevationValueDisplay: document.getElementById("elevation-value"),
  powerValueDisplay: document.getElementById("power-value"),
  powerLevelBar: document.getElementById("power-level"),
  fireButton: document.getElementById("fire-button"),
  statusDisplay: document.getElementById("status"),
};

// ... O restante do código (Asset Manager, Particle System, Init, Setups) permanece o mesmo ...
// (Para evitar um bloco de código gigante, o início do arquivo que não foi alterado foi omitido)
const assetManager = {
  models: {},
  async load() {
    const gltfLoader = new GLTFLoader().setDRACOLoader(null);
    const assetPath = "../assets/";
    const assets = {
      groundGrass: "ground_grass.glb",
      cliffLarge: "cliff_large_stone.glb",
      cliffRock: "cliff_rock.glb",
      statueBlock: "statue_block.glb",
      rockLargeA: "rock_largeA.glb",
      rockLargeB: "rock_largeB.glb",
      rockLargeC: "rock_largeC.glb",
      statueColumn: "statue_column.glb",
      statueColumnDamaged: "statue_columnDamaged.glb",
      statueHead: "statue_head.glb",
      statueObelisk: "statue_obelisk.glb",
      logStack: "log_stackLarge.glb",
      treeOak: "tree_oak.glb",
      treeDetailed: "tree_detailed.glb",
      treePineDefaultA: "tree_pineDefaultA.glb",
      treePineRoundB: "tree_pineRoundB.glb",
      treePineTallC: "tree_pineTallC.glb",
      hangingMoss: "hanging_moss.glb",
      mushroomRed: "mushroom_red.glb",
      mushroomTanGroup: "mushroom_tanGroup.glb",
      flowerRedA: "flower_redA.glb",
      flowerYellowB: "flower_yellowB.glb",
      plantBush: "plant_bush.glb",
      plantBushDetailed: "plant_bushDetailed.glb",
      plantBushLarge: "plant_bushLarge.glb",
      stumpRound: "stump_round.glb",
      stumpSquare: "stump_square.glb",
      bridgeStone: "bridge_stone.glb",
      tentSmallOpen: "tent_smallOpen.glb",
      campfireStones: "campfire_stones.glb",
    };
    const results = await Promise.all(
      Object.entries(assets).map(([k, f]) =>
        gltfLoader.loadAsync(assetPath + f)
      )
    );
    Object.keys(assets).forEach((key, index) => {
      this.models[key] = results[index].scene;
    });
  },
};
class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.pool = [];
    this.active = [];
  }
  getParticleSet() {
    if (this.pool.length > 0) return this.pool.pop();
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(new Float32Array(150), 3)
    );
    const material = new THREE.PointsMaterial({
      color: 0xffd700,
      size: 0.3,
      transparent: true,
      blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geometry, material);
    return points;
  }
  explode(position) {
    const ps = this.getParticleSet();
    ps.position.copy(position);
    this.scene.add(ps);
    const particles = [];
    for (let i = 0; i < 50; i++) {
      particles.push({
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 10
        ),
        alpha: 1.0,
      });
    }
    this.active.push({ points: ps, particles, time: 0 });
  }
  update(deltaTime) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const set = this.active[i];
      set.time += deltaTime;
      const positions = set.points.geometry.attributes.position.array;
      for (let j = 0; j < set.particles.length; j++) {
        const p = set.particles[j];
        p.velocity.y -= 20 * deltaTime;
        p.alpha -= 1.5 * deltaTime;
        positions[j * 3] += p.velocity.x * deltaTime;
        positions[j * 3 + 1] += p.velocity.y * deltaTime;
        positions[j * 3 + 2] += p.velocity.z * deltaTime;
      }
      set.points.geometry.attributes.position.needsUpdate = true;
      set.points.material.opacity = Math.max(0, set.particles[0].alpha);
      if (set.time > 1) {
        this.scene.remove(set.points);
        this.pool.push(set.points);
        this.active.splice(i, 1);
      }
    }
  }
}
async function init() {
  await assetManager.load();
  scene = new THREE.Scene();
  physicsWorld = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
  particleSystem = new ParticleSystem(scene);
  setupPhysicsMaterials();
  setupCamera();
  setupRenderer();
  setupSkyboxAndFog();
  setupLighting();
  setupPostProcessing();
  createWorld(
    scene,
    physicsWorld,
    assetManager,
    staticCollidables,
    defaultMaterial
  );
  gameCannon = new Cannon(
    scene,
    physicsWorld,
    defaultMaterial,
    projectileMaterial
  );
  gameCannon.setUIElements(uiElements);
  setupControls();
  loadLevel(0);
  animate();
}
function setupPhysicsMaterials() {
  defaultMaterial = new CANNON.Material("default");
  projectileMaterial = new CANNON.Material("projectile");
  physicsWorld.addContactMaterial(
    new CANNON.ContactMaterial(defaultMaterial, projectileMaterial, {
      friction: 0.5,
      restitution: 0.2,
    })
  );
}
function setupCamera() {
  camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.2,
    5000
  );
  camera.position.set(0, 15, 30);
  camera.lookAt(0, 5, 10);
  lastFreeCameraPosition.copy(camera.position);
  lastFreeCameraQuaternion.copy(camera.quaternion);
}
function setupRenderer() {
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.setPixelRatio(window.devicePixelRatio);
  document.body.appendChild(renderer.domElement);
}
function setupSkyboxAndFog() {
  const cubeLoader = new THREE.CubeTextureLoader().setPath("../assets/skybox/");
  scene.background = cubeLoader.load([
    "px.png",
    "nx.png",
    "py.png",
    "ny.png",
    "pz.png",
    "nz.png",
  ]);
  scene.fog = new THREE.FogExp2(0x1e243b, 0.006);
}
function setupLighting() {
  scene.add(new THREE.AmbientLight(0x8899aa, 1.5));
  const dirLight = new THREE.DirectionalLight(0xffeedd, 2);
  dirLight.position.set(100, 250, 150);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(4096, 4096);
  scene.add(dirLight);
}
function setupPostProcessing() {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const ssaoPass = new SSAOPass(
    scene,
    camera,
    window.innerWidth,
    window.innerHeight
  );
  ssaoPass.kernelRadius = 32;
  ssaoPass.minDistance = 0.001;
  ssaoPass.maxDistance = 0.3;
  composer.addPass(ssaoPass);
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.4,
    0.6,
    0.8
  );
  composer.addPass(bloomPass);
}
function setupControls() {
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.target.copy(gameCannon.getCannonPositionForCamera());
  controls.enabled = false;
  controls.enableRotate = true;
  controls.enablePan = true;
  controls.enableZoom = true;
  dynamicAimMesh = new THREE.Mesh(
    new THREE.CircleGeometry(0.2, 32),
    new THREE.MeshBasicMaterial({ color: 0xff0000, side: THREE.DoubleSide })
  );
  dynamicAimMesh.rotation.x = -Math.PI / 2;
  dynamicAimMesh.visible = false;
  scene.add(dynamicAimMesh);
  document.getElementById("toggle-ui-button").addEventListener("click", () => {
    const uiContainer = document.getElementById("ui-container");
    if (uiContainer.style.display === "none") {
      uiContainer.style.display = "block";
      document.getElementById("toggle-ui-button").textContent = "Ocultar UI";
    } else {
      uiContainer.style.display = "none";
      document.getElementById("toggle-ui-button").textContent = "Mostrar UI";
    }
  });
  window.addEventListener("keydown", (e) => {
    if (e.code === "KeyW") keysPressed.KeyW = true;
    if (e.code === "KeyA") keysPressed.KeyA = true;
    if (e.code === "KeyS") keysPressed.KeyS = true;
    if (e.code === "KeyD") keysPressed.KeyD = true;
    if (e.code === "KeyR") loadLevel(gameState.currentLevel);
    if (isAiming && !isOrbiting) {
      gameCannon.handleKeyboardAiming(e.code);
    }
    if (e.code === "Space") {
      if (gameState.projectiles > 0 && !gameState.isGameOver) {
        shoot();
      } else {
        uiElements.statusDisplay.textContent =
          "Sem projéteis ou Jogo Encerrado!";
      }
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "KeyW") keysPressed.KeyW = false;
    if (e.code === "KeyA") keysPressed.KeyA = false;
    if (e.code === "KeyS") keysPressed.KeyS = false;
    if (e.code === "KeyD") keysPressed.KeyD = false;
  });
  renderer.domElement.addEventListener("mousedown", (e) => {
    if (e.button === 2) {
      isAiming = !isAiming;
      if (isAiming) {
        lastFreeCameraPosition.copy(camera.position);
        lastFreeCameraQuaternion.copy(camera.quaternion);
        controls.enabled = false;
        renderer.domElement.requestPointerLock();
        crosshair.style.display = "block";
        dynamicAimMesh.visible = true;
        gameCannon.enableAimingMode();
      } else {
        document.exitPointerLock();
      }
    } else if (e.button === 0) {
      if (!isAiming) {
        isOrbiting = true;
        controls.enabled = true;
        controls.target.copy(gameCannon.getCannonPositionForCamera());
      }
    }
  });
  renderer.domElement.addEventListener("mouseup", (e) => {
    if (e.button === 0) {
      if (isOrbiting) {
        isOrbiting = false;
        controls.enabled = false;
        lastFreeCameraPosition.copy(camera.position);
        lastFreeCameraQuaternion.copy(camera.quaternion);
      }
    }
  });
  document.addEventListener("pointerlockchange", () => {
    if (document.pointerLockElement !== renderer.domElement) {
      if (isAiming) {
        isAiming = false;
        crosshair.style.display = "none";
        dynamicAimMesh.visible = false;
        gameCannon.disableAimingMode();
      }
      controls.enabled = false;
      isOrbiting = false;
    }
  });
  window.addEventListener("mousemove", (e) => {
    if (isAiming && !isOrbiting) {
      gameCannon.handleAimingMouseMove(e);
    }
  });
  window.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      gameCannon.handlePowerScroll(e.deltaY);
    },
    { passive: false }
  );
  renderer.domElement.addEventListener("contextmenu", (e) =>
    e.preventDefault()
  );
}

function createTarget(position) {
  const model = assetManager.models.statueBlock.clone();
  model.traverse((n) => {
    if (n.isMesh) {
      n.castShadow = true;
      n.receiveShadow = true;
      n.material = targetMaterial;
    }
  });
  model.position.copy(position);
  const size = 1.8;
  const shape = new CANNON.Box(new CANNON.Vec3(size / 2, size / 2, size / 2));
  const body = new CANNON.Body({
    mass: 1,
    shape: shape,
    position: position,
    material: defaultMaterial,
  });
  body.isTarget = true;
  body.gameReference = { toRemove: false, meshRef: model };
  model.bodyRef = body;
  scene.add(model);
  physicsWorld.addBody(body);
  objectsToUpdate.push(model);
  gameState.targets++;
}

const levels = [
  {
    name: "Nível 1",
    projectiles: 20,
    setup: () => {
      createTarget(new THREE.Vector3(0, 8, -15));
      createTarget(new THREE.Vector3(15, 8, -10));
      createTarget(new THREE.Vector3(-15, 8, -10));
    },
  },
  {
    name: "Nível 2",
    projectiles: 15,
    setup: () => {
      createTarget(new THREE.Vector3(-25, 12, -20));
      createTarget(new THREE.Vector3(0, 15, -40));
      createTarget(new THREE.Vector3(25, 12, -20));
      createTarget(new THREE.Vector3(10, 5, -50));
    },
  },
];

function shoot() {
  const projectileMesh = gameCannon.shoot();
  if (projectileMesh) {
    gameState.projectiles--;
    updateGameUI();
    uiElements.statusDisplay.textContent = `Disparado! Velocidade: ${parseFloat(
      uiElements.powerInput.value
    ).toFixed(1)} m/s`;

    projectileMesh.bodyRef.isProjectile = true;
    projectileMesh.bodyRef.gameReference = {
      toRemove: false,
      createdAt: clock.getElapsedTime(),
    };
    projectileMesh.bodyRef.addEventListener("collide", onProjectileHit);
    objectsToUpdate.push(projectileMesh);
  }
}

function loadLevel(levelIndex) {
  clearLevel();
  const level = levels[levelIndex];
  if (!level) return;
  gameState.currentLevel = levelIndex;
  gameState.projectiles = level.projectiles;
  gameState.isGameOver = false;
  gameState.waitingForLevelEnd = false; // Reseta a flag de espera

  level.setup();
  updateGameUI();
  uiElements.statusDisplay.textContent = `Nível ${levelIndex + 1} - Preparado`;
}

function clearLevel() {
  gameState.targets = 0;
  for (let i = objectsToUpdate.length - 1; i >= 0; i--) {
    const obj = objectsToUpdate[i];
    if (obj.bodyRef) {
      if (physicsWorld.bodies.includes(obj.bodyRef)) {
        physicsWorld.removeBody(obj.bodyRef);
      }
    }
    if (scene.children.includes(obj)) {
      scene.remove(obj);
    }
  }
  objectsToUpdate.length = 0;
}

// ✅ ALTERAÇÃO: Função onProjectileHit totalmente corrigida e robusta.
function onProjectileHit(event) {
  const bodyA = event.bodyA;
  const bodyB = event.bodyB;

  // Descobre qual dos corpos que colidiram é o alvo.
  let targetBody = null;
  if (bodyA?.isTarget) {
    targetBody = bodyA;
  } else if (bodyB?.isTarget) {
    targetBody = bodyB;
  }

  // Se um alvo foi atingido E ele ainda não foi marcado para remoção...
  if (targetBody && !targetBody.gameReference.toRemove) {
    // Marca o alvo para ser removido no loop 'animate'
    targetBody.gameReference.toRemove = true;

    // Atualiza a contagem e a UI
    gameState.targets--;
    updateGameUI();

    // Efeito visual
    particleSystem.explode(targetBody.position);

    // Se este foi o último alvo, inicia o processo de fim de nível.
    if (gameState.targets <= 0) {
      gameState.waitingForLevelEnd = true;
      uiElements.statusDisplay.textContent =
        "Alvos destruídos! Finalizando nível...";
    }
  }
}

function checkWinCondition() {
  if (gameState.isGameOver) return;
  const nextLevelIndex = gameState.currentLevel + 1;
  if (levels[nextLevelIndex]) {
    uiElements.statusDisplay.textContent = `Nível ${
      gameState.currentLevel + 1
    } Concluído! Carregando...`;
    setTimeout(() => {
      loadLevel(nextLevelIndex);
    }, 2000);
  } else {
    gameState.isGameOver = true;
    uiElements.statusDisplay.textContent =
      "Você venceu o jogo! (Pressione R para reiniciar)";
    alert("Parabéns, você completou todos os níveis!");
  }
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
}
function updateGameUI() {
  targetsDisplay.textContent = gameState.targets;
  projectilesDisplay.textContent = gameState.projectiles;
}
function handleCannonMovement(deltaTime) {
  const speed = 20;
  let vx = 0,
    vz = 0;
  const forwardDirection = new THREE.Vector3(0, 0, -1)
    .applyQuaternion(gameCannon.basePivot.quaternion)
    .normalize();
  forwardDirection.y = 0;
  forwardDirection.normalize();
  const rightDirection = new THREE.Vector3()
    .crossVectors(new THREE.Vector3(0, 1, 0), forwardDirection)
    .normalize();
  if (keysPressed.KeyW) {
    vx += forwardDirection.x * speed;
    vz += forwardDirection.z * speed;
  }
  if (keysPressed.KeyS) {
    vx -= forwardDirection.x * speed;
    vz -= forwardDirection.z * speed;
  }
  if (keysPressed.KeyA) {
    vx -= rightDirection.x * speed;
    vz -= rightDirection.z * speed;
  }
  if (keysPressed.KeyD) {
    vx += rightDirection.x * speed;
    vz += rightDirection.z * speed;
  }
  gameCannon.cannonBody.velocity.x = vx;
  gameCannon.cannonBody.velocity.z = vz;
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.1, clock.getDelta());

  handleCannonMovement(dt);
  gameCannon.update(dt);
  physicsWorld.step(1 / 60, dt, 3);
  particleSystem.update(dt);

  // Lógica de câmera...
  if (isAiming) {
    const { mouthPos, shootDir } = gameCannon.getCameraAimPointAndDirection();
    const cameraDistanceBehind = 10,
      cameraHeightOffset = 5;
    const camTargetPos = mouthPos
      .clone()
      .add(shootDir.clone().negate().multiplyScalar(cameraDistanceBehind))
      .add(new THREE.Vector3(0, cameraHeightOffset, 0));
    camera.position.lerp(camTargetPos, 0.1);
    camera.lookAt(mouthPos.clone().add(shootDir.clone().multiplyScalar(20)));
    crosshair.style.display = "none";
    const aimPoint = gameCannon.getAimPointFromTrajectory();
    if (aimPoint) {
      dynamicAimMesh.position.copy(aimPoint);
      dynamicAimMesh.position.y += 0.1;
      dynamicAimMesh.visible = true;
    } else {
      dynamicAimMesh.visible = false;
    }
  } else if (isOrbiting) {
    controls.update();
    crosshair.style.display = "none";
    dynamicAimMesh.visible = false;
  } else {
    camera.position.lerp(lastFreeCameraPosition, 0.05);
    camera.quaternion.slerp(lastFreeCameraQuaternion, 0.05);
    controls.target.copy(gameCannon.getCannonPositionForCamera());
    controls.update();
    crosshair.style.display = "none";
    dynamicAimMesh.visible = false;
  }

  gameCannon.updateTrajectoryPrediction();

  // Lógica de atualização dos objetos (marcar e remover)...
  for (let i = objectsToUpdate.length - 1; i >= 0; i--) {
    const obj = objectsToUpdate[i];
    if (obj.bodyRef) {
      if (!obj.bodyRef.gameReference.toRemove) {
        obj.position.copy(obj.bodyRef.position);
        obj.quaternion.copy(obj.bodyRef.quaternion);
      }

      if (
        obj.bodyRef.isProjectile &&
        clock.getElapsedTime() - obj.bodyRef.gameReference.createdAt > 5
      ) {
        obj.bodyRef.gameReference.toRemove = true;
      }

      if (obj.bodyRef.gameReference.toRemove) {
        if (scene.children.includes(obj)) scene.remove(obj);
        if (physicsWorld.bodies.includes(obj.bodyRef))
          physicsWorld.removeBody(obj.bodyRef);
        objectsToUpdate.splice(i, 1);
      }
    }
  }

  // ✅ ALTERAÇÃO: Lógica para checar e iniciar a transição de nível.
  if (gameState.waitingForLevelEnd && !gameState.isGameOver) {
    const projectilesActive = objectsToUpdate.some(
      (obj) => obj.bodyRef?.isProjectile
    );
    if (!projectilesActive) {
      checkWinCondition();
      gameState.waitingForLevelEnd = false; // Desativa a flag para não chamar de novo.
    }
  }

  // Lógica para Game Over por falta de projéteis
  if (
    gameState.projectiles === 0 &&
    gameState.targets > 0 &&
    !gameState.isGameOver &&
    !gameState.waitingForLevelEnd
  ) {
    if (!objectsToUpdate.some((obj) => obj.bodyRef?.isProjectile)) {
      gameState.isGameOver = true;
      uiElements.statusDisplay.textContent =
        "Sem projéteis! (Pressione R para reiniciar)";
      alert("Sem projéteis! (Pressione R para reiniciar)");
    }
  }

  composer.render();
}

init();
window.addEventListener("resize", onWindowResize);
