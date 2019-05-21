import { SceneLoader, AbstractMesh, Mesh, Sound, TransformNode, Scene, AnimationGroup, PBRMaterial, Texture, Vector3, Quaternion } from "@babylonjs/core";
import { GLTFFileLoader, GLTFLoaderAnimationStartMode } from "@babylonjs/loaders/glTF";

export interface IAssetInfo {
    mesh: Mesh;
    animationGroups: Array<AnimationGroup>;
}

export class Assets {
    public mainKart: IAssetInfo;
    public kart: IAssetInfo;
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

    private static sanitizeMesh(root: AbstractMesh): void {
        const badMeshes = root.getChildMeshes(false).filter((mesh : Mesh) => {
            return mesh.name == "driverMat2" ||
                   mesh.name == "driverMat3" ||
                   mesh.name == "bodyMat2" ||
                   mesh.name == "bodyMat3";
        }) as Mesh[];

        badMeshes.forEach((mesh : Mesh) => {
            (mesh.parent as AbstractMesh).removeChild(mesh);
        });
    }

    public async loadAsync(scene: Scene): Promise<void> {
        const observer = SceneLoader.OnPluginActivatedObservable.add((loader: GLTFFileLoader) => {
            loader.animationStartMode = GLTFLoaderAnimationStartMode.NONE;
        });

        const assets = new TransformNode("assets", scene);

        // HACK to fix the kart asset
        function cleanAnimationGroup(animationGroup: AnimationGroup): AnimationGroup {
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

        const kartResult = await SceneLoader.ImportMeshAsync(null, "/public/models/roadsterKart/roadsterKart.gltf");
        Assets.sanitizeMesh(kartResult.meshes[0]);
        kartResult.meshes[0].scaling.scaleInPlace(0.05);
        kartResult.meshes[0].isPickable = false;
        kartResult.meshes[0].getChildMeshes().forEach(child => child.isPickable = false);

        const kartMesh = kartResult.meshes[0].clone("", null, false);

        this.mainKart = {
            mesh: kartResult.meshes[0] as Mesh,
            animationGroups: kartResult.animationGroups.map(animationGroup => cleanAnimationGroup(animationGroup))
        };

        var rand = Math.random();
        var bodyMatNum = 1
        if( rand < 0.33 ){
            bodyMatNum = 2
        }else if(rand < 0.66){
            bodyMatNum = 3
        }
        this.mainKart.mesh.getChildMeshes(false).filter((c)=>{return c.name.indexOf("roadsterBody_low") != -1})[0].material = scene.materials.filter((m)=>{return m.name == "kartBodyMat"+bodyMatNum})[0]
        this.mainKart.mesh.getChildMeshes(false).filter((c)=>{return c.name.indexOf("rollCage_low") != -1})[0].material = scene.materials.filter((m)=>{return m.name == "kartBodyMat"+bodyMatNum})[0]
        this.mainKart.mesh.getChildMeshes(false).filter((c)=>{return c.name.indexOf("seat_low") != -1})[0].material = scene.materials.filter((m)=>{return m.name == "kartBodyMat"+bodyMatNum})[0]
        this.mainKart.mesh.getChildMeshes(false).filter((c)=>{return c.name.indexOf("wheelDash_low") != -1})[0].material = scene.materials.filter((m)=>{return m.name == "kartBodyMat"+bodyMatNum})[0]

        const mergedKartMesh = Mesh.MergeMeshes(kartMesh.getChildMeshes() as Mesh[], false, undefined, undefined, undefined, true);
        mergedKartMesh.setEnabled(false);
        mergedKartMesh.name = "kart";
        mergedKartMesh.parent = assets;
        this.kart = {
            mesh: kartMesh as any,
            animationGroups: []
        };
        this.kart.mesh.getChildMeshes(false).filter((c)=>{return c.name.indexOf("roadsterBody_low") != -1})[0].material = scene.materials.filter((m)=>{return m.name == "kartBodyMat1"})[0]
        this.kart.mesh.getChildMeshes(false).filter((c)=>{return c.name.indexOf("rollCage_low") != -1})[0].material = scene.materials.filter((m)=>{return m.name == "kartBodyMat1"})[0]
        this.kart.mesh.getChildMeshes(false).filter((c)=>{return c.name.indexOf("seat_low") != -1})[0].material = scene.materials.filter((m)=>{return m.name == "kartBodyMat1"})[0]
        this.kart.mesh.getChildMeshes(false).filter((c)=>{return c.name.indexOf("wheelDash_low") != -1})[0].material = scene.materials.filter((m)=>{return m.name == "kartBodyMat1"})[0]

        async function loadMergedAssetAsync(name: string, path: string): Promise<IAssetInfo> {
            const container = await SceneLoader.LoadAssetContainerAsync(path);
            const root = container.meshes[0];
            const merged = Mesh.MergeMeshes(root.getChildMeshes() as Mesh[], false, undefined, undefined, undefined, true);
            merged.setEnabled(false);
            merged.name = name;
            merged.parent = assets;
            root.dispose();
            return {
                mesh: merged,
                animationGroups: container.animationGroups.map(animationGroup => cleanAnimationGroup(animationGroup))
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