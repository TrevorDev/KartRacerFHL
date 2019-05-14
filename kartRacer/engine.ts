import * as BABYLON from 'babylonjs'
import 'babylonjs-loaders';
import * as GUI from 'babylonjs-gui';
import { SceneComponentConstants } from 'babylonjs';
import {IKartInput, KartInput_Keyboard} from './input'
import { Assets } from './assets';

export class KartEngine {
    static instance: KartEngine
    scene: BABYLON.Scene
    canvas: HTMLCanvasElement
    assets = new Assets();


    inputSource: IKartInput
    OnInputSourceChangedObservable = new BABYLON.Observable<IKartInput>();
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
        var engine = new BABYLON.Engine(this.canvas, true, { stencil: true, disableWebGL2Support: false, preserveDrawingBuffer: true })
        engine.enableOfflineSupport = false
        this.scene = new BABYLON.Scene(engine)
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
        this.inputSource = new KartInput_Keyboard(this.scene);
        this.OnInputSourceChangedObservable.notifyObservers(this.inputSource);

        var camera = new BABYLON.FreeCamera("camera", new BABYLON.Vector3(0, 10, 3), this.scene);
        await this.assets.loadAssets()
        
        // .then(()=>{
        //     var c = assets.kart.clone("clone", null, false);
        //     kartEngine.scene.addMesh(c)
        // })
    }
}