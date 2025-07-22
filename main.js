import * as THREE from 'three';
import * as CANNON from 'cannon';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Sky } from 'three/addons/objects/Sky.js';

const loader = new THREE.TextureLoader();

let world, timeStep = 1 / 60
let camera, scene, renderer;
let controls;
let cannonPivot;

// relativo aos projeteis
let projeteis = [], projeteisMesh = [];
let projetilShape = new CANNON.Sphere(0.2);
let projetilGeometry = new THREE.SphereGeometry(projetilShape.radius, 32, 32);
let projetilMaterial = new THREE.MeshPhongMaterial({ color: "red" });
let projetilVelocidade = 45;

// relativo ao canhao
const cannonPosition = new THREE.Vector3(0, 1, 0);
let cannonRadius = 0.3; // o raio do canhao
let cannonHeight = 2; // altura do canhao
let cannonBodySize = new CANNON.Vec3(3, 1, 2);
const cannonBodyPosition = new CANNON.Vec3(0, 1, 0)
let cannonMesh; // o mesh do canhao em si
let cannonBodyMesh; // o mesh do corpo do canhao
let cannon; // o corpo do canhao no cannon js, é sobre esse que deve ocorrer o movimento, o mesh e atualizado a partir dele
let cannonBody;

// Controles de entrada
const keysPressed = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
};

// iniciar o mundo no cannon js, o cannon js cuida apenas da fisica, o render é feito no three js
// as posicoes dos mesh no three.js sao atualizadas a partir dos bodys no cannon js
function iniciarCannon() {
    // configura o mundo
    world = new CANNON.World();
    world.quatNormalizeSkip = 0;
    world.quatNormalizeFast = false;

    var solver = new CANNON.GSSolver();

    world.defaultContactMaterial.contactEquationStiffness = 1e9;
    world.defaultContactMaterial.contactEquationRelaxation = 4;

    solver.iterations = 7;
    solver.tolerance = 0.1;
    var split = true;
    if (split)
        world.solver = new CANNON.SplitSolver(solver);
    else
        world.solver = solver;

    world.gravity.set(0, -20, 0);
    world.broadphase = new CANNON.NaiveBroadphase();

    // Adiciona o chao do lado do cannon js, no lado do three js é apenas visual
    let groundShape = new CANNON.Plane();
    let groundBody = new CANNON.Body({ mass: 0 });
    groundBody.addShape(groundShape);
    groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    world.addBody(groundBody);

    // adiciona o corpo do canhao no lado do cannon js
    let cannonBodyShape = new CANNON.Box(cannonBodySize.mult(0.5));
    cannonBody = new CANNON.Body({ mass: 0 });
    cannonBody.addShape(cannonBodyShape);
    cannonBody.position.copy(cannonBodyPosition.mult(0.5));
    groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    world.addBody(cannonBody);

    // adiciona o canhao no lado do cannon js
    let cannonShape = new CANNON.Cylinder(cannonRadius, cannonRadius, cannonHeight, 32);
    cannon = new CANNON.Body({ mass: 300 });
    cannon.addShape(cannonShape);
    cannon.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), -Math.PI / 2);
    cannon.position.copy(cannonPosition);
    cannon.angularDamping = 0.9;
    // removi a parte fisica do canhao porque torna mais facil, ele é apenas visual esse codigo acima pode ser ignorado
    //world.addBody(cannon);
}

// funcao para atirar
function shoot() {
    // Calcula a posição na ponta do canhão
    const shootPosition = new THREE.Vector3();
    cannonMesh.getWorldPosition(shootPosition);

    const shootDirection = new THREE.Vector3(0, 1, 0);
    shootDirection.applyQuaternion(cannonMesh.getWorldQuaternion(new THREE.Quaternion())).normalize();

    const ballBody = new CANNON.Body({ mass: 5 });
    ballBody.addShape(projetilShape);
    ballBody.position.set(shootPosition.x, shootPosition.y, shootPosition.z);
    // Define velocidade na direção do disparo
    ballBody.velocity.set(
        shootDirection.x * projetilVelocidade,
        shootDirection.y * projetilVelocidade,
        shootDirection.z * projetilVelocidade
    );

    const ballMesh = new THREE.Mesh(projetilGeometry, projetilMaterial);
    ballMesh.position.copy(ballBody.position);

    world.addBody(ballBody);
    scene.add(ballMesh);
    projeteis.push(ballBody);
    projeteisMesh.push(ballMesh);
}

