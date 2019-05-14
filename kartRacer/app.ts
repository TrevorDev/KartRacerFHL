import * as BABYLON from 'babylonjs'
import 'babylonjs-loaders';
import * as GUI from 'babylonjs-gui';

import {KartEngine} from "./engine";
import {Multiplayer} from "./multiplayer"

// Create game engine
var kartEngine = new KartEngine();
kartEngine.initializeFullSceenApp();

// Lights and camera
var camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0, 10, 3), kartEngine.scene)
camera.rotationQuaternion = new BABYLON.Quaternion()
camera.attachControl(kartEngine.canvas, true)
var light = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(0, 1, 0), kartEngine.scene)
light.intensity = 0.7

var ground = BABYLON.MeshBuilder.CreateGround("ground", {width: 1000, height: 1000}, kartEngine.scene);

// Starting Reference Point; Remove when Starting Point Vector is available
var startingLine = BABYLON.Mesh.CreateBox("start box", 1, kartEngine.scene)
startingLine.position.z = -30
startingLine.position.y = 0;
startingLine.position.x = 5;

var env = kartEngine.scene.createDefaultEnvironment()
env.setMainColor(new BABYLON.Color3(0.1, 0.4,0.6))

kartEngine.scene.createDefaultLight(true)

var uvTexture = new BABYLON.Texture("/public/images/uv.png", kartEngine.scene)

var uvMat = new BABYLON.StandardMaterial("", kartEngine.scene)
uvMat.diffuseTexture = uvTexture
ground.material = uvMat

// Multiplayer
var multiplayer = new Multiplayer(kartEngine.scene);
multiplayer.connectToRoom("testRoom")
multiplayer.trackedObject = camera;

// Main render loop
kartEngine.scene.onBeforeRenderObservable.add(()=>{
    multiplayer.update()
})

var createBillBoardGUI = (startPos : BABYLON.Vector3)=>{
    var root = new BABYLON.Mesh("billboard", kartEngine.scene)
    
    var guiPlane = BABYLON.Mesh.CreatePlane("guiPlane", 6, kartEngine.scene)
    guiPlane.position.set(0,10,10);
    guiPlane.material = new BABYLON.StandardMaterial("",kartEngine.scene)

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
    var button2 = GUI.Button.CreateSimpleButton("but2", "End Game");
    button2.width = 1;
    button2.height = "100px";
    button2.color = "white";
    button2.fontSize = 50;
    button2.background = "green"
    stackPanel.addControl(button2);

    var billBoardBase = BABYLON.Mesh.CreateBox("base", 1, kartEngine.scene)
    billBoardBase.scaling.y = 10;
    billBoardBase.position.set(0,5,10.51)

    var billBoardPanel = BABYLON.Mesh.CreateBox("billboardPanel",1, kartEngine.scene)
    billBoardPanel.scaling.x = 12;
    billBoardPanel.scaling.y = 6;
    billBoardPanel.position.set(0,10,10.51)

    button1.onPointerUpObservable.add(function() {
        var bezierEase = new BABYLON.BezierCurveEase(0.5, 0, 0.5, 1);
        BABYLON.Animation.CreateAndStartAnimation("moveCamera", 
            camera, "position", 60, 120, camera.position, startPos, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT, bezierEase);
    });

    return root
}

// Set Starting Position and Move to Track
var startingPosition = startingLine.position.add(new BABYLON.Vector3(0, 3, 0));
var bb = createBillBoardGUI(startingPosition);