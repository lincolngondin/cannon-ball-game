// js/cannon.js

import * as THREE from "three";
import * as CANNON from "cannon-es";

export class Cannon {
  constructor(scene, world, defaultMaterial, projectileMaterial) {
    this.scene = scene;
    this.world = world;
    this.defaultMaterial = defaultMaterial;
    this.projectileMaterial = projectileMaterial;

    this.baseWidth = 1.8;
    this.baseHeight = 0.6;
    this.baseDepth = 1.6;
    this.wheelRadius = 0.6;
    this.wheelThickness = 0.25;
    this.barrelRadiusStart = 0.3;
    this.barrelRadiusEnd = 0.15;
    this.barrelLength = 3.5;
    this.pivotHeight = 0.7;
    this.rearLegLength = 1.8;
    this.projectileRadius = 0.2;
    this.cannonStartPosition = new THREE.Vector3(
      0,
      this.wheelRadius + this.baseHeight / 2,
      10
    );
    this.minPitch = -Math.PI / 12;
    this.maxPitch = Math.PI / 2.5;
    this.trajectoryLine = null;
    this.isAiming = false;
    this.yawAngle = 0;
    this.pitchAngle = 0;
    this.uiElements = {};
    this.initVisuals();
    this.initPhysics();
    this.rearLeftWheel = null;
    this.rearRightWheel = null;
  }

