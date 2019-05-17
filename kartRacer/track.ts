import { Vector3, Curve3, RibbonBuilder, PBRMaterial, Texture, Tools, Scene, TransformNode, Mesh, InstancedMesh, Scalar, Engine, Vector2, Nullable } from "@babylonjs/core";
import { KartEngine } from "./engine";

interface ITrackPoint {
    point: Vector3;

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
    public readonly controlPoints: Vector3[];

    private _varianceSeed: number;

    constructor(scene: Scene, options: { radius: number, numPoints: number, varianceSeed: number, lateralVariance: number, heightVariance: number, width: number, height: number }) {
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
        const apronLengthPercentage = 0.15;
        const flatWidthPercentage = 0.30;
        const wallHeight = options.height;
        const wallWidth = 1.0;

        const trackPoints = new Array<ITrackPoint>(points.length);
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

            trackPoints[index] = {
                point: point,

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

        const vScale = Math.round(curve.length() / (options.width * 2));

        const track = new TransformNode("track", scene);
        this.createRoad(scene, trackPoints, track, vScale);
        this.createAprons(scene, trackPoints, track, vScale);
        this.createFlats(scene, trackPoints, track, vScale);
        this.createWalls(scene, trackPoints, track, vScale);
        this.createGoal(scene, trackPoints, track);
        this.createTrees(scene, trackPoints, track);
        this.createHazards(scene, trackPoints, track);

        this.startPoint = getPoint(0);
        this.startTarget = getPoint(1);
    }

    private createRoad(scene: Scene, trackPoints: Array<ITrackPoint>, track: TransformNode, vScale: number): Mesh {
        const road = RibbonBuilder.CreateRibbon("road", {
            pathArray: trackPoints.map(p => [p.rightEdge, p.leftEdge]),
            uvs: this.createUVs(trackPoints, [0.15, 0.85]),
        }, scene);

        const material = this.createMaterial("track", scene);
        material.albedoTexture = this.createTexture("public/textures/SimpleTrack_basecolor.png", scene, vScale);
        material.bumpTexture = this.createTexture("public/textures/SimpleTrack_normal.png", scene, vScale);
        material.metallicTexture = this.createTexture("public/textures/SimpleTrack_ORM.png", scene, vScale);

        road.material = material;
        road.parent = track;

        return road;
    }

    private createAprons(scene: Scene, trackPoints: Array<ITrackPoint>, track: TransformNode, vScale: number): void {
        const aprons = new TransformNode("aprons", scene);
        aprons.parent = track;

        const right = RibbonBuilder.CreateRibbon("right", {
            pathArray: trackPoints.map(p => [p.rightApron, p.rightEdge]),
            uvs: this.createUVs(trackPoints, [0.85, 1]),
        }, scene);

        const left = RibbonBuilder.CreateRibbon("left", {
            pathArray: trackPoints.map(p => [p.leftEdge, p.leftApron]),
            uvs: this.createUVs(trackPoints, [0, 0.15]),
        }, scene);

        const material = this.createMaterial("wall", scene);
        material.albedoTexture = this.createTexture("public/textures/SimpleTrack_basecolor.png", scene, vScale);

        right.material = material;
        right.parent = aprons;

        left.material = material;
        left.parent = aprons;
    }

    private createFlats(scene: Scene, trackPoints: Array<ITrackPoint>, track: TransformNode, vScale: number): void {
        const flats = new TransformNode("flats", scene);
        flats.parent = track;

        const right = RibbonBuilder.CreateRibbon("right", {
            pathArray: trackPoints.map(p => [p.rightFlat, p.rightApron])
        }, scene);

        const left = RibbonBuilder.CreateRibbon("left", {
            pathArray: trackPoints.map(p => [p.leftApron, p.leftFlat])
        }, scene);

        const material = this.createMaterial("wall", scene);

        right.material = material;
        right.parent = flats;

        left.material = material;
        left.parent = flats;
    }

    private createWalls(scene: Scene, trackPoints: Array<ITrackPoint>, track: TransformNode, vScale: number): void {
        const walls = new TransformNode("walls", scene);
        walls.parent = track;

        const right = RibbonBuilder.CreateRibbon("rightWall", {
            pathArray: trackPoints.map(p => [p.rightWallOutside, p.rightWallInside, p.rightFlat])
        }, scene);

        const left = RibbonBuilder.CreateRibbon("leftWall", {
            pathArray: trackPoints.map(p => [p.leftFlat, p.leftWallInside, p.leftWallOutside])
        }, scene);

        const material = this.createMaterial("wall", scene);

        right.material = material;
        right.parent = walls;

        left.material = material;
        left.parent = walls;
    }

    private createGoal(scene: Scene, trackPoints: Array<ITrackPoint>, track: TransformNode): void {
        const percent = 0.015;
        const limit = Math.round(trackPoints.length * percent);

        const pathArray = new Array<Array<Vector3>>();
        for (let index = 0; index < limit; ++index) {
            pathArray.push([trackPoints[index].rightEdge, trackPoints[index].leftEdge]);
        }

        const goal = RibbonBuilder.CreateRibbon("goal", {
            pathArray: pathArray
        });

        const material = this.createMaterial("goal", scene);

        const albedoTexture = new Texture("public/textures/goal_basecolor.png", scene);
        material.albedoTexture = albedoTexture;

        goal.material = material;
        goal.parent = track;
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

    private createTrees(scene: Scene, trackPoints: Array<ITrackPoint>, track: TransformNode): void {
        const trees = new TransformNode("trees", scene);
        trees.parent = track;
        const treePoints = this.getTreePoints(trackPoints, 0.9, 10.0, 7.0);
        for (const treePoint of treePoints) {
            const tree = KartEngine.instance.assets.tree.createInstance("tree");
            tree.isPickable = false;
            tree.position.copyFrom(treePoint);
            tree.parent = trees;
        }
    }

    private createHazards(scene: Scene, trackPoints: Array<ITrackPoint>, track: TransformNode): void {
        const hazards = new TransformNode("hazards", scene);
        hazards.parent = track;
        const bombHazards = new TransformNode("bombs", scene);
        bombHazards.parent = hazards;
        const boostHazards = new TransformNode("boosts", scene);
        boostHazards.parent = hazards;
        const bumperHazards = new TransformNode("bumpers", scene);
        bumperHazards.parent = hazards;
        const poisonHazards = new TransformNode("poisons", scene);
        poisonHazards.parent = hazards;

        const instances: Array<InstancedMesh> = [];
        function createHazard(name: string, mesh: Mesh, point: Vector3, rotationY: number, group: TransformNode): void {
            const hazardScale = 4;
            const instance = mesh.createInstance(name);
            instance.scaling.scaleInPlace(hazardScale);
            instance.addRotation(0, rotationY, 0);
            instance.position.copyFrom(point);
            instance.parent = group;
            instances.push(instance);
        }

        const hazardPoints = this.getHazardPoints(1.5, 0.1, trackPoints);
        for (const hazardPoint of hazardPoints) {
            const hazardType = this.random();
            const rotationY = this.random();
            if (hazardType < 0.25) {
                createHazard("bomb", KartEngine.instance.assets.bomb, hazardPoint, rotationY, bombHazards);
            }
            else if (hazardType < 0.50) {
                createHazard("boost", KartEngine.instance.assets.boost, hazardPoint, rotationY, boostHazards);
            }
            else if (hazardType < 0.75) {
                createHazard("bumper", KartEngine.instance.assets.bumper, hazardPoint, rotationY, bumperHazards);
            }
            else {
                createHazard("poison", KartEngine.instance.assets.poison, hazardPoint, rotationY, poisonHazards);
            }
        }

        scene.onBeforeRenderObservable.add(() => {
            let scalar = Date.now() * 0.002;
            for (const instance of instances) {
                const scale = 0.5 * Math.sin(scalar++);
                instance.scaling.set(4.0 + scale, 4.0 - scale, 4.0 + scale);
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
        material.metallic = 0;
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
