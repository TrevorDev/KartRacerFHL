import { Scene, ActionManager, ExecuteCodeAction } from '@babylonjs/core';

export interface IKartInput {
    horizontal: number; // Left = -1, Right = 1, Center = 0
    accelerate: number; // 1 = completely pressed
    brake: number; // 1 = completely pressed
    drift: boolean;
}

export class KartInput_Keyboard implements IKartInput {
    public horizontal: number;
    public accelerate: number;
    public brake: number;
    public drift: boolean;

    // https://www.babylonjs-playground.com/#Y1W3F9

    constructor(scene: Scene) {
        if (!scene.actionManager) {
            scene.actionManager = new ActionManager(scene);
        }
        var keymap: any = {};
        // register with the action manager to set the keymap values as either pressed or not pressed depending on the event
        scene.actionManager.registerAction(new ExecuteCodeAction(ActionManager.OnKeyDownTrigger, function (evt) {
            keymap[evt.sourceEvent.key] = evt.sourceEvent.type == "keydown";
        }));

        scene.actionManager.registerAction(new ExecuteCodeAction(ActionManager.OnKeyUpTrigger, function (evt) {
            keymap[evt.sourceEvent.key] = evt.sourceEvent.type == "keydown";
        }));

        // before the render pass (and before our business logic update), update the input.
        scene.registerBeforeRender(() => {
            // Acceleration
            this.accelerate = 0;
            if (keymap["w"] || keymap["W"] || keymap["ArrowUp"]) {
                this.accelerate = 1;
            };

            // Left/Right axis
            this.horizontal = 0;
            if (keymap["a"] || keymap["A"] || keymap["ArrowLeft"]) {
                this.horizontal -= 1;
            }
            if (keymap["d"] || keymap["D"] || keymap["ArrowRight"]) {
                this.horizontal += 1;
            };

            // Brake
            this.brake = 0;
            if (keymap["s"] || keymap["S"] || keymap["ArrowDown"]) {
                this.brake = 1;
            };

            // Handbrake/drift
            this.drift = false;
            if (keymap["Shift"]) {
                this.drift = true;
            };
        });
    }
}