import { Engine, Mesh, Scene, Vector3, Ray, Quaternion, FreeCamera, TransformNode, StandardMaterial, Scalar, AbstractMesh, AnimationGroup, ParticleSystem, MeshBuilder, Texture, Color4, Tags, PickingInfo, Sound, PBRMaterial } from "@babylonjs/core";
import { AdvancedDynamicTexture, StackPanel, TextBlock } from "@babylonjs/gui";
import { IKartInput } from "./input";
import { Menu } from "./menu";
import { Assets } from "./assets";

export class Kart extends TransformNode {
    private _engineSound: Sound;
    private _unlitMaterial: PBRMaterial;
    private _mesh: AbstractMesh;
    private _animationGroups?: { wheelsRotation: AnimationGroup, steering: AnimationGroup };
    private _camera: FreeCamera;
    private _input: IKartInput;
    private _hits: number = 0;
    private _deathPositionY: number;
    private _particlesLeft: ParticleSystem;
    private _particlesRight: ParticleSystem;
    private _particlesState: ParticleSystem;
    private _particlesConeLeft: Mesh;
    private _particlesConeRight: Mesh;
    private _particlesSphere: Mesh;

    private static readonly UP_GROUNDED_FILTER_STRENGTH: number = 7.0;
    private static readonly UP_FALLING_FILTER_STRENGTH: number = 1.0;
    private static readonly TURN_FILTER_STRENGTH: number = 0.1;
    private static readonly MAX_TURN_SCALAR: number = Math.PI * 2 / 3;
    private static readonly FORWARD_VELOCITY_SCALAR: number = 1.2;
    private static readonly VELOCITY_DECAY_SCALAR: number = 4.0;
    private static readonly WALL_REBOUND_FACTOR: number = 1.6;
    private static readonly TURN_DECAY_SCALAR: number = 5.0;
    private static readonly BRAKE_SCALAR: number = 3.0;
    private static readonly SLOW_DURATION: number = 3000;
    private static readonly BOMB_DURATION: number = 1500;
    private static readonly BOOST_DURATION: number = 700;
    private static readonly BOOST_VELOCITY_FACTOR: number = 8.9;
    private static readonly ACCELERATION: number = 0.267;
    private static readonly BABY_ACCELERATION: number = 0.22;
    private static readonly BABY_THRESHOLD = 0.53;
    private static readonly DECCELERATION: number = 1.35;
    private static readonly TOP_DECCELERATION: number = 2;
    private static readonly TOP_ACCELERATION: number = 0.2;
    private static readonly TOP_THRESHOLD: number = 3.7;
    private static readonly MAX_SPEED: number = 4.3;

    private static readonly VELOCITY_DECAY_SCALARS: { [type: string]: number } = {
        "road": 4.0,
        "apron": 6.0,
        "flat": 10.0,
    };

    private _velocity: Vector3 = Vector3.Zero();
    private _relocity: number = 0.0;
    private _filteredUp: Vector3 = Vector3.Up();
    private _deltaTime: number = 0.0;
    private _lastSafePosition: Vector3 = Vector3.Zero();
    private _lastSafeFilteredUp: Vector3 = Vector3.Zero();
    private _turnFactor: number = 0.0;
    private _kartName: string = "";
    private _lastHazardId: number = -1;
    private _lastHazardType: string = "";
    private _bombHitTime: number = 0;
    private _velocityFactor: number;
    private _currentVelocityFactor: number = 0;
    private _initialPosition: Vector3;
    private _velocityDecayScalar: number = Kart.VELOCITY_DECAY_SCALARS["road"];

    private _initialLookAt: Vector3;
    private _checkpoints: Vector3[];
    private _totalCheckpoints: number = 0;
    private _boostHitTime: number = 0;
    private _slowHitTime: number = 0;
    private _state: string = "ok";

    public TrackTime: string = "";
    public PlayerMenu: Menu;

