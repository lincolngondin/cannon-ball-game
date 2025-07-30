import * as THREE from "three";

export const uiElements = {
  targetsDisplay: document.getElementById("targets-display"),
  projectilesDisplay: document.getElementById("projectiles-display"),
  scoreDisplay: document.getElementById("score-display"), // NOVO
  crosshair: document.getElementById("crosshair"),
  uiContainer: document.getElementById("ui-container"),
  toggleUiButton: document.getElementById("toggle-ui-button"),
  azimuthInput: document.getElementById("azimuth"),
  elevationInput: document.getElementById("elevation"),
  powerInput: document.getElementById("power"),
  azimuthValueDisplay: document.getElementById("azimuth-value"),
  elevationValueDisplay: document.getElementById("elevation-value"),
  powerValueDisplay: document.getElementById("power-value"),
  powerLevelBar: document.getElementById("power-level"),
  fireButton: document.getElementById("fire-button"),
  statusDisplay: document.getElementById("status"),
};

export function initUIManager(callbacks) {
  uiElements.fireButton.addEventListener("click", callbacks.shoot);

  uiElements.toggleUiButton.addEventListener("click", () => {
    const isHidden = uiElements.uiContainer.style.display === "none";
    uiElements.uiContainer.style.display = isHidden ? "block" : "none";
    uiElements.toggleUiButton.textContent = isHidden
      ? "Ocultar UI"
      : "Mostrar UI";
  });

  // Esses listeners agora chamam callbacks que atualizam o canhão diretamente
  uiElements.azimuthInput.addEventListener("input", (e) =>
    callbacks.setAzimuth(THREE.MathUtils.degToRad(parseFloat(e.target.value)))
  );

  uiElements.elevationInput.addEventListener("input", (e) =>
    callbacks.setElevation(
      THREE.MathUtils.degToRad(-parseFloat(e.target.value))
    )
  );

  uiElements.powerInput.addEventListener("input", (e) =>
    callbacks.setPower(parseFloat(e.target.value))
  );
}

// Atualiza o HUD principal (alvos, projéteis)
export function updateGameUI(gameState) {
  uiElements.targetsDisplay.textContent = gameState.targets;
  uiElements.projectilesDisplay.textContent = gameState.projectiles;
  uiElements.scoreDisplay.textContent = gameState.score; // NOVO
}
