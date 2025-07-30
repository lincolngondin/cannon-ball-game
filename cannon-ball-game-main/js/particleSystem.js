import * as THREE from "three";

export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.pool = [];
    this.active = [];
  }

  getParticleSet() {
    if (this.pool.length > 0) return this.pool.pop();
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(new Float32Array(150), 3)
    ); // 50 particles * 3
    const material = new THREE.PointsMaterial({
      color: 0xffd700,
      size: 0.3,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const points = new THREE.Points(geometry, material);
    return points;
  }

  explode(position) {
    const ps = this.getParticleSet();
    ps.position.copy(position);
    this.scene.add(ps);

    // Cores de poeira: cinza claro, cinza escuro, branco
    const colors = [0xcccccc, 0x888888, 0xffffff];
    const colorAttr = [];
    const particles = [];
    const positions = ps.geometry.attributes.position.array;
    for (let i = 0; i < 40; i++) { // Menos partículas para explosão sutil
      colorAttr.push(colors[Math.floor(Math.random() * colors.length)]);
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 8
      );
      particles.push({
        velocity: vel,
        alpha: 1.0,
        scale: 0.18 + Math.random() * 0.15,
      });
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;
    }
    ps.geometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(colorAttr, 1)
    );
    ps.material.vertexColors = true;
    ps.geometry.attributes.position.needsUpdate = true;
    this.active.push({ points: ps, particles, time: 0 });
  }

  cannonBlast(position, direction) {
    const ps = this.getParticleSet();
    ps.position.copy(position);
    this.scene.add(ps);

    // Cores: fumaça (cinza) e faíscas (amarelo/laranja)
    const colors = [0xcccccc, 0x888888, 0xffd700, 0xffa500];
    const colorAttr = [];
    const particles = [];
    const positions = ps.geometry.attributes.position.array;
    for (let i = 0; i < 60; i++) {
      // Fumaça nos primeiros 40, faíscas nos últimos 20
      const isSpark = i >= 40;
      const color = isSpark
        ? colors[2 + Math.floor(Math.random() * 2)]
        : colors[Math.floor(Math.random() * 2)];
      colorAttr.push(color);

      const speed = isSpark ? 12 + Math.random() * 8 : 4 + Math.random() * 2;
      const spread = isSpark ? 0.7 : 1.5;
      const vel = new THREE.Vector3(
        direction.x + (Math.random() - 0.5) * spread,
        direction.y + (Math.random() - 0.5) * spread,
        direction.z + (Math.random() - 0.5) * spread
      ).normalize().multiplyScalar(speed);

      particles.push({
        velocity: vel,
        alpha: 1.0,
        scale: isSpark ? 0.15 : 0.35 + Math.random() * 0.2,
      });
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;
    }
    ps.geometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(colorAttr, 1)
    );
    ps.material.vertexColors = true;
    ps.geometry.attributes.position.needsUpdate = true;
    this.active.push({ points: ps, particles, time: 0 });
  }

  update(deltaTime) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const set = this.active[i];
      set.time += deltaTime;
      const positions = set.points.geometry.attributes.position.array;
      for (let j = 0; j < set.particles.length; j++) {
        const p = set.particles[j];
        p.velocity.y -= 20 * deltaTime; // Gravity
        p.alpha -= 1.5 * deltaTime; // Fade out

        const index = j * 3;
        positions[index] += p.velocity.x * deltaTime;
        positions[index + 1] += p.velocity.y * deltaTime;
        positions[index + 2] += p.velocity.z * deltaTime;
      }
      set.points.geometry.attributes.position.needsUpdate = true;
      set.points.material.opacity = Math.max(0, set.particles[0].alpha);

      if (set.time > 1) {
        this.scene.remove(set.points);
        this.pool.push(set.points);
        this.active.splice(i, 1);
      }
    }
  }
}