    private _wheelsRotationSpeedRatio = 0;
    public get wheelsRotationSpeedRatio(): number {
        return this._wheelsRotationSpeedRatio;
    }
    public set wheelsRotationSpeedRatio(value: number) {
        this._wheelsRotationSpeedRatio = value;
        if (this._animationGroups) {
            this._animationGroups.wheelsRotation.speedRatio = this._wheelsRotationSpeedRatio;
        }
    }

    private _steeringAnimationFrame = 0;
    public get steeringAnimationFrame(): number {
        return this._steeringAnimationFrame;
    }
    public set steeringAnimationFrame(value: number) {
        this._steeringAnimationFrame = value;
        if (this._animationGroups) {
            this._animationGroups.steering.goToFrame(this._steeringAnimationFrame);
        }
    }

    public readonly bodyMaterialIndex: number;
    public readonly driverMaterialIndex: number;

    constructor(kartName: string, scene: Scene, assets: Assets, bodyMaterialIndex: number, driverMaterialIndex: number, input?: IKartInput) {
        super(kartName, scene);

        this.bodyMaterialIndex = bodyMaterialIndex;
        this.driverMaterialIndex = driverMaterialIndex;

        this._engineSound = assets.engineSound;
        this._unlitMaterial = assets.unlitMaterial;

        assets.loadKartAsync(scene, bodyMaterialIndex, driverMaterialIndex).then(assetInfo => {
            this._mesh = assetInfo.mesh;
            this._mesh.name = "model";
            this._mesh.parent = this;

            this._animationGroups = {
                wheelsRotation: assetInfo.animationGroups[0],
                steering: assetInfo.animationGroups[1]
            };

            this._animationGroups.wheelsRotation.play(true);
            this._animationGroups.wheelsRotation.speedRatio = this._wheelsRotationSpeedRatio;

            this._animationGroups.steering.play(true);
            this._animationGroups.steering.pause();
            this._animationGroups.steering.goToFrame(this._steeringAnimationFrame);
        });

        this._input = input;

        this.setUpParticleSystems(scene);

        this.rotationQuaternion = new Quaternion();
    }

    public setDeathPositionY(value: number): void {
        this._deathPositionY = value;
    }

    public activateKartCamera(): FreeCamera {
        this.setup3rdPersonKartCamera();

        this._scene.registerBeforeRender(() => {
            this.beforeRenderUpdate();
        });

        return this._camera;
    }

    public initializeTrackProgress(checkpoints: Vector3[], startingPosition: Vector3, startingLookAt: Vector3): void {
        this._initialPosition = startingPosition;
        this._initialLookAt = startingLookAt;
        this._checkpoints = checkpoints;
        // checkpoints.forEach((c)=>{
        //     var s = Mesh.CreateSphere("", 16, 60)
        //     s.position.copyFrom(c)
        //     s.isPickable = false
        // })
        this._totalCheckpoints = checkpoints.length;
    }

    public get trackProgress(): number {
        return Math.round(this._hits / this._totalCheckpoints * 100);
    }

    public set kartName(value: string) {
        var namePlane = Mesh.CreatePlane("namePlane", 3.5, this._scene);
        namePlane.material = this._unlitMaterial;

        var nameMesh = AdvancedDynamicTexture.CreateForMesh(namePlane);
        var stackPanel = new StackPanel();
        stackPanel.height = "100%";
        nameMesh.addControl(stackPanel);

        var nameText = new TextBlock();
        nameText.height = "100%";
        nameText.textVerticalAlignment = TextBlock.VERTICAL_ALIGNMENT_TOP;
        nameText.fontSize = 96;
        nameText.color = "white"
        nameText.text = value;
        nameText.textWrapping = true;
        nameText.outlineColor = "black";
        nameText.outlineWidth = 3;
        stackPanel.addControl(nameText);
        namePlane.position.set(0, 1, 0);
        namePlane.parent = this;

        this._kartName = value;
    }

    public get kartName(): string {
        return this._kartName;
    }

