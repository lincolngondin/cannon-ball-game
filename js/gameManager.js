import * as THREE from "three";
import * as CANNON from "cannon-es";
import { assetManager } from "./assetManager.js";
import { uiElements, updateGameUI } from "./uiManager.js";

// Módulo-nível de dependências
// CORREÇÃO: Adicionada a variável _targetPhysicsMaterial
let _scene,
  _physicsWorld,
  _particleSystem,
  _objectsToUpdate,
  _clock,
  _targetPhysicsMaterial;

export const gameState = {
  currentLevel: 0,
  targets: 0,
  projectiles: 100,
  isGameOver: false,
  waitingForLevelEnd: false,
};

const targetMaterial = new THREE.MeshStandardMaterial({
  color: 0xffd700,
  emissive: 0xee9900,
  roughness: 0.3,
  metalness: 0.8,
});

export function initGameManager(dependencies) {
  _scene = dependencies.scene;
  _physicsWorld = dependencies.physicsWorld;
  _particleSystem = dependencies.particleSystem;
  _objectsToUpdate = dependencies.objectsToUpdate;
  _clock = dependencies.clock;
  // CORREÇÃO: Armazenar a referência ao material do alvo
  _targetPhysicsMaterial = dependencies.targetPhysicsMaterial;
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

export function shootProjectile(gameCannon) {
  if (gameState.projectiles <= 0 || gameState.isGameOver) return;

  const projectileMesh = gameCannon.shoot();
  if (projectileMesh) {
    gameState.projectiles--;
    updateGameUI(gameState);
    uiElements.statusDisplay.textContent = `Disparado!`;

    projectileMesh.bodyRef.isProjectile = true;
    projectileMesh.bodyRef.gameReference = {
      toRemove: false,
      createdAt: _clock.getElapsedTime(),
    };
    projectileMesh.bodyRef.addEventListener("collide", onProjectileHit);
    _objectsToUpdate.push(projectileMesh);
  }
}

export function loadLevel(levelIndex) {
  clearLevel();
  const level = levels[levelIndex];
  if (!level) {
    gameState.isGameOver = true;
    uiElements.statusDisplay.textContent =
      "Você venceu o jogo! (Pressione R para reiniciar)";
    alert("Parabéns, você completou todos os níveis!");
    return;
  }
  gameState.currentLevel = levelIndex;
  gameState.projectiles = level.projectiles;
  gameState.isGameOver = false;
  gameState.waitingForLevelEnd = false;
  level.setup();
  updateGameUI(gameState);
  uiElements.statusDisplay.textContent = `Nível ${levelIndex + 1} - Preparado`;
}

function onProjectileHit(event) {
  const projectileBody = event.target;
  const otherBody = event.body;

  if (
    otherBody.isTarget &&
    otherBody.gameReference &&
    !otherBody.gameReference.toRemove
  ) {
    otherBody.gameReference.toRemove = true;
    gameState.targets--;
    updateGameUI(gameState);
    _particleSystem.explode(new THREE.Vector3().copy(otherBody.position));

    if (projectileBody.gameReference) {
      projectileBody.gameReference.toRemove = true;
    }

    if (gameState.targets <= 0) {
      gameState.waitingForLevelEnd = true;
      uiElements.statusDisplay.textContent =
        "Todos os alvos destruídos! Finalizando nível...";
    }
  }
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

  // CORREÇÃO: Usar a variável de material correta
  const body = new CANNON.Body({
    mass: 10,
    shape: shape,
    position: new CANNON.Vec3().copy(position),
    material: _targetPhysicsMaterial,
  });

  body.isTarget = true;
  body.gameReference = { toRemove: false, meshRef: model };
  model.bodyRef = body;

  _scene.add(model);
  _physicsWorld.addBody(body);
  _objectsToUpdate.push(model);
  gameState.targets++;
}

function clearLevel() {
  gameState.targets = 0;
  for (let i = _objectsToUpdate.length - 1; i >= 0; i--) {
    const obj = _objectsToUpdate[i];
    if (obj.bodyRef) {
      obj.bodyRef.removeEventListener("collide", onProjectileHit);
      if (_physicsWorld.bodies.includes(obj.bodyRef)) {
        _physicsWorld.removeBody(obj.bodyRef);
      }
    }
    if (_scene.children.includes(obj)) {
      _scene.remove(obj);
    }
  }
  _objectsToUpdate.length = 0;
}

function checkWinCondition() {
  if (gameState.isGameOver) return;
  const nextLevelIndex = gameState.currentLevel + 1;
  uiElements.statusDisplay.textContent = `Nível Concluído! Carregando próximo...`;
  setTimeout(() => {
    loadLevel(nextLevelIndex);
  }, 2000);
}

export function updateGameLogic() {
  if (gameState.waitingForLevelEnd && !gameState.isGameOver) {
    const projectilesActive = _objectsToUpdate.some(
      (obj) => obj.bodyRef?.isProjectile && !obj.bodyRef.gameReference.toRemove
    );
    if (!projectilesActive) {
      checkWinCondition();
      gameState.waitingForLevelEnd = false;
    }
  }

  if (
    gameState.projectiles === 0 &&
    gameState.targets > 0 &&
    !gameState.isGameOver &&
    !gameState.waitingForLevelEnd
  ) {
    const projectilesActive = _objectsToUpdate.some(
      (obj) => obj.bodyRef?.isProjectile
    );
    if (!projectilesActive) {
      gameState.isGameOver = true;
      uiElements.statusDisplay.textContent =
        "Sem projéteis! (Pressione R para reiniciar)";
      alert("Sem projéteis! (Pressione R para reiniciar)");
    }
  }
}
