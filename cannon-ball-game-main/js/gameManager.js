// js/gameManager.js (COMPLETO E MODIFICADO)

import * as THREE from "three";
import * as CANNON from "cannon-es";
import { assetManager } from "./assetManager.js";
import { uiElements, updateGameUI } from "./uiManager.js";

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
  score: 0, // NOVO: pontuação
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
  _targetPhysicsMaterial = dependencies.targetPhysicsMaterial;
}

// <<< NOVO: NÍVEIS 3 E 4 ADICIONADOS COM ALVOS MÓVEIS >>>
const levels = [
  {
    name: "Nível 1",
    projectiles: 20,
    setup: () => {
      createTarget({ position: new THREE.Vector3(0, 8, -15) });
      createTarget({ position: new THREE.Vector3(15, 8, -10) });
      createTarget({ position: new THREE.Vector3(-15, 8, -10) });
    },
  },
  {
    name: "Nível 2",
    projectiles: 15,
    setup: () => {
      createTarget({ position: new THREE.Vector3(-25, 12, -20) });
      createTarget({ position: new THREE.Vector3(0, 15, -40) });
      createTarget({ position: new THREE.Vector3(25, 12, -20) });
      createTarget({ position: new THREE.Vector3(10, 5, -50) });
    },
  },
  {
    name: "Nível 3 - O Patrulheiro",
    projectiles: 10,
    setup: () => {
      // Alvo estático de isca
      createTarget({ position: new THREE.Vector3(0, 5, -20) });
      // Alvo móvel
      createTarget({
        position: new THREE.Vector3(0, 15, -50),
        movementPattern: {
          type: "horizontal-sine", // Padrão de movimento
          amplitude: 25, // Distância que se move para cada lado
          speed: 0.4, // Velocidade do movimento
        },
      });
    },
  },
  {
    name: "Nível 4 - Desafio Final",
    projectiles: 15,
    setup: () => {
      // Obstáculo
      const obstacle = assetManager.models.rockLargeB.clone();
      obstacle.scale.set(10, 10, 10);
      obstacle.position.set(0, 0, -45);
      _scene.add(obstacle);

      // Alvo móvel horizontal atrás do obstáculo
      createTarget({
        position: new THREE.Vector3(0, 8, -60),
        movementPattern: { type: "horizontal-sine", amplitude: 30, speed: 0.8 },
      });
      // Alvo móvel vertical
      createTarget({
        position: new THREE.Vector3(-35, 10, -30),
        movementPattern: { type: "vertical-sine", amplitude: 10, speed: 0.5 },
      });
      // Alvo estático bem alto
      createTarget({ position: new THREE.Vector3(30, 25, -40) });
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

    // EFEITO DE FUMAÇA E FAÍSCAS NA BOCA DO CANHÃO
    if (_particleSystem && typeof _particleSystem.cannonBlast === "function") {
      const mouthPos = gameCannon.getBarrelTipPosition();
      const shootDir = gameCannon.getBarrelDirection();
      _particleSystem.cannonBlast(mouthPos, shootDir);
    }
  }
}

export function loadLevel(levelIndex) {
  clearLevel();
  // NÃO zera a pontuação ao iniciar nível!
  const level = levels[levelIndex];
  if (!level) {
    gameState.isGameOver = true;
    uiElements.statusDisplay.textContent =
      "Você venceu o jogo! (Pressione R para reiniciar)";
    alert("Parabéns, você completou todos os níveis!");
    // Zera a pontuação ao terminar o jogo
    gameState.score = 0;
    updateGameUI(gameState);
    return;
  }
  gameState.currentLevel = levelIndex;
  gameState.projectiles = level.projectiles;
  gameState.isGameOver = false;
  gameState.waitingForLevelEnd = false;
  level.setup();
  updateGameUI(gameState);
  uiElements.statusDisplay.textContent = `${level.name} - Preparado`;
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
    gameState.score++; // NOVO: incrementa pontuação
    updateGameUI(gameState);

    if (_particleSystem && typeof _particleSystem.explode === "function") {
      _particleSystem.explode(new THREE.Vector3().copy(otherBody.position));
    }

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

// <<< FUNÇÃO MODIFICADA PARA ACEITAR PADRÕES DE MOVIMENTO >>>
function createTarget({ position, movementPattern = null }) {
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

  // Se tem padrão de movimento, será um corpo KINEMATIC. Senão, DINÂMICO.
  const bodyOptions = {
    mass: movementPattern ? 0 : 10, // Corpos cinemáticos têm massa 0
    shape: shape,
    position: new CANNON.Vec3().copy(position),
    material: _targetPhysicsMaterial,
    type: movementPattern ? CANNON.Body.KINEMATIC : CANNON.Body.DYNAMIC,
  };

  const body = new CANNON.Body(bodyOptions);

  body.isTarget = true;
  body.gameReference = {
    toRemove: false,
    meshRef: model,
    movementPattern: movementPattern, // Armazena o padrão de movimento
    initialPosition: position.clone(), // Armazena a posição inicial para o cálculo
  };
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

  // Limpa também qualquer obstáculo adicionado
  const obstacle = _scene.getObjectByName("obstacle");
  if (obstacle) {
    _scene.remove(obstacle);
  }
}

function checkWinCondition() {
  if (gameState.isGameOver) return;
  const nextLevelIndex = gameState.currentLevel + 1;
  uiElements.statusDisplay.textContent = `Nível Concluído! Carregando próximo...`;
  setTimeout(() => {
    loadLevel(nextLevelIndex);
  }, 2000);
}

// <<< FUNÇÃO MODIFICADA PARA MOVER OS ALVOS >>>
export function updateGameLogic() {
  // 1. Lógica de movimento para alvos cinemáticos
  const elapsedTime = _clock.getElapsedTime();
  for (const obj of _objectsToUpdate) {
    if (obj.bodyRef && obj.bodyRef.gameReference?.movementPattern) {
      const { movementPattern, initialPosition } = obj.bodyRef.gameReference;
      const { type, amplitude, speed } = movementPattern;

      const newPosition = initialPosition.clone();
      const offset = amplitude * Math.sin(elapsedTime * speed);

      if (type === "horizontal-sine") {
        newPosition.x += offset;
      } else if (type === "vertical-sine") {
        newPosition.y += offset;
      }

      // Atualiza a posição do corpo cinemático diretamente
      obj.bodyRef.position.copy(newPosition);
    }
  }

  // 2. Lógica de fim de nível
  if (gameState.waitingForLevelEnd && !gameState.isGameOver) {
    const projectilesActive = _objectsToUpdate.some(
      (obj) => obj.bodyRef?.isProjectile && !obj.bodyRef.gameReference.toRemove
    );
    if (!projectilesActive) {
      checkWinCondition();
      gameState.waitingForLevelEnd = false;
    }
  }

  // 3. Lógica de derrota (Game Over)
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
      // Zera a pontuação ao perder
      gameState.score = 0;
      updateGameUI(gameState);
    }
  }
}

// Exemplo de função de reinício
export function restartGame() {
  gameState.score = 0;
  // ...demais lógicas de reinício...
  updateGameUI(gameState);
}