    private updateFromTrackPhysics(): void {
        var ray = new Ray(this.position, this.up.scale(-1.0), 0.7);
        var hit = this.getScene().pickWithRay(ray, mesh => Tags.HasTags(mesh));
        if (hit.hit) {
            // MAGIC: There is a bug in the picking code where the barycentric coordinates
            // returned for bu and bv are actually bv and bw.  This causes the normals to be
            // calculated incorrectly.
            const bv = hit.bu;
            const bw = hit.bv;
            const bu = 1.0 - bv - bw;
            hit.bu = bu;
            hit.bv = bv;

            var normal = hit.getNormal(true, true);

            this._filteredUp = Vector3.Lerp(
                this._filteredUp,
                normal,
                Kart.UP_GROUNDED_FILTER_STRENGTH * this._deltaTime);
            this._filteredUp.normalize();

            this.position = hit.pickedPoint.add(this._filteredUp.scale(0.55));

            this._velocity.subtractInPlace(normal.scale(Vector3.Dot(this._velocity, normal)));

            this._lastSafePosition.copyFrom(this.position);
            this._lastSafeFilteredUp.copyFrom(this._filteredUp);

            const tags = Tags.GetTags(hit.pickedMesh);
            this._velocityDecayScalar = Kart.VELOCITY_DECAY_SCALARS[tags];
        }
        else {
            this._filteredUp = Vector3.Lerp(
                this._filteredUp,
                Vector3.Up(),
                Kart.UP_FALLING_FILTER_STRENGTH * this._deltaTime);
            this._filteredUp.normalize();

            this._velocity.addInPlace(Vector3.Down().scale(this._deltaTime));

            if (this.position.y < this._deathPositionY) {
                this.position.copyFrom(this._lastSafePosition);
                this._filteredUp.copyFrom(this._lastSafeFilteredUp);
                this._velocity.set(0.0, 0.0, 0.0);
                this._relocity = 0.0;
            }
        }

        var forward = Vector3.Cross(this.right, this._filteredUp);
        var right = Vector3.Cross(this._filteredUp, forward);
        Quaternion.RotationQuaternionFromAxisToRef(right, this._filteredUp, forward, this.rotationQuaternion);
    }

    private updateFromWallPhysics(): void {
        var hit: PickingInfo;

        var ray = new Ray(this.up, Vector3.Zero(), 0.0);
        ray.origin.scaleInPlace(0.5);
        ray.origin.addInPlace(this.position);
        [this.forward, this.right, this.forward.scale(-1.0), this.right.scale(-1.0)].forEach((direction) => {
            ray.direction = direction;
            ray.length = 2.0;
            hit = this.getScene().pickWithRay(ray, mesh => Tags.GetTags(mesh) === "wall");
            if (hit.hit) {
                var normal = hit.getNormal(true, true);
                var velocityNormalDot = Vector3.Dot(this._velocity, normal);

                if (velocityNormalDot < 0.0) {
                    this._velocity.subtractInPlace(normal.scale(Kart.WALL_REBOUND_FACTOR * velocityNormalDot));
                }

                var projection = normal.scale(Vector3.Dot(normal, direction.scale(-hit.distance)));
                if (projection.lengthSquared() < 1.0) {
                    this.position.addInPlace(normal.scale(1.0 - projection.length()));
                }
            }
        });
    }

    private checkHazardCollision(name: string): number {
        const radiusCollisionSquared = 4;

        const hazards = this.getScene().getTransformNodeByName(name);

        if (hazards == null) {
            return -1;
        }

        const meshes = hazards.getChildMeshes();

        for (var index = 0; index < meshes.length; ++index) {
            const position = meshes[index].absolutePosition;
            const distanceSquared = Vector3.DistanceSquared(this.position, position);
            if (distanceSquared < radiusCollisionSquared && meshes[index].isVisible) {
                return index;
            }
        }

        return -1;
    }

    private disappearHazard(name: string, index: number) {
        const hazards = this.getScene().getTransformNodeByName(name);
        const hazardMeshes = hazards.getChildMeshes();
        hazardMeshes[index].isVisible = false;
    }


