import * as BABYLON from 'babylonjs'
import 'babylonjs-loaders';

// Get rid of margin
document.documentElement.style["overflow"]="hidden"
document.documentElement.style.overflow ="hidden"
document.documentElement.style.width ="100%"
document.documentElement.style.height ="100%"
document.documentElement.style.margin ="0"
document.documentElement.style.padding ="0"
document.body.style.overflow ="hidden"
document.body.style.width ="100%"
document.body.style.height ="100%"
document.body.style.margin ="0"
document.body.style.padding ="0"

// Create canvas html element on webpage
var canvas = document.createElement('canvas')
canvas.style.width="100%"
canvas.style.height="100%"

//canvas = document.getElementById("renderCanvas")
document.body.appendChild(canvas)

// Initialize Babylon scene and engine
var engine = new BABYLON.Engine(canvas, true, { stencil: true, disableWebGL2Support: false, preserveDrawingBuffer: true })
engine.enableOfflineSupport = false
var scene = new BABYLON.Scene(engine)
engine.runRenderLoop(()=>{
    scene.render()
})
window.addEventListener("resize", ()=> {
    engine.resize()
})

var camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0, 5, -10), scene)
camera.setTarget(BABYLON.Vector3.Zero())
camera.attachControl(canvas, true)
var light = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(0, 1, 0), scene)
light.intensity = 0.7


var sphere = BABYLON.Mesh.CreateSphere("sphere1", 16, 2, scene)
sphere.position.y = 1

var ground = BABYLON.Mesh.CreateGround("ground1", 6, 6, 1, scene)
ground.material = new BABYLON.StandardMaterial("",scene)

BABYLON.SceneLoader.LoadAssetContainer("https://models.babylonjs.com/", "fish.glb", scene, function (container) {
    // Scale and position the loaded model (First mesh loaded from gltf is the root node)
    container.meshes[0].scaling.scaleInPlace(0.1)
    container.meshes[0].position.z = 5
    container.meshes[0].position.y = -1

    // Add loaded file to the scene
    container.addAllToScene();
});