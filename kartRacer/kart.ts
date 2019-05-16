import { IKartInput } from "./input";
import { KartEngine } from "./engine";
import { Engine, Mesh, Scene, Vector3, Ray, Quaternion, FreeCamera, TransformNode, StandardMaterial, Scalar } from "@babylonjs/core";
import { AdvancedDynamicTexture, StackPanel, TextBlock } from "@babylonjs/gui";

export class Kart extends TransformNode {
    private _mesh: Mesh;
    private _camera: FreeCamera;
    private _locallyOwned: boolean;
    private _input: IKartInput;
    private _hits: number = 0;

    private static readonly UP_GROUNDED_FILTER_STRENGTH: number = 7.0;
    private static readonly UP_FALLING_FILTER_STRENGTH: number = 1.0;
    private static readonly MAX_FALL_TIME_SECONDS: number = 3.0;
    private static readonly TURN_FILTER_STRENGTH: number = 0.1;
    private static readonly MAX_TURN_SCALAR: number = Math.PI * 2 / 3;
    private static readonly FORWARD_VELOCITY_SCALAR: number = 3.0;
    private static readonly VELOCITY_DECAY_SCALAR: number = 2.0;
    private static readonly TURN_DECAY_SCALAR: number = 5.0;
    private static readonly BRAKE_SCALAR: number = 3.0;
    private static readonly SLOW_DURATION: number = 3000;
    private static readonly BOMB_DURATION: number = 2000;
    private static readonly BOOST_DURATION: number = 1000;

    private _velocity: Vector3 = Vector3.Zero();
    private _relocity: number = 0.0;
    private _filteredUp: Vector3 = Vector3.Up();
    private _fallTime: number = 0.0;
    private _deltaTime: number = 0.0;
    private _lastSafePosition: Vector3 = Vector3.Zero();
    private _lastSafeFilteredUp: Vector3 = Vector3.Zero();
    private _turnFactor: number = 0.0;
    private _kartName : string = "";
    private _lastHazard: number = -1;
    private _bombHitTime: number = 0;
    private _velocityFactor: number = 1;
    private _initialPosition: Vector3;

    private _initialLookAt: Vector3;
    private _checkpoints: Vector3[];
    private _totalCheckpoints: number = 0;
    private _boostHitTime: number = 0;
    private _slowHitTime: number = 0;
    private _state: string = "ok";

    public TrackTime : string = "";

    constructor(kartName: string, scene: Scene, locallyOwned: boolean = true) {
        super(kartName, scene);

        // this is a placeholder so that we actually spawn a Kart on game start.
        this._mesh = KartEngine.instance.assets.kart.clone("model");
        this._mesh.getChildMeshes().forEach(child => child.isPickable = false);
        KartEngine.instance.scene.addMesh(this._mesh)
        this._mesh.parent = this;
        this._locallyOwned = locallyOwned;

        if (this._locallyOwned) {
            this._input = KartEngine.instance.inputSource;
        }
    }

    public activateKartCamera(): FreeCamera {
        this.setup3rdPersonKartCamera();

        this._scene.registerBeforeRender(() =>
        {
            this.beforeRenderUpdate();
        });

        return this._camera;
    }

    public assignKartName(name : string): void {
        var namePlane = Mesh.CreatePlane("namePlane", 2, this._scene);
        namePlane.material = new StandardMaterial("", this._scene)

        var nameMesh = AdvancedDynamicTexture.CreateForMesh(namePlane);
        var stackPanel = new StackPanel();
        stackPanel.height = "100%";
        nameMesh.addControl(stackPanel);

        var nameText = new TextBlock();
        nameText.height = "100%";
        nameText.textVerticalAlignment = TextBlock.VERTICAL_ALIGNMENT_TOP;
        nameText.fontSize = 160;
        nameText.color = "white"
        nameText.text = name;
        nameText.textWrapping = true;
        stackPanel.addControl(nameText);
        namePlane.position.set(0,1,0);
        namePlane.parent = this;

        this._kartName = name;
    }

    public initializeTrackProgress(checkpoints: Vector3[], startingPosition: Vector3, startingLookAt: Vector3): void
    {
        this._initialPosition = startingPosition;
        this._initialLookAt = startingLookAt;
        this._checkpoints = checkpoints;
        this._totalCheckpoints = checkpoints.length;
    }

    public getTrackComplete(): number
    {
        return Math.round(this._hits / this._totalCheckpoints * 100);
    }

    public getKartName(): string
    {
        return this._kartName;
    }

    private updateFromPhysics(): void {
        var ray = new Ray(this.position, this.up.scale(-1.0), 0.7);
        var hit = KartEngine.instance.scene.pickWithRay(ray);
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

            this._fallTime = 0.0;
            this._lastSafePosition.copyFrom(this.position);
            this._lastSafeFilteredUp.copyFrom(this._filteredUp);
        }
        else {
            this._filteredUp = Vector3.Lerp(
                this._filteredUp, 
                Vector3.Up(), 
                Kart.UP_FALLING_FILTER_STRENGTH * this._deltaTime);
            this._filteredUp.normalize();

            this._velocity.addInPlace(Vector3.Down().scale(this._deltaTime));

            this._fallTime += this._deltaTime;
            if (this._fallTime > Kart.MAX_FALL_TIME_SECONDS) {
                this.position.copyFrom(this._lastSafePosition);
                this._filteredUp.copyFrom(this._lastSafeFilteredUp);
                this._velocity.set(0.0, 0.0, 0.0);
                this._relocity = 0.0;
            }
        }

