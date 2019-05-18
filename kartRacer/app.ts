import { KartEngine } from "./engine";
import { Track, ITrackPoint } from './track';
import { Vector3, Quaternion, FreeCamera, Mesh, CubeMapToSphericalPolynomialTools, StandardMaterial, DirectionalLight, CubeTexture, EnvironmentHelper, Color3, Tools } from "@babylonjs/core";
import { Multiplayer } from "./multiplayer";
import { Billboard } from "./billboard";
import { Menu } from './menu';

// Create game engine
var kartEngine = new KartEngine();
var menu: Menu = null;

var main = async () => {
    await kartEngine.initializeFullSceenApp();

    var track = new Track(kartEngine.scene, {
        radius: 200,
        numPoints: 16,
        varianceSeed: 1,
        lateralVariance: 50,
        heightVariance: 20,
        width: 35,
        height: 5
    });

    const environmentTexture = CubeTexture.CreateFromPrefilteredData("public/environment/environment.env", kartEngine.scene);
    environmentTexture.rotationY = Tools.ToRadians(45);
    kartEngine.scene.createDefaultSkybox(environmentTexture, true, 1000);
    kartEngine.scene.environmentTexture.level = 0.5;
    const light = new DirectionalLight("light", new Vector3(1, -2, 0), kartEngine.scene);
    light.intensity = 2.0;

    const offset = new Vector3(0, 4, 0);
    var camera = new FreeCamera("camera", new Vector3(0, 10, 3), kartEngine.scene);
    camera.rotationQuaternion = new Quaternion();
    kartEngine.scene.activeCamera = camera;

    // Set Starting Position and Move to Track
    var startingPosition = track.startPoint.add(offset);
    var startingRotation = track.startTarget.add(offset);
    var billboard = new Billboard(startingPosition, startingRotation, kartEngine, camera);
    var bb = billboard.getBillBoardMesh();

    // Multiplayer
    var multiplayer = new Multiplayer(kartEngine.scene);

    var gameStarted = false;
  
    billboard.onGameStartObservable.addOnce(()=>{
        let checkpoints : ITrackPoint[] = track.trackPoints.slice(1,track.trackPoints.length-1); 
        checkpoints[0] = track.trackPoints[track.trackPoints.length - 1];
        let cv : Vector3[] = []

        checkpoints.forEach(value => {
            cv.push(value.point);
        });

        kartEngine.kart.initializeTrackProgress(cv, startingPosition, startingRotation);

        let camera = kartEngine.kart.activateKartCamera();
        menu = new Menu(camera, kartEngine.scene);
        kartEngine.kart.PlayerMenu = menu;
        kartEngine.kart.reset();

        // Save racer name to local storage
        const racerName = billboard.getRacerName();
        localStorage.setItem("KartRacer.PlayerName", racerName);

        // Initialize Multiplayer
        multiplayer.connectToRoom("testRoom", racerName, kartEngine.kart);
        multiplayer.trackedObject = camera;
        
        menu.EnableHud();
        kartEngine.kart.assignKartName(racerName);
        gameStarted = true;
    })

    // Main render loop
    kartEngine.scene.onBeforeRenderObservable.add(() => {
        if (gameStarted) {
            multiplayer.update();
            menu.UpdateHUD(kartEngine.kart.getTrackComplete());
            if (kartEngine.kart.getTrackComplete() == 100 && kartEngine.kart.TrackTime.length == 0) {
                kartEngine.kart.TrackTime = menu.StopTimer();
            }

            if(kartEngine.kart.getTrackComplete() == 100){
                multiplayer.raceComplete(kartEngine.kart.getKartName());
            }
        }
    })
}
main();
