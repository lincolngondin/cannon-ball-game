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

    const particles = [];
    for (let i = 0; i < 50; i++) {
      particles.push({
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 10
        ),
        alpha: 1.0,
      });
    }
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
