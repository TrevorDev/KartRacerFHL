import { Vector3, Nullable, Quaternion, Scene, Scalar, Tools, Observable } from '@babylonjs/core';
import { Kart } from './kart';
import { Assets } from './assets';

// Socket io
declare var io: any;

export interface IRaceInfo {
    trackVarianceSeed: number;
}

export interface ITrackedObject {
    position: Vector3;
    rotationQuaternion: Quaternion;
    wheelsRotationSpeedRatio: number;
    steeringAnimationFrame: number;
}

// bodyMaterialIndex: number;
// driverMaterialIndex: number;

export class Multiplayer {
    public localId: string = "";
    public trackedObject: Nullable<ITrackedObject>;
    public trackedServerObjects: { [key: string]: { lastPose: ITrackedObject, targetPose: ITrackedObject, object: Nullable<ITrackedObject> } } = {};
    public lastTime = Date.now();
    public pingMS = 1;
    public onNewRaceObservable = new Observable<IRaceInfo>();
    private _scene: Scene;
    private _assets: Assets;
    private _mainKart: Kart;
    private _raceId = 0;
    private _socket: SocketIO.Socket;
    private _waitingForNextRace = false;

    constructor(scene: Scene, assets: Assets, mainKart: Kart) {
        this._scene = scene;
        this._assets = assets;
        this._mainKart = mainKart;
    }

    public connectAsync(roomName: string, playerName: string, trackedObject: Nullable<ITrackedObject>, bodyMaterialIndex: number, driverMaterialIndex: number): Promise<IRaceInfo> {
        return new Promise(resolve => {
            var socket: SocketIO.Socket = io();
            this._socket = socket;
            socket.emit("joinRoom", {
                roomName: "test",
                playerName: playerName,
                bodyMaterialIndex: bodyMaterialIndex,
                driverMaterialIndex: driverMaterialIndex
            });
            socket.on("joinRoomComplete", (e) => {
                this._raceId = e.raceId;
                this.localId = e.id;
                this.trackedObject = trackedObject;
                this.pingMS = e.pingMS
                setInterval(() => {
                    if (this.trackedObject) {
                        socket.emit("updateKartPose", {
                            p: this.trackedObject.position,
                            r: this.trackedObject.rotationQuaternion,
                            w: this.trackedObject.wheelsRotationSpeedRatio,
                            s: this.trackedObject.steeringAnimationFrame,
                            b: bodyMaterialIndex,
                            d: driverMaterialIndex,
                        })
                    }
                }, e.pingMS)

                socket.on("serverUpdate", (e) => {
                    e.forEach((p: any) => {
                        if (p.id != this.localId) {
                            let trackedServerObject = this.trackedServerObjects[p.id];
                            if (!trackedServerObject) {
                                const kart = new Kart(p.id, this._scene, this._assets, p.b, p.d);
                                kart.kartName = p.name;
                                trackedServerObject = {
                                    lastPose: { position: new Vector3(), rotationQuaternion: new Quaternion(), wheelsRotationSpeedRatio: 0, steeringAnimationFrame: 0 },
                                    targetPose: { position: new Vector3(), rotationQuaternion: new Quaternion(), wheelsRotationSpeedRatio: 0, steeringAnimationFrame: 0 },
                                    object: kart,
                                };
                                this.trackedServerObjects[p.id] = trackedServerObject;
                            }
                            trackedServerObject.lastPose.position.copyFrom(trackedServerObject.targetPose.position);
                            trackedServerObject.lastPose.rotationQuaternion.copyFrom(trackedServerObject.targetPose.rotationQuaternion);
                            trackedServerObject.lastPose.wheelsRotationSpeedRatio = trackedServerObject.targetPose.wheelsRotationSpeedRatio;
                            trackedServerObject.lastPose.steeringAnimationFrame = trackedServerObject.targetPose.steeringAnimationFrame;
                            trackedServerObject.targetPose.position.copyFrom(p.p);
                            trackedServerObject.targetPose.rotationQuaternion.copyFrom(p.r);
                            trackedServerObject.targetPose.wheelsRotationSpeedRatio = p.w;
                            trackedServerObject.targetPose.steeringAnimationFrame = p.s;
                            this.lastTime = Date.now();
                        }
                    })
                })

                socket.on("userDisconnected", (id) => {
                    if (this.trackedServerObjects[id]) {
                        (this.trackedServerObjects[id].object as any).dispose();
                        delete this.trackedServerObjects[id]
                    }
                })

                socket.on("raceComplete", (info) => {
                    if (!this._waitingForNextRace) {
                        this._waitingForNextRace = true;
                        this._mainKart.PlayerMenu.SetWinText("GG! The winner is\n" + info.winnerName);
                        setTimeout(() => {
                            this._raceId = info.raceId;
                            this.onNewRaceObservable.notifyObservers({
                                trackVarianceSeed: this._raceId
                            });
                            this._waitingForNextRace = false;
                        }, 4000);
                    }
                })

                resolve({
                    trackVarianceSeed: this._raceId
                });
            });
        });
    }

    public update() {
        var curTime = Date.now();
        var ratio = Scalar.Clamp((curTime - this.lastTime) / this.pingMS, 0, 1.1);
        for (var key in this.trackedServerObjects) {
            const trackedServerObject = this.trackedServerObjects[key];
            Vector3.LerpToRef(trackedServerObject.lastPose.position, trackedServerObject.targetPose.position, ratio, trackedServerObject.object.position);
            Quaternion.SlerpToRef(trackedServerObject.lastPose.rotationQuaternion, trackedServerObject.targetPose.rotationQuaternion, ratio, trackedServerObject.object.rotationQuaternion);
            trackedServerObject.object.wheelsRotationSpeedRatio = Scalar.Lerp(trackedServerObject.lastPose.wheelsRotationSpeedRatio, trackedServerObject.targetPose.wheelsRotationSpeedRatio, ratio);
            trackedServerObject.object.steeringAnimationFrame = Scalar.Lerp(trackedServerObject.lastPose.steeringAnimationFrame, trackedServerObject.targetPose.steeringAnimationFrame, ratio);
        }
    }

    public raceComplete(name: string) {
        if (!this._waitingForNextRace) {
            this._socket.emit("raceComplete", { name: name, raceId: this._raceId });
        }
    }
}
