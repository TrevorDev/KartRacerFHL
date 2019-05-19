import { Vector3, Curve3, RibbonBuilder, PBRMaterial, Texture, Tools, Scene, TransformNode, Mesh, InstancedMesh, Scalar, Engine, Vector2, Nullable, Tags, Material } from "@babylonjs/core";
import { Assets } from "./assets";

export interface ITrackPoint {
    point: Vector3;
    forward: Vector3;
    up: Vector3;
    right: Vector3;

    leftEdge: Vector3;
    leftApron: Vector3;
    leftFlat: Vector3;
    leftWallInside: Vector3;
    leftWallOutside: Vector3;

    rightEdge: Vector3;
    rightApron: Vector3;
    rightFlat: Vector3;
    rightWallInside: Vector3;
    rightWallOutside: Vector3;
}

export class Track {
    public readonly startPoint: Vector3;
    public readonly startTarget: Vector3;
    public readonly trackPoints: ITrackPoint[];

    private _varianceSeed: number;
    private _track: TransformNode;

    constructor(scene: Scene, assets: Assets, options: { radius: number, numPoints: number, varianceSeed: number, lateralVariance: number, heightVariance: number, width: number, height: number }) {
        this._varianceSeed = options.varianceSeed;

        const controlPoints = this._getControlPoints(
            options.numPoints,
            options.radius,
            options.lateralVariance,
            options.heightVariance
        );

        const curvatureFactor = Math.ceil((options.radius + options.lateralVariance + options.heightVariance) * 0.05);
        const curve = this._getCurve(controlPoints, curvatureFactor);
        const curveLength = curve.length();
        const points = curve.getPoints();

        function getPoint(index: number): Vector3 {
            const length = points.length;
            return points[(index + length) % length];
        }

        function getForward(index: number): Vector3 {
            return getPoint(index + 1).subtract(getPoint(index - 1)).normalize();
        }

        function getUp(index: number): Vector3 {
            const curvatureVector = getPoint(index - curvatureFactor).add(getPoint(index + curvatureFactor)).scaleInPlace(0.5).subtractInPlace(getPoint(index));
            return curvatureVector.addInPlaceFromFloats(0, curvatureFactor * 10, 0).scaleInPlace(0.5).normalize();
        }

        const apronAngle = Tools.ToRadians(15);
        const apronLengthPercentage = 0.15;
        const flatWidthPercentage = 0.30;
        const wallHeight = options.height;
        const wallWidth = 1.0;

        this.trackPoints = new Array<ITrackPoint>(points.length);
        for (let index = 0; index < points.length; ++index) {
            const point = points[index];
            const forward = getForward(index);
            const up = getUp(index);
            const right = Vector3.Cross(up, forward);
            const flatUp = Vector3.UpReadOnly;
            const flatRight = Vector3.Cross(flatUp, forward);

            const edgeVector = right.scale(options.width * (0.5 - apronLengthPercentage));
            const apronVector1 = edgeVector.add(right.scale(options.width * apronLengthPercentage * Math.cos(apronAngle)));
            const apronVector2 = up.scale(options.width * apronLengthPercentage * Math.sin(apronAngle));
            const flatWidthVector = right.scale(options.width * flatWidthPercentage);
            const wallHeightVector = flatUp.scale(wallHeight);
            const wallWidthVector = flatRight.scale(wallWidth);

            const leftEdge = point.subtract(edgeVector);
            const leftApron = point.subtract(apronVector1).addInPlace(apronVector2);
            const leftFlat = leftApron.subtract(flatWidthVector);
            const leftWallInside = leftFlat.add(wallHeightVector);
            const leftWallOutside = leftWallInside.subtract(wallWidthVector);

            const rightEdge = point.add(edgeVector);
            const rightApron = point.add(apronVector1).addInPlace(apronVector2);
            const rightFlat = rightApron.add(flatWidthVector);
            const rightWallInside = rightFlat.add(wallHeightVector);
            const rightWallOutside = rightWallInside.add(wallWidthVector);

            this.trackPoints[index] = {
                point: point,
                forward: forward,
                up: up,
                right: right,

                leftEdge: leftEdge,
                leftApron: leftApron,
                leftFlat: leftFlat,
                leftWallInside: leftWallInside,
                leftWallOutside: leftWallOutside,

                rightEdge: rightEdge,
                rightApron: rightApron,
                rightFlat: rightFlat,
                rightWallInside: rightWallInside,
                rightWallOutside: rightWallOutside,
            };
        }

        // Finish loop
        this.trackPoints.push(this.trackPoints[0]);

        this._track = new TransformNode("track", scene);

        // Update materials
        this._updateTextures(assets.trackRoadMaterial, Math.round(curveLength / options.width));
        this._updateTextures(assets.trackBoundaryMaterial, Math.round(curveLength / options.width));
        this._updateTextures(assets.trackWallMaterial, Math.round(curveLength / (wallHeight * 5)));

        // Create track parts
        this._createRoad(scene, assets, this.trackPoints);
        this._createAprons(scene, assets, this.trackPoints);
        this._createFlats(scene, assets, this.trackPoints);
        this._createWalls(scene, assets, this.trackPoints);
        this._createGoal(scene, assets, this.trackPoints);

        // Remove extra loop point.
        this.trackPoints.length--;

        // Create track objects
        this._createTrees(scene, assets, this.trackPoints);
        this._createHazards(scene, assets, this.trackPoints);

        this.startPoint = getPoint(0);
        this.startTarget = getPoint(1);
    }

