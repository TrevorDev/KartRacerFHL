import { SceneLoader, Mesh, Sound, TransformNode, Scene, AnimationGroup, PBRMaterial, Texture, Vector3, Quaternion } from "@babylonjs/core";
import { GLTFFileLoader, GLTFLoaderAnimationStartMode } from "@babylonjs/loaders/glTF";

// HACK to fix the kart asset
function cleanAnimationGroup(scene: Scene, animationGroup: AnimationGroup): AnimationGroup {
    const newAnimationGroup = new AnimationGroup(`${animationGroup.name}_cleaned`, scene);
    for (const targetedAnimation of animationGroup.targetedAnimations) {
        const values = targetedAnimation.animation.getKeys().map(key => key.value);
        if (((values[0] instanceof Vector3) && !values.every(value => Vector3.DistanceSquared(value, values[0]) < 0.0001)) ||
            ((values[0] instanceof Quaternion) && !values.every(value => Quaternion.AreClose(value, values[0])))) {
            newAnimationGroup.addTargetedAnimation(targetedAnimation.animation, targetedAnimation.target);
        }
    }
    return newAnimationGroup;
}

export interface IAssetInfo {
    mesh: Mesh;
    animationGroups: Array<AnimationGroup>;
}

export class Assets {
    public tree: IAssetInfo;
    public bomb: IAssetInfo;
    public boost: IAssetInfo;
    public bumper: IAssetInfo;
    public poison: IAssetInfo;
    public engineSound: Sound;
    public music: Sound;
    public unlitMaterial: PBRMaterial;
    public trackRoadMaterial: PBRMaterial;
    public trackBoundaryMaterial: PBRMaterial;
    public trackWallMaterial: PBRMaterial;
    public trackGoalMaterial: PBRMaterial;

    public async loadKartAsync(scene: Scene, bodyMaterialIndex: number, driverMaterialIndex: number): Promise<IAssetInfo> {
        const result = await SceneLoader.ImportMeshAsync(null, "/public/models/roadsterKart/roadsterKart.gltf", undefined, scene);
        const root = result.meshes[0];
        root.scaling.scaleInPlace(0.05);

        if (bodyMaterialIndex < 2) {
            const bodyMaterials = [
                root.getChildMeshes(false).find(c => c.name === "bodyMat2").material,
                root.getChildMeshes(false).find(c => c.name === "bodyMat3").material,
            ];

            const bodyMeshes = root.getChildTransformNodes(false).find(c => c.name === "carBody_low").getChildMeshes(false);
            for (const bodyMesh of bodyMeshes) {
                bodyMesh.material = bodyMaterials[bodyMaterialIndex];
            }
        }

        if (driverMaterialIndex < 2) {
            const driverMaterials = [
                root.getChildMeshes(false).find(c => c.name === "driverMat2").material,
                root.getChildMeshes(false).find(c => c.name === "driverMat3").material,
            ];

            const driverMesh = root.getChildMeshes(false).find(c => c.name === "driver_low");
            driverMesh.material = driverMaterials[driverMaterialIndex];
        }

        return {
            mesh: root as Mesh,
            animationGroups: result.animationGroups
        };
    }

    public async loadAsync(scene: Scene): Promise<void> {
        const observer = SceneLoader.OnPluginActivatedObservable.add((loader: GLTFFileLoader) => {
            loader.animationStartMode = GLTFLoaderAnimationStartMode.NONE;
        });

        const assets = new TransformNode("assets", scene);

        async function loadMergedAssetAsync(name: string, path: string): Promise<IAssetInfo> {
            const container = await SceneLoader.LoadAssetContainerAsync(path, undefined, scene);
            const root = container.meshes[0];
            const merged = Mesh.MergeMeshes(root.getChildMeshes() as Mesh[], false, undefined, undefined, undefined, true);
            merged.setEnabled(false);
            merged.name = name;
            merged.parent = assets;
            root.dispose();
            return {
                mesh: merged,
                animationGroups: container.animationGroups.map(animationGroup => cleanAnimationGroup(scene, animationGroup))
            };
        }

        this.bomb = await loadMergedAssetAsync("bomb", "/public/models/bomb/bomb.gltf");
        this.tree = await loadMergedAssetAsync("tree", "/public/models/evergreen2/evergreen2.gltf");
        this.boost = await loadMergedAssetAsync("boost", "/public/models/wing/wing.gltf");
        this.bumper = await loadMergedAssetAsync("bumper", "/public/models/bumper/bumper.gltf");
        this.poison = await loadMergedAssetAsync("poison", "/public/models/poison_cloud/poison_cloud.gltf");

        this.engineSound = new Sound("Music", "/public/sounds/go.mp3", scene, () => {
            this.engineSound.setVolume(0);
            this.engineSound.loop = true;
            this.engineSound.play();
        });

        this.music = new Sound("Music", "/public/sounds/music.mp3", scene, () => {
            this.music.loop = true;
            this.music.play();
        });

        this.unlitMaterial = new PBRMaterial("unlit", scene);
        this.unlitMaterial.unlit = true;

        this.trackRoadMaterial = this._createMaterial("trackRoad", scene);
        this.trackRoadMaterial.albedoTexture = new Texture("public/textures/SimpleTrack_basecolor.png", scene);
        this.trackRoadMaterial.bumpTexture = new Texture("public/textures/SimpleTrack_normal.png", scene);
        this.trackRoadMaterial.metallicTexture = new Texture("public/textures/SimpleTrack_ORM.png", scene);

        this.trackBoundaryMaterial = this._createMaterial("trackBoundary", scene);
        this.trackBoundaryMaterial.albedoTexture = new Texture("public/textures/TrackBoundary_basecolor.png", scene);
        this.trackBoundaryMaterial.bumpTexture = new Texture("public/textures/TrackBoundary_normal.png", scene);
        this.trackBoundaryMaterial.metallicTexture = new Texture("public/textures/TrackBoundary_ORM.png", scene);

        this.trackWallMaterial = this._createMaterial("trackWall", scene);
        this.trackWallMaterial.albedoTexture = new Texture("public/textures/StylizedWall_basecolor.png", scene);
        this.trackWallMaterial.bumpTexture = new Texture("public/textures/StylizedWall_normal.png", scene);
        this.trackWallMaterial.metallicTexture = new Texture("public/textures/StylizedWall_ORM.png", scene);

        this.trackGoalMaterial = this._createMaterial("trackGoal", scene);
        this.trackGoalMaterial.albedoTexture = new Texture("public/textures/goal_basecolor.png", scene);

        SceneLoader.OnPluginActivatedObservable.remove(observer);
    }

    private _createMaterial(name: string, scene: Scene): PBRMaterial {
        const material = new PBRMaterial(name, scene);
        material.metallic = 1;
        material.roughness = 1;
        material.backFaceCulling = false;
        material.twoSidedLighting = true;
        material.useMetallnessFromMetallicTextureBlue = true;
        material.useRoughnessFromMetallicTextureGreen = true;
        material.useRoughnessFromMetallicTextureAlpha = false;
        return material;
    }
}