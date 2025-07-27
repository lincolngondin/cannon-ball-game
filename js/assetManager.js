import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export const assetManager = {
  models: {},
  async load() {
    const gltfLoader = new GLTFLoader().setDRACOLoader(null);
    const assetPath = "../assets/";
    const assets = {
      groundGrass: "ground_grass.glb",
      cliffLarge: "cliff_large_stone.glb",
      cliffRock: "cliff_rock.glb",
      statueBlock: "statue_block.glb",
      rockLargeA: "rock_largeA.glb",
      rockLargeB: "rock_largeB.glb",
      rockLargeC: "rock_largeC.glb",
      statueColumn: "statue_column.glb",
      statueColumnDamaged: "statue_columnDamaged.glb",
      statueHead: "statue_head.glb",
      statueObelisk: "statue_obelisk.glb",
      logStack: "log_stackLarge.glb",
      treeOak: "tree_oak.glb",
      treeDetailed: "tree_detailed.glb",
      treePineDefaultA: "tree_pineDefaultA.glb",
      treePineRoundB: "tree_pineRoundB.glb",
      treePineTallC: "tree_pineTallC.glb",
      hangingMoss: "hanging_moss.glb",
      mushroomRed: "mushroom_red.glb",
      mushroomTanGroup: "mushroom_tanGroup.glb",
      flowerRedA: "flower_redA.glb",
      flowerYellowB: "flower_yellowB.glb",
      plantBush: "plant_bush.glb",
      plantBushDetailed: "plant_bushDetailed.glb",
      plantBushLarge: "plant_bushLarge.glb",
      stumpRound: "stump_round.glb",
      stumpSquare: "stump_square.glb",
      bridgeStone: "bridge_stone.glb",
      tentSmallOpen: "tent_smallOpen.glb",
      campfireStones: "campfire_stones.glb",
    };

    console.log("Loading assets...");
    const results = await Promise.all(
      Object.entries(assets).map(([k, f]) =>
        gltfLoader.loadAsync(assetPath + f)
      )
    );
    Object.keys(assets).forEach((key, index) => {
      this.models[key] = results[index].scene;
    });
    console.log("Assets loaded!");
  },
};
