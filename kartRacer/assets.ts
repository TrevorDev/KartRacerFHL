export class Assets {
    kart:BABYLON.Mesh
    tree:BABYLON.Mesh
    constructor(){

    }
    async loadAssets(){
        // Load kart
        var kartContainer = await BABYLON.SceneLoader.LoadAssetContainerAsync("/public/models/roadsterKart.gltf");
        this.kart = kartContainer.meshes[0] as BABYLON.Mesh
        this.kart.scaling.scaleInPlace(0.01)

        var kartContainer = await BABYLON.SceneLoader.LoadAssetContainerAsync("/public/models/evergreen2.gltf");
        this.tree = kartContainer.meshes[0] as BABYLON.Mesh
        this.tree.scaling.scaleInPlace(1)
    }
}