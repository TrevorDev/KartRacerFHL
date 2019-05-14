import { IKartInput } from "./input";
import { KartEngine } from "./engine";
import { Mesh, Scene, Vector3, Matrix, FreeCamera, TransformNode } from "@babylonjs/core";

export class Kart extends TransformNode {
    private _mesh: Mesh;
    private _locallyOwned: boolean;
    private _input: IKartInput;

    // Physics model related accessors.
    public topSpeed: number = 10;
    public turnSpeed: number = Math.PI / 4;

    constructor(kartName: string, scene: Scene, locallyOwned: boolean = true) {
        super(kartName, scene);

        // this is a placeholder so that we actually spawn a Kart on game start.
        this._mesh = KartEngine.instance.assets.kart.clone();
        KartEngine.instance.scene.addMesh(this._mesh)
        this._mesh.parent = this;
        this._locallyOwned = locallyOwned;

        // If this is the local player's cart setup a follow camera
        // this can probably be refactored out of Kart.
        if (this._locallyOwned) {
            this.setup3rdPersonKartCamera();
            scene.onBeforeRenderObservable.add(() => {
                // stubbed for testing Input system.
                if (this._input) {
                    // http://www.html5gamedevs.com/topic/32934-multiply-a-vector3-times-a-quaternion/
                    // calculate our differential turn for this frame
                    var dTurn = new Vector3(0, this.turnSpeed * this._input.horizontal * scene.getEngine().getDeltaTime() * .001, 0);
                    // calculate the resulting rotation after this turn.
                    var matrix = Matrix.RotationYawPitchRoll(this.rotation.y + dTurn.y, this.rotation.x + dTurn.x, this.rotation.z + dTurn.z);
                    // calculate the differential position by using our current speed, and the current accelerator value from input (assuming we have an identity transform)
                    var dPosition = new Vector3(0, 0, this._input.accelerate * this.topSpeed).scale(scene.getEngine().getDeltaTime() * .001)

                    // multiply our resulting orientation by our differntial change in position to get the "real" change in position relative to our transform.
                    dPosition = Vector3.TransformNormal(dPosition, matrix);

                    // if we are actually moving this frame, turn the vehicle.
                    if (dPosition.length() > 0) {
                        this.rotation.addInPlace(dTurn);
                    }
                    // finally apply the difference in position.
                    this.position.addInPlace(dPosition);
                }
            });
            this._input = KartEngine.instance.inputSource;
        }
    }

    private setup3rdPersonKartCamera() {
        var camera = new FreeCamera(this.name + "_camera", new Vector3(0, 1.5, -5), this.getScene());
        camera.setTarget(this.position);
        camera.parent = this;
        this.getScene().activeCamera = camera;
    }
}