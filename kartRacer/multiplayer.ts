import { Vector3, Nullable, Quaternion, Scene, Scalar, Tools, Observable } from '@babylonjs/core';
import { Kart } from './kart';
import { Assets } from './assets';

// Socket io
declare var io: any;

export interface IRaceInfo {
    trackVarianceSeed: number;
}

export class Multiplayer {
    public localId: string = "";
    public trackedObject: Nullable<{ position: Vector3, rotationQuaternion: Quaternion }>;
    public trackedServerObjects: { [key: string]: { lastPose: { position: Vector3, rotation: Quaternion }, targetPose: { position: Vector3, rotation: Quaternion }, object: Nullable<{ position: Vector3, rotationQuaternion: Quaternion }> } } = {};
    public lastTime = new Date();
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

    public connectAsync(roomName: string, playerName: string, trackedObject: Nullable<{ position: Vector3, rotationQuaternion: Quaternion }>): Promise<IRaceInfo> {
        return new Promise(resolve => {
            var socket: SocketIO.Socket = io();
            this._socket = socket;
            socket.emit("joinRoom", { roomName: "test", playerName: playerName });
            socket.on("joinRoomComplete", (e) => {
                this._raceId = e.raceId;
                this.localId = e.id;
                this.trackedObject = trackedObject;
                this.pingMS = e.pingMS
                setInterval(() => {
                    if (this.trackedObject) {
                        socket.emit("updateKartPose", { position: this.trackedObject.position, rotation: this.trackedObject.rotationQuaternion })
                    }
                }, e.pingMS)

                socket.on("serverUpdate", (e) => {
                    e.forEach((p: any) => {
                        if (p.id != this.localId) {
                            if (!this.trackedServerObjects[p.id]) {
                                const kart = new Kart(p.id, this._scene, this._assets);
                                kart.kartName =p.name;
                                this.trackedServerObjects[p.id] = {
                                    lastPose: { position: new Vector3(), rotation: new Quaternion() },
                                    targetPose: { position: new Vector3(), rotation: new Quaternion() },
                                    object: kart,
                                }
                                this.trackedServerObjects[p.id].object.rotationQuaternion = new Quaternion();
                            }
                            this.trackedServerObjects[p.id].lastPose.position.copyFrom(this.trackedServerObjects[p.id].targetPose.position)
                            this.trackedServerObjects[p.id].lastPose.rotation.copyFrom(this.trackedServerObjects[p.id].targetPose.rotation)

                            this.trackedServerObjects[p.id].targetPose.position.copyFrom(p.position)
                            this.trackedServerObjects[p.id].targetPose.rotation.copyFrom(p.rotation)
                            this.lastTime = new Date();
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
        var curTime = new Date()
        var ratio = Scalar.Clamp((curTime.getTime() - this.lastTime.getTime()) / this.pingMS, 0, 1.1)
        for (var key in this.trackedServerObjects) {
            Vector3.LerpToRef(this.trackedServerObjects[key].lastPose.position, this.trackedServerObjects[key].targetPose.position, ratio, this.trackedServerObjects[key].object.position)
            Quaternion.SlerpToRef(this.trackedServerObjects[key].lastPose.rotation, this.trackedServerObjects[key].targetPose.rotation, ratio, this.trackedServerObjects[key].object.rotationQuaternion)

            // var diff = this.trackedServerObjects[key].targetPose.position.subtract(this.trackedServerObjects[key].object.position).scale(0.05)
            // this.trackedServerObjects[key].object.position.addInPlace(diff)

            //Quaternion.SlerpToRef(this.trackedServerObjects[key].object.rotationQuaternion, this.trackedServerObjects[key].targetPose.rotation, 0.05, this.trackedServerObjects[key].object.rotationQuaternion);
        }
    }

    public raceComplete(name: string) {
        if (!this._waitingForNextRace) {
            this._socket.emit("raceComplete", { name: name, raceId: this._raceId });
        }
    }
}
