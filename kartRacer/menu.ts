import { FreeCamera, Scene, Mesh, StandardMaterial } from "@babylonjs/core";
import { AdvancedDynamicTexture, TextBlock, StackPanel } from "@babylonjs/gui";

export class Menu {
    private _camera : FreeCamera;
    private _UI : Mesh;
    private _timeText : TextBlock = null;
    private _scoreText : TextBlock = null;
    private _winText : TextBlock = null;
    private _startTime : number = null;
    private _stopTimer : boolean = false;
    private _time : number;

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
        timeText.height = "100px";
        timeText.width = "100%";
        timeText.textHorizontalAlignment = TextBlock.HORIZONTAL_ALIGNMENT_RIGHT;
        timeText.fontSize = 40;
        timeText.color = "white"
        timeText.text = "00:00:00";
        timeText.outlineColor = "black";
        timeText.outlineWidth = 8;

        var scoreText = new TextBlock();
        scoreText.height = "50px";
        scoreText.width = "100%";
        scoreText.textHorizontalAlignment = TextBlock.HORIZONTAL_ALIGNMENT_RIGHT
        scoreText.fontSize = 40;
        scoreText.color = "white"
        scoreText.text = "0% Complete";
        scoreText.outlineColor = "black";
        scoreText.outlineWidth = 8;

        var winText = new TextBlock();
        winText.height = "250px";
        winText.width = "100%";
        winText.textHorizontalAlignment = TextBlock.HORIZONTAL_ALIGNMENT_CENTER;
        winText.textVerticalAlignment = TextBlock.VERTICAL_ALIGNMENT_CENTER;
        winText.fontSize = 100;
        winText.color = "white"
        winText.text = "";
        winText.outlineColor = "black"
        winText.outlineWidth = 8;
        
        stackPanel.addControl(timeText);
        stackPanel.addControl(scoreText);
        stackPanel.addControl(winText);

        this._UI = hudPlane;
        this._timeText = timeText;
        this._scoreText = scoreText;
        this._winText = winText;
        this._camera = camera;
    }

    public SetVisible(isEnabled : boolean) : void
    {
        this._UI.isVisible = isEnabled;
    }

    public UpdateHUD(prog : number) : void
    {
        if (this._startTime != null && !this._stopTimer)
        {
            let time = Math.floor((new Date().getTime() - this._startTime) / 1000);

            this._time = time;
            this._timeText.text = this.FormatTime(time);
        }
        
        this._scoreText.text = prog + "% Complete";
    }

    public EnableHud() : void
    {
        this._UI.position.set(0, 0, 5);
        this._UI.parent = this._camera;
    }

    public StartTimer() : void
    {
        this._startTime = new Date().getTime();
        this._stopTimer = false;
    }
    public StopTimer() : string
    {
        this._stopTimer = true;
        
        return this.FormatTime(this._time);
    }

    public SetWinText(text : string)
    {
        this._winText.text = text;
    }

    private FormatTime(time : number) : string
    {
        let hours = Math.floor(time / 3600);
        time %= 3600;
        let minutes = Math.floor(time / 60);
        let seconds = time % 60;
        var hoursString : string = (hours < 10 ? "0" : "") + hours;
        var minutesString : string = (minutes < 10 ? "0" : "") + minutes;
        var secondsString : string = (seconds < 10 ? "0" : "") + seconds;

        return (hoursString + ":" + minutesString + ":" + secondsString);
    }
}
