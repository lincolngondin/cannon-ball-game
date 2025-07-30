// js/cannon.js

import * as THREE from "three";
import * as CANNON from "cannon-es";

const COLLISION_GROUPS = {
  GROUND: 1,
  CANNON: 2,
  PROJECTILE: 4,
};

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
      this.wheelRadius + this.baseHeight,
      10
    );

    this.minElevationDeg = -90;
    this.maxElevationDeg = 90;

    this.trajectoryLine = null;
    this.isAiming = false;
    this.yawAngle = 0;
    this.pitchAngle = 0;

    this.uiElements = {};
    this.initVisuals();
    this.initPhysics();
  }

  initVisuals() {
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x6b4226,
      roughness: 0.8,
    });
    const darkMetalMat = new THREE.MeshStandardMaterial({
      color: 0x2c3e50,
      roughness: 0.3,
      metalness: 0.9,
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
    this.carriageBodyMesh.position.y = 0;
    this.basePivot.add(this.carriageBodyMesh);

    const wheelGeo = new THREE.CylinderGeometry(
      this.wheelRadius,
      this.wheelRadius,
      this.wheelThickness,
      24
    );
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelPosX = this.baseWidth / 2 + this.wheelThickness / 2;
    const wheelPosY = -this.baseHeight / 2 + this.wheelRadius;
    this.rearLeftWheel = new THREE.Mesh(wheelGeo, woodMat);
    this.rearLeftWheel.position.set(-wheelPosX, wheelPosY, -this.baseDepth / 4);
    this.carriageBodyMesh.add(this.rearLeftWheel);
    this.rearRightWheel = new THREE.Mesh(wheelGeo, woodMat);
    this.rearRightWheel.position.set(wheelPosX, wheelPosY, -this.baseDepth / 4);
    this.carriageBodyMesh.add(this.rearRightWheel);

    const supportArmGeo = new THREE.BoxGeometry(
      this.baseWidth * 0.15,
      this.pivotHeight,
      this.baseDepth * 0.2
    );
    ["Left", "Right"].forEach((side, i) => {
      const m = new THREE.Mesh(supportArmGeo, darkMetalMat);
      m.position.set(
        (i ? 1 : -1) * (this.baseWidth / 2 - this.baseWidth * 0.1),
        this.pivotHeight / 2,
        0
      );
      this.carriageBodyMesh.add(m);
    });

    const rearLegGeo = new THREE.BoxGeometry(
      this.baseWidth * 0.4,
      this.baseHeight * 0.5,
      this.rearLegLength
    );
    const rearLeg = new THREE.Mesh(rearLegGeo, woodMat);
    rearLeg.position.set(
      0,
      -this.baseHeight * 0.25,
      -this.baseDepth / 2 - this.rearLegLength / 2 + 0.1
    );
    this.carriageBodyMesh.add(rearLeg);

    this.cannonPivot = new THREE.Group();
    this.cannonPivot.position.set(0, this.pivotHeight, 0);
    this.carriageBodyMesh.add(this.cannonPivot);

    const barrelGeo = new THREE.CylinderGeometry(
      this.barrelRadiusEnd,
      this.barrelRadiusStart,
      this.barrelLength,
      32
    );
    barrelGeo.rotateX(Math.PI / 2);
    barrelGeo.translate(0, 0, this.barrelLength / 2);
    this.cannonMesh = new THREE.Mesh(barrelGeo, darkMetalMat);
    this.cannonPivot.add(this.cannonMesh);

    this.basePivot.traverse((n) => {
      if (n.isMesh) {
        n.castShadow = true;
        n.receiveShadow = true;
      }
    });
  }

  initPhysics() {
    const mainBoxHalfExtents = new CANNON.Vec3(
      this.baseWidth / 2,
      (this.baseHeight + this.pivotHeight) / 2,
      this.baseDepth / 2
    );
    const legBoxHalfExtents = new CANNON.Vec3(
      (this.baseWidth * 0.4) / 2,
      (this.baseHeight * 0.5) / 2,
      this.rearLegLength / 2
    );

    const mainBoxShape = new CANNON.Box(mainBoxHalfExtents);
    const legBoxShape = new CANNON.Box(legBoxHalfExtents);

    this.cannonBody = new CANNON.Body({
      mass: 50,
      material: this.defaultMaterial,
      linearDamping: 0.2,
      fixedRotation: true,
      collisionFilterGroup: COLLISION_GROUPS.CANNON,
      collisionFilterMask: COLLISION_GROUPS.GROUND,
    });

    this.cannonBody.addShape(
      mainBoxShape,
      new CANNON.Vec3(0, (this.pivotHeight - this.baseHeight) / 2, 0)
    );
    this.cannonBody.addShape(
      legBoxShape,
      new CANNON.Vec3(
        0,
        (-this.baseHeight - this.baseHeight * 0.25) / 2,
        -this.baseDepth / 2 - this.rearLegLength / 2 + 0.1
      )
    );

    this.cannonBody.position.copy(this.cannonStartPosition);
    this.world.addBody(this.cannonBody);
  }

  shoot() {
    const shootingPower = parseFloat(this.uiElements.powerInput.value);
    const dir = this.getBarrelDirection();
    const tip = this.getBarrelTipPosition();

    const ball = new CANNON.Body({
      mass: 20,
      shape: new CANNON.Sphere(this.projectileRadius),
      material: this.projectileMaterial,
      linearDamping: 0.1,
      angularDamping: 0.6,
      collisionFilterGroup: COLLISION_GROUPS.PROJECTILE,
      collisionFilterMask: COLLISION_GROUPS.GROUND | COLLISION_GROUPS.CANNON,
    });
    ball.position.copy(tip);

    const velocityVector = new CANNON.Vec3(dir.x, dir.y, dir.z);
    velocityVector.scale(shootingPower, velocityVector);
    ball.velocity.copy(velocityVector);

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

  updateTrajectoryPrediction() {
    if (!this.isAiming) {
      this.removeTrajectoryLine();
      return;
    }
    this.removeTrajectoryLine();

    const threeTip = this.getBarrelTipPosition();
    const threeDir = this.getBarrelDirection();

    const tip = new CANNON.Vec3(threeTip.x, threeTip.y, threeTip.z);
    const dir = new CANNON.Vec3(threeDir.x, threeDir.y, threeDir.z);

    const speed = parseFloat(this.uiElements.powerInput.value);
    const g = new CANNON.Vec3().copy(this.world.gravity);
    const dt_step = 0.03;
    const max_steps = 300;

    let pos = tip.clone();
    let vel = dir.clone();
    vel.scale(speed, vel);

    const raycastOptions = { collisionFilterMask: COLLISION_GROUPS.GROUND };
    const raycastResult = new CANNON.RaycastResult();

    const pointsForLine = [threeTip.clone()];

    for (let i = 0; i < max_steps; i++) {
      const previousPos = pos.clone();

      const gravityStep = g.scale(dt_step);
      vel.vadd(gravityStep, vel);
      const velocityStep = vel.scale(dt_step);
      pos.vadd(velocityStep, pos);

      raycastResult.reset();

      this.world.raycastClosest(
        previousPos,
        pos,
        raycastOptions,
        raycastResult
      );

      if (raycastResult.hasHit) {
        const hitPoint = raycastResult.hitPointWorld;
        pointsForLine.push(
          new THREE.Vector3(hitPoint.x, hitPoint.y, hitPoint.z)
        );
        break;
      }

      pointsForLine.push(new THREE.Vector3(pos.x, pos.y, pos.z));

      if (pos.y < -100) break;
    }

    if (pointsForLine.length < 2) return;

    const geo = new THREE.BufferGeometry().setFromPoints(pointsForLine);
    const mat = new THREE.LineDashedMaterial({
      color: 0xffff00,
      dashSize: 0.8,
      gapSize: 0.4,
    });
    this.trajectoryLine = new THREE.Line(geo, mat);
    this.trajectoryLine.computeLineDistances();
    this.scene.add(this.trajectoryLine);
  }

  setUIElements(elements) {
    this.uiElements = elements;
    this.setElevation(this.pitchAngle);
    this.setAzimuth(this.yawAngle);
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
    if (!azimuthInput) return;
    const deg = ((THREE.MathUtils.radToDeg(this.yawAngle) % 360) + 360) % 360;
    azimuthValueDisplay.textContent = deg.toFixed(0) + "°";
    azimuthInput.value = deg;

    let elevationDeg = THREE.MathUtils.radToDeg(this.pitchAngle);
    elevationValueDisplay.textContent = elevationDeg.toFixed(0) + "°";
    elevationInput.value = elevationDeg;

    const currentPower = parseFloat(powerInput.value);
    powerValueDisplay.textContent = `${currentPower.toFixed(0)} m/s`;
    powerLevelBar.style.width = `${
      ((currentPower - parseFloat(powerInput.min)) /
        (parseFloat(powerInput.max) - parseFloat(powerInput.min))) *
      100
    }%`;
  }

  setAzimuth(angleRad) {
    this.yawAngle = angleRad;
    const q = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      this.yawAngle
    );
    this.basePivot.quaternion.copy(q);
    this.cannonBody.quaternion.copy(q);
    this.updateUI();
  }

  setElevation(angleRad) {
    this.pitchAngle = THREE.MathUtils.clamp(
      angleRad,
      THREE.MathUtils.degToRad(this.minElevationDeg),
      THREE.MathUtils.degToRad(this.maxElevationDeg)
    );
    this.cannonPivot.rotation.x = this.pitchAngle;
    this.updateUI();
  }

  setPower(powerValue) {
    const { powerInput } = this.uiElements;
    powerInput.value = THREE.MathUtils.clamp(
      powerValue,
      parseFloat(powerInput.min),
      parseFloat(powerInput.max)
    );
    this.updateUI();
  }

  getBarrelDirection() {
    const d = new THREE.Vector3();
    this.cannonMesh.getWorldDirection(d);
    return d;
  }

  getBarrelTipPosition() {
    const t = new THREE.Vector3(0, 0, this.barrelLength);
    return this.cannonMesh.localToWorld(t);
  }

  update(deltaTime) {
    this.basePivot.position.copy(this.cannonBody.position);

    const hVel = new CANNON.Vec3(
      this.cannonBody.velocity.x,
      0,
      this.cannonBody.velocity.z
    ).length();

    if (hVel > 0.01) {
      const invQ = this.cannonBody.quaternion.clone().inverse();
      const lVel = invQ.vmult(this.cannonBody.velocity);

      const wSpeed = hVel * 2.5 * deltaTime;
      const rotDir = lVel.z > 0 ? -1 : 1;

      this.rearLeftWheel.rotation.x += wSpeed * rotDir;
      this.rearRightWheel.rotation.x += wSpeed * rotDir;
    }
  }

  removeTrajectoryLine() {
    if (this.trajectoryLine) {
      this.scene.remove(this.trajectoryLine);
      this.trajectoryLine.geometry.dispose();
      this.trajectoryLine.material.dispose();
      this.trajectoryLine = null;
    }
  }

  enableAimingMode() {
    this.isAiming = true;
    this.updateTrajectoryPrediction();
  }

  disableAimingMode() {
    this.isAiming = false;
  }

  handleAimingMouseMove(event) {
    if (!this.isAiming) return;
    const sensitivity = 0.002;
    this.setAzimuth(this.yawAngle - event.movementX * sensitivity);
    this.setElevation(this.pitchAngle + event.movementY * sensitivity);
  }

  // <<< FUNÇÃO REMOVIDA (handleElevationScroll) POIS NÃO É MAIS NECESSÁRIA >>>

  handlePowerScroll(deltaY) {
    // Aumentamos a sensibilidade para um ajuste mais rápido da força
    const sens = 0.25;
    const currentPower = parseFloat(this.uiElements.powerInput.value);
    const newPower = currentPower - deltaY * sens;
    this.setPower(newPower);
  }

  getCameraAimPointAndDirection() {
    return {
      mouthPos: this.getBarrelTipPosition(),
      shootDir: this.getBarrelDirection(),
    };
  }

  getCannonPositionForCamera() {
    return new THREE.Vector3().copy(this.cannonBody.position);
  }

  getAimPointFromTrajectory() {
    if (
      !this.trajectoryLine ||
      this.trajectoryLine.geometry.attributes.position.count < 2
    )
      return null;
    const pos = this.trajectoryLine.geometry.attributes.position.array;
    const last = this.trajectoryLine.geometry.attributes.position.count - 1;
    return new THREE.Vector3(
      pos[last * 3],
      pos[last * 3 + 1],
      pos[last * 3 + 2]
    );
  }
}
