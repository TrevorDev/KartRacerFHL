import * as BABYLON from 'babylonjs'
import 'babylonjs-loaders';
import * as GUI from 'babylonjs-gui';

import { KartEngine } from "./engine";
import { Track } from './track';
import { Vector3 } from 'babylonjs';
import { Multiplayer } from "./multiplayer";


// Create game engine
var kartEngine = new KartEngine();
kartEngine.initializeFullSceenApp();

var track = new Track(kartEngine.scene, {
    radius: 100,
    numPoints: 16,
    varianceSeed: 2,
    lateralVariance: 30,
    heightVariance: 10,
    width: 10,
});

const offset = new Vector3(0, 0.5, 0);
var camera = new BABYLON.FreeCamera("camera", track.startPoint.add(offset), kartEngine.scene);
camera.rotationQuaternion = new BABYLON.Quaternion()
camera.setTarget(track.startTarget.add(offset));
camera.attachControl(kartEngine.canvas);
camera.minZ = 0.01;
camera.maxZ = 1000;
camera.speed = 1;

// var env = kartEngine.scene.createDefaultEnvironment()
// env.setMainColor(new BABYLON.Color3(0.1, 0.4, 0.6))

kartEngine.scene.createDefaultLight(true);

// Multiplayer
var multiplayer = new Multiplayer(kartEngine.scene);
multiplayer.connectToRoom("testRoom");
multiplayer.trackedObject = camera;

// Main render loop
kartEngine.scene.onBeforeRenderObservable.add(() => {
    multiplayer.update()
})

var createBillBoardGUI = () => {
    var root = new BABYLON.Mesh("billboard", kartEngine.scene)

    var guiPlane = BABYLON.Mesh.CreatePlane("guiPlane", 6, kartEngine.scene)
    guiPlane.position.set(0, 10, 10);
    guiPlane.material = new BABYLON.StandardMaterial("", kartEngine.scene)

    console.log(GUI)
    // BABYLON.engine.SceneLoader.LoadAssetContainer("https://models.babylonjs.com/", "fish.glb", engine.scene, function (container) {
    //     // Scale and position the loaded model (First mesh loaded from gltf is the root node)
    //     container.meshes[0].scaling.scaleInPlace(0.1)
    //     container.meshes[0].position.z = 5
    //     container.meshes[0].position.y = -1

    //     // Add loaded file to the engine.scene
    //     container.addAllToengine.Scene();
    // });

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

    button1.onPointerUpObservable.add(function () {
        var bezierEase = new BABYLON.BezierCurveEase(0.32, 0.73, 0.69, 1.59);
        //BABYLON.Animation.CreateAndStartAnimation("moveCamera", camera, "position", 60, 60, camera.position, startingLine.position.add(new BABYLON.Vector3(0, 3, -30)), BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT, bezierEase);

        console.log("click!")
    });



    var billBoardBase = BABYLON.Mesh.CreateBox("base", 1, kartEngine.scene)
    billBoardBase.scaling.y = 10;
    billBoardBase.position.set(0, 5, 0)

    return root
}

var bb = createBillBoardGUI();