    private resetAllHazardsOfAType(name: string) {
        const hazards = this.getScene().getTransformNodeByName(name);
        const hazardMeshes = hazards.getChildMeshes();
        for (var index = 0; index < hazardMeshes.length; ++index) {
            hazardMeshes[index].isVisible = true;
        }
    }

    private resetAllHazards() {
        this._lastHazardId = -1;
        this._lastHazardType = "";
        this.resetAllHazardsOfAType("bombs");
        this.resetAllHazardsOfAType("poison");
        this.resetAllHazardsOfAType("boosts");
        this.resetAllHazardsOfAType("bumpers");
    }

    private updateFromHazards(): void {
        let collisionId = this.checkHazardCollision("bombs");
        if (collisionId != -1 && (collisionId != this._lastHazardId || this._lastHazardType != "bomb")) {
            this._velocity.set(0.0, 1.2, 0.0);
            this._lastHazardId = collisionId;
            this._lastHazardType = "bomb";
            this._bombHitTime = (new Date).getTime();
            this._velocityFactor = 0.5;
            this.setCurrentVelocityFactor(true);
            this._state = "exploded";
            this.disappearHazard("bombs", collisionId);
        }

        collisionId = this.checkHazardCollision("boosts");
        if (collisionId != -1 && (collisionId != this._lastHazardId || this._lastHazardType != "boost")) {
            this._lastHazardId = collisionId;
            this._lastHazardType = "boost";
            this._boostHitTime = (new Date).getTime();
            this._velocityFactor = Kart.BOOST_VELOCITY_FACTOR;
            this.setCurrentVelocityFactor(true);
            this._state = "fast";
            this.disappearHazard("boosts", collisionId);
        }

        collisionId = this.checkHazardCollision("bumpers");
        if (collisionId != -1) {
            const hazards = this.getScene().getTransformNodeByName("bumpers");
            const bumpers = hazards.getChildMeshes();
            const bumper = bumpers[collisionId];
            const bumperPosition = bumper.position;
            let direction = this.position.subtract(bumperPosition);
            direction.y = 0;
            direction.normalize();

            const angle = Vector3.GetAngleBetweenVectors(this._velocity, direction, new Vector3(0, 1, 0));
            if (angle > 2 * Math.PI / 3.0 && angle < 4 * Math.PI / 3.0) {
                this._velocity.set(-this._velocity.x, this._velocity.y, -this._velocity.z);
            }
            else {
                const speed = Math.max(this._velocity.length() * .8, 0.3);

                direction.scaleInPlace(this._velocity.length() * 2);
                this._velocity.addInPlace(direction);
                this._velocity.normalize();
                this._velocity.scaleInPlace(speed);
            }

            this._lastHazardId = collisionId;
            this._lastHazardType = "bumper";
        }
        collisionId = this.checkHazardCollision("poison");
        if (collisionId != -1 && (collisionId != this._lastHazardId || this._lastHazardType != "poison")) {
            this._velocity.set(0.0, 0.0, 0.0);
            this._lastHazardId = collisionId;
            this._lastHazardType = "poison";
            this._slowHitTime = (new Date).getTime();
            this._velocityFactor = 0.1;
            this.setCurrentVelocityFactor(true);
            this._state = "slow";

            this.disappearHazard("poison", collisionId);
        }
    }

    private getForward(): number {
        //return false ? 1.0 : 0.0;
        return Math.max(0, Math.min(1, this._input.accelerate));
    }

    private getLeft(): number {
        //return false ? 1.0 : 0.0;
        return Math.max(0, Math.min(1, -this._input.horizontal));
    }

    private getBack(): number {
        //return false ? 1.0 : 0.0;
        return Math.max(0, Math.min(1, -this._input.accelerate));
    }

    private getRight(): number {
        //return false ? 1.0 : 0.0;
        return Math.max(0, Math.min(1, this._input.horizontal));
    }

    private getBrake(): number {
        //return false ? 1.0 : 0.0;
        return Math.max(0, Math.min(1, this._input.brake));
    }

