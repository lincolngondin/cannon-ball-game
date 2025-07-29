// js/main.js

import * as THREE from "three";
import * as CANNON from "cannon-es";
import { assetManager } from "./assetManager.js";
import { createWorld } from "./world.js";
import { setupEngine } from "./engineSetup.js";
import { setupPhysics } from "./physicsSetup.js";
import { Cannon } from "./cannon.js";
import { ParticleSystem } from "./particleSystem.js";
import { initUIManager, uiElements } from "./uiManager.js";
import {
  initInputManager,
  getInputState,
  getMovementKeys,
} from "./inputManager.js";
import {
  gameState,
  initGameManager,
  loadLevel,
  shootProjectile,
  updateGameLogic,
} from "./gameManager.js";

// --- ESCOPO GLOBAL DO MÓDULO ---
let scene,
  camera,
  renderer,
  composer,
  physicsWorld,
  controls,
  gameCannon,
  particleSystem,
  dynamicAimMesh;
const clock = new THREE.Clock();
const staticCollidables = [];
const objectsToUpdate = [];

// Para câmera livre
let lastFreeCameraPosition = new THREE.Vector3();
let lastFreeCameraQuaternion = new THREE.Quaternion();

async function init() {
  await assetManager.load();

  const engine = setupEngine();
  scene = engine.scene;
  camera = engine.camera;
  renderer = engine.renderer;
  composer = engine.composer;
  controls = engine.controls;
  dynamicAimMesh = engine.dynamicAimMesh;

  const physics = setupPhysics();
  physicsWorld = physics.physicsWorld;

  particleSystem = new ParticleSystem(scene);

  createWorld(
    scene,
    physicsWorld,
    assetManager,
    staticCollidables,
    physics.defaultMaterial
  );

  gameCannon = new Cannon(
    scene,
    physicsWorld,
    physics.defaultMaterial,
    physics.projectileMaterial
  );

  initGameManager({
    scene,
    physicsWorld,
    particleSystem,
    objectsToUpdate,
    clock,
    targetPhysicsMaterial: physics.targetPhysicsMaterial,
  });

  const actions = {
    shoot: () => shootProjectile(gameCannon),
    reset: () => loadLevel(0),
    setAzimuth: (angle) => gameCannon.setAzimuth(angle),
    setElevation: (angle) => gameCannon.setElevation(angle),
    setPower: (value) => gameCannon.setPower(value),
  };

  initUIManager(actions);
  gameCannon.setUIElements(uiElements);

  initInputManager(
    {
      renderer,
      gameCannon,
      controls,
      crosshair: uiElements.crosshair,
      dynamicAimMesh,
      lastFreeCameraPosition,
      lastFreeCameraQuaternion,
    },
    actions
  );

  loadLevel(0);
  animate();
}

// ===================================================================
// INÍCIO DA FUNÇÃO handleCannonMovement (CORRIGIDA)
// ===================================================================
function handleCannonMovement(deltaTime) {
  const { isAiming } = getInputState();
  const keys = getMovementKeys();
  const speed = 20;
  let vx = 0,
    vz = 0;

  const upVector = new THREE.Vector3(0, 1, 0);

  if (isAiming) {
    // LÓGICA MODO MIRA (FPS) - Já estava correta
    const aimDirection = gameCannon.getBarrelDirection();
    aimDirection.y = 0;
    aimDirection.normalize();

    const rightDirection = new THREE.Vector3()
      .crossVectors(aimDirection, upVector)
      .normalize();

    if (keys.KeyW) {
      vx += aimDirection.x * speed;
      vz += aimDirection.z * speed;
    }
    if (keys.KeyS) {
      vx -= aimDirection.x * speed;
      vz -= aimDirection.z * speed;
    }
    if (keys.KeyA) {
      vx -= rightDirection.x * speed;
      vz -= rightDirection.z * speed;
    }
    if (keys.KeyD) {
      vx += rightDirection.x * speed;
      vz += rightDirection.z * speed;
    }
  } else {
    // --- LÓGICA MODO TANQUE (SEM MIRA) ---
    const forwardDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(
      gameCannon.basePivot.quaternion
    );
    forwardDirection.y = 0;
    forwardDirection.normalize();

    // <<< CORREÇÃO DA LÓGICA INVERTIDA >>>
    // Trocamos `+=` por `-=` e vice-versa para que o movimento corresponda à tecla pressionada.
    // Isso alinha o controle à orientação do seu modelo 3D.
    if (keys.KeyW) {
      // Frente
      vx -= forwardDirection.x * speed;
      vz -= forwardDirection.z * speed;
    }
    if (keys.KeyS) {
      // Trás
      vx += forwardDirection.x * speed;
      vz += forwardDirection.z * speed;
    }

    const rightDirection = new THREE.Vector3()
      .crossVectors(forwardDirection, upVector)
      .normalize();

    // <<< CORREÇÃO DA LÓGICA INVERTIDA (LATERAL) >>>
    if (keys.KeyA) {
      // Esquerda
      vx += rightDirection.x * speed;
      vz += rightDirection.z * speed;
    }
    if (keys.KeyD) {
      // Direita
      vx -= rightDirection.x * speed;
      vz -= rightDirection.z * speed;
    }
  }

  gameCannon.cannonBody.velocity.x = vx;
  gameCannon.cannonBody.velocity.z = vz;
}
// ===================================================================
// FIM DA FUNÇÃO handleCannonMovement
// ===================================================================

function updateCamera() {
  const { isAiming, isOrbiting } = getInputState();

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

    const aimPoint = gameCannon.getAimPointFromTrajectory();
    if (aimPoint) {
      dynamicAimMesh.position.copy(aimPoint).y += 0.1;
      dynamicAimMesh.visible = true;
    } else {
      dynamicAimMesh.visible = false;
    }
  } else if (isOrbiting) {
    // Câmera está sendo orbitada manualmente pelo botão esquerdo do mouse
    controls.update();
  } else {
    // Câmera seguindo o canhão automaticamente
    controls.target.copy(gameCannon.getCannonPositionForCamera());
    controls.update();
  }
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.1, clock.getDelta());

  handleCannonMovement(dt);
  gameCannon.update(dt);
  physicsWorld.step(1 / 60, dt, 3);
  particleSystem.update(dt);
  updateGameLogic();
  gameCannon.updateTrajectoryPrediction();

  updateCamera();

  for (let i = objectsToUpdate.length - 1; i >= 0; i--) {
    const obj = objectsToUpdate[i];
    if (!obj.bodyRef || !obj.bodyRef.gameReference) {
      objectsToUpdate.splice(i, 1);
      continue;
    }

    if (!obj.bodyRef.gameReference.toRemove) {
      obj.position.copy(obj.bodyRef.position);
      obj.quaternion.copy(obj.bodyRef.quaternion);
    }

    if (
      obj.bodyRef.isProjectile &&
      !obj.bodyRef.gameReference.toRemove &&
      clock.getElapsedTime() - obj.bodyRef.gameReference.createdAt > 5
    ) {
      obj.bodyRef.gameReference.toRemove = true;
    }

    if (obj.bodyRef.gameReference.toRemove) {
      if (scene.children.includes(obj)) scene.remove(obj);
      if (physicsWorld.bodies.includes(obj.bodyRef)) {
        physicsWorld.removeBody(obj.bodyRef);
      }
      objectsToUpdate.splice(i, 1);
    }
  }

  composer.render();
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

init();
