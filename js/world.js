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

function createTrimeshHitbox(instance) {
  const meshes = [];
  instance.traverse((node) => {
    if (node.isMesh) {
      meshes.push(node);
    }
  });

  if (meshes.length === 0) return;

  // Para cada malha dentro do modelo...
  meshes.forEach((mesh) => {
    const geometry = mesh.geometry;
    const vertices = geometry.attributes.position.array;
    const indices = geometry.index ? geometry.index.array : undefined;

    // Se a geometria não tiver índices, criamos um array sequencial.
    const finalIndices =
      indices || Array.from(Array(vertices.length / 3).keys());

    // Cria a forma Trimesh
    const shape = new CANNON.Trimesh(vertices, finalIndices);
    const body = new CANNON.Body({ mass: 0, material: _defaultMaterial });
    body.addShape(shape);

    // Aplica a mesma posição e rotação do modelo visual.
    body.position.copy(instance.position);
    body.quaternion.copy(instance.quaternion);

    _physicsWorld.addBody(body);
  });
}

function placeStaticObject(modelKey, position, options = {}) {
  if (!_assetManager.models[modelKey]) return;

  const instance = _assetManager.models[modelKey].clone();
  if (options.scale) instance.scale.setScalar(options.scale);
  if (options.rotation) instance.rotation.y = options.rotation;

  // Determina a altura
  let finalY = position.y;
  if (position.y === null || position.y === undefined) {
    finalY = getGroundHeight(position.x, position.z);
  }

  instance.position.set(position.x, finalY, position.z);
  _scene.add(instance);
  _staticCollidables.push(instance); // Adiciona para o raycast de altura

  instance.traverse((n) => {
    if (n.isMesh) {
      n.castShadow = true;
      n.receiveShadow = true;
    }
  });

  // Decide qual hitbox criar baseado nas opções
  if (options.createHitbox !== false) {
    if (options.hitboxType === "trimesh") {
      // Usa a hitbox de malha de triângulos, super precisa
      createTrimeshHitbox(instance);
    } else {
      // Usa a hitbox de caixa padrão (ainda útil para objetos quadrados)
      const box = new THREE.Box3().setFromObject(instance);
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
        {
          scale: 4 + Math.random() * 5,
          rotation: Math.random() * Math.PI * 2,
          hitboxType: "trimesh",
        } // <-- USA TRIMESH PARA PRECISÃO
      );
      if (cliff) {
        const cliffBox = new THREE.Box3().setFromObject(cliff);
        currentY = cliffBox.max.y - Math.random() * 3;
      } else {
        currentY += 5;
      }
    }
  }
}

function createCentralPlateau() {
  // Usando Trimesh para as rochas do platô também
  placeStaticObject(
    "rockLargeC",
    { x: 18, y: 0, z: -5 },
    { scale: 8, hitboxType: "trimesh" }
  );
  placeStaticObject(
    "rockLargeA",
    { x: -15, y: 0, z: -2 },
    { scale: 7, hitboxType: "trimesh" }
  );

  // Ponte pode usar uma caixa simples ou Trimesh, Trimesh é mais preciso para o arco
  placeStaticObject(
    "bridgeStone",
    { x: -20, y: 0, z: 25 },
    { scale: 3, rotation: Math.PI / 8, hitboxType: "trimesh" }
  );

  // Para objetos simples como a tenda, hitbox pode ser desativada ou ser uma caixa
  const campX = -5,
    campZ = 25,
    campY = getGroundHeight(campX, campZ);
  placeStaticObject(
    "tentSmallOpen",
    { x: campX, y: campY, z: campZ },
    { scale: 2, createHitbox: false }
  );
  placeStaticObject(
    "campfireStones",
    { x: campX + 5, y: campY, z: campZ },
    { scale: 1.5, hitboxType: "trimesh" }
  );
}

