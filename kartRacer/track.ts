import { Vector3, Curve3, RibbonBuilder, PBRMaterial, Texture, Tools, Scene, TransformNode, Mesh, InstancedMesh, Scalar, Engine, Vector2, Nullable, Tags } from "@babylonjs/core";
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

        const controlPoints = this.getControlPoints(
            options.numPoints,
            options.radius,
            options.lateralVariance,
            options.heightVariance
        );

        const curvatureFactor = Math.ceil((options.radius + options.lateralVariance + options.heightVariance) * 0.05);
        const curve = this.getCurve(controlPoints, curvatureFactor);
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
        this.createRoad(scene, this.trackPoints, Math.round(curveLength / options.width));
        this.createAprons(scene, this.trackPoints, Math.round(curveLength / options.width));
        this.createFlats(scene, this.trackPoints, Math.round(curveLength / options.width));
        this.createWalls(scene, this.trackPoints, Math.round(curveLength / (wallHeight * 5)));
        this.createGoal(scene, this.trackPoints);
        this.createTrees(scene, assets, this.trackPoints);
        this.createHazards(scene, assets, this.trackPoints);

        // Remove extra loop point.
        this.trackPoints.length--;

        this.startPoint = getPoint(0);
        this.startTarget = getPoint(1);
    }

    public dispose(): void {
        this._track.dispose(false, true);
    }

    private createRoad(scene: Scene, trackPoints: Array<ITrackPoint>, vScale: number): Mesh {
        const road = RibbonBuilder.CreateRibbon("road", {
            pathArray: trackPoints.map(p => [p.rightEdge, p.leftEdge]),
            uvs: this.createUVs(trackPoints, [0.15, 0.85]),
        }, scene);

        const material = this.createMaterial("track", scene);
        material.albedoTexture = this.createTexture("public/textures/SimpleTrack_basecolor.png", scene, vScale);
        material.bumpTexture = this.createTexture("public/textures/SimpleTrack_normal.png", scene, vScale);
        material.metallicTexture = this.createTexture("public/textures/SimpleTrack_ORM.png", scene, vScale);

        road.material = material;
        road.parent = this._track;

        Tags.AddTagsTo(road, "road");

        return road;
    }

    private createAprons(scene: Scene, trackPoints: Array<ITrackPoint>, vScale: number): void {
        const aprons = new TransformNode("aprons", scene);
        aprons.parent = this._track;

        const right = RibbonBuilder.CreateRibbon("right", {
            pathArray: trackPoints.map(p => [p.rightApron, p.rightEdge]),
            uvs: this.createUVs(trackPoints, [1/3, 0]),
        }, scene);

        const left = RibbonBuilder.CreateRibbon("left", {
            pathArray: trackPoints.map(p => [p.leftEdge, p.leftApron]),
            uvs: this.createUVs(trackPoints, [0, 1/3]),
        }, scene);

        const material = this.createMaterial("aprons", scene);
        material.albedoTexture = this.createTexture("public/textures/TrackBoundary_basecolor.png", scene, vScale);
        material.bumpTexture = this.createTexture("public/textures/TrackBoundary_normal.png", scene, vScale);
        material.metallicTexture = this.createTexture("public/textures/TrackBoundary_ORM.png", scene, vScale);

        right.material = material;
        right.parent = aprons;
        Tags.AddTagsTo(right, "apron");

        left.material = material;
        left.parent = aprons;
        Tags.AddTagsTo(left, "apron");
    }

    private createFlats(scene: Scene, trackPoints: Array<ITrackPoint>, vScale: number): void {
        const flats = new TransformNode("flats", scene);
        flats.parent = this._track;

        const right = RibbonBuilder.CreateRibbon("right", {
            pathArray: trackPoints.map(p => [p.rightFlat, p.rightApron]),
            uvs: this.createUVs(trackPoints, [1, 1/3]),
        }, scene);

        const left = RibbonBuilder.CreateRibbon("left", {
            pathArray: trackPoints.map(p => [p.leftApron, p.leftFlat]),
            uvs: this.createUVs(trackPoints, [1/3, 1]),
        }, scene);

        const material = this.createMaterial("flats", scene);
        material.albedoTexture = this.createTexture("public/textures/TrackBoundary_basecolor.png", scene, vScale);
        material.bumpTexture = this.createTexture("public/textures/TrackBoundary_normal.png", scene, vScale);
        material.metallicTexture = this.createTexture("public/textures/TrackBoundary_ORM.png", scene, vScale);

        right.material = material;
        right.parent = flats;
        Tags.AddTagsTo(right, "flat");

        left.material = material;
        left.parent = flats;
        Tags.AddTagsTo(left, "flat");
    }

    private createWalls(scene: Scene, trackPoints: Array<ITrackPoint>, vScale: number): void {
        const walls = new TransformNode("walls", scene);
        walls.parent = this._track;

        const right = RibbonBuilder.CreateRibbon("rightWall", {
            pathArray: trackPoints.map(p => [p.rightWallOutside, p.rightWallInside, p.rightFlat]),
            uvs: this.createUVs(trackPoints, [1, 0.8, 0]),
        }, scene);

        const left = RibbonBuilder.CreateRibbon("leftWall", {
            pathArray: trackPoints.map(p => [p.leftFlat, p.leftWallInside, p.leftWallOutside]),
            uvs: this.createUVs(trackPoints, [0, 0.8, 1]),
        }, scene);

        const material = this.createMaterial("wall", scene);
        material.albedoTexture = this.createTexture("public/textures/StylizedWall_basecolor.png", scene, vScale);
        material.bumpTexture = this.createTexture("public/textures/StylizedWall_normal.png", scene, vScale);
        material.metallicTexture = this.createTexture("public/textures/StylizedWall_ORM.png", scene, vScale);

        right.material = material;
        right.parent = walls;
        Tags.AddTagsTo(right, "wall");

        left.material = material;
        left.parent = walls;
        Tags.AddTagsTo(left, "wall");
    }

    private createGoal(scene: Scene, trackPoints: Array<ITrackPoint>): void {
        const indices = [0, 1];
        const goal = RibbonBuilder.CreateRibbon("goal", {
            pathArray: indices.map(index => [trackPoints[index].rightEdge, trackPoints[index].leftEdge])
        });

        const material = this.createMaterial("goal", scene);

        const albedoTexture = new Texture("public/textures/goal_basecolor.png", scene);
        material.albedoTexture = albedoTexture;

        goal.material = material;
        goal.parent = this._track;
    }

    private createUVs(trackPoints: Array<ITrackPoint>, us: Array<number>): Array<Vector2> {
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

    private createTrees(scene: Scene, assets: Assets, trackPoints: Array<ITrackPoint>): void {
        const trees = new TransformNode("trees", scene);
        trees.parent = this._track;
        const treePoints = this.getTreePoints(trackPoints, 0.9, 10.0, 7.0);
        for (const treePoint of treePoints) {
            const tree = assets.tree.createInstance("tree");
            tree.isPickable = false;
            tree.position.copyFrom(treePoint);
            tree.parent = trees;
        }
    }

    private createHazards(scene: Scene, assets: Assets, trackPoints: Array<ITrackPoint>): void {
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
        function createHazard(name: string, mesh: Mesh, point: Vector3, rotationY: number, group: TransformNode, hazardScale: number): void {
            const instance = mesh.createInstance(name);
            instance.isPickable = false;
            instance.scaling.scaleInPlace(hazardScale);
            instance.addRotation(0, rotationY, 0);
            instance.position.copyFrom(point);
            instance.parent = group;
            instances.push(instance);
        }

        const hazardPoints = this.getHazardPoints(1.5, 0.13, trackPoints);
        for (const hazardPoint of hazardPoints) {
            const hazardType = this.random();
            const rotationY = this.random();
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

    private getControlPoints(numPoints: number, radius: number, lateralVariance: number, heightVariance: number): Array<Vector3> {
        const points = new Array<Vector3>(numPoints);
        for (let index = 0; index < numPoints; ++index) {
            const pert = this.random() * lateralVariance - lateralVariance / 2;
            const x = (radius + pert) * Math.sin(index * Scalar.TwoPi / numPoints);
            const y = this.random() * heightVariance - heightVariance / 2;
            const z = (radius + pert) * Math.cos(index * Scalar.TwoPi / numPoints);
            points[index] = new Vector3(x, y, z);
        }

        return points;
    }

    private getCurve(controlPoints: Array<Vector3>, numPoints: number): Curve3 {
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

    private getTreePoints(trackPoints: Array<ITrackPoint>, density: number, width: number, offset: number): Array<Vector3> {
        const trees: Array<Vector3> = [];
        for (const trackPoint of trackPoints) {
            const leftSide = trackPoint.leftFlat;
            const rightSide = trackPoint.rightFlat;

            const direction = rightSide.subtract(leftSide).normalize();
            direction.y = 0;

            if (this.random() < density) {
                const distanceFromPath = this.random() * width + offset;
                trees.push(rightSide.add(direction.scale(distanceFromPath)));
            }

            if (this.random() < density) {
                const distanceFromPath = this.random() * width + offset;
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

    private createMaterial(name: string, scene: Scene): PBRMaterial {
        const material = new PBRMaterial(name, scene);
        material.metallic = 1;
        material.roughness = 1;
        material.backFaceCulling = false;
        material.twoSidedLighting = true;
        material.useMetallnessFromMetallicTextureBlue = true;
        material.useRoughnessFromMetallicTextureGreen = true;
        material.useRoughnessFromMetallicTextureAlpha = false;
        return material;
    }

    private createTexture(path: string, scene: Scene, vScale: number): Texture {
        const texture = new Texture(path, scene);
        texture.vScale = vScale;
        return texture;
    }

    // https://stackoverflow.com/a/19303725/11256124
    private random(): number {
        const x = Math.sin(this._varianceSeed++) * 10000;
        return x - Math.floor(x);
    }
}
