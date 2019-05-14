import { Scene } from "babylonjs/scene";
import { Vector3, Curve3, RibbonBuilder, PBRMaterial, Texture, Tools } from "babylonjs";

export class Track {
    public readonly startPoint: Vector3;
    public readonly startTarget: Vector3;

    private _varianceSeed: number;

    constructor(scene: Scene, options: { radius: number, numPoints: number, varianceSeed: number, lateralVariance: number, heightVariance: number, width: number }) {
        this._varianceSeed = options.varianceSeed;

        const controlPoints = this.getTrackPoints(
            options.numPoints,
            options.radius,
            options.lateralVariance,
            options.heightVariance
        );

        const curve = Curve3.CreateCatmullRomSpline(controlPoints, options.radius * 0.05, true);
        const points = curve.getPoints();

        function getPoint(index: number): Vector3 {
            const length = points.length - 1;
            while (index < 0) index += length;
            while (index >= length) index -= length;
            return points[index];
        }

        function getForward(index: number): Vector3 {
            return getPoint(index + 1).subtract(getPoint(index - 1)).normalize();
        }

        const apronAngle = Tools.ToRadians(15);
        const apronLengthPrecentage = 0.15;

        const pathArray = new Array<Array<Vector3>>(points.length);
        for (let index = 0; index < points.length; ++index) {
            const point = points[index];
            const forward = getForward(index);
            const right = Vector3.Cross(Vector3.Up(), forward);
            const edge = right.scale(options.width * (0.5 - apronLengthPrecentage));
            const apron1 = edge.add(right.scale(options.width * apronLengthPrecentage * Math.cos(apronAngle)));
            const apron2 = Vector3.Up().scale(options.width * apronLengthPrecentage * Math.sin(apronAngle));
            pathArray[index] = [
                point.subtract(apron1).add(apron2),
                point.subtract(edge),
                point.add(edge),
                point.add(apron1).add(apron2),
            ];
        }

        const ribbon = RibbonBuilder.CreateRibbon("track", {
            pathArray: pathArray
        });

        const material = new PBRMaterial("track", scene);
        material.metallic = 0;
        material.roughness = 0.5;
        material.backFaceCulling = false;
        material.twoSidedLighting = true;

        const albedoTexture = new Texture("public/textures/SimpleTrack_basecolor.png", scene);
        const bumpTexture = new Texture("public/textures/SimpleTrack_normal.png", scene);
        const metallicTexture = new Texture("public/textures/SimpleTrack_ORM.png", scene);

        const vScale = Math.round(curve.length() / (options.width * 2));
        albedoTexture.vScale = vScale;
        bumpTexture.vScale = vScale;
        metallicTexture.vScale = vScale;

        material.albedoTexture = albedoTexture;
        material.bumpTexture = bumpTexture;

        material.metallic = 0;
        material.roughness = 1;
        material.metallicTexture = metallicTexture;
        material.useMetallnessFromMetallicTextureBlue = true;
        material.useRoughnessFromMetallicTextureGreen = true;
        material.useRoughnessFromMetallicTextureAlpha = false;

        ribbon.material = material;

        this.startPoint = getPoint(0);
        this.startTarget = getPoint(1);
    }

    private getTrackPoints(numPoints: number, radius: number, lateralVariance: number, heightVariance: number): Array<Vector3> {
        const points = new Array<Vector3>(numPoints);
        for (let index = 0; index < numPoints; ++index) {
            const rPert = lateralVariance;
            const pert = this.random() * rPert - rPert / 2;
            const x = (radius + pert) * Math.sin(2 * index * Math.PI / numPoints);
            const y = this.random() * heightVariance - heightVariance / 2;
            const z = (radius + pert) * Math.cos(2 * index * Math.PI / numPoints);
            points[index] = new Vector3(x, y, z);
        }

        return points;
    }

    // https://stackoverflow.com/a/19303725/11256124
    private random(): number {
        const x = Math.sin(this._varianceSeed++) * 10000;
        return x - Math.floor(x);
    }
}
