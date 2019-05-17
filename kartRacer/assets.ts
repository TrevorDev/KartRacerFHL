import { SceneLoader, Mesh, Sound, TransformNode, Scene, AnimationGroup, AbstractMesh } from "@babylonjs/core";
import { GLTFFileLoader, GLTFLoaderAnimationStartMode } from "@babylonjs/loaders/glTF";

export class Assets {
    public mainKartInfo: { mesh: AbstractMesh, animationGroups: { wheelsRotation: AnimationGroup, steering: AnimationGroup } };
    public kart: Mesh;
    public tree: Mesh;
    public bomb: Mesh;
    public boost: Mesh;
    public bumper: Mesh;
    public poison: Mesh;
    public engineSound: Sound;
    public music: Sound;

    public async loadAssets(scene: Scene): Promise<void> {
        scene.getEngine().displayLoadingUI();

        const observer = SceneLoader.OnPluginActivatedObservable.add((loader: GLTFFileLoader) => {
            loader.animationStartMode = GLTFLoaderAnimationStartMode.NONE;
        });

        const assets = new TransformNode("assets", scene);

        const kartResult = await SceneLoader.ImportMeshAsync(null, "/public/models/roadsterKart/roadsterKart.gltf");
        const kartMesh = kartResult.meshes[0];
        kartMesh.scaling.scaleInPlace(0.05);
        kartMesh.isPickable = false;
        kartMesh.getChildMeshes().forEach(child => child.isPickable = false);
        this.mainKartInfo = {
            mesh: kartResult.meshes[0],
            animationGroups: {
                wheelsRotation: kartResult.animationGroups[0],
                steering: kartResult.animationGroups[1]
            }
        };

        this.kart = Mesh.MergeMeshes(kartMesh.getChildMeshes() as Mesh[], false, undefined, undefined, undefined, true);
        this.kart.setEnabled(false);
        this.kart.name = "kart";
        this.kart.parent = assets;

        async function loadMergedAsset(name: string, path: string): Promise<Mesh> {
            const container = await SceneLoader.LoadAssetContainerAsync(path);
            const root = container.meshes[0] as Mesh;
            const merged = Mesh.MergeMeshes(root.getChildMeshes() as Mesh[], false, undefined, undefined, undefined, true);
            merged.setEnabled(false);
            merged.name = name;
            merged.parent = assets;
            root.dispose();
            return merged;
        }

        this.tree = await loadMergedAsset("tree", "/public/models/evergreen2/evergreen2.gltf");
        this.bomb = await loadMergedAsset("bomb", "/public/models/bomb/bomb.gltf");
        this.boost = await loadMergedAsset("boost", "/public/models/wing.glb");
        this.bumper = await loadMergedAsset("bumper", "/public/models/bumper.glb");
        this.poison = await loadMergedAsset("poison", "/public/models/poison_cloud.glb");

        this.engineSound = new Sound("Music", "/public/sounds/go.mp3", scene, () => {
            this.engineSound.setVolume(0);
            this.engineSound.loop = true;
            this.engineSound.play();
        });

        this.music = new Sound("Music", "/public/sounds/music.mp3", scene, () => {
            this.music.loop = true;
            this.music.play();
        });

        SceneLoader.OnPluginActivatedObservable.remove(observer);

        scene.getEngine().hideLoadingUI();
    }
}