import * as express from "express"
import * as http from "http"
import * as sio from "socket.io";

interface ISocket extends sio.Socket {
    customData: {
        roomName: string;
        playerName: string;
        position: { x: number, y: number, z: number };
        rotationQuaternion: { x: number, y: number, z: number, w: number };
        wheelsRotationSpeedRatio: number;
        steeringAnimationFrame: number;
        bodyMaterialIndex: number;
        driverMaterialIndex: number;
    }
}

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
var rooms: { [name: string]: { users: Array<any>, raceId: number } } = {}
io.on('connection', function (socket: ISocket) {
    socket.customData = {
        roomName: "",
        playerName: "",
        position: { x: 0, y: 0, z: 0 },
        rotationQuaternion: { x: 0, y: 0, z: 0, w: 0 },
        wheelsRotationSpeedRatio: 0,
        steeringAnimationFrame: 0,
        bodyMaterialIndex: 0,
        driverMaterialIndex: 0
    };
    console.log('a user connected');
    socket.on("joinRoom", (e) => {
        if (!rooms[e.roomName]) {
            rooms[e.roomName] = {
                users: [],
                raceId: 1
            }
        }
        socket.customData.roomName = e.roomName;
        socket.customData.playerName = e.playerName;
        socket.customData.bodyMaterialIndex = e.bodyMaterialIndex;
        socket.customData.driverMaterialIndex = e.driverMaterialIndex;
        const room = rooms[socket.customData.roomName];
        room.users.push(socket);
        socket.emit("joinRoomComplete", { id: socket.id, pingMS: pingMS, raceId: room.raceId });
    })
    socket.on("updateKartPose", (pose) => {
        socket.customData.position.x = pose.p.x;
        socket.customData.position.y = pose.p.y;
        socket.customData.position.z = pose.p.z;

        socket.customData.rotationQuaternion.x = pose.r.x;
        socket.customData.rotationQuaternion.y = pose.r.y;
        socket.customData.rotationQuaternion.z = pose.r.z;
        socket.customData.rotationQuaternion.w = pose.r.w;

        socket.customData.wheelsRotationSpeedRatio = pose.w;
        socket.customData.steeringAnimationFrame = pose.s;

        socket.customData.bodyMaterialIndex = pose.b;
        socket.customData.driverMaterialIndex = pose.d;
    })
    socket.on("disconnect", () => {
        if (!rooms[socket.customData.roomName]) {
            return;
        }
        var index = rooms[socket.customData.roomName].users.indexOf(socket)
        if (index == -1) {
            return;
        }
        rooms[socket.customData.roomName].users.splice(index, 1)
        rooms[socket.customData.roomName].users.forEach((s: ISocket) => {
            s.emit("userDisconnected", socket.id)
        })
    })
    socket.on("raceComplete", (e) => {
        const room = rooms[socket.customData.roomName];
        if (!room) {
            return;
        }
        console.log(e.raceId, room.raceId);
        if (e.raceId == room.raceId) {
            room.raceId++;
            room.users.forEach((s: ISocket) => {
                s.emit("raceComplete", { raceId: room.raceId, winnerName: e.name })
            })

        }
        console.log("race reset")
    })
});

// Ping loop
setInterval(() => {
    for (var key in rooms) {
        var ret = rooms[key].users.map((s: ISocket) => {
            return {
                id: s.id,
                name: s.customData.playerName,
                p: s.customData.position,
                r: s.customData.rotationQuaternion,
                w: s.customData.wheelsRotationSpeedRatio,
                s: s.customData.steeringAnimationFrame,
                b: s.customData.bodyMaterialIndex,
                d: s.customData.driverMaterialIndex,
            }
        })
        rooms[key].users.forEach((s: ISocket) => {
            s.emit("serverUpdate", ret);
        })
    }
}, pingMS)