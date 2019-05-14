import { Observable, Observer } from "babylonjs/Misc/observable";
import { PropertyChangedEvent } from "../misc/PropertyChangedEvent";

export class Game {

    public readonly lobbyCountdownTimer = 30;
    public readonly raceCountdownTimer = 3;

    public onRaceTimerChangedObservable:Observable<any>;
     
}