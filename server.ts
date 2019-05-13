import * as express from "express"
import * as http from "http"

var app = express()
app.use("/public", express.static("public"))
app.get('/', function (req, res) {
    res.sendFile(process.cwd() + "/public/index.html")
})

var server = http.createServer(app)
server.listen(3000)