import { IKartInput } from "./input";
import { KartEngine } from "./engine";
import { Engine, Mesh, Scene, Vector3, Ray, Quaternion, Matrix, FreeCamera, TransformNode, Camera } from "@babylonjs/core";

export class Kart extends TransformNode {
    private _mesh: Mesh;
    private _camera: FreeCamera;
    private _locallyOwned: boolean;
    private _input: IKartInput;

    private static readonly UP_GROUNDED_FILTER_STRENGTH: number = 7.0;
    private static readonly UP_FALLING_FILTER_STRENGTH: number = 1.0;
    private static readonly MAX_FALL_TIME_SECONDS: number = 3.0;
    private static readonly TURN_FILTER_STRENGTH: number = 0.1;
    private static readonly MAX_TURN_SCALAR: number = Math.PI * 2 / 3;
    private static readonly FORWARD_VELOCITY_SCALAR: number = 3.0;
    private static readonly VELOCITY_DECAY_SCALAR: number = 2.0;
    private static readonly TURN_DECAY_SCALAR: number = 5.0;
    private static readonly BRAKE_SCALAR: number = 3.0;

    private _velocity: Vector3 = Vector3.Zero();
    private _relocity: number = 0.0;
    private _filteredUp: Vector3 = Vector3.Up();
    private _fallTime: number = 0.0;
    private _deltaTime: number = 0.0;
    private _lastSafePosition: Vector3 = Vector3.Zero();
    private _lastSafeFilteredUp: Vector3 = Vector3.Zero();
    private _turnFactor: number = 0.0;

    constructor(kartName: string, scene: Scene, locallyOwned: boolean = true) {
        super(kartName, scene);

        // this is a placeholder so that we actually spawn a Kart on game start.
        this._mesh = KartEngine.instance.assets.kart.clone();
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

    private updateFromPhysics(): void {
        var ray = new Ray(this.position, this.up.scale(-1.0), 0.7);
        var hit = KartEngine.instance.scene.pickWithRay(ray);
        if (hit.hit) {
            var normal = hit.getNormal(true, true);

            // TODO: HACK! It seems the normals of the track are weird, or something, not sure what exactly is going on.
            normal.scaleInPlace(-1.0)

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

        this._velocity.addInPlace(this.forward.scale(this.getForward() * Kart.FORWARD_VELOCITY_SCALAR * this._deltaTime));

        this._velocity.subtractInPlace(this.forward.scale(this.getBack() * this._deltaTime));

        this._velocity.scaleInPlace(1.0 - (this.getBrake() * Kart.BRAKE_SCALAR * this._deltaTime));
    }

    private beforeRenderUpdate(): void {
        this._deltaTime = Engine.Instances[0].getDeltaTime() / 1000.0;
    
        this.updateFromPhysics();
        this.updateFromControls();
        
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
}