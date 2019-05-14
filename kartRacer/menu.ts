import { FreeCamera, Scene, Mesh, StandardMaterial } from "@babylonjs/core";
import { PlanePanel, AdvancedDynamicTexture, TextBlock } from "@babylonjs/gui";

class Menu {
    private _camera : FreeCamera;
    private _UI : Mesh;

    constructor (camera : FreeCamera, scene : Scene)
    {
        this._camera = camera;
        this._UI = Mesh.CreatePlane("driverUI", 10, scene);

        this._UI.position.set(0, 10, 8);
        this._UI.material = new StandardMaterial("", scene)

        var driverGUI = AdvancedDynamicTexture.CreateForMesh(this._UI);

        var planePanel:any = new PlanePanel();
        planePanel.top = "100px";
        driverGUI.addControl(planePanel);

        var timeText:any = new TextBlock();
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