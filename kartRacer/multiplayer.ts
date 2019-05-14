import * as BABYLON from 'babylonjs'
import { Kart } from './kart';

// Socket io
declare var io:any;

export class Multiplayer{
    private _tmpVector = new BABYLON.Vector3()
    public localId:string = "";
    public trackedObject:BABYLON.Nullable<{position:BABYLON.Vector3, rotationQuaternion:BABYLON.Quaternion}>;
    public trackedServerObjects:{[key:string]:{targetPose: {position:BABYLON.Vector3, rotation:BABYLON.Quaternion}, object: BABYLON.Nullable<{position:BABYLON.Vector3, rotationQuaternion:BABYLON.Quaternion}>}} = {};
    constructor(public scene: BABYLON.Scene){
    }
    connectToRoom(roomName:string){
        var socket:SocketIO.Socket = io();
        socket.emit("joinRoom", {roomName: "test"});
        socket.on("joinRoomComplete", (e)=>{
            this.localId = e.id;
            this.trackedObject = new Kart(this.localId, this.scene, true);
            this.repeat(()=>{
                if(this.trackedObject){
                    socket.emit("updateKartPose", {position: this.trackedObject.position, rotation: this.trackedObject.rotationQuaternion})
                }
            }, 300)

            socket.on("serverUpdate", (e)=>{
                e.forEach((p:any)=>{
                    if(p.id != this.localId){
                        if(!this.trackedServerObjects[p.id]){
                            this.trackedServerObjects[p.id] = {
                                targetPose: {position: new BABYLON.Vector3(), rotation: new BABYLON.Quaternion()},
                                object: new Kart(p.id, this.scene, false),
                            }
                            this.trackedServerObjects[p.id].object.rotationQuaternion = new BABYLON.Quaternion();
                        }
                        this.trackedServerObjects[p.id].targetPose.position.copyFrom(p.position)
                        this.trackedServerObjects[p.id].targetPose.rotation.copyFrom(p.rotation)
                    }
                })
            })
            socket.on("userDisconnected", (id)=>{
                if(this.trackedServerObjects[id]){
                    (this.trackedServerObjects[id].object as any).dispose();
                    delete this.trackedServerObjects[id]
                }
            })
        })
    }
    private repeat = (fn:Function, ms:number)=>{
        fn();
        setTimeout(() => {
            this.repeat(fn, ms);
        }, ms);
    }
    public update(){
        for(var key in this.trackedServerObjects){
            var diff = this.trackedServerObjects[key].targetPose.position.subtract(this.trackedServerObjects[key].object.position).scale(0.05)
            this.trackedServerObjects[key].object.position.addInPlace(diff)

            BABYLON.Quaternion.SlerpToRef(this.trackedServerObjects[key].object.rotationQuaternion, this.trackedServerObjects[key].targetPose.rotation, 0.05, this.trackedServerObjects[key].object.rotationQuaternion);
        }
    }
}


