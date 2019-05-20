import "@babylonjs/core/Debug/debugLayer";
import "@babylonjs/inspector";
import { Vector3, DirectionalLight, CubeTexture, Tools, Scene, Engine, Observer, Nullable } from "@babylonjs/core";
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
    private _track: Track;

    constructor() {
        const canvas = this._createCanvas();

        // Initialize Babylon scene and engine
        const engine = new Engine(canvas, true);
        engine.enableOfflineSupport = false;
        this._scene = new Scene(engine);

        // Load environment
        const environmentTexture = CubeTexture.CreateFromPrefilteredData("public/environment/environment.env", this._scene);
        environmentTexture.rotationY = Tools.ToRadians(45);
        this._scene.createDefaultSkybox(environmentTexture, true, 1000, 0.2);
        const light = new DirectionalLight("light", new Vector3(1, -2, 0), this._scene);
        light.intensity = 3.0;

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

            const raceInfo = await multiplayer.connectAsync("testRoom", racerName, this._mainKart);

            multiplayer.onNewRaceObservable.add(async (newRaceInfo) => {
                engine.displayLoadingUI();

                this._newRace(newRaceInfo.trackVarianceSeed);

                await this._scene.whenReadyAsync();
                engine.hideLoadingUI();
            });

            const camera = this._mainKart.activateKartCamera();
            const menu = new Menu(camera, this._scene, this._assets);
            this._mainKart.PlayerMenu = menu;
            this._mainKart.kartName = racerName;
            menu.EnableHud();

            this._newRace(raceInfo.trackVarianceSeed);

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
            });

            await this._scene.whenReadyAsync();
            engine.hideLoadingUI();
        });
    }

    private _newRace(varianceSeed: number): void {
        if (this._track) {
            this._track.dispose();
        }

        this._track = new Track(this._scene, this._assets, {
            radius: 200,
            numPoints: 16,
            varianceSeed: varianceSeed,
            lateralVariance: 50,
            heightVariance: 20,
            width: 35,
            height: 5
        });

        const checkpoints = this._track.trackPoints.map(value => value.point);
        const offset = new Vector3(0, 0.5, 0);
        this._mainKart.initializeTrackProgress(checkpoints, this._track.startPoint.add(offset), this._track.startTarget.add(offset));
        this._mainKart.setDeathPositionY(this._track.trackPoints.reduce((p, c) => p.point.y < c.point.y ? p : c).point.y - 0.1);
        this._mainKart.reset();
    }
}

new App();