function placeTreeWithCompoundHitbox(modelKey, position, options = {}) {
  if (!_assetManager.models[modelKey]) return;

  const instance = _assetManager.models[modelKey].clone();
  if (options.scale)
    instance.scale.set(options.scale, options.scale, options.scale);
  if (options.rotation) instance.rotation.y = options.rotation;

  let finalY = position.y;
  if (position.y === null || position.y === undefined) {
    finalY = getGroundHeight(position.x, position.z);
  }

  instance.position.set(position.x, finalY, position.z);
  _scene.add(instance);
  _staticCollidables.push(instance);

  instance.traverse((n) => {
    if (n.isMesh) {
      n.castShadow = true;
      n.receiveShadow = true;
    }
  });

  // --- CRIAÇÃO DA HITBOX COMPOSTA ---
  const compoundBody = new CANNON.Body({ mass: 0, material: _defaultMaterial });

  // Medir a árvore inteira para definir as proporções
  const box = new THREE.Box3().setFromObject(instance);
  const size = new THREE.Vector3();
  box.getSize(size);

  // 1. O Tronco (um Cilindro)
  const trunkRadius = size.x * 0.15; // Estimativa do raio do tronco
  const trunkHeight = size.y * 0.9; // Altura quase total
  const trunkShape = new CANNON.Cylinder(
    trunkRadius,
    trunkRadius,
    trunkHeight,
    12
  );
  // Offset local: o centro do cilindro fica no meio da altura do tronco.
  const trunkOffset = new CANNON.Vec3(0, trunkHeight / 2, 0);
  compoundBody.addShape(trunkShape, trunkOffset);

  // 2. A Copa (uma Esfera)
  const canopyRadius = size.x * 0.6; // Raio maior para a copa
  const canopyHeight = size.y * 0.65; // Posição do centro da copa
  const canopyShape = new CANNON.Sphere(canopyRadius);
  // Offset local: o centro da esfera fica na parte de cima da árvore.
  const canopyOffset = new CANNON.Vec3(0, canopyHeight, 0);
  compoundBody.addShape(canopyShape, canopyOffset);

  compoundBody.position.copy(instance.position);
  compoundBody.quaternion.copy(instance.quaternion);
  _physicsWorld.addBody(compoundBody);
}

function addWorldDetails(count) {
  const detailModels = [
    { key: "mushroomRed", scale: 1, type: "decoration" },
    { key: "mushroomTanGroup", scale: 1.5, type: "decoration" },
    { key: "flowerRedA", scale: 1, type: "decoration" },
    { key: "flowerYellowB", scale: 1, type: "decoration" },
    { key: "stumpRound", scale: 1.5, type: "prop", hitbox: "trimesh" },
    { key: "plantBush", scale: 2, type: "decoration" },
    { key: "treePineDefaultA", scale: 8 + Math.random() * 4, type: "tree" },
    { key: "treeOak", scale: 7 + Math.random() * 3, type: "tree" },
    { key: "treeDetailed", scale: 6 + Math.random() * 3, type: "tree" },
    { key: "treePineRoundB", scale: 8 + Math.random() * 4, type: "tree" },
    { key: "treePineTallC", scale: 9 + Math.random() * 5, type: "tree" },
  ];
  for (let i = 0; i < count; i++) {
    const modelInfo =
      detailModels[Math.floor(Math.random() * detailModels.length)];
    const x = (Math.random() - 0.5) * 140,
      z = (Math.random() - 0.5) * 140;

    // Garante que não nasçam no centro perto do canhão
    if (new THREE.Vector2(x, z).length() > 25) {
      const options = {
        scale: modelInfo.scale,
        rotation: Math.random() * Math.PI * 2,
      };

      // Direciona para a função de criação correta
      if (modelInfo.type === "tree") {
        placeTreeWithCompoundHitbox(
          modelInfo.key,
          { x, y: undefined, z },
          options
        );
      } else if (modelInfo.type === "prop") {
        placeStaticObject(
          modelInfo.key,
          { x, y: undefined, z },
          { ...options, hitboxType: modelInfo.hitbox }
        );
      } else {
        // Decorações sem hitbox
        placeStaticObject(
          modelInfo.key,
          { x, y: undefined, z },
          { ...options, createHitbox: false }
        );
      }
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

  createPhoenixRavine(75, 50); // Reduzi um pouco a contagem para performance
  createCentralPlateau();
  addWorldDetails(200); // Reduzi um pouco a contagem para performance
}
