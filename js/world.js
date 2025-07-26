// js/world.js

import * as THREE from "three";
import * as CANNON from "cannon-es";
import { SimplexNoise } from "./simplex.js";

const noise = new SimplexNoise();

let _scene, _physicsWorld, _assetManager, _staticCollidables, _defaultMaterial;

function getGroundHeight(x, z) {
  const raycaster = new THREE.Raycaster();
  raycaster.set(new THREE.Vector3(x, 500, z), new THREE.Vector3(0, -1, 0));
  const intersects = raycaster.intersectObjects(_staticCollidables, true);
  return intersects.length > 0 ? intersects[0].point.y : 0;
}

function placeStaticObject(modelKey, position, options = {}) {
  if (!_assetManager.models[modelKey]) return;

  const instance = _assetManager.models[modelKey].clone();
  if (options.scale) instance.scale.setScalar(options.scale);
  if (options.rotation) instance.rotation.y = options.rotation;

  let finalY = position.y;
  if (position.y === null || position.y === undefined) {
    finalY = getGroundHeight(position.x, position.z);
  }

  const box = new THREE.Box3().setFromObject(instance);
  instance.position.set(position.x, finalY, position.z);

  instance.traverse((n) => {
    if (n.isMesh) {
      n.castShadow = true;
      n.receiveShadow = true;
      if (options.isCollidable !== false) _staticCollidables.push(instance);
    }
  });
  _scene.add(instance);

  if (options.createHitbox !== false) {
    const size = new THREE.Vector3();
    box.getSize(size);
    const shape = new CANNON.Box(
      new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2)
    );
    const body = new CANNON.Body({
      mass: 0,
      shape,
      material: _defaultMaterial,
    });
    body.position.copy(instance.position).y += size.y / 2;
    body.quaternion.copy(instance.quaternion);
    _physicsWorld.addBody(body);
  }
  return instance;
}

function createPhoenixRavine(baseRadius, count) {
  const cliffModels = [
    "cliffRock",
    "cliffLarge",
    "rockLargeA",
    "rockLargeB",
    "rockLargeC",
  ];
  const treeModels = [
    "treeOak",
    "treeDetailed",
    "treePineDefaultA",
    "treePineRoundB",
    "treePineTallC",
  ];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius =
      baseRadius + noise.noise2D(Math.cos(angle), Math.sin(angle)) * 20;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const stackHeight =
      1 + Math.floor(Math.abs(noise.noise2D(x * 0.1, z * 0.1)) * 4 + 3);
    let currentY = -5;
    for (let j = 0; j < stackHeight; j++) {
      const model = cliffModels[Math.floor(Math.random() * cliffModels.length)];
      const cliff = placeStaticObject(
        model,
        {
          x: x + (Math.random() - 0.5) * 10,
          y: currentY,
          z: z + (Math.random() - 0.5) * 10,
        },
        { scale: 4 + Math.random() * 5, rotation: Math.random() * Math.PI * 2 }
      );
      if (cliff) {
        const cliffBox = new THREE.Box3().setFromObject(cliff);
        currentY = cliffBox.max.y - Math.random() * 3;
        if (j === stackHeight - 1 && Math.random() < 0.4) {
          const treeModel =
            treeModels[Math.floor(Math.random() * treeModels.length)];
          placeStaticObject(
            treeModel,
            { x: cliff.position.x, y: currentY, z: cliff.position.z },
            { scale: 3 + Math.random() * 2 }
          );
        }
      } else {
        currentY += 5;
      }
    }
  }
}

function createCentralPlateau() {
  // Removido o bloco grande central: placeStaticObject("cliffLarge", { x: 0, y: 0, z: 15 }, { scale: 10 });
  placeStaticObject("rockLargeC", { x: 18, y: 0, z: -5 }, { scale: 8 });
  placeStaticObject("rockLargeA", { x: -15, y: 0, z: -2 }, { scale: 7 });
  placeStaticObject(
    "bridgeStone",
    { x: -20, y: 0, z: 25 },
    { scale: 3, rotation: Math.PI / 8 }
  );
  const campX = -5,
    campZ = 25,
    campY = getGroundHeight(campX, campZ);
  placeStaticObject(
    "tentSmallOpen",
    { x: campX, y: campY, z: campZ },
    { scale: 2 }
  );
  placeStaticObject(
    "campfireStones",
    { x: campX + 5, y: campY, z: campZ },
    { scale: 1.5 }
  );
}

function addWorldDetails(count) {
  const detailModels = [
    { key: "mushroomRed", scale: 1 },
    { key: "mushroomTanGroup", scale: 1.5 },
    { key: "flowerRedA", scale: 1 },
    { key: "flowerYellowB", scale: 1 },
    { key: "stumpRound", scale: 1.5 },
    { key: "plantBush", scale: 2 },
    // Aumentando o scale das árvores aqui
    { key: "treePineDefaultA", scale: 8 + Math.random() * 4 }, // Aumentado
    { key: "treeOak", scale: 7 + Math.random() * 3 }, // Aumentado
    { key: "treeDetailed", scale: 6 + Math.random() * 3 }, // Aumentado
    { key: "treePineRoundB", scale: 8 + Math.random() * 4 }, // Aumentado
    { key: "treePineTallC", scale: 9 + Math.random() * 5 }, // Aumentado
  ];
  for (let i = 0; i < count; i++) {
    const modelInfo =
      detailModels[Math.floor(Math.random() * detailModels.length)];
    const x = (Math.random() - 0.5) * 140,
      z = (Math.random() - 0.5) * 140;
    if (new THREE.Vector2(x, z).length() > 25) {
      placeStaticObject(
        modelInfo.key,
        { x: x, y: undefined, z: z },
        {
          scale: modelInfo.scale,
          rotation: Math.random() * Math.PI * 2,
          createHitbox:
            modelInfo.key.includes("tree") || modelInfo.key.includes("stump"),
        }
      );
    }
  }
}

export function createWorld(
  scene,
  physicsWorld,
  assetManager,
  staticCollidables,
  defaultMaterial
) {
  _scene = scene;
  _physicsWorld = physicsWorld;
  _assetManager = assetManager;
  _staticCollidables = staticCollidables;
  _defaultMaterial = defaultMaterial;

  const groundBody = new CANNON.Body({
    type: CANNON.Body.STATIC,
    shape: new CANNON.Plane(),
    material: defaultMaterial,
  });
  groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  _physicsWorld.addBody(groundBody);

  const groundMesh = _assetManager.models.groundGrass.clone();
  groundMesh.scale.set(200, 1, 200);
  groundMesh.receiveShadow = true;
  _scene.add(groundMesh);
  _staticCollidables.push(groundMesh);

  createPhoenixRavine(75, 150);
  createCentralPlateau();
  addWorldDetails(250);
}
