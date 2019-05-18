import "@babylonjs/core/Debug/debugLayer";
import "@babylonjs/inspector";
import { Vector3, DirectionalLight, CubeTexture, Tools, Scene, Engine } from "@babylonjs/core";
import { Billboard } from "./billboard";
import { Kart } from "./kart";
import { IKartInput, KartInput } from "./input";
import { Assets } from "./assets";
import { Multiplayer } from "./multiplayer";
import { Track } from "./track";
import { Menu } from "./menu";


class App {
    private _scene: Scene;
    private _assets: Assets;
    private _input: IKartInput;
    private _mainKart: Kart;

    constructor() {
        const canvas = this._createCanvas();

        // Initialize Babylon scene and engine
        const engine = new Engine(canvas, true);
        engine.enableOfflineSupport = false;
        this._scene = new Scene(engine);

        // Load environment
        const environmentTexture = CubeTexture.CreateFromPrefilteredData("public/environment/environment.env", this._scene);
        environmentTexture.rotationY = Tools.ToRadians(45);
        this._scene.createDefaultSkybox(environmentTexture, true, 1000);
        this._scene.environmentTexture.level = 0.5;
        const light = new DirectionalLight("light", new Vector3(1, -2, 0), this._scene);
        light.intensity = 2.0;

        window.addEventListener("resize", () => {
            engine.resize();
        })

        window.addEventListener("keydown", (ev) => {
            // Shift+Ctrl+Alt+I
            if (ev.shiftKey && ev.ctrlKey && ev.altKey && ev.keyCode === 73) {
                if (this._scene.debugLayer.isVisible()) {
                    this._scene.debugLayer.hide();
                }
                else {
                    this._scene.debugLayer.show();
                }
            }
        });

        this._assets = new Assets();
        this._input = new KartInput(this._scene);
        this._initializeAsync();
    }

    private _createCanvas(): HTMLCanvasElement {
        // Get rid of margin
        document.documentElement.style["overflow"] = "hidden";
        document.documentElement.style.overflow = "hidden";
        document.documentElement.style.width = "100%";
        document.documentElement.style.height = "100%";
        document.documentElement.style.margin = "0";
        document.documentElement.style.padding = "0";
        document.body.style.overflow = "hidden";
        document.body.style.width = "100%";
        document.body.style.height = "100%";
        document.body.style.margin = "0";
        document.body.style.padding = "0";

        // Create canvas html element on webpage
        const canvas = document.createElement("canvas");
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        document.body.appendChild(canvas);

        return canvas;
    }

    private async _initializeAsync(): Promise<void> {
        const engine = this._scene.getEngine();

        engine.displayLoadingUI();

        await this._assets.loadAsync(this._scene);

        this._mainKart = new Kart("player_kart", this._scene, this._assets, true, this._input);

        const billboard = new Billboard(this._scene, this._assets);
        const multiplayer = new Multiplayer(this._scene, this._assets, this._mainKart);

        await this._scene.whenReadyAsync();

        engine.hideLoadingUI();

        engine.runRenderLoop(() => {
            this._scene.render();
        });

        billboard.onGameStartObservable.add(async () => {
            // Save racer name to local storage
            const racerName = billboard.racerName;
            localStorage.setItem("KartRacer.PlayerName", racerName);

            engine.displayLoadingUI();

            const serverInfo = await multiplayer.connectAsync("testRoom", racerName, this._mainKart);

            const track = new Track(this._scene, this._assets, {
                radius: 200,
                numPoints: 16,
                varianceSeed: serverInfo.varianceSeed,
                lateralVariance: 50,
                heightVariance: 20,
                width: 35,
                height: 5
            });

            const checkpoints = track.trackPoints.map(value => value.point);
            this._mainKart.initializeTrackProgress(checkpoints, track.startPoint, track.startTarget);

            const camera = this._mainKart.activateKartCamera();
            const menu = new Menu(camera, this._scene, this._assets);
            this._mainKart.PlayerMenu = menu;
            this._mainKart.reset();
            this._mainKart.kartName = racerName;
            menu.EnableHud();

            await this._scene.whenReadyAsync();

            engine.hideLoadingUI();

            // Main render loop
            this._scene.onBeforeRenderObservable.add(() => {
                multiplayer.update();

                const trackProgress = this._mainKart.trackProgress;
                menu.UpdateHUD(trackProgress);

                if (trackProgress === 100) {
                    if (this._mainKart.TrackTime.length == 0) {
                        this._mainKart.TrackTime = menu.StopTimer();
                    }

                    multiplayer.raceComplete(this._mainKart.kartName);
                }
            })
        });
    }
}

new App();
