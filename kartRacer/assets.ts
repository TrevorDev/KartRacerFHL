import { SceneLoader, Mesh, Sound } from "@babylonjs/core";
import "@babylonjs/loaders/glTF";
import { KartEngine } from "./engine";

export class Assets {
    public kart: Mesh;
    public tree: Mesh;
    public bomb: Mesh;
    public engineSound: Sound;
    public music: Sound;

    async loadAssets() {
        KartEngine.instance.scene.getEngine().displayLoadingUI()
        const kartContainer = await SceneLoader.LoadAssetContainerAsync("/public/models/roadsterKart.gltf");
        this.kart = kartContainer.meshes[0] as Mesh;
        this.kart.scaling.scaleInPlace(0.01);
        this.kart.isPickable = false;
        this.kart.getChildMeshes(false).forEach(child => {
            child.isPickable = false;
        });

        const treeContainer = await SceneLoader.LoadAssetContainerAsync("/public/models/evergreen2.gltf");
        this.tree = treeContainer.meshes[0] as Mesh;
        this.tree.isPickable = false;
        this.tree.getChildMeshes(false).forEach(child => {
            child.isPickable = false;
        });

        const bombContainer = await SceneLoader.LoadAssetContainerAsync("/public/models/bomb.glb");
        this.bomb = bombContainer.meshes[0] as Mesh;
        this.bomb.isPickable = false;
        this.bomb.getChildMeshes(false).forEach(child => {
            child.isPickable = false;
        });

        this.engineSound = new Sound("Music", "/public/sounds/go.mp3", KartEngine.instance.scene, ()=> {
            this.engineSound.setVolume(0)
            this.engineSound.loop = true
            this.engineSound.play();
        });

        this.music = new Sound("Music", "/public/sounds/music.mp3", KartEngine.instance.scene, ()=> {
            this.music.loop = true
            this.music.play();
        });
        KartEngine.instance.scene.getEngine().hideLoadingUI()
    }
}