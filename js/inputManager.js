// js/inputManager.js

import * as THREE from "three";

// Estado de controle de input
const keysPressed = { KeyW: false, KeyA: false, KeyS: false, KeyD: false };
let isAiming = false;
let isOrbiting = false;
let gameCannon, controls, renderer, crosshair, dynamicAimMesh;
let lastFreeCameraPosition, lastFreeCameraQuaternion;
let actions = {};

export function initInputManager(deps, gameActions) {
  renderer = deps.renderer;
  gameCannon = deps.gameCannon;
  controls = deps.controls;
  crosshair = deps.crosshair;
  dynamicAimMesh = deps.dynamicAimMesh;
  lastFreeCameraPosition = deps.lastFreeCameraPosition;
  lastFreeCameraQuaternion = deps.lastFreeCameraQuaternion;
  actions = gameActions;

  // Adiciona todos os listeners
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  renderer.domElement.addEventListener("mousedown", onMouseDown);
  renderer.domElement.addEventListener("mouseup", onMouseUp);
  renderer.domElement.addEventListener("contextmenu", (e) =>
    e.preventDefault()
  );
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("wheel", onWheel, { passive: false });
  document.addEventListener("pointerlockchange", onPointerLockChange);
}

// Retorna estados para o loop principal
export const getInputState = () => ({ isAiming, isOrbiting });
export const getMovementKeys = () => keysPressed;

function onKeyDown(e) {
  if (e.code in keysPressed) keysPressed[e.code] = true;
  if (e.code === "KeyR") actions.reset();
  if (e.code === "Space") {
    e.preventDefault();
    actions.shoot();
  }
}

function onKeyUp(e) {
  if (e.code in keysPressed) keysPressed[e.code] = false;
}

function onMouseDown(e) {
  if (e.button === 2) {
    if (!isAiming) {
      isAiming = true;
      lastFreeCameraPosition.copy(controls.object.position);
      lastFreeCameraQuaternion.copy(controls.object.quaternion);
      controls.enabled = false;
      renderer.domElement.requestPointerLock();
      crosshair.style.display = "block";
      dynamicAimMesh.visible = true;
      gameCannon.enableAimingMode();
    } else {
      document.exitPointerLock();
    }
  } else if (e.button === 0) {
    if (!isAiming && e.target.tagName === "CANVAS") {
      isOrbiting = true;
      controls.enabled = true;
      controls.target.copy(gameCannon.getCannonPositionForCamera());
    }
  }
}

function onMouseUp(e) {
  if (e.button === 0 && isOrbiting) {
    isOrbiting = false;
    controls.enabled = false;
    lastFreeCameraPosition.copy(controls.object.position);
    lastFreeCameraQuaternion.copy(controls.object.quaternion);
  }
}

function onPointerLockChange() {
  if (document.pointerLockElement !== renderer.domElement) {
    isAiming = false;
    crosshair.style.display = "none";
    dynamicAimMesh.visible = false;
    gameCannon.disableAimingMode();
    controls.enabled = false;
    isOrbiting = false;
  }
}

function onMouseMove(e) {
  if (isAiming) {
    gameCannon.handleAimingMouseMove(e);
  }
}

// <<< FUNÇÃO `onWheel` SIMPLIFICADA >>>
function onWheel(e) {
  e.preventDefault();

  // Agora, o scroll do mouse sempre controlará a força do disparo.
  gameCannon.handlePowerScroll(e.deltaY);
}
