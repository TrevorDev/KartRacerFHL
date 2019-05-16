import { Vector3, Curve3, RibbonBuilder, PBRMaterial, Texture, Tools, Scene, TransformNode, Mesh, InstancedMesh, Scalar, Engine } from "@babylonjs/core";
import { KartEngine } from "./engine";

interface ITrackPoint {
    point: Vector3;
    forward: Vector3;
    up: Vector3;
    right: Vector3;
    leftEdge: Vector3;
    rightEdge: Vector3;
    leftApron: Vector3;
    rightApron: Vector3;
}

export class Track {
    public readonly startPoint: Vector3;
    public readonly startTarget: Vector3;
    public readonly controlPoints: Vector3[];

    private _varianceSeed: number;

    private _bombHazards: InstancedMesh[];
    private _boostHazards: InstancedMesh[];
    private _bumperHazards: InstancedMesh[];
    private _poisonHazards: InstancedMesh[];

    constructor(scene: Scene, options: { radius: number, numPoints: number, varianceSeed: number, lateralVariance: number, heightVariance: number, width: number }) {
        this._varianceSeed = options.varianceSeed;

        const controlPoints = this.getTrackControlPoints(
            options.numPoints,
            options.radius,
            options.lateralVariance,
            options.heightVariance
        );

        this.controlPoints = controlPoints;

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

        const trackPoints = new Array<ITrackPoint>(points.length);
        for (let index = 0; index < points.length; ++index) {
            const point = points[index];
            const forward = getForward(index);
            const up = getUp(index);
            const right = Vector3.Cross(up, forward);
            const edge = right.scale(options.width * (0.5 - apronLengthPrecentage));
            const apron1 = edge.add(right.scale(options.width * apronLengthPrecentage * Math.cos(apronAngle)));
            const apron2 = up.scale(options.width * apronLengthPrecentage * Math.sin(apronAngle));
            const leftEdge = point.subtract(edge);
            const leftApron = point.subtract(apron1).addInPlace(apron2);
            const rightApron = point.add(apron1).addInPlace(apron2);
            const rightEdge = point.add(edge);
            trackPoints[index] = {
                point: point,
                forward: forward,
                up: up,
                right: right,
                leftEdge: leftEdge,
                rightEdge: rightEdge,
                leftApron: leftApron,
                rightApron: rightApron
            };
        }

        const track = this.createTrack(scene, trackPoints, options.width, curve.length());

        this.createGoal(scene, trackPoints, track);

        const trees = new TransformNode("trees", scene);
        trees.parent = track;
        const treePoints = this.getTreePoints(0.9, 1.0, 0.5, trackPoints);
        for (const treePoint of treePoints) {
            const tree = KartEngine.instance.assets.tree.createInstance("tree");
            tree.position.copyFrom(treePoint);
            tree.parent = trees;
        }

        this.createHazards(scene, trackPoints, track);

        this.startPoint = getPoint(0);
        this.startTarget = getPoint(1);
    }