        var forward = Vector3.Cross(this.right, this._filteredUp);
        var right = Vector3.Cross(this._filteredUp, forward);
        this.rotationQuaternion = Quaternion.RotationQuaternionFromAxis(right, this._filteredUp, forward);
    }

    private checkHazardCollision(name: string): number {
        const radiusCollision = 2;

        const hazards = (KartEngine.instance.scene as any).getTransformNodeByName(name);

        if (hazards == null)
        {
            return -1;
        }

        const bombs = hazards.getChildMeshes();

        for (var index = 0; index < bombs.length; ++index) 
        {
            const position = bombs[index].position;
            const distance = this.position.subtract(position).length();
            if (distance < radiusCollision)
            {
                return index;
            }
        }

        return -1;
    }

    private updateFromHazards(): void {
        let collisionId = this.checkHazardCollision("bombs");
        if (collisionId != -1 && collisionId != this._lastHazard)
        {
            this._velocity.set(0.0, 1.2, 0.0);
            this._lastHazard = collisionId;
            this._bombHitTime = (new Date).getTime();
            this._velocityFactor = 0.5;
            this._state = "exploded";
        }

        collisionId = this.checkHazardCollision("boosts"); 
        if (collisionId != -1 && collisionId != this._lastHazard)
        {
            this._lastHazard = collisionId;
            this._boostHitTime = (new Date).getTime();
            this._velocityFactor = 1.6;
            this._state = "fast";
        }

        collisionId = this.checkHazardCollision("bumpers"); 
        if (collisionId != -1)
        {
            const hazards = (KartEngine.instance.scene as any).getTransformNodeByName("bumpers");
            const bumpers = hazards.getChildMeshes();
            const bumper = bumpers[collisionId];
            const bumperPosition = bumper.position;
            let direction = this.position.subtract(bumperPosition);
            direction.y =0;
            direction.normalize();

            const angle = Vector3.GetAngleBetweenVectors(this._velocity, direction, new Vector3(0,1,0));
            if (angle> 2*Math.PI/3.0 && angle < 4*Math.PI/3.0 )
            {
                this._velocity.set(-this._velocity.x, this._velocity.y, -this._velocity.z);
            }
            else
            {
                const speed = Math.max(this._velocity.length()*.8, 0.3);

                direction.scaleInPlace(this._velocity.length()*2);
                this._velocity.addInPlace(direction);
                this._velocity.normalize();
                this._velocity.scaleInPlace(speed);
            }
            
            this._lastHazard = collisionId;
        }
        collisionId = this.checkHazardCollision("poison"); 
        if (collisionId != -1 && collisionId != this._lastHazard)
        {
            this._velocity.set(0.0, 0.0, 0.0);
            this._lastHazard = collisionId;
            this._slowHitTime = (new Date).getTime();
            this._velocityFactor = 0.1;
            this._state = "slow";
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

        
        KartEngine.instance.assets.engineSound.setVolume(Scalar.Lerp(KartEngine.instance.assets.engineSound.getVolume(),this.getForward(), 0.1))
        this._velocity.addInPlace(this.forward.scale(this.getForward() * Kart.FORWARD_VELOCITY_SCALAR * this._velocityFactor * this._deltaTime));

        this._velocity.subtractInPlace(this.forward.scale(this.getBack() * this._deltaTime));

        this._velocity.scaleInPlace(1.0 - (this.getBrake() * Kart.BRAKE_SCALAR * this._deltaTime));
    }

    private updateFromTrackProgress(): void {
        let i = 0
        let hit = false;
        let kartPos = this.position;

        let x = Math.abs(kartPos.x - this._checkpoints[this._hits].x);
        let y = Math.abs(kartPos.y - this._checkpoints[this._hits].y);
        let z = Math.abs(kartPos.z - this._checkpoints[this._hits].z);
        let rad = 8;

        if(x < rad && y < rad && z < rad)
        {
            this._hits++;
        }
    }

    private beforeRenderUpdate(): void {
        this._deltaTime = Engine.Instances[0].getDeltaTime() / 1000.0;
        
        if ((this._state == "exploded" && (new Date).getTime() - this._bombHitTime > Kart.BOMB_DURATION)
        || (this._state == "fast" && (new Date).getTime() - this._boostHitTime > Kart.BOOST_DURATION)
        || (this._state == "slow" && (new Date).getTime() - this._slowHitTime > Kart.SLOW_DURATION))
        {
            this._velocityFactor = 1;
            this._state = "ok";
        }

        if(this._hits < this._checkpoints.length)
        {
            this.updateFromTrackProgress();
        }
     
        this.updateFromPhysics();
        this.updateFromHazards();

        if (this._state != "exploded")
        {
            this.updateFromControls();
        }
        
        this._velocity.scaleInPlace(1.0 - (Kart.VELOCITY_DECAY_SCALAR * this._deltaTime));
        this._relocity *= (1.0 - (Kart.TURN_DECAY_SCALAR * this._deltaTime));
    
        this.position.addInPlace(this._velocity);
    }

    private setup3rdPersonKartCamera() {
        this._camera = new FreeCamera(this.name + "_camera", new Vector3(0, 4, -8), this.getScene());
        this._camera.setTarget(this.position.add(this.forward.scale(10.0)));
        this._camera.parent = this;
        this.getScene().activeCamera = this._camera;
    }

    public reset(){
        this._hits = 0;
        this._state = "ok";
        this._velocity.set(0,0,0);
        this._velocityFactor = 1;
        this.position = this._initialPosition;
        this.lookAt(this._initialLookAt);
        this.computeWorldMatrix();
    }
}

