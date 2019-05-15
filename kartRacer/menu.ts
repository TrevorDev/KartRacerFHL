import { FreeCamera, Scene, Mesh, StandardMaterial } from "@babylonjs/core";
import { AdvancedDynamicTexture, TextBlock, StackPanel } from "@babylonjs/gui";

export class Menu {
    private _camera : FreeCamera;
    private _UI : Mesh;
    private _timeText : TextBlock = null;
    private _startTime : number = null;
    private _stopTimer : boolean = false;

    constructor (camera : FreeCamera, scene : Scene)
    {
        var hudPlane = Mesh.CreatePlane("hudPlane", 4.5, scene)
        hudPlane.material = new StandardMaterial("", scene)

        var driverUI = AdvancedDynamicTexture.CreateForMesh(hudPlane);

        var stackPanel = new StackPanel();
        stackPanel.height = "1000px";
        stackPanel.width = "100%";
        driverUI.addControl(stackPanel);

        var timeText = new TextBlock();
        timeText.height = "150px";
        timeText.width = "100%";
        timeText.textHorizontalAlignment = TextBlock.HORIZONTAL_ALIGNMENT_RIGHT;
        timeText.fontSize = 40;
        timeText.color = "white"
        timeText.text = "TIME: 00:00:00";
        
        stackPanel.addControl(timeText);

        var scoreText = new TextBlock();
        scoreText.height = "500px";
        scoreText.left = "100px";
        scoreText.fontSize = 25;
        scoreText.color = "white"
        scoreText.textWrapping = true;
        scoreText.text = "Lorem Ipsum is simply dummy text of the printing " +
        "and typesetting industry. Lorem Ipsum has been the industry's standard " +
        "dummy text ever since the 1500s, when an unknown printer took a galley of " + 
        "type and scrambled it to make a type specimen book. It has survived not only " + 
        "five centuries, but also the leap into electronic typesetting, remaining " + 
        "essentially unchanged. It was popularised in the 1960s with the release of " + 
        "Letraset sheets containing Lorem Ipsum passages, and more recently with desktop " + 
        "publishing software like Aldus PageMaker including versions of Lorem Ipsum.";
        scoreText.isVisible = false;
        
        stackPanel.addControl(scoreText);

        this._UI = hudPlane;
        this._timeText = timeText;
        this._camera = camera;
    }

    public SetVisible(isEnabled : boolean) : void
    {
        this._UI.isVisible = isEnabled;
    }

    public UpdateHUD() : void
    {
        if (this._startTime != null && !this._stopTimer)
        {
            let time = Math.floor((new Date().getTime() - this._startTime) / 1000);
            let hours = Math.floor(time / 3600);
            time %= 3600;
            let minutes = Math.floor(time / 60);
            let seconds = time % 60;
            var hoursString : string = (hours < 10 ? "0" : "") + hours
            var minutesString : string = (minutes < 10 ? "0" : "") + minutes
            var secondsString : string = (seconds < 10 ? "0" : "") + seconds

            this._timeText.text = "TIME: " + hoursString + ":" + minutesString + ":" + secondsString;
        }
    }

    public EnableHud() : void
    {
        this._UI.position.set(0, 0, 5);
        this._UI.parent = this._camera;
    }

    public StartTimer() : void
    {
        this._startTime = new Date().getTime();
    }
    public StopTimer() : void
    {
        this._stopTimer = true;
    }
}