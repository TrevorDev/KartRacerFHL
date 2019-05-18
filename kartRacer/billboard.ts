import { Mesh, Texture, Observable, Scene, FreeCamera, Vector3, PBRMaterial } from "@babylonjs/core";
import { AdvancedDynamicTexture, StackPanel, Button, InputText } from "@babylonjs/gui";
import { Assets } from "./assets";

export class Billboard {
    private _racerName: InputText;

    public readonly onGameStartObservable = new Observable<void>();

    constructor(scene: Scene, assets: Assets) {
        const root = new Mesh("billboard", scene)

        const backgroundPlane = Mesh.CreatePlane("backgroundPlane", 5, scene);
        backgroundPlane.scaling.x = 1.8
        backgroundPlane.position.set(0, 10, 10 - 0.1);
        const backgroundMaterial = assets.unlitMaterial.clone("backgroundPlane");
        backgroundMaterial.unlit = true;
        backgroundMaterial.albedoTexture = new Texture("/public/textures/logo.png", scene);
        backgroundPlane.material = backgroundMaterial;
        backgroundPlane.parent = root;

        const guiPlane = Mesh.CreatePlane("guiPlane", 6, scene);
        guiPlane.position.set(0, 10, 10 - 0.2);
        guiPlane.material = assets.unlitMaterial;
        guiPlane.parent = root;

        const mainMenuGUI = AdvancedDynamicTexture.CreateForMesh(guiPlane);

        const stackPanel = new StackPanel();
        stackPanel.top = "200px";
        mainMenuGUI.addControl(stackPanel);

        const racerName = new InputText("racerName");
        racerName.width = 1;
        racerName.height = "100px";
        racerName.placeholderText = "Enter racer name...";
        racerName.fontSize = 50;
        racerName.color = "black";
        racerName.background = "white";
        racerName.focusedBackground = "white";
        stackPanel.addControl(racerName);

        const startButton = Button.CreateSimpleButton("start", "Start Game");
        startButton.width = 1;
        startButton.height = "100px";
        startButton.color = "white";
        startButton.fontSize = 50;
        startButton.background = "green"
        stackPanel.addControl(startButton);

        const billBoardBase = Mesh.CreateBox("base", 1, scene)
        billBoardBase.scaling.y = 10;
        billBoardBase.position.set(0, 5, 10.51);
        billBoardBase.setParent(root);

        const billBoardPanel = Mesh.CreateBox("billboard", 1, scene)
        billBoardPanel.scaling.x = 12;
        billBoardPanel.scaling.y = 6;
        billBoardPanel.position.set(0, 10, 10.51);
        billBoardPanel.setParent(root);

        startButton.onPointerUpObservable.add(() => {
            this.onGameStartObservable.notifyObservers();
        });

        const camera = new FreeCamera("camera", new Vector3(0, 10, 3), scene);
        camera.parent = root;

        scene.activeCamera = camera;

        // Get racer name from local storage if available
        if (typeof localStorage === "object") {
            const value = localStorage.getItem("KartRacer.PlayerName");
            if (value) {
                racerName.text = value;
            }
        }

        this._racerName = racerName;
    }

    public get racerName(): string {
        const racerName = this._racerName.text.trim();
        if (!racerName) {
            let num = Math.floor(Math.random() * 10000);
            this._racerName.text = ("kart_" + num);
        }

        return racerName;
    }
}