    private updateFromControls(): void {
        this._turnFactor = Kart.TURN_FILTER_STRENGTH * this.getLeft();
        this._relocity = this._turnFactor * -Kart.MAX_TURN_SCALAR * this._deltaTime + (1.0 - this._turnFactor) * this._relocity;

        this._turnFactor = Kart.TURN_FILTER_STRENGTH * this.getRight();
        this._relocity = this._turnFactor * Kart.MAX_TURN_SCALAR * this._deltaTime + (1.0 - this._turnFactor) * this._relocity;

        this.rotateAround(this.position, this.up, this._relocity);

        this._engineSound.setVolume(Scalar.Lerp(this._engineSound.getVolume(), this.getForward(), 0.1))
        this._velocity.addInPlace(this.forward.scale(this.getForward() * Kart.FORWARD_VELOCITY_SCALAR * this._currentVelocityFactor * this._deltaTime));
        this.setCurrentVelocityFactor(false);

        this._velocity.scaleInPlace(1.0 - (this.getBrake() * Kart.BRAKE_SCALAR * this._deltaTime));

        this._velocity.subtractInPlace(this.forward.scale(this.getBack() * this._deltaTime));

        if (this._animationGroups) {
            this.wheelsRotationSpeedRatio = this._velocity.length() * 300 / 17.825;
            this.steeringAnimationFrame = (this._input.horizontal + 1) * 0.5 * this._animationGroups.steering.to;
        }
    }

    private updateFromTrackProgress(): void {
        let i: number;
        let closestPoint = this._checkpoints[0];
        let kartPos = this.position;
        let closestPos = 0;
        let previousPos = this._hits;

        for (i = 1; i < this._checkpoints.length; i++) {
            let closeDiff = kartPos.subtract(closestPoint);
            let currentDiff = kartPos.subtract(this._checkpoints[i]);

            if (closeDiff.length() > currentDiff.length()) {
                closestPoint = this._checkpoints[i];
                closestPos = i;
            }
        }

        if (Math.abs(previousPos - closestPos) < 3) {
            this._hits = closestPos;
        }
    }

    private beforeRenderUpdate(): void {
        this._deltaTime = Engine.Instances[0].getDeltaTime() / 1000.0;
        if (this._deltaTime > 0.1) {
            return;
        }

        if ((this._state == "exploded" && (new Date).getTime() - this._bombHitTime > Kart.BOMB_DURATION)
            || (this._state == "fast" && (new Date).getTime() - this._boostHitTime > Kart.BOOST_DURATION)
            || (this._state == "slow" && (new Date).getTime() - this._slowHitTime > Kart.SLOW_DURATION)) {
            this.resetVelocityFactor();
            this._state = "ok";
        }

        if (this._hits < this._checkpoints.length) {
            this.updateFromTrackProgress();
        }

        this.updateFromWallPhysics();
        this.updateFromTrackPhysics();
        this.updateFromHazards();

        if (this._state != "exploded") {
            this.updateFromControls();
        }

        this._velocity.scaleInPlace(1.0 - (this._velocityDecayScalar * this._deltaTime));
        this._relocity *= (1.0 - (Kart.TURN_DECAY_SCALAR * this._deltaTime));

        this.position.addInPlace(this._velocity.scale(this._deltaTime * 60));

        this.updateParticles(this._velocity.length());
    }

    private setup3rdPersonKartCamera() {
        this._camera = new FreeCamera(this.name + "_camera", new Vector3(0, 4, -8), this.getScene());
        this._camera.setTarget(this.position.add(this.forward.scale(10.0)));
        this._camera.parent = this;
        this.getScene().activeCamera = this._camera;
    }

