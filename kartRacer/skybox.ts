import { Scene, Observable, Engine, FreeCamera, Vector3, Mesh, CubeTexture, Texture, Color3 } from "@babylonjs/core";
import { StandardMaterial } from "@babylonjs/core";

export class Skybox {
    constructor(scene: Scene) {
        // Skybox
        var skybox = Mesh.CreateBox("skyBox", 1000.0, scene);
        var skyboxMaterial = new StandardMaterial("skyBox", scene);
        skyboxMaterial.backFaceCulling = false;
        skyboxMaterial.reflectionTexture = new CubeTexture("/public/textures/skybox/TropicalSunnyDay", scene);
        skyboxMaterial.reflectionTexture.coordinatesMode = Texture.SKYBOX_MODE;
        skyboxMaterial.diffuseColor = new Color3(0, 0, 0);
        skyboxMaterial.specularColor = new Color3(0, 0, 0);
        skyboxMaterial.disableLighting = true;
        
        skybox.infiniteDistance = true;
        skybox.material = skyboxMaterial;
    }
}