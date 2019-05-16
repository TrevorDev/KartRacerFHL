import { Kart } from './kart';
import { IKartInput, KartInput_KeyboardAndTouch } from "./input";
import { Assets } from "./assets";
import { Scene, Observable, Engine, FreeCamera, Vector3 } from "@babylonjs/core";

import "@babylonjs/core/Debug/debugLayer";
import "@babylonjs/inspector";

export class KartEngine {
    public static instance: KartEngine;
    public scene: Scene;
    public canvas: HTMLCanvasElement;
    public readonly assets = new Assets();

    public kart: Kart;
    public inputSource: IKartInput;
    public onInputSourceChangedObservable = new Observable<IKartInput>();

    constructor() {
        KartEngine.instance = this;
    }

    async initializeFullSceenApp() {
        // Get rid of margin
        document.documentElement.style["overflow"] = "hidden"
        document.documentElement.style.overflow = "hidden"
        document.documentElement.style.width = "100%"
        document.documentElement.style.height = "100%"
        document.documentElement.style.margin = "0"
        document.documentElement.style.padding = "0"
        document.body.style.overflow = "hidden"
        document.body.style.width = "100%"
        document.body.style.height = "100%"
        document.body.style.margin = "0"
        document.body.style.padding = "0"

        // Create canvas html element on webpage
        this.canvas = document.createElement('canvas')
        this.canvas.style.width = "100%"
        this.canvas.style.height = "100%"

        //canvas = document.getElementById("renderCanvas")
        document.body.appendChild(this.canvas)

        // Initialize Babylon scene and engine
        const engine = new Engine(this.canvas, true, { stencil: true, disableWebGL2Support: false, preserveDrawingBuffer: true })
        engine.enableOfflineSupport = false
        this.scene = new Scene(engine)
        engine.runRenderLoop(() => {
            this.scene.render()
        })
        window.addEventListener("resize", () => {
            engine.resize()
        })

        window.addEventListener("keydown", (ev) => {
            // Shift+Ctrl+Alt+I
            if (ev.shiftKey && ev.ctrlKey && ev.altKey && ev.keyCode === 73) {
                if (this.scene.debugLayer.isVisible()) {
                    this.scene.debugLayer.hide();
                }
                else {
                    this.scene.debugLayer.show();
                }
            }
        });

        // we should determine our running platform and setup default controls accordingly here.
        // stubbed to use keyboard input now.
        this.inputSource = new KartInput_KeyboardAndTouch(this.scene);
        this.onInputSourceChangedObservable.notifyObservers(this.inputSource);

        const camera = new FreeCamera("camera", new Vector3(0, 10, 3), this.scene);
        await this.assets.loadAssets();
        
        this.kart = new Kart("player_kart", this.scene, true);

        // .then(()=>{
        //     var c = assets.kart.clone("clone", null, false);
        //     kartEngine.scene.addMesh(c)
        // })
    }
}