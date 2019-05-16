import { Scene, ActionManager, ExecuteCodeAction, Observer, Engine } from '@babylonjs/core';
import { KartEngine } from './engine';

export interface IKartInput {
    horizontal: number; // Left = -1, Right = 1, Center = 0
    accelerate: number; // 1 = completely pressed
    brake: number; // 1 = completely pressed
    drift: boolean;
}

export class KartInput_KeyboardAndTouch implements IKartInput {
    public horizontal: number;
    public accelerate: number;
    public brake: number;
    public drift: boolean;

    // https://www.babylonjs-playground.com/#Y1W3F9

    private _scene: Scene;
    private _keymap: any;
    private _inputObserver: Observer<Scene>;
    private _priorX: number;
    private _priorY: number;
    private _deltaTime: number;

    private updateFromKeyboard(): void {
        // Acceleration
        this.accelerate = 0;
        if (this._keymap["w"] || this._keymap["W"] || this._keymap["ArrowUp"]) {
            this.accelerate = 1;
        };

        // Left/Right axis
        this.horizontal = 0;
        if (this._keymap["a"] || this._keymap["A"] || this._keymap["ArrowLeft"]) {
            this.horizontal -= 1;
        }
        if (this._keymap["d"] || this._keymap["D"] || this._keymap["ArrowRight"]) {
            this.horizontal += 1;
        };

        // Brake
        this.brake = 0;
        if (this._keymap["s"] || this._keymap["S"] || this._keymap["ArrowDown"]) {
            this.brake = 1;
        };

        // Handbrake/drift
        this.drift = false;
        if (this._keymap["Shift"]) {
            this.drift = true;
        };
    }

    private updateFromDragging(): void {
        this._deltaTime = Engine.Instances[0].getDeltaTime() / 1000.0;

        this.accelerate += (this._priorY - this._scene.pointerY) * this._deltaTime;
        this.horizontal += (this._scene.pointerX - this._priorX) * this._deltaTime;

        this.accelerate = Math.min(1.0, Math.max(-1.0, this.accelerate));
        this.horizontal = Math.min(1.0, Math.max(-1.0, this.horizontal));

        this._priorX = this._scene.pointerX;
        this._priorY = this._scene.pointerY;
    }

    private updateFromNotDragging(): void {
        this._deltaTime = Engine.Instances[0].getDeltaTime() / 1000.0;

        this.accelerate *= (1.0 - 10.0 * this._deltaTime);
        this.horizontal *= (1.0 - 10.0 * this._deltaTime);

        if (Math.abs(this.accelerate) < 0.05 && Math.abs(this.horizontal) < 0.05) {
            this._scene.onBeforeRenderObservable.remove(this._inputObserver);
            
            var self = this;
            this._inputObserver = this._scene.onBeforeRenderObservable.add(() => {
                self.updateFromKeyboard()
            });
        }
    }

    constructor(scene: Scene) {
        var self = this;

        this._scene = scene;
        this._keymap = {};
        if (!scene.actionManager) {
            scene.actionManager = new ActionManager(this._scene);
        };

        // register with the action manager to set the keymap values as either pressed or not pressed depending on the event
        this._scene.actionManager.registerAction(new ExecuteCodeAction(ActionManager.OnKeyDownTrigger, function (evt) {
            self._keymap[evt.sourceEvent.key] = evt.sourceEvent.type == "keydown";
        }));

        this._scene.actionManager.registerAction(new ExecuteCodeAction(ActionManager.OnKeyUpTrigger, function (evt) {
            self._keymap[evt.sourceEvent.key] = evt.sourceEvent.type == "keydown";
        }));

        var pointersDown: number = 0;
        scene.onPointerDown = () => {
            // TODO: Constrain touch down to a region.

            pointersDown += 1;
            if (pointersDown !== 1) {
                return;
            }

            self._priorX = scene.pointerX;
            self._priorY = scene.pointerY;

            scene.onBeforeRenderObservable.remove(this._inputObserver);
            this._inputObserver = scene.onBeforeRenderObservable.add(() => {
                self.updateFromDragging();
            });
        };
        scene.onPointerUp = () => {
            pointersDown -= 1;
            if (pointersDown !== 0) {
                return;
            }

            scene.onBeforeRenderObservable.remove(this._inputObserver);
            this._inputObserver = scene.onBeforeRenderObservable.add(() => {
                self.updateFromNotDragging();
            });
        };

        this._inputObserver = scene.onBeforeRenderObservable.add(() => {
            self.updateFromKeyboard()
        });
    }
}