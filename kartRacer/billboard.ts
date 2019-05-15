import { KartEngine } from "./engine";
import { Animation, FreeCamera, Mesh, Vector3, StandardMaterial, BezierCurveEase, Texture } from "@babylonjs/core";
import { AdvancedDynamicTexture, StackPanel, Button, InputText } from "@babylonjs/gui";

export class Billboard {
    private _root: Mesh;
    private _racerName: InputText;

    public static startGame: boolean = false;

    constructor(startPos: Vector3, startRotate: Vector3, kartEngine: KartEngine, camera: FreeCamera) {
        var root = new Mesh("billboard", kartEngine.scene)

        var guiPlane = Mesh.CreatePlane("guiPlane", 6, kartEngine.scene);
        guiPlane.position.set(0, 10, 10-0.2);
        guiPlane.material = new StandardMaterial("GUI", kartEngine.scene);

        var imagePlane = Mesh.CreatePlane("imagePlane", 5, kartEngine.scene);
        imagePlane.scaling.x = 1.8	
        imagePlane.position.set(0, 10, 10-0.1);	
        imagePlane.material = new StandardMaterial("", kartEngine.scene);	
        (imagePlane.material as any).diffuseTexture = (imagePlane.material as any).emissiveTexture = new Texture("/public/textures/logo.png", kartEngine.scene);

        var mainMenuGUI = AdvancedDynamicTexture.CreateForMesh(guiPlane);

        var stackPanel = new StackPanel();
        stackPanel.top = "200px";
        mainMenuGUI.addControl(stackPanel);

        var racerName = new InputText("rName");
        racerName.width = 1;
        racerName.height = "100px";
        racerName.placeholderText = "Enter racer name...";
        racerName.fontSize = 50;
        racerName.color = "black";
        racerName.background = "white";
        racerName.focusedBackground = "white";
        stackPanel.addControl(racerName);

        var button1 = Button.CreateSimpleButton("but1", "Start Game");
        button1.width = 1;
        button1.height = "100px";
        button1.color = "white";
        button1.fontSize = 50;
        button1.background = "green"
        stackPanel.addControl(button1);

        var billBoardBase = Mesh.CreateBox("base", 1, kartEngine.scene)
        billBoardBase.scaling.y = 10;
        billBoardBase.position.set(0, 5, 10.51)

        var billBoardPanel = Mesh.CreateBox("billboardPanel", 1, kartEngine.scene)
        billBoardPanel.scaling.x = 12;
        billBoardPanel.scaling.y = 6;
        billBoardPanel.position.set(0, 10, 10.51)

        button1.onPointerUpObservable.add(function () {
            /*var startRot = camera.rotationQuaternion.clone();
            var oldPos = camera.position.clone()
            camera.position.copyFrom(startPos)
            camera.setTarget(startRotate)
            camera.computeWorldMatrix()
            var targetRot = camera.rotationQuaternion.clone()
            camera.position.copyFrom(oldPos)
            camera.rotationQuaternion.copyFrom(startRot)
            camera.computeWorldMatrix()

            var bezierEase = new BezierCurveEase(0.5, 0, 0.5, 1);
            Animation.CreateAndStartAnimation("moveCamera",
                camera, "position", 60, 120, camera.position, startPos, Animation.ANIMATIONLOOPMODE_CONSTANT, bezierEase);

            Animation.CreateAndStartAnimation("rotateCamera",
                camera, "rotationQuaternion", 60, 120, camera.rotationQuaternion, targetRot, Animation.ANIMATIONLOOPMODE_CONSTANT, bezierEase);*/

            Billboard.startGame = true;
        });

        // Set elements as children of root
        guiPlane.setParent(root);
        billBoardBase.setParent(root);
        billBoardPanel.setParent(root);

        this._racerName = racerName;
        this._root = root
    }

    public getBillBoardMesh(): Mesh {
        return this._root;
    }

    public getRacerName(): string
    {
        if(this._racerName.text.length == 0)
        {
            return "Kart with No Name";
        }
        return this._racerName.text;
    }
}