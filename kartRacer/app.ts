import { Kart } from './kart';
import { KartEngine } from "./engine";
import { Track } from './track';
import { Vector3, Quaternion, FreeCamera } from "@babylonjs/core";
import { Multiplayer } from "./multiplayer";
import { Billboard } from "./billboard";
import { Menu } from './menu';

// Create game engine
var kartEngine = new KartEngine();
var initMP = false;
var menu : Menu = null;

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
    camera.rotationQuaternion = new Quaternion();
    camera.setTarget(track.startTarget.add(offset));
    camera.attachControl(kartEngine.canvas);
    camera.minZ = 0.01;
    camera.maxZ = 1000;
    camera.speed = 2;

    kartEngine.scene.createDefaultLight(true);

    // Set Starting Position and Move to Track
    var startingPosition = track.startPoint.add(offset);
    var startingRotation = track.startTarget.add(offset);
    var billboard = new Billboard(startingPosition, startingRotation, kartEngine, camera);
    var bb = billboard.getBillBoardMesh();

    // Multiplayer
    var multiplayer = new Multiplayer(kartEngine.scene);

    // Main render loop
    kartEngine.scene.onBeforeRenderObservable.add(() => {
        if (Billboard.startGame && !initMP) {
            // Initialize Multiplayer

            let camera = kartEngine.kart.activateKartCamera();
            kartEngine.kart.position = startingPosition;

            multiplayer.connectToRoom("testRoom", kartEngine.kart);
            multiplayer.trackedObject = camera;

            initMP = true;
            menu = new Menu(camera, kartEngine.scene);
            menu.EnableHud();

            menu.StartTimer();
        }
        else if (Billboard.startGame && initMP) {
            multiplayer.update();
            menu.UpdateHUD();
        }
    })
}
main();
