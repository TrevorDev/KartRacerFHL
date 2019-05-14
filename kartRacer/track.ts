import { Vector3, Curve3, RibbonBuilder, PBRMaterial, Texture, Tools, Scene, TransformNode } from "@babylonjs/core";
import { KartEngine } from "./engine";

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

        const curvatureFactor = Math.ceil((options.radius + options.lateralVariance + options.heightVariance) * 0.05);

        const curve = Curve3.CreateCatmullRomSpline(controlPoints, curvatureFactor, true);
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

        function getUp(index: number): Vector3 {
            const curvatureVector = getPoint(index - curvatureFactor).add(getPoint(index + curvatureFactor)).scaleInPlace(0.5).subtractInPlace(getPoint(index));
            return curvatureVector.addInPlaceFromFloats(0, curvatureFactor * 10, 0).scaleInPlace(0.5).normalize();
        }

        const apronAngle = Tools.ToRadians(15);
        const apronLengthPrecentage = 0.15;

        const pathArray = new Array<Array<Vector3>>(points.length);
        for (let index = 0; index < points.length; ++index) {
            const point = points[index];
            const forward = getForward(index);
            const up = getUp(index);
            const right = Vector3.Cross(up, forward);
            const edge = right.scale(options.width * (0.5 - apronLengthPrecentage));
            const apron1 = edge.add(right.scale(options.width * apronLengthPrecentage * Math.cos(apronAngle)));
            const apron2 = up.scale(options.width * apronLengthPrecentage * Math.sin(apronAngle));
            pathArray[index] = [
                point.subtract(apron1).addInPlace(apron2),
                point.subtract(edge),
                point.add(edge),
                point.add(apron1).addInPlace(apron2),
            ];
        }

        this.createTrack(scene, pathArray, curve.length(), options.width);

        const trees = new TransformNode("trees", scene);
        const treePoints = this.getTreePoints(0.9, 1.0, 0.5, pathArray);
        for (const treePoint of treePoints) {
            const tree = KartEngine.instance.assets.tree.createInstance("tree");
            tree.position.copyFrom(treePoint);
            tree.parent = trees;
        }

        this.startPoint = getPoint(0);
        this.startTarget = getPoint(1);
    }

    private createTrack(scene: Scene, pathArray: Array<Array<Vector3>>, width: number, length: number): void {
        const track = RibbonBuilder.CreateRibbon("track", {
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

        const vScale = Math.round(length / (width * 2));
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

        track.material = material;
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

    private getTreePoints(density: number, radius: number, minDistance: number, pathArray: Array<Array<Vector3>>): Array<Vector3> {
        const trees: Array<Vector3> = [];
        for (var index = 0; index < pathArray.length; ++index) {

            const leftSide = pathArray[index][1];
            const rightSide = pathArray[index][2];

            let direction = rightSide.subtract(leftSide);
            direction.y = 0;

            if (this.random() < density) {
                const distanceFromPath = this.random() * radius + minDistance;
                trees.push(rightSide.add(direction.scale(distanceFromPath)));
            }

            if (this.random() < density) {
                const distanceFromPath = this.random() * radius + minDistance;
                trees.push(leftSide.subtract(direction.scale(distanceFromPath)));
            }
        }

        // Delete trees that were were generated too close to the track.
        const spacedTrees: Array<Vector3> = [];
        for (var index = 0; index < trees.length - 1; ++index) {
            let isSpaced = true;
            for (var j = 0; j < spacedTrees.length; ++j) {
                const distanceBetween = trees[index].subtract(spacedTrees[j]).length();
                if (distanceBetween < minDistance) {
                    isSpaced = false;
                    break;
                }
            }

            for (var j = 0; j < pathArray.length; ++j) {
                for (var k = 0; k < pathArray[j].length; ++k) {
                    const distanceBetween = trees[index].subtract(pathArray[j][k]).length();
                    if (distanceBetween < minDistance) {
                        isSpaced = false;
                        break;
                    }
                }
            }

            if (isSpaced) {
                spacedTrees.push(trees[index]);
            }
        }
        return spacedTrees;
    }

    // https://stackoverflow.com/a/19303725/11256124
    private random(): number {
        const x = Math.sin(this._varianceSeed++) * 10000;
        return x - Math.floor(x);
    }
}
