import { SceneLoader, Mesh } from "@babylonjs/core";
import "@babylonjs/loaders/glTF";

export class Assets {
    public kart: Mesh;
    public tree: Mesh;

    async loadAssets() {
        const kartContainer = await SceneLoader.LoadAssetContainerAsync("/public/models/roadsterKart.gltf");
        this.kart = kartContainer.meshes[0] as Mesh;
        this.kart.scaling.scaleInPlace(0.01);

        const treeContainer = await SceneLoader.LoadAssetContainerAsync("/public/models/evergreen2.gltf");
        this.tree = treeContainer.meshes[0] as Mesh;
    }
}