  initVisuals() {
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x6b4226,
      roughness: 0.8,
      metalness: 0.0,
    });
    const darkMetalMat = new THREE.MeshStandardMaterial({
      color: 0x2c3e50,
      roughness: 0.3,
      metalness: 0.9,
    });
    const polishedMetalMat = new THREE.MeshStandardMaterial({
      color: 0x95a5a6,
      roughness: 0.1,
      metalness: 0.95,
    });
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xb8860b,
      roughness: 0.4,
      metalness: 0.7,
    });

    this.basePivot = new THREE.Group();
    this.basePivot.position.copy(this.cannonStartPosition);
    this.scene.add(this.basePivot);

    const carriageBodyGeo = new THREE.BoxGeometry(
      this.baseWidth,
      this.baseHeight,
      this.baseDepth
    );
    this.carriageBodyMesh = new THREE.Mesh(carriageBodyGeo, woodMat);
    this.carriageBodyMesh.position.y = this.baseHeight / 2;
    this.carriageBodyMesh.castShadow = true;
    this.carriageBodyMesh.receiveShadow = true;
    this.basePivot.add(this.carriageBodyMesh);

    const wheelGeo = new THREE.CylinderGeometry(
      this.wheelRadius,
      this.wheelRadius,
      this.wheelThickness,
      24
    );
    wheelGeo.rotateZ(Math.PI / 2);

    const wheelPosX = this.baseWidth / 2 + this.wheelThickness / 2;
    const wheelPosY = this.baseHeight / 2 - this.wheelRadius;

    const halfDepth = this.baseDepth / 2;
    const wheelZRear = -halfDepth + this.wheelThickness / 2;

    this.rearLeftWheel = new THREE.Mesh(wheelGeo, woodMat);
    this.rearLeftWheel.position.set(-wheelPosX, wheelPosY, wheelZRear);
    this.rearLeftWheel.castShadow = true;
    this.carriageBodyMesh.add(this.rearLeftWheel);

    this.rearRightWheel = new THREE.Mesh(wheelGeo, woodMat);
    this.rearRightWheel.position.set(wheelPosX, wheelPosY, wheelZRear);
    this.rearRightWheel.castShadow = true;
    this.carriageBodyMesh.add(this.rearRightWheel);

    const axleGeo = new THREE.CylinderGeometry(
      0.15,
      0.15,
      this.baseWidth + this.wheelThickness * 2,
      16
    );
    const rearAxle = new THREE.Mesh(axleGeo, polishedMetalMat);
    rearAxle.rotation.z = Math.PI / 2;
    rearAxle.position.set(0, wheelPosY, wheelZRear);
    this.carriageBodyMesh.add(rearAxle);

    const supportArmGeo = new THREE.BoxGeometry(
      this.baseWidth * 0.15,
      this.pivotHeight * 1.6,
      this.baseDepth * 0.35
    );
    ["Left", "Right"].forEach((side, i) => {
      const m = new THREE.Mesh(supportArmGeo, darkMetalMat);
      m.position.set(
        (i ? 1 : -1) * (this.baseWidth / 2 - this.baseWidth * 0.08),
        this.pivotHeight * 0.75 + this.baseHeight / 2 + 0.1,
        this.baseDepth * 0.15
      );
      m.castShadow = true;
      m.receiveShadow = true;
      this.carriageBodyMesh.add(m);

      const connectorGeo = new THREE.CylinderGeometry(
        0.2,
        0.2,
        this.baseWidth * 0.2,
        16
      );
      const connector = new THREE.Mesh(connectorGeo, polishedMetalMat);
      connector.rotation.z = Math.PI / 2;
      connector.position.set(
        (i ? 1 : -1) * (this.baseWidth / 2 - this.baseWidth * 0.08),
        this.baseHeight / 2 + 0.1,
        this.baseDepth * 0.15
      );
      this.carriageBodyMesh.add(connector);
    });

    const rearLegGeo = new THREE.BoxGeometry(
      this.baseWidth * 0.4,
      this.baseHeight * 0.5,
      this.rearLegLength
    );
    const rearLeg = new THREE.Mesh(rearLegGeo, woodMat);
    rearLeg.position.set(
      0,
      this.baseHeight * 0.25,
      -this.baseDepth / 2 - this.rearLegLength / 2 + 0.1
    );
    rearLeg.castShadow = true;
    rearLeg.receiveShadow = true;
    this.carriageBodyMesh.add(rearLeg);

    this.cannonPivot = new THREE.Group();
    this.cannonPivot.position.set(
      0,
      this.pivotHeight + this.baseHeight / 2,
      this.baseDepth * 0.15
    );
    this.carriageBodyMesh.add(this.cannonPivot);

    const barrelGeo = new THREE.CylinderGeometry(
      this.barrelRadiusEnd,
      this.barrelRadiusStart,
      this.barrelLength,
      32
    );
    barrelGeo.rotateZ(-Math.PI / 2);
    barrelGeo.translate(this.barrelLength / 2, 0, 0);

    this.cannonMesh = new THREE.Mesh(barrelGeo, darkMetalMat);
    this.cannonMesh.castShadow = true;
    this.cannonMesh.receiveShadow = true;
    this.cannonPivot.add(this.cannonMesh);
  }

  initPhysics() {
    const shape = new CANNON.Box(
      new CANNON.Vec3(
        this.baseWidth / 2,
        this.baseHeight / 2,
        this.baseDepth / 2
      )
    );
    this.cannonBody = new CANNON.Body({
      mass: 50,
      material: this.defaultMaterial,
      linearDamping: 0.95,
      fixedRotation: true,
    });
    this.cannonBody.addShape(shape);
    this.cannonBody.position.copy(this.cannonStartPosition);
    this.world.addBody(this.cannonBody);
  }

  setUIElements(elements) {
    this.uiElements = elements;
    this.updateUI();
  }

  updateUI() {
    const {
      azimuthInput,
      elevationInput,
      powerInput,
      azimuthValueDisplay,
      elevationValueDisplay,
      powerValueDisplay,
      powerLevelBar,
    } = this.uiElements;

    const deg = ((THREE.MathUtils.radToDeg(this.yawAngle) % 360) + 360) % 360;
    azimuthInput.value = deg;
    azimuthValueDisplay.textContent = deg.toFixed(0) + "°";
    elevationInput.value = THREE.MathUtils.radToDeg(-this.pitchAngle).toFixed(
      0
    );
    elevationValueDisplay.textContent = elevationInput.value + "°";
    const currentPower = parseFloat(powerInput.value);
    powerValueDisplay.textContent = currentPower.toFixed(0) + " m/s";
    powerLevelBar.style.width =
      ((currentPower - parseFloat(powerInput.min)) /
        (parseFloat(powerInput.max) - parseFloat(powerInput.min))) *
        100 +
      "%";
  }

  setAzimuth(angleRad) {
    this.yawAngle = angleRad;
    this.basePivot.quaternion.setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      this.yawAngle
    );
    this.cannonBody.quaternion.copy(this.basePivot.quaternion);
  }

  setElevation(angleRad) {
    this.pitchAngle = THREE.MathUtils.clamp(
      angleRad,
      this.minPitch,
      this.maxPitch
    );
    this.cannonPivot.quaternion.setFromAxisAngle(
      new THREE.Vector3(1, 0, 0),
      this.pitchAngle
    );
  }

  setPower(powerValue) {
    const { powerInput } = this.uiElements;
    const min = parseFloat(powerInput.min);
    const max = parseFloat(powerInput.max);
    powerInput.value = THREE.MathUtils.clamp(powerValue, min, max);
    this.updateUI();
  }

  getBarrelDirection() {
    const quat = new THREE.Quaternion();
    this.cannonMesh.getWorldQuaternion(quat);
    return new THREE.Vector3(1, 0, 0).applyQuaternion(quat).normalize();
  }

  getBarrelTipPosition() {
    const tip = new THREE.Vector3();
    this.cannonMesh.getWorldPosition(tip);
    const dir = this.getBarrelDirection();
    tip.addScaledVector(dir, this.barrelLength / 2);
    return tip;
  }

  shoot() {
    const shootingPower = parseFloat(this.uiElements.powerInput.value);
    const dir = this.getBarrelDirection();
    const tip = this.getBarrelTipPosition();

    // ✅ ALTERAÇÃO: Adicionado Damping para atrito/arrasto do projétil
    const ball = new CANNON.Body({
      mass: 20,
      shape: new CANNON.Sphere(this.projectileRadius),
      material: this.projectileMaterial,
      linearDamping: 0.1, // Simula resistência do ar/fluido.
      angularDamping: 0.6, // Essencial para frear a rotação e parar de rolar.
    });

    ball.position.copy(tip);
    const initialVelocityVector = new CANNON.Vec3(dir.x, dir.y, dir.z).scale(
      shootingPower
    );
    ball.velocity.copy(initialVelocityVector);
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(this.projectileRadius, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xdddddd, emissive: 0xbbbbbb })
    );
    mesh.castShadow = true;
    mesh.bodyRef = ball;
    this.world.addBody(ball);
    this.scene.add(mesh);
    return mesh;
  }

  update(deltaTime) {
    this.basePivot.position.copy(this.cannonBody.position);
    this.basePivot.position.y -= this.baseHeight / 2;
    this.basePivot.position.y += this.wheelRadius;
    this.basePivot.quaternion.copy(this.cannonBody.quaternion);
    const horizontalVelocity = new THREE.Vector3(
      this.cannonBody.velocity.x,
      0,
      this.cannonBody.velocity.z
    ).length();
    const wheelRotationSpeed = horizontalVelocity * 0.5 * deltaTime;
    if (horizontalVelocity > 0.01) {
      const localVelocity = new THREE.Vector3().copy(this.cannonBody.velocity);
      localVelocity.applyQuaternion(this.basePivot.quaternion.clone().invert());
      if (this.rearLeftWheel && this.rearRightWheel) {
        if (localVelocity.z < -0.01) {
          this.rearLeftWheel.rotation.x -= wheelRotationSpeed;
          this.rearRightWheel.rotation.x -= wheelRotationSpeed;
        } else if (localVelocity.z > 0.01) {
          this.rearLeftWheel.rotation.x += wheelRotationSpeed;
          this.rearRightWheel.rotation.x += wheelRotationSpeed;
        }
      }
    }
  }

  updateTrajectoryPrediction() {
    if (!this.isAiming) {
      this.removeTrajectoryLine();
      return;
    }
    if (this.trajectoryLine) {
      this.scene.remove(this.trajectoryLine);
      this.trajectoryLine.geometry.dispose();
      this.trajectoryLine.material.dispose();
      this.trajectoryLine = null;
    }
    const points = [];
    const dir = this.getBarrelDirection();
    const tip = this.getBarrelTipPosition();
    const speed = parseFloat(this.uiElements.powerInput.value);
    let pos = tip.clone();
    let vel = dir.clone().multiplyScalar(speed);
    const g = this.world.gravity.y;
    const dt_step = 0.03;
    const max_steps = 300;
    for (let i = 0; i < max_steps; i++) {
      points.push(pos.clone());
      vel.y += g * dt_step;
      pos.addScaledVector(vel, dt_step);
      if (pos.y < 0) {
        points.push(pos.clone());
        break;
      }
      if (pos.distanceTo(tip) > 500) {
        break;
      }
    }
    if (points.length < 2) {
      this.removeTrajectoryLine();
      return;
    }
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineDashedMaterial({
      color: 0xffff00,
      dashSize: 0.8,
      gapSize: 0.4,
    });
    const line = new THREE.Line(geo, mat);
    line.computeLineDistances();
    this.trajectoryLine = line;
    this.scene.add(line);
  }

  removeTrajectoryLine() {
    if (!this.trajectoryLine) return;
    this.scene.remove(this.trajectoryLine);
    this.trajectoryLine.geometry.dispose();
    this.trajectoryLine.material.dispose();
    this.trajectoryLine = null;
  }

  enableAimingMode() {
    this.isAiming = true;
    this.updateTrajectoryPrediction();
  }

  disableAimingMode() {
    this.isAiming = false;
    this.removeTrajectoryLine();
  }

  handleAimingMouseMove(event) {
    if (!this.isAiming) return;
    const sensitivity = 0.002;
    this.setAzimuth(this.yawAngle - event.movementX * sensitivity);
    const newPitch = this.pitchAngle - event.movementY * sensitivity;
    this.setElevation(newPitch);
    this.updateUI();
  }

  handleKeyboardAiming(keyCode) {
    if (!this.isAiming) return;
    const stepDeg = 1;
    const stepRad = THREE.MathUtils.degToRad(stepDeg);
    switch (keyCode) {
      case "ArrowLeft":
        this.setAzimuth(this.yawAngle + stepRad);
        break;
      case "ArrowRight":
        this.setAzimuth(this.yawAngle - stepRad);
        break;
      case "ArrowUp":
        this.setElevation(this.pitchAngle - stepRad);
        break;
      case "ArrowDown":
        this.setElevation(this.pitchAngle + stepRad);
        break;
    }
    this.updateUI();
  }

  handlePowerScroll(deltaY) {
    const powerChange = deltaY * -0.2;
    const currentPower = parseFloat(this.uiElements.powerInput.value);
    this.setPower(currentPower + powerChange);
  }

  getCameraAimPointAndDirection() {
    const mouthPos = this.getBarrelTipPosition();
    const shootDir = this.getBarrelDirection();
    return { mouthPos, shootDir };
  }

  getCannonPositionForCamera() {
    return new THREE.Vector3().copy(this.cannonBody.position);
  }

  getAimPointFromTrajectory() {
    if (
      !this.trajectoryLine ||
      this.trajectoryLine.geometry.attributes.position.count === 0
    ) {
      return null;
    }
    const positions = this.trajectoryLine.geometry.attributes.position.array;
    const lastVertexIndex =
      this.trajectoryLine.geometry.attributes.position.count - 1;
    return new THREE.Vector3(
      positions[lastVertexIndex * 3],
      positions[lastVertexIndex * 3 + 1],
      positions[lastVertexIndex * 3 + 2]
    );
  }
}
