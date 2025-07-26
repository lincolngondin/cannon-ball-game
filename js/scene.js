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

// Variável de estado para o toggle de mira
let isAiming = false;
let isOrbiting = false; // Nova variável de estado para OrbitControls ativado pelo mouse
let lastFreeCameraPosition = new THREE.Vector3(); // Armazena a última posição da câmera livre
let lastFreeCameraQuaternion = new THREE.Quaternion(); // Armazena a última rotação da câmera livre

const keysPressed = {
  KeyW: false,
  KeyA: false,
  KeyS: false,
  KeyD: false, // Movimento (WASD)
};

// --- ESTADO DO JOGO E DOM ---
let gameState = {
  currentLevel: 0,
  targets: 0,
  projectiles: 100,
  isGameOver: false,
};
const targetMaterial = new THREE.MeshStandardMaterial({
  color: 0xffd700,
  emissive: 0xee9900,
  roughness: 0.3,
  metalness: 0.8,
});
const targetsDisplay = document.getElementById("targets-display"),
  projectilesDisplay = document.getElementById("projectiles-display"),
  crosshair = document.getElementById("crosshair"), // O crosshair HTML será escondido ou reusado como ponto de mira 3D
  uiContainer = document.getElementById("ui-container"),
  toggleUiButton = document.getElementById("toggle-ui-button"); // Novo botão

// Mira 3D baseada na trajetória
let dynamicAimMesh;

// Elementos da UI
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

// --- ASSET MANAGER E PARTICLE SYSTEM ---
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

// --- INICIALIZAÇÃO GERAL ---
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