    private setUpParticleSystems(scene: Scene) {
        const scaling = this.scaling;
        this._particlesLeft = this.setUpSpeedParticles(scene, this._particlesConeLeft, new Vector3(-scaling.x, 0.5, 2 * scaling.z), new Vector3(-scaling.x, 0.0, 0))
        this._particlesRight = this.setUpSpeedParticles(scene, this._particlesConeRight, new Vector3(scaling.x, 0.5, 2 * scaling.z), new Vector3(scaling.x, 0.0, 0))
        this._particlesSphere = MeshBuilder.CreateSphere("sphere", { diameter: scaling.x * 2, segments: 8 }, scene);
        this._particlesSphere.position = this.position
        this._particlesSphere.parent = this;
        this._particlesSphere.material = new StandardMaterial("particlesSphere", scene);
        this._particlesSphere.visibility = 0;
        this._particlesSphere.isPickable = false;

        this._particlesState = new ParticleSystem("particles", 2000, scene);
        this._particlesState.particleTexture = new Texture("/public/textures/flare.png", scene);
        this._particlesState.emitter = this._particlesSphere;
        this._particlesState.createSphereEmitter(scaling.x);
        this._particlesState.colorDead = new Color4(0, 0.0, 0.0, 0.0);
        this._particlesState.minSize = 0.3;
        this._particlesState.maxSize = 0.5;
        this._particlesState.minLifeTime = 2;
        this._particlesState.maxLifeTime = 5;
        this._particlesState.emitRate = 0;
        this._particlesState.blendMode = ParticleSystem.BLENDMODE_ONEONE;
        this._particlesState.minEmitPower = 1;
        this._particlesState.maxEmitPower = 2;
        this._particlesState.updateSpeed = 0.08;
        this._particlesState.start();

    }

    private setUpSpeedParticles(scene: Scene, cone: Mesh, minEmitBox: Vector3, maxEmitBox: Vector3): ParticleSystem {
        cone = MeshBuilder.CreateCylinder("cone", { diameterBottom: 0, diameterTop: 1, height: 1 }, scene);
        cone.position = this.position.subtract(new Vector3(0, 0, 1.5));
        // cone.rotate(new Vector3(1,0,0), -Math.PI/2.0);
        cone.parent = this;
        cone.material = new StandardMaterial("particlesCone", scene);
        cone.visibility = 0;
        cone.isPickable = false;

        const particlesSystem = new ParticleSystem("particles", 2000, scene);
        particlesSystem.particleTexture = new Texture("/public/textures/flare.png", scene);
        particlesSystem.emitter = cone;
        particlesSystem.minEmitBox = minEmitBox;
        particlesSystem.maxEmitBox = maxEmitBox;

        particlesSystem.colorDead = new Color4(0, 0.0, 0.0, 0.0);
        particlesSystem.minSize = 0.1;
        particlesSystem.maxSize = 0.15;
        particlesSystem.minLifeTime = 0.02;
        particlesSystem.maxLifeTime = 0.05;
        particlesSystem.emitRate = 0;
        particlesSystem.blendMode = ParticleSystem.BLENDMODE_ONEONE;
        particlesSystem.direction1 = new Vector3(0, 0, -1);
        particlesSystem.direction2 = new Vector3(0, 1, -1);
        particlesSystem.minAngularSpeed = 0;
        particlesSystem.maxAngularSpeed = Math.PI / 8;
        particlesSystem.minEmitPower = 0.5;
        particlesSystem.maxEmitPower = 1;
        particlesSystem.updateSpeed = 0.08;

        particlesSystem.start();

        return particlesSystem;
    }

