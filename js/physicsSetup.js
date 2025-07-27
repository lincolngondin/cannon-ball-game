import * as CANNON from "cannon-es";

export function setupPhysics() {
  const physicsWorld = new CANNON.World({
    gravity: new CANNON.Vec3(0, -9.82, 0),
  });

  // Materiais
  const defaultMaterial = new CANNON.Material("default");
  const projectileMaterial = new CANNON.Material("projectile");
  const targetPhysicsMaterial = new CANNON.Material("target");

  // Contatos
  physicsWorld.addContactMaterial(
    new CANNON.ContactMaterial(defaultMaterial, projectileMaterial, {
      friction: 0.5,
      restitution: 0.2,
    })
  );
  physicsWorld.addContactMaterial(
    new CANNON.ContactMaterial(targetPhysicsMaterial, projectileMaterial, {
      friction: 0.8,
      restitution: 0.1,
    })
  );

  return {
    physicsWorld,
    defaultMaterial,
    projectileMaterial,
    targetPhysicsMaterial,
  };
}
