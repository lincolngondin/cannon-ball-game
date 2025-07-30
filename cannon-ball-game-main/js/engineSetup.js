import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export function setupEngine() {
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.2,
    5000
  );
  camera.position.set(0, 15, 30);
  camera.lookAt(0, 5, 10);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.setPixelRatio(window.devicePixelRatio);
  document.body.appendChild(renderer.domElement);

  // Controles da Câmera
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.enabled = false; // Começa desabilitado

  // Skybox e Fog
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

  // Iluminação
  scene.add(new THREE.AmbientLight(0x8899aa, 1.5));
  const dirLight = new THREE.DirectionalLight(0xffeedd, 2);
  dirLight.position.set(100, 250, 150);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(4096, 4096);
  scene.add(dirLight);

  // Pós-processamento
  const composer = new EffectComposer(renderer);
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

  const dynamicAimMesh = new THREE.Mesh(
    new THREE.CircleGeometry(0.2, 32),
    new THREE.MeshBasicMaterial({ color: 0xff0000, side: THREE.DoubleSide })
  );
  dynamicAimMesh.rotation.x = -Math.PI / 2;
  dynamicAimMesh.visible = false;
  scene.add(dynamicAimMesh);

  return { scene, camera, renderer, composer, controls, dynamicAimMesh };
}