    private createTrack(scene: Scene, trackPoints: Array<ITrackPoint>, width: number, length: number): Mesh {
        const track = RibbonBuilder.CreateRibbon("track", {
            pathArray: trackPoints.map(p => [p.rightApron, p.rightEdge, p.rightEdge, p.leftEdge, p.leftEdge, p.leftApron])
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

        return track;
    }

    private createGoal(scene: Scene, trackPoints: Array<ITrackPoint>, track: Mesh): void {
        const percent = 0.015;
        const limit = Math.round(trackPoints.length * percent);

        const pathArray = new Array<Array<Vector3>>();
        for (let index = 0; index < limit; ++index) {
            pathArray.push([trackPoints[index].rightEdge, trackPoints[index].leftEdge]);
        }

        const goal = RibbonBuilder.CreateRibbon("goal", {
            pathArray: pathArray
        });

        goal.parent = track;

        const material = new PBRMaterial("goal", scene);
        material.metallic = 0;
        material.roughness = 0.5;
        material.backFaceCulling = false;
        material.twoSidedLighting = true;

        const albedoTexture = new Texture("public/textures/goal_basecolor.png", scene);
        material.albedoTexture = albedoTexture;

        goal.material = material;

        goal.parent = track;
    }

    private createHazards(scene: Scene, trackPoints: Array<ITrackPoint>, track: Mesh): void {
        const hazardPoints = this.getHazardPoints(1.5, 0.1, trackPoints);

        const bombHazards = new TransformNode("bombs", scene);
        bombHazards.parent = track;
        const boostHazards = new TransformNode("boosts", scene);
        boostHazards.parent = track;
        const bumperHazards = new TransformNode("bumpers", scene);
        bumperHazards.parent = track;
        const poisonHazards = new TransformNode("poisons", scene);
        poisonHazards.parent = track;

        function createHazard(name: string, mesh: Mesh, point: Vector3, rotationY: number, group: TransformNode): InstancedMesh {
            const hazardScale = 4;
            const instance = mesh.createInstance(name);
            instance.scaling.scaleInPlace(hazardScale);
            instance.addRotation(0, rotationY, 0);
            instance.position.copyFrom(point);
            instance.parent = group;

            return instance;
        }

        this._bombHazards = [];
        this._boostHazards = [];
        this._bumperHazards = [];
        this._poisonHazards = [];

        for (const hazardPoint of hazardPoints) {
            const hazardType = this.random();
            const rotationY = this.random();
            if (hazardType < 0.25) {
                this._bombHazards.push(createHazard("bomb", KartEngine.instance.assets.bomb, hazardPoint, rotationY, bombHazards));
            }
            else if (hazardType < 0.50) {
                this._boostHazards.push(createHazard("boost", KartEngine.instance.assets.boost, hazardPoint, rotationY, boostHazards));
            }
            else if (hazardType < 0.75) {
                this._bumperHazards.push(createHazard("bumper", KartEngine.instance.assets.bumper, hazardPoint, rotationY, bumperHazards));
            }
            else {
                this._poisonHazards.push(createHazard("poison", KartEngine.instance.assets.poison, hazardPoint, rotationY, poisonHazards));
            }
        }

        var self: Track = this;
        var time: number = 0.0;
        var scalar: number;
        var scale: number;
        scene.onBeforeRenderObservable.add(() => {
            time += Engine.Instances[0].getDeltaTime() / 1000.0;
            scalar = 2.0 * time;

            self._bombHazards.forEach((hazard) => {
                scale = 0.5 * Math.sin(scalar++);
                hazard.scaling.set(4.0 + scale, 4.0 - scale, 4.0 + scale);
            });

            self._boostHazards.forEach((hazard) => {
                scale = 0.5 * Math.sin(scalar++);
                hazard.scaling.set(4.0 + scale, 4.0 - scale, 4.0 + scale);
            });

            self._bumperHazards.forEach((hazard) => {
                scale = 0.5 * Math.sin(scalar++);
                hazard.scaling.set(4.0 + scale, 4.0 - scale, 4.0 + scale);
            });

            self._poisonHazards.forEach((hazard) => {
                scale = 0.5 * Math.sin(scalar++);
                hazard.scaling.set(4.0 + scale, 4.0 - scale, 4.0 + scale);
            });
        });
    }

    private getHazardPoints(height: number, density: number, trackPoints: Array<ITrackPoint>): Array<Vector3> {
        const hazardPoints = new Array<Vector3>();
        const percentageDistanceFromSides = .1;
        for (const trackPoint of trackPoints) {
            const leftSide = trackPoint.leftEdge;
            const rightSide = trackPoint.rightEdge;

            const direction = rightSide.subtract(leftSide);
            if (this.random() < density) {
                const distance = (this.random() * (1 - percentageDistanceFromSides * 2) + percentageDistanceFromSides);
                const positionHazard = leftSide.add(direction.scale(distance));
                positionHazard.y += height;
                hazardPoints.push(positionHazard);
            }
        }
        return hazardPoints;
    }

    private getTrackControlPoints(numPoints: number, radius: number, lateralVariance: number, heightVariance: number): Array<Vector3> {
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

    private getTreePoints(density: number, radius: number, minDistance: number, trackPoints: Array<ITrackPoint>): Array<Vector3> {
        const trees: Array<Vector3> = [];
        for (const trackPoint of trackPoints) {
            const leftSide = trackPoint.leftEdge;
            const rightSide = trackPoint.rightEdge;

            const direction = rightSide.subtract(leftSide);
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

        // Delete trees that are generated too close to each other or to the track.
        const minDistanceSquared = minDistance * minDistance;
        const spacedTrees: Array<Vector3> = [];
        for (const tree of trees) {
            let isSpaced = true;

            for (const spacedTree of spacedTrees) {
                if (Vector3.DistanceSquared(tree, spacedTree) < minDistanceSquared) {
                    isSpaced = false;
                    break;
                }
            }

            for (const trackPoint of trackPoints) {
                if (Vector3.DistanceSquared(tree, trackPoint.leftApron) < minDistanceSquared ||
                    Vector3.DistanceSquared(tree, trackPoint.leftEdge) < minDistanceSquared ||
                    Vector3.DistanceSquared(tree, trackPoint.point) < minDistanceSquared ||
                    Vector3.DistanceSquared(tree, trackPoint.rightEdge) < minDistanceSquared ||
                    Vector3.DistanceSquared(tree, trackPoint.rightApron) < minDistanceSquared) {
                    isSpaced = false;
                    break;
                }
            }

            if (isSpaced) {
                spacedTrees.push(tree);
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
