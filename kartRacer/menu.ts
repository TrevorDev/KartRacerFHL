import * as BABYLON from 'babylonjs'
import 'babylonjs-loaders';
import * as GUI from 'babylonjs-gui';
import { FreeCamera , Scene } from 'babylonjs';

class Menu {
    private _camera : FreeCamera;
    private _UI : BABYLON.Mesh;

    constructor (camera : FreeCamera, scene : Scene)
    {
        this._camera = camera;
        this._UI = BABYLON.Mesh.CreatePlane("driverUI", 10, scene);

        this._UI.position.set(0, 10, 8);
        this._UI.material = new BABYLON.StandardMaterial("", scene)

        var driverGUI = GUI.AdvancedDynamicTexture.CreateForMesh(this._UI);

        var planePanel = new GUI.PlanePanel();
        planePanel.top = "100px";
        driverGUI.addControl(planePanel);

        var timeText = new GUI.TextBlock();
        timeText.text = "TIME";
        timeText.color = "white";
        timeText.fontSize = 24;
        planePanel.addControl(timeText);
        
        function SetEnabled(isEnabled : boolean) : void
        {
            this._UI.isEnabled = isEnabled;
        }
    }
}