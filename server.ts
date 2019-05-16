import * as express from "express"
import * as http from "http"
import * as sio from "socket.io";

var port = 3000;
var pingMS = 100;

// Basic express webserver
var app = express()
app.use("/public", express.static("public"))
app.get('/', function (req, res) {
    res.sendFile(process.cwd() + "/public/index.html")
})
var server = http.createServer(app)
server.listen(port)

// socket io configuration for multiplayer
var io = sio(server)
var rooms:any = {}
io.on('connection', function(socket:(sio.Socket & {customData:any})){
    socket.customData = {position: {x:0,y:0,z:0}, rotation: {x:0,y:0,z:0,w:0}};
    console.log('a user connected');
    socket.on("joinRoom", (e)=>{
        if(!rooms[e.roomName]){
            rooms[e.roomName] = {
                users: [],
                raceId: 0
            }
        }
        socket.customData.roomName = e.roomName;
        rooms[socket.customData.roomName].users.push(socket)
        socket.emit("joinRoomComplete", {id: socket.id, pingMS: pingMS, raceId: rooms[socket.customData.roomName].raceId})
    })
    socket.on("updateKartPose", (pose)=>{
        socket.customData.position.x = pose.position.x
        socket.customData.position.y = pose.position.y
        socket.customData.position.z = pose.position.z

        if (pose.rotation) {
            socket.customData.rotation.x = pose.rotation.x
            socket.customData.rotation.y = pose.rotation.y
            socket.customData.rotation.z = pose.rotation.z
            socket.customData.rotation.w = pose.rotation.w
        }
    })
    socket.on("disconnect", ()=>{
        if(!rooms[socket.customData.roomName]){
            return;
        }
        var index = rooms[socket.customData.roomName].users.indexOf(socket)
        if(index == -1){
            return;
        }
        rooms[socket.customData.roomName].users.splice(index, 1)
        rooms[socket.customData.roomName].users.forEach((s:(sio.Socket & {customData:any}))=>{
            s.emit("userDisconnected", socket.id)
        })
    })
    socket.on("raceComplete", (e)=>{
        console.log(e.raceId, rooms[socket.customData.roomName].raceId)
        if(e.raceId == rooms[socket.customData.roomName].raceId){
            rooms[socket.customData.roomName].raceId++; 
            rooms[socket.customData.roomName].users.forEach((s:(sio.Socket & {customData:any}))=>{
                s.emit("raceComplete", {raceId: rooms[socket.customData.roomName].raceId, winnerName: e.name})
            })
            
        }
        console.log("race reset")

    })
});

// Ping loop
var repeat = (fn:Function, ms:number)=>{
    fn();
    setTimeout(() => {
        repeat(fn, ms);
    }, ms);
}
repeat(()=>{
    for(var key in rooms){
        var ret = rooms[key].users.map((s:sio.Socket & {customData:any})=>{
            return {id: s.id, position: s.customData.position, rotation: s.customData.rotation}
        })
        rooms[key].users.forEach((s:sio.Socket & {customData:any})=>{
            s.emit("serverUpdate", ret);
        })
    }
}, pingMS)