// --- SETUP ---
function setupPhysicsMaterials() {
  defaultMaterial = new CANNON.Material("default");
  projectileMaterial = new CANNON.Material("projectile");
  physicsWorld.addContactMaterial(
    new CANNON.ContactMaterial(defaultMaterial, projectileMaterial, {
      friction: 0.3,
      restitution: 0.6,
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
  // Posição inicial ajustada para uma visão de terceira pessoa mais ampla
  camera.position.set(0, 15, 30);
  camera.lookAt(0, 5, 10);

  // Armazena a posição inicial da câmera como a "última posição livre"
  lastFreeCameraPosition.copy(camera.position);
  lastFreeCameraQuaternion.copy(camera.quaternion);

  // Removendo a retícula fixa da câmera (agora usaremos a mira 3D)
  // const reticle = new THREE.Mesh(
  //   new THREE.CircleGeometry(0.1, 16),
  //   new THREE.MeshBasicMaterial({ color: 0xffff00 })
  // );
  // camera.add(reticle);
  // reticle.position.set(0, 0, -5);
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
  controls.target.copy(gameCannon.getCannonPositionForCamera()); // Target inicial no canhão
  controls.enabled = false; // Começa DESABILITADO
  controls.enableRotate = true; // permite girar com LMB
  controls.enablePan = true; // permite arrastar com LMB (panorâmica)
  controls.enableZoom = true;

  // Criar o mesh da mira dinâmica
  dynamicAimMesh = new THREE.Mesh(
    new THREE.CircleGeometry(0.2, 32),
    new THREE.MeshBasicMaterial({ color: 0xff0000, side: THREE.DoubleSide })
  );
  dynamicAimMesh.rotation.x = -Math.PI / 2; // Para que o círculo fique deitado no chão
  dynamicAimMesh.visible = false; // Começa invisível
  scene.add(dynamicAimMesh);

  // Botão para ocultar/mostrar a UI
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
    // Teclas de Movimento do Canhão (WASD) - APENAS MOVIMENTO DA BASE
    if (e.code === "KeyW") keysPressed.KeyW = true;
    if (e.code === "KeyA") keysPressed.KeyA = true;
    if (e.code === "KeyS") keysPressed.KeyS = true;
    if (e.code === "KeyD") keysPressed.KeyD = true;

    if (e.code === "KeyR") loadLevel(gameState.currentLevel);

    // Setas do teclado controlando a mira (AGORA APENAS DENTRO DO MODO DE MIRA E NÃO ORBITANDO)
    if (isAiming && !isOrbiting) {
      gameCannon.handleKeyboardAiming(e.code);
    }

    if (e.code === "Space") {
      // Disparar APENAS com a barra de espaço
      if (gameState.projectiles > 0 && !gameState.isGameOver) {
        shoot();
      } else {
        uiElements.statusDisplay.textContent =
          "Sem projéteis ou Jogo Encerrado!";
      }
    }
  });

  window.addEventListener("keyup", (e) => {
    // Teclas de Movimento do Canhão (WASD)
    if (e.code === "KeyW") keysPressed.KeyW = false;
    if (e.code === "KeyA") keysPressed.KeyA = false;
    if (e.code === "KeyS") keysPressed.KeyS = false;
    if (e.code === "KeyD") keysPressed.KeyD = false;
  });

  // MOUSE DOWN
  renderer.domElement.addEventListener("mousedown", (e) => {
    if (e.button === 2) {
      // Botão direito: toggle mira
      isAiming = !isAiming;
      if (isAiming) {
        // Se entrar no modo de mira
        lastFreeCameraPosition.copy(camera.position); // Salva a posição atual da câmera
        lastFreeCameraQuaternion.copy(camera.quaternion); // Salva a rotação atual da câmera
        controls.enabled = false; // Desabilita OrbitControls para mirar
        renderer.domElement.requestPointerLock();
        crosshair.style.display = "block"; // Crosshair HTML (ainda podemos usá-lo ou substituí-lo completamente pelo 3D)
        dynamicAimMesh.visible = true; // Mostra a mira 3D
        gameCannon.enableAimingMode();
      } else {
        // Se sair do modo de mira
        document.exitPointerLock(); // Libera Pointer Lock (acionará pointerlockchange)
      }
    } else if (e.button === 0) {
      // Botão esquerdo: ativa OrbitControls
      if (!isAiming) {
        // Só ativa se não estiver no modo de mira
        isOrbiting = true;
        controls.enabled = true;
        controls.target.copy(gameCannon.getCannonPositionForCamera()); // Garante que o target seja o canhão
      }
    }
  });

  // MOUSE UP
  renderer.domElement.addEventListener("mouseup", (e) => {
    if (e.button === 0) {
      // Botão esquerdo: desativa OrbitControls
      if (isOrbiting) {
        // Apenas se estava orbitando
        isOrbiting = false;
        controls.enabled = false; // Desabilita controles
        // Salva a última posição e rotação da câmera livre
        lastFreeCameraPosition.copy(camera.position);
        lastFreeCameraQuaternion.copy(camera.quaternion);
      }
    }
  });

  // Quando o Pointer Lock for perdido (por ESC ou externa)
  document.addEventListener("pointerlockchange", () => {
    if (document.pointerLockElement !== renderer.domElement) {
      if (isAiming) {
        // Se Pointer Lock foi liberado E estávamos em aiming
        isAiming = false;
        crosshair.style.display = "none"; // Esconde crosshair HTML
        dynamicAimMesh.visible = false; // Esconde a mira 3D
        gameCannon.disableAimingMode();
      }
      // Se não estivermos mais em modo de mira (Pointer Lock), garantimos que OrbitControls esteja desativado
      // para que a câmera volte ao modo padrão.
      controls.enabled = false;
      isOrbiting = false; // Garante que o estado de órbita seja resetado
    }
  });

  // MOUSE MOVE - AGORA SÓ AFETA A MIRA SE isAiming FOR TRUE E NÃO ESTIVER ORBITANDO
  window.addEventListener("mousemove", (e) => {
    if (isAiming && !isOrbiting) {
      gameCannon.handleAimingMouseMove(e);
    }
  });

  // Roda do mouse para controle de força
  window.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault(); // Impede o scroll da página
      gameCannon.handlePowerScroll(e.deltaY);
    },
    { passive: false }
  ); // Usar { passive: false } para permitir preventDefault

  // Previne o menu de contexto do botão direito
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
  body.gameReference = { toRemove: false, meshRef: model }; // Adiciona referência ao mesh
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
];
function shoot() {
  const projectileMesh = gameCannon.shoot();
  if (projectileMesh) {
    gameState.projectiles--;
    updateGameUI();
    uiElements.statusDisplay.textContent = `Disparado! Velocidade: ${parseFloat(
      uiElements.powerInput.value
    ).toFixed(1)} m/s`;
    projectileMesh.bodyRef.gameReference = {
      toRemove: false,
      createdAt: clock.getElapsedTime(),
    };
    projectileMesh.bodyRef.addEventListener("collide", onProjectileHit);
    objectsToUpdate.push(projectileMesh);
  } else {
    console.warn("gameCannon.shoot() não retornou um mesh válido.");
  }
}
function loadLevel(levelIndex) {
  clearLevel();
  const level = levels[levelIndex];
  if (!level) return;
  gameState.currentLevel = levelIndex;
  gameState.projectiles = level.projectiles;
  gameState.isGameOver = false;
  level.setup();
  updateGameUI();
  uiElements.statusDisplay.textContent = "Preparado para disparar";
}
function clearLevel() {
  gameState.targets = 0;
  for (let i = objectsToUpdate.length - 1; i >= 0; i--) {
    const obj = objectsToUpdate[i];
    if (obj.bodyRef) physicsWorld.removeBody(obj.bodyRef);
    scene.remove(obj);
  }
  objectsToUpdate.length = 0;
}
function onProjectileHit(event) {
  const hitTarget = (body) => {
    // Verifica se o corpo colidido é um alvo e ainda não foi marcado para remoção
    if (body?.isTarget && !body.gameReference.toRemove) {
      body.gameReference.toRemove = true; // Marca para remover
      gameState.targets--;
      console.log("Alvo atingido! Alvos restantes:", gameState.targets); // Depuração
      updateGameUI();
      particleSystem.explode(body.position);

      // Remove o mesh visual do alvo da cena
      if (body.gameReference.meshRef) {
        scene.remove(body.gameReference.meshRef);
      }
      // Remove o corpo físico do alvo do mundo para evitar mais colisões
      physicsWorld.removeBody(body);

      // Verifica condição de vitória
      if (gameState.targets <= 0) {
        // Usar <= 0 para garantir que passe mesmo se algo inesperado ocorrer
        checkWinCondition();
      }
    }
  };
  hitTarget(event.bodyA);
  hitTarget(event.bodyB);
}
function checkWinCondition() {
  if (gameState.isGameOver) return;
  gameState.isGameOver = true;
  uiElements.statusDisplay.textContent =
    "Nível Concluído! (Pressione R para reiniciar)";
  alert("Nível Concluído! (Pressione R para reiniciar)");
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

// Movimento WASD do canhão relativo à sua orientação
function handleCannonMovement(deltaTime) {
  const speed = 20; // Velocidade de movimento AUMENTADA
  let vx = 0,
    vz = 0;

  // Obtém a direção "para frente" da base do canhão (vetor Three.js)
  // O eixo Z negativo local do canhão aponta para onde o cano aponta.
  const forwardDirection = new THREE.Vector3(0, 0, -1)
    .applyQuaternion(gameCannon.basePivot.quaternion)
    .normalize();
  forwardDirection.y = 0; // Movimento no plano XZ
  forwardDirection.normalize();

  // Calcula a direção "para a direita" (90 graus à direita da frente)
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

  // Aplica a velocidade ao corpo físico do canhão
  gameCannon.cannonBody.velocity.x = vx;
  gameCannon.cannonBody.velocity.z = vz;
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.1, clock.getDelta());

  handleCannonMovement(dt); // Movimento da BASE do canhão (corpo) com WASD
  gameCannon.update(dt); // Sincroniza visual com física (posição e rotação da base e rodas)
  physicsWorld.step(1 / 60, dt, 3);
  particleSystem.update(dt);

  // Lógica da Câmera:
  if (isAiming) {
    // Modo de Mira (Pointer Lock): Câmera segue a mira do canhão
    const { mouthPos, shootDir } = gameCannon.getCameraAimPointAndDirection();

    const cameraDistanceBehind = 10;
    const cameraHeightOffset = 5;

    const camTargetPos = mouthPos
      .clone()
      .add(shootDir.clone().negate().multiplyScalar(cameraDistanceBehind))
      .add(new THREE.Vector3(0, cameraHeightOffset, 0));

    camera.position.lerp(camTargetPos, 0.1); // Suaviza o movimento da câmera
    camera.lookAt(mouthPos.clone().add(shootDir.clone().multiplyScalar(20)));
    crosshair.style.display = "none"; // Oculta o crosshair HTML

    // Posiciona a mira 3D no ponto final da trajetória
    const aimPoint = gameCannon.getAimPointFromTrajectory();
    if (aimPoint) {
      dynamicAimMesh.position.copy(aimPoint);
      dynamicAimMesh.position.y += 0.1; // Levemente acima do chão para não ficar dentro do terreno
      dynamicAimMesh.visible = true; // Mostra a mira 3D
    } else {
      dynamicAimMesh.visible = false;
    }
  } else if (isOrbiting) {
    // Modo de Câmera Livre (OrbitControls ativo):
    controls.update(); // Permite que OrbitControls funcione livremente
    crosshair.style.display = "none"; // Esconde a mira HTML
    dynamicAimMesh.visible = false; // Esconde a mira 3D
    // A posição e rotação da câmera já são atualizadas pelo OrbitControls
    // e serão salvas em lastFreeCameraPosition/Quaternion no mouseup.
  } else {
    // Modo de Câmera Padrão (nem mira, nem órbita ativa): Câmera na última posição livre.
    // Interpolar para a última posição e rotação livre
    camera.position.lerp(lastFreeCameraPosition, 0.05);
    camera.quaternion.slerp(lastFreeCameraQuaternion, 0.05);

    // Atualiza o target do OrbitControls para onde a câmera está olhando para evitar saltos ao reativá-lo
    controls.target.copy(gameCannon.getCannonPositionForCamera());
    controls.update();

    crosshair.style.display = "none"; // Esconde a mira HTML
    dynamicAimMesh.visible = false; // Esconde a mira 3D
  }

  // LINHA AMARELA SEMPRE VISÍVEL E ATUALIZADA (só se estiver em modo de mira, a lógica está dentro de updateTrajectoryPrediction)
  gameCannon.updateTrajectoryPrediction();

  for (let i = objectsToUpdate.length - 1; i >= 0; i--) {
    const obj = objectsToUpdate[i];
    if (obj.bodyRef) {
      // Atualiza a posição e rotação dos objetos baseadas no corpo físico,
      // se eles ainda não estiverem marcados para remoção.
      if (!obj.bodyRef.gameReference.toRemove) {
        obj.position.copy(obj.bodyRef.position);
        obj.quaternion.copy(obj.bodyRef.quaternion);
      }

      // Lógica de remoção para projéteis (tempo de vida)
      if (
        obj.bodyRef.isProjectile &&
        clock.getElapsedTime() - obj.bodyRef.gameReference.createdAt > 5
      ) {
        obj.bodyRef.gameReference.toRemove = true;
      }

      // Se o objeto estiver marcado para remoção, remove-o
      if (obj.bodyRef.gameReference.toRemove) {
        // Verifica se o objeto ainda não foi removido para evitar erros (remover da cena e do mundo físico)
        const indexInScene = scene.children.indexOf(obj);
        if (indexInScene !== -1) {
          scene.remove(obj);
        }
        const bodyIndexInWorld = physicsWorld.bodies.indexOf(obj.bodyRef);
        if (bodyIndexInWorld !== -1) {
          physicsWorld.removeBody(obj.bodyRef);
        }
        objectsToUpdate.splice(i, 1); // Remove do array de objetos a serem atualizados
      }
    }
  }

  if (
    gameState.projectiles === 0 &&
    gameState.targets > 0 &&
    !gameState.isGameOver
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
