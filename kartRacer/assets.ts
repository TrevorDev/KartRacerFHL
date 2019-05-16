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

        this.kart = await this.loadAsset(assets, "/public/models/roadsterKart/roadsterKart.gltf");
        this.kart.name = "kart";
        this.kart.scaling.scaleInPlace(0.01);

        const tree = await this.loadAsset(assets, "/public/models/evergreen2/evergreen2.gltf");
        this.tree = Mesh.MergeMeshes(tree.getChildMeshes() as Mesh[], undefined, undefined, undefined, undefined, true);
        this.tree.name = "tree";
        this.tree.parent = assets;
        tree.dispose();

        const bomb = await this.loadAsset(assets, "/public/models/bomb/bomb.gltf");
        this.bomb = Mesh.MergeMeshes(bomb.getChildMeshes() as Mesh[], undefined, undefined, undefined, undefined, true);
        this.bomb.name = "bomb";
        this.bomb.parent = assets;
        bomb.dispose();

        const boost = await this.loadAsset(assets,  "/public/models/wing.glb");
        this.boost = Mesh.MergeMeshes(boost.getChildMeshes() as Mesh[], undefined, undefined, undefined, undefined, true);
        this.boost.name = "boost";
        this.boost.parent = assets;
        boost.dispose;

        const bumper = await this.loadAsset(assets,  "/public/models/bumper.glb");
        this.bumper = Mesh.MergeMeshes(bumper.getChildMeshes() as Mesh[], undefined, undefined, undefined, undefined, true);
        this.bumper.name = "bumper";
        this.bumper.parent = assets;
        bumper.dispose;

        const poison = await this.loadAsset(assets,  "/public/models/poison_cloud.glb");
        this.poison = Mesh.MergeMeshes(poison.getChildMeshes() as Mesh[], undefined, undefined, undefined, undefined, true);
        this.poison.name = "poison";
        this.poison.parent = assets;
        poison.dispose;

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

    private async loadAsset(assets: TransformNode, path: string): Promise<Mesh> {
        const container = await SceneLoader.LoadAssetContainerAsync(path);
        const mesh = container.meshes[0] as Mesh;
        mesh.parent = assets;
        mesh.isPickable = false;
        for (const child of mesh.getChildMeshes()) {
            child.isPickable = false;
        }
        mesh.setEnabled(false);
        return mesh;
    }
}