function initThree() {

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 500);
    camera.position.z = 5;
    camera.position.y = 3;
    scene.add(camera);

    const axesHelp = new THREE.AxesHelper(2);
    scene.add(axesHelp);

    // adiciono  canhao
    const cannonBodyGeometry = new THREE.BoxGeometry(cannonBodySize.x, cannonBodySize.y, cannonBodySize.z);
    const cannonBodyMaterial = new THREE.MeshLambertMaterial({
    });
    cannonBodyMesh = new THREE.Mesh(cannonBodyGeometry, cannonBodyMaterial);
    cannonBodyMesh.position.set(cannonBodyPosition.x, cannonBodyPosition.y, cannonBodyPosition.z);
    scene.add(cannonBodyMesh);

    const cannonGeometry = new THREE.CylinderGeometry(cannonRadius, cannonRadius, cannonHeight);
    const cannonMaterial = new THREE.MeshLambertMaterial({
    });
    cannonMesh = new THREE.Mesh(cannonGeometry, cannonMaterial);
    cannonMesh.rotation.z = THREE.MathUtils.degToRad(-90);
    cannonMesh.position.x = 1;
    // Cria grupo de pivô e adiciona o cilindro a ele
    // faço isso para rotacionar o canhao a partir de outro eixo
    cannonPivot = new THREE.Group();
    cannonPivot.add(cannonMesh);
    cannonPivot.position.set(-0.5, 1.4, 0); // Onde o canhão está em cena

    scene.add(cannonPivot);

    // Adiciona o chao
    const floorGeometry = new THREE.PlaneGeometry(1000, 1000, 100, 100);
    const floorTexture = loader.load("assets/floor_texture.jpg");
    floorTexture.colorSpace = THREE.SRGBColorSpace;
    floorTexture.wrapS = THREE.RepeatWrapping;
    floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat = new THREE.Vector2(100, 100)
    const floorMaterial = new THREE.MeshLambertMaterial({
        color: 0xcccccc,
        map: floorTexture
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = THREE.MathUtils.degToRad(-90);
    scene.add(floor);

    // Adiciono o ceu 
    const sky = new Sky();
    sky.scale.setScalar(450000);
    // posicao do sol
    const phi = THREE.MathUtils.degToRad(35);
    const theta = THREE.MathUtils.degToRad(180);
    const sunPosition = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
    sky.material.uniforms.sunPosition.value = sunPosition;
    scene.add(sky);
    // luz do sol
    const luz_sol = new THREE.DirectionalLight(0xffffff, 1);
    luz_sol.position.set(sunPosition.x, sunPosition.y, sunPosition.z)
    scene.add(luz_sol);
    // luz ambiente
    const light = new THREE.AmbientLight(0x404040); // soft white light
    scene.add(light);


    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.update()

    document.body.appendChild(renderer.domElement);

    // Eventos de teclado
    window.addEventListener('keydown', (event) => {
        if (keysPressed.hasOwnProperty(event.key)) {
            keysPressed[event.key] = true;
        }
    });

    window.addEventListener('keyup', (event) => {
        if (keysPressed.hasOwnProperty(event.key)) {
            keysPressed[event.key] = false;
        }
    });

    window.addEventListener('mousedown', (event) => {
        if (event.buttons == 1) {
            shoot();
        }
    })

}


function animate() {
    requestAnimationFrame(animate);
    updatePhysics();
    controls.update()
    updateCannonControl();
    renderer.render(scene, camera);

}

function updatePhysics() {
    world.step(timeStep);

    // atualiza a posicao dos projeteis
    for (let i = 0; i < projeteis.length; i++) {
        projeteisMesh[i].position.copy(projeteis[i].position)
        projeteisMesh[i].quaternion.copy(projeteis[i].quaternion)
    }

    // atualiza a posicao do corpo do canhao
    cannonBodyMesh.position.copy(cannonBody.position);
    cannonBodyMesh.quaternion.copy(cannonBody.quaternion);
}

// atualiza as posicoes do canhao
function updateCannonControl() {
    const rotateSpeed = 0.01;
    // Movimento esquerda/direita
    if (keysPressed.ArrowLeft) {
        cannonPivot.rotation.y += rotateSpeed;
    }
    if (keysPressed.ArrowRight) {
        cannonPivot.rotation.y -= rotateSpeed;
    }
    // Rotação do cano (para cima/baixo)
    if (keysPressed.ArrowUp) {
        if (cannonPivot.rotation.z < THREE.MathUtils.degToRad(45)) {
            cannonPivot.rotation.z += rotateSpeed;
        }
    }
    if (keysPressed.ArrowDown) {
        if (cannonPivot.rotation.z > 0) {
            cannonPivot.rotation.z -= rotateSpeed;
        } else {
            cannonPivot.rotation.z = 0;
        }
    }
}

initThree();
iniciarCannon();
animate();