    public dispose(): void {
        this._track.dispose();
    }

    private _createRoad(scene: Scene, assets: Assets, trackPoints: Array<ITrackPoint>): Mesh {
        const road = RibbonBuilder.CreateRibbon("road", {
            pathArray: trackPoints.map(p => [p.rightEdge, p.leftEdge]),
            uvs: this._createUVs(trackPoints, [0.15, 0.85]),
        }, scene);

        road.material = assets.trackRoadMaterial;
        road.parent = this._track;

        Tags.AddTagsTo(road, "road");

        return road;
    }

    private _createAprons(scene: Scene, assets: Assets, trackPoints: Array<ITrackPoint>): void {
        const aprons = new TransformNode("aprons", scene);
        aprons.parent = this._track;

        const right = RibbonBuilder.CreateRibbon("right", {
            pathArray: trackPoints.map(p => [p.rightApron, p.rightEdge]),
            uvs: this._createUVs(trackPoints, [1/3, 0]),
        }, scene);

        const left = RibbonBuilder.CreateRibbon("left", {
            pathArray: trackPoints.map(p => [p.leftEdge, p.leftApron]),
            uvs: this._createUVs(trackPoints, [0, 1/3]),
        }, scene);

        right.material = assets.trackBoundaryMaterial;
        right.parent = aprons;
        Tags.AddTagsTo(right, "apron");

        left.material = assets.trackBoundaryMaterial;
        left.parent = aprons;
        Tags.AddTagsTo(left, "apron");
    }

    private _createFlats(scene: Scene, assets: Assets, trackPoints: Array<ITrackPoint>): void {
        const flats = new TransformNode("flats", scene);
        flats.parent = this._track;

        const right = RibbonBuilder.CreateRibbon("right", {
            pathArray: trackPoints.map(p => [p.rightFlat, p.rightApron]),
            uvs: this._createUVs(trackPoints, [1, 1/3]),
        }, scene);

        const left = RibbonBuilder.CreateRibbon("left", {
            pathArray: trackPoints.map(p => [p.leftApron, p.leftFlat]),
            uvs: this._createUVs(trackPoints, [1/3, 1]),
        }, scene);

        right.material = assets.trackBoundaryMaterial;
        right.parent = flats;
        Tags.AddTagsTo(right, "flat");

        left.material = assets.trackBoundaryMaterial;
        left.parent = flats;
        Tags.AddTagsTo(left, "flat");
    }

    private _createWalls(scene: Scene, assets: Assets, trackPoints: Array<ITrackPoint>): void {
        const walls = new TransformNode("walls", scene);
        walls.parent = this._track;

        const right = RibbonBuilder.CreateRibbon("rightWall", {
            pathArray: trackPoints.map(p => [p.rightWallOutside, p.rightWallInside, p.rightFlat]),
            uvs: this._createUVs(trackPoints, [1, 0.8, 0]),
        }, scene);

        const left = RibbonBuilder.CreateRibbon("leftWall", {
            pathArray: trackPoints.map(p => [p.leftFlat, p.leftWallInside, p.leftWallOutside]),
            uvs: this._createUVs(trackPoints, [0, 0.8, 1]),
        }, scene);

        right.material = assets.trackWallMaterial;
        right.parent = walls;
        Tags.AddTagsTo(right, "wall");

        left.material = assets.trackWallMaterial;
        left.parent = walls;
        Tags.AddTagsTo(left, "wall");
    }

    private _createGoal(scene: Scene, assets: Assets, trackPoints: Array<ITrackPoint>): void {
        const indices = [0, 1];
        const goal = RibbonBuilder.CreateRibbon("goal", {
            pathArray: indices.map(index => [trackPoints[index].rightEdge, trackPoints[index].leftEdge])
        }, scene);

        goal.material = assets.trackGoalMaterial;
        goal.parent = this._track;
    }

    private _createUVs(trackPoints: Array<ITrackPoint>, us: Array<number>): Array<Vector2> {
        let totalDistance = 0;
        let lastTrackPoint: Nullable<ITrackPoint> = null;
        const uvs = new Array<Vector2>();

        for (const trackPoint of trackPoints) {
            if (lastTrackPoint) {
                totalDistance += Vector3.Distance(lastTrackPoint.point, trackPoint.point);
            }

            for (const u of us) {
                uvs.push(new Vector2(u, totalDistance));
            }

            lastTrackPoint = trackPoint;
        }

        for (const uv of uvs) {
            uv.y /= totalDistance;
        }

        return uvs;
    }

    private _createTrees(scene: Scene, assets: Assets, trackPoints: Array<ITrackPoint>): void {
        const trees = new TransformNode("trees", scene);
        trees.parent = this._track;
        const treePoints = this._getTreePoints(trackPoints, 0.9, 10.0, 7.0);
        for (const treePoint of treePoints) {
            const instance = assets.tree.createInstance("tree");
            instance.isPickable = false;
            instance.position.copyFrom(treePoint);
            instance.rotation.y = this._random() * Scalar.TwoPi;
            instance.parent = trees;
        }
    }

    private _createHazards(scene: Scene, assets: Assets, trackPoints: Array<ITrackPoint>): void {
        const hazards = new TransformNode("hazards", scene);
        hazards.parent = this._track;
        const bombHazards = new TransformNode("bombs", scene);
        bombHazards.parent = hazards;
        const boostHazards = new TransformNode("boosts", scene);
        boostHazards.parent = hazards;
        const bumperHazards = new TransformNode("bumpers", scene);
        bumperHazards.parent = hazards;
        const poisonHazards = new TransformNode("poison", scene);
        poisonHazards.parent = hazards;

        const instances: Array<InstancedMesh> = [];
        const createHazard = (name: string, mesh: Mesh, point: Vector3, rotationY: number, group: TransformNode, hazardScale: number): void => {
            const instance = mesh.createInstance(name);
            instance.isPickable = false;
            instance.scaling.scaleInPlace(hazardScale);
            instance.addRotation(0, rotationY, 0);
            instance.position.copyFrom(point);
            instance.rotation.y = this._random() * Scalar.TwoPi;
            instance.parent = group;
            instances.push(instance);
        };

        const hazardPoints = this._getHazardPoints(1.5, 0.13, trackPoints);
        for (const hazardPoint of hazardPoints) {
            const hazardType = this._random();
            const rotationY = this._random();
            if (hazardType < 0.2) {
                createHazard("bomb", assets.bomb, hazardPoint, rotationY, bombHazards, 1);
            }
            else if (hazardType < 0.6) {
                createHazard("boost", assets.boost, hazardPoint, rotationY, boostHazards, 8);
            }
            else if (hazardType < 0.8) {
                createHazard("bumper", assets.bumper, hazardPoint, rotationY, bumperHazards, 4);
            }
            else {
                createHazard("poison", assets.poison, hazardPoint, rotationY, poisonHazards, 4);
            }
        }

        scene.onBeforeRenderObservable.add(() => {
            let scalar = Date.now() * 0.002;
            for (const instance of instances) {
                let scaleOriginal = 4.0;
                if (instance.id == "bomb")
                {
                    scaleOriginal = .2;
                }
                const growth = scaleOriginal/8 * Math.sin(scalar++);
                instance.scaling.set(scaleOriginal + growth, scaleOriginal - growth, scaleOriginal+ growth);
            }
        });
    }

    private _getHazardPoints(height: number, density: number, trackPoints: Array<ITrackPoint>): Array<Vector3> {
        const hazardPoints = new Array<Vector3>();
        const percentageDistanceFromSides = .1;
        for (let index = 3; index < trackPoints.length - 1; ++index) {
            const trackPoint = trackPoints[index];
            const leftSide = trackPoint.leftEdge;
            const rightSide = trackPoint.rightEdge;

            const direction = rightSide.subtract(leftSide);
            if (this._random() < density) {
                const distance = (this._random() * (1 - percentageDistanceFromSides * 2) + percentageDistanceFromSides);
                const positionHazard = leftSide.add(direction.scale(distance));
                positionHazard.y += height;
                hazardPoints.push(positionHazard);
            }
        }
        return hazardPoints;
    }

    private _getControlPoints(numPoints: number, radius: number, lateralVariance: number, heightVariance: number): Array<Vector3> {
        const points = new Array<Vector3>(numPoints);
        const reverse = this._random() < 0.5;

        for (let index = 0; index < numPoints; ++index) {
            const angle = (reverse ? (numPoints - 1 - index) : index) / numPoints * Scalar.TwoPi;
            const pert = this._random() * lateralVariance - lateralVariance / 2;
            const x = (radius + pert) * Math.sin(angle);
            const y = this._random() * heightVariance - heightVariance / 2;
            const z = (radius + pert) * Math.cos(angle);
            points[index] = new Vector3(x, y, z);
        }

        return points;
    }

    private _getCurve(controlPoints: Array<Vector3>, numPoints: number): Curve3 {
        const points = new Array<Vector3>();
        const count = controlPoints.length;
        const step = 1 / numPoints;

        for (let index = 0; index < count; ++index) {
            for (let i = 0, amount = 0; i < numPoints; ++i, amount += step) {
                points.push(Vector3.CatmullRom(
                    controlPoints[(index + count - 1) % count],
                    controlPoints[(index + count + 0) % count],
                    controlPoints[(index + count + 1) % count],
                    controlPoints[(index + count + 2) % count],
                    amount
                ));
            }
        }

        return new Curve3(points);
    }

    private _getTreePoints(trackPoints: Array<ITrackPoint>, density: number, width: number, offset: number): Array<Vector3> {
        const trees: Array<Vector3> = [];
        for (const trackPoint of trackPoints) {
            const leftSide = trackPoint.leftFlat;
            const rightSide = trackPoint.rightFlat;

            const direction = rightSide.subtract(leftSide).normalize();
            direction.y = 0;

            if (this._random() < density) {
                const distanceFromPath = this._random() * width + offset;
                trees.push(rightSide.add(direction.scale(distanceFromPath)));
            }

            if (this._random() < density) {
                const distanceFromPath = this._random() * width + offset;
                trees.push(leftSide.subtract(direction.scale(distanceFromPath)));
            }
        }

        // Delete trees that are generated too close to each other.
        const offsetSquared = offset * offset;
        const spacedTrees: Array<Vector3> = [];
        for (const tree of trees) {
            if (!spacedTrees.some(spacedTree => Vector3.DistanceSquared(tree, spacedTree) < offsetSquared)) {
                spacedTrees.push(tree);
            }
        }

        return spacedTrees;
    }

    private _updateTextures(material: PBRMaterial, vScale: number): void {
        (material.albedoTexture as Texture).vScale = vScale;
        (material.bumpTexture as Texture).vScale = vScale;
        (material.metallicTexture as Texture).vScale = vScale;
    }

    // https://stackoverflow.com/a/19303725/11256124
    private _random(): number {
        const x = Math.sin(this._varianceSeed++) * 10000;
        return x - Math.floor(x);
    }
}
