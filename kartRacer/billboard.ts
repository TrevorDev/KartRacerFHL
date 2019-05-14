import * as BABYLON from 'babylonjs'
import 'babylonjs-loaders';
import * as GUI from 'babylonjs-gui';
import { KartEngine } from './engine';
import { FreeCamera } from 'babylonjs';

export class Billboard
{
    private _root : BABYLON.Mesh;
    public static startGame : boolean = false;

    constructor (startPos : BABYLON.Vector3, startRotate : BABYLON.Vector3, kartEngine : KartEngine, camera : FreeCamera)
    {
        var root = new BABYLON.Mesh("billboard", kartEngine.scene)

        var guiPlane = BABYLON.Mesh.CreatePlane("guiPlane", 6, kartEngine.scene)
        guiPlane.position.set(0, 10, 10);
        guiPlane.material = new BABYLON.StandardMaterial("", kartEngine.scene)

        var mainMenuGUI = GUI.AdvancedDynamicTexture.CreateForMesh(guiPlane);

        var stackPanel = new GUI.StackPanel();
        stackPanel.top = "100px";
        mainMenuGUI.addControl(stackPanel);

        var button1 = GUI.Button.CreateSimpleButton("but1", "Start Game");
        button1.width = 1;
        button1.height = "100px";
        button1.color = "white";
        button1.fontSize = 50;
        button1.background = "green"
        stackPanel.addControl(button1);

        var billBoardBase = BABYLON.Mesh.CreateBox("base", 1, kartEngine.scene)
        billBoardBase.scaling.y = 10;
        billBoardBase.position.set(0,5,10.51)

        var billBoardPanel = BABYLON.Mesh.CreateBox("billboardPanel",1, kartEngine.scene)
        billBoardPanel.scaling.x = 12;
        billBoardPanel.scaling.y = 6;
        billBoardPanel.position.set(0,10,10.51)

        button1.onPointerUpObservable.add(function() {
            var startRot = camera.rotationQuaternion.clone();
            var oldPos = camera.position.clone()
            camera.position.copyFrom(startPos)
            camera.setTarget(startRotate)
            camera.computeWorldMatrix()
            var targetRot = camera.rotationQuaternion.clone()
            camera.position.copyFrom(oldPos)
            camera.rotationQuaternion.copyFrom(startRot)
            camera.computeWorldMatrix()

            var bezierEase = new BABYLON.BezierCurveEase(0.5, 0, 0.5, 1);
            BABYLON.Animation.CreateAndStartAnimation("moveCamera", 
                camera, "position", 60, 120, camera.position, startPos, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT, bezierEase);
                
            BABYLON.Animation.CreateAndStartAnimation("rotateCamera", 
                camera, "rotationQuaternion", 60, 120, camera.rotationQuaternion, targetRot, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT, bezierEase);

            Billboard.startGame = true;
        });

        // Set elements as children of root
        guiPlane.setParent(root);
        billBoardBase.setParent(root);
        billBoardPanel.setParent(root);

        this._root = root
    }

    public getBillBoardMesh() : BABYLON.Mesh
    {
        return this._root;
    }
}