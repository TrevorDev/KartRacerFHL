import { KartEngine } from "./engine";
import { Track } from './track';
import { Animation, Vector3, Quaternion, FreeCamera, Mesh, StandardMaterial, Texture, BezierCurveEase } from "@babylonjs/core";
import { AdvancedDynamicTexture, StackPanel, Button } from "@babylonjs/gui";
import { Multiplayer } from "./multiplayer";

// Create game engine
var kartEngine = new KartEngine();

var main = async () => {
    await kartEngine.initializeFullSceenApp();

    var track = new Track(kartEngine.scene, {
        radius: 200,
        numPoints: 16,
        varianceSeed: 1,
        lateralVariance: 50,
        heightVariance: 20,
        width: 25,
    });


    const offset = new Vector3(0, 0.5, 0);
    var camera = new FreeCamera("camera", new Vector3(0, 10, 3), kartEngine.scene);
    camera.rotationQuaternion = new Quaternion()
    camera.setTarget(track.startTarget.add(offset));
    camera.attachControl(kartEngine.canvas);
    camera.minZ = 0.01;
    camera.maxZ = 1000;
    camera.speed = 2;

    kartEngine.scene.createDefaultLight(true);

    // Multiplayer
    var multiplayer = new Multiplayer(kartEngine.scene);
    multiplayer.connectToRoom("testRoom");
    multiplayer.trackedObject = camera;

    // Main render loop
    kartEngine.scene.onBeforeRenderObservable.add(() => {
        multiplayer.update()
    })

    var createBillBoardGUI = (startPos: Vector3, startRotate: Vector3) => {
        var root = new Mesh("billboard", kartEngine.scene)

        var guiPlane = Mesh.CreatePlane("guiPlane", 6, kartEngine.scene)
        guiPlane.position.set(0, 10, 10 - 0.2);
        guiPlane.material = new StandardMaterial("", kartEngine.scene)

        var imagePlane = Mesh.CreatePlane("imagePlane", 5, kartEngine.scene)
        imagePlane.scaling.x = 1.8
        imagePlane.position.set(0, 10, 10 - 0.1);
        imagePlane.material = new StandardMaterial("", kartEngine.scene);
        (imagePlane.material as any).diffuseTexture = (imagePlane.material as any).emissiveTexture = new Texture("/public/textures/logo.png", kartEngine.scene);

        var mainMenuGUI = AdvancedDynamicTexture.CreateForMesh(guiPlane);

        var stackPanel = new StackPanel();
        stackPanel.top = "100px";
        mainMenuGUI.addControl(stackPanel);

        var button1 = Button.CreateSimpleButton("but1", "Start Game");
        button1.width = 1;
        button1.height = "100px";
        button1.color = "white";
        button1.fontSize = 50;
        button1.background = "green"
        stackPanel.addControl(button1);

        var billBoardBase = Mesh.CreateBox("base", 1, kartEngine.scene)
        billBoardBase.scaling.y = 10;
        billBoardBase.position.set(0, 5, 10.53)

        var billBoardPanel = Mesh.CreateBox("billboardPanel", 1, kartEngine.scene)
        billBoardPanel.scaling.x = 12;
        billBoardPanel.scaling.y = 6;
        billBoardPanel.position.set(0, 10, 10.53)

        button1.onPointerUpObservable.add(function () {
            // var a = Mesh.CreateBox("base", 0.1, kartEngine.scene)
            // var b = Mesh.CreateBox("base", 0.1, kartEngine.scene)
            // a.position.copyFrom(startPos)
            // b.position.copyFrom(startRotate)


            var startRot = camera.rotationQuaternion.clone();
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
                camera, "rotationQuaternion", 60, 120, camera.rotationQuaternion, targetRot, Animation.ANIMATIONLOOPMODE_CONSTANT, bezierEase);
            // Animation.CreateAndStartAnimation("rotateCamera", 
            // camera, "rotation", 60, 120, camera.rotationQuater, startRotate, Animation.ANIMATIONLOOPMODE_CONSTANT, bezierEase);
        });

        // Set elements as children of root
        guiPlane.setParent(root);
        billBoardBase.setParent(root);
        billBoardPanel.setParent(root);

        return root
    }

    // Set Starting Position and Move to Track
    var startingPosition = track.startPoint.add(offset)
    var startingRotation = track.startTarget.add(offset)
    var bb = createBillBoardGUI(startingPosition, startingRotation);
}
main();
