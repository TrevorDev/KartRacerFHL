import * as BABYLON from 'babylonjs'
import {IKartInput, KartInput_Keyboard} from 'input'
import { CameraInputTypes, _BabylonLoaderRegistered, Vector3 } from 'babylonjs';
import {KartEngine} from './engine'
import { InputManager } from 'babylonjs/Inputs/scene.inputManager';

export class Kart extends BABYLON.TransformNode {

    // Owned components and input
    private mesh : BABYLON.Mesh;
    private scene : BABYLON.Scene;
    private camera : BABYLON.Camera;
    private locallyOwned : boolean
    private input : IKartInput;

    // Physics model related accessors.
    public topSpeed : number = 10;
    public turnSpeed : number = Math.PI/4;

    constructor(kartName: string, scene: BABYLON.Scene, locallyOwned: boolean = true){
        super(kartName, scene);

        // this is a placeholder so that we actually spawn a Kart on game start.
        this.mesh = BABYLON.Mesh.CreateBox(kartName + "_mesh", 1, scene);
        this.mesh.parent = this;
        this.locallyOwned = locallyOwned;
        this.scene = scene;

        // If this is the local player's cart setup a follow camera
        // this can probably be refactored out of Kart.
        if(this.locallyOwned){
            this.setup3rdPersonKartCamera();
            console.log(this.camera.getClassName());
            scene.onBeforeRenderObservable.add(() => {
                // stubbed for testing of follow camera.
                if(this.input){
                    // http://www.html5gamedevs.com/topic/32934-multiply-a-vector3-times-a-quaternion/
                    console.log("Input:\n" + "Horizontal: " + this.input.horizontal + "\nAccelerate: " + this.input.accelerate + "\nBrake: " + this.input.brake + "\nDrift: " + this.input.drift);
                    // calculate our differential turn for this frame
                    var dTurn = new BABYLON.Vector3(0,this.turnSpeed*this.input.horizontal*scene.getEngine().getDeltaTime()*.001,0);
                    // calculate the resulting rotation after this turn.
                    var rotationQuat = BABYLON.Quaternion.FromEulerAngles(this.rotation.x + dTurn.x, this.rotation.y + dTurn.y, this.rotation.z + dTurn.z);
                    var matrix = BABYLON.Matrix.Identity();
                    BABYLON.Matrix.FromQuaternionToRef(rotationQuat, matrix);
                    // calculate the differential position by using our current speed, and the current accelerator value from input (assuming we have an identity transform)
                    var dPosition = new BABYLON.Vector3(0, 0, this.input.accelerate * this.topSpeed).scale(scene.getEngine().getDeltaTime()*.001)

                    // multiply our resulting orientation by our differntial change in position to get the "real" change in position relative to our transform.
                    dPosition = BABYLON.Vector3.TransformNormal(dPosition, matrix);
                    
                    // if we are actually moving this frame, turn the vehicle.
                    if(dPosition.length() > 0){
                        this.rotation = this.rotation.add(dTurn);
                    }
                    // finally apply the difference in position.
                    this.position = this.position.add(dPosition);
                }
            });
            this.input = KartEngine.instance.inputSource;
        }
    }

    private setup3rdPersonKartCamera(){
        var camera = new BABYLON.FreeCamera(this.name + "_camera", new BABYLON.Vector3(0, 1.5, -5), this.scene);
        camera.setTarget(this.position);
        camera.parent = this;
        this.scene.activeCamera = camera;
        this.camera = camera;
    }
}