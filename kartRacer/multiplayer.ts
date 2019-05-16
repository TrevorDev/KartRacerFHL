import { Kart } from './kart';
import { Vector3, Nullable, Quaternion, Scene } from '@babylonjs/core';

// Socket io
declare var io: any;

export class Multiplayer {
    public localId: string = "";
    public trackedObject: Nullable<{ position: Vector3, rotationQuaternion: Quaternion }>;
    public trackedServerObjects: { [key: string]: { targetPose: { position: Vector3, rotation: Quaternion }, object: Nullable<{ position: Vector3, rotationQuaternion: Quaternion }> } } = {};

    constructor(public scene: Scene) {
    }

    connectToRoom(roomName: string, trackedObject: Nullable<{ position: Vector3, rotationQuaternion: Quaternion }>) {
        var socket: SocketIO.Socket = io();
        socket.emit("joinRoom", { roomName: "test" });
        socket.on("joinRoomComplete", (e) => {
            this.localId = e.id;
            this.trackedObject = trackedObject;
            this.repeat(() => {
                if (this.trackedObject) {
                    socket.emit("updateKartPose", { position: this.trackedObject.position, rotation: this.trackedObject.rotationQuaternion })
                }
            }, e.pingMS)

            socket.on("serverUpdate", (e) => {
                console.log("hit")
                e.forEach((p: any) => {
                    if (p.id != this.localId) {
                        if (!this.trackedServerObjects[p.id]) {
                            this.trackedServerObjects[p.id] = {
                                targetPose: { position: new Vector3(), rotation: new Quaternion() },
                                object: new Kart(p.id, this.scene, false),
                            }
                            this.trackedServerObjects[p.id].object.rotationQuaternion = new Quaternion();
                        }
                        this.trackedServerObjects[p.id].targetPose.position.copyFrom(p.position)
                        this.trackedServerObjects[p.id].targetPose.rotation.copyFrom(p.rotation)
                    }
                })
            })
            socket.on("userDisconnected", (id) => {
                if (this.trackedServerObjects[id]) {
                    (this.trackedServerObjects[id].object as any).dispose();
                    delete this.trackedServerObjects[id]
                }
            })
        })
    }

    private repeat = (fn: Function, ms: number) => {
        fn();
        setTimeout(() => {
            this.repeat(fn, ms);
        }, ms);
    }

    public update() {
        for (var key in this.trackedServerObjects) {
            var diff = this.trackedServerObjects[key].targetPose.position.subtract(this.trackedServerObjects[key].object.position).scale(0.05)
            this.trackedServerObjects[key].object.position.addInPlace(diff)

            Quaternion.SlerpToRef(this.trackedServerObjects[key].object.rotationQuaternion, this.trackedServerObjects[key].targetPose.rotation, 0.05, this.trackedServerObjects[key].object.rotationQuaternion);
        }
    }
}