    private updateSpeedParticle(speed: number) {
        this._particlesLeft.emitRate = speed * 100;
        this._particlesRight.emitRate = speed * 100;


        if (speed > 0 && speed < .7) {
            const gray1 = new Color4(0.3, 0.3, 0.3, 1.0);
            const gray2 = new Color4(0.7, 0.7, 0.7, 1.0);
            this._particlesLeft.color1 = gray1;
            this._particlesLeft.color2 = gray2;
            this._particlesLeft.maxLifeTime = 2;
            this._particlesRight.color1 = gray1;
            this._particlesRight.color2 = gray2;
            this._particlesRight.maxLifeTime = 2;
        }

        else if (speed >= .7 && speed < 1.1) {
            const yellow1 = new Color4(1, 1, 0.0, 1.0);
            const yellow2 = new Color4(1, 0.8, 0.0, 1.0);
            this._particlesLeft.color1 = yellow1;
            this._particlesLeft.color2 = yellow2;
            this._particlesLeft.maxLifeTime = .5;
            this._particlesRight.color1 = yellow1;
            this._particlesRight.color2 = yellow2;
            this._particlesRight.maxLifeTime = .5;
        }

        else if (speed >= 1.1 && speed < 1.5) {
            const red1 = new Color4(1, 0, 0.0, 1.0);
            const red2 = new Color4(.7, 0.0, 0.0, 1.0);
            this._particlesLeft.color1 = red1;
            this._particlesLeft.color2 = red2;
            this._particlesLeft.maxLifeTime = .4;
            this._particlesRight.color1 = red1;
            this._particlesRight.color2 = red2;
            this._particlesRight.maxLifeTime = .4;
        }

        else {
            const blue1 = new Color4(0, 1, 0.0, 1.0);
            const blue2 = new Color4(0, 0.8, 0.0, 1.0);
            this._particlesLeft.color1 = blue1;
            this._particlesLeft.color2 = blue2;
            this._particlesLeft.maxLifeTime = .4;
            this._particlesRight.color1 = blue1;
            this._particlesRight.color2 = blue2;
            this._particlesRight.maxLifeTime = .4;
        }
    }

    private updateParticles(speed: number) {
        this.updateSpeedParticle(speed);

        if (this._state == "slow") {
            this._particlesState.color1 = new Color4(.6, 0, .9, 1);
            this._particlesState.color2 = new Color4(.5, 0, .8, 1);
            this._particlesState.emitRate = 500;
        }

        else if (this._state == "exploded") {
            this._particlesState.color1 = new Color4(0.5, 0.5, 0.5, 1);
            this._particlesState.color2 = new Color4(0.8, 0, 0, 1);
            this._particlesState.emitRate = 500;
        }

        else if (this._state == "fast") {
            this._particlesState.color1 = new Color4(0.0, 0, .8, 1);
            this._particlesState.color2 = new Color4(0.0, .8, 0, 1);
            this._particlesState.emitRate = 500;
        }

        else {
            this._particlesState.emitRate = 0;
        }
    }

    public reset() {
        this._hits = 0;
        this._state = "ok";
        this._velocity.set(0, 0, 0);
        this.resetVelocityFactor();
        this._currentVelocityFactor = 0;
        this.position = this._initialPosition;
        this.lookAt(this._initialLookAt);
        this.computeWorldMatrix();
        this.TrackTime = "";
        this.PlayerMenu.SetWinText("");
        this.PlayerMenu.StartTimer();
        this.resetAllHazards();
    }

    private resetVelocityFactor() {
        this._velocityFactor = Kart.MAX_SPEED;
    }

    private setCurrentVelocityFactor(hardReset: boolean = false) {
        if (hardReset) {
            this._currentVelocityFactor = this._velocityFactor;
        }
        else {
            let goalVelocityFactor: number = this._velocityFactor;
            let acceleration = Kart.ACCELERATION;
            if (this.getForward() === 0) {
                goalVelocityFactor = 0;
                acceleration = Kart.DECCELERATION;
            }
            else {
                if (this._currentVelocityFactor < Kart.BABY_THRESHOLD) {
                    acceleration = Kart.BABY_ACCELERATION;
                }
                if (this._currentVelocityFactor > Kart.TOP_THRESHOLD) {
                    acceleration = Kart.TOP_ACCELERATION;
                }
                if (this._currentVelocityFactor > goalVelocityFactor) {
                    acceleration = Kart.TOP_DECCELERATION;
                }
            }
            this._currentVelocityFactor = Scalar.Lerp(this._currentVelocityFactor, goalVelocityFactor, this._deltaTime * acceleration);
        }
    }
}
