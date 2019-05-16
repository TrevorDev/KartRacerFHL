import { SceneLoader, Mesh, Sound, TransformNode } from "@babylonjs/core";
import "@babylonjs/loaders/glTF";
import { KartEngine } from "./engine";

export class Assets {
    public kart: Mesh;
    public tree: Mesh;
    public bomb: Mesh;
    public boost: Mesh;
    public bumper: Mesh;
    public poison: Mesh;
    public engineSound: Sound;
    public music: Sound;

    public async loadAssets(): Promise<void> {
        KartEngine.instance.scene.getEngine().displayLoadingUI();

        const assets = new TransformNode("assets", KartEngine.instance.scene);

        const kartContainer = await SceneLoader.LoadAssetContainerAsync("/public/models/roadsterKart/roadsterKart.gltf");
        this.kart = kartContainer.meshes[0] as Mesh;
        this.kart.setEnabled(false);
        this.kart.name = "kart";
        this.kart.scaling.scaleInPlace(0.01);
        this.kart.parent = assets;

        async function loadHazard(name: string, path: string): Promise<Mesh> {
            const container = await SceneLoader.LoadAssetContainerAsync(path);
            const root = container.meshes[0] as Mesh;
            const merged = Mesh.MergeMeshes(root.getChildMeshes() as Mesh[], false, undefined, undefined, undefined, true);
            merged.setEnabled(false);
            merged.name = name;
            merged.parent = assets;
            root.dispose();
            return merged;
        }

        this.tree = await loadHazard("tree", "/public/models/evergreen2/evergreen2.gltf");
        this.bomb = await loadHazard("bomb", "/public/models/bomb/bomb.gltf");
        this.boost = await loadHazard("boost", "/public/models/wing.glb");
        this.bumper = await loadHazard("bumper", "/public/models/bumper.glb");
        this.poison = await loadHazard("poison", "/public/models/poison_cloud.glb");

        this.engineSound = new Sound("Music", "/public/sounds/go.mp3", KartEngine.instance.scene, () => {
            this.engineSound.setVolume(0);
            this.engineSound.loop = true;
            this.engineSound.play();
        });

        this.music = new Sound("Music", "/public/sounds/music.mp3", KartEngine.instance.scene, () => {
            this.music.loop = true;
            this.music.play();
        });

        KartEngine.instance.scene.getEngine().hideLoadingUI();
    }
}