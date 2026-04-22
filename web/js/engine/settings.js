export class SettingsManager {
    constructor(node, dataManager, animator) {
        this.node = node;
        this.manager = dataManager;
        this.animator = animator;
        this.values = {}; 
        this.controls = {};
        this.persistence = {}; 
        this.refreshControls();
    }

    refreshControls() {
        const find = (name) => this.node.widgets.find(w => w.name === name);
        this.controls = {
            view: find("view_mode"),
            colormap: find("colormap"),
            norm: find("norm_mode"),
            aspect_ratio: find("maintain_aspect_ratio"),
            index_labels: find("show_index_labels"),
            animation: find("animation"),
            container: find("ui_container"),
        };
    }

    captureDynamicValues() {
        this.node.widgets.forEach(w => {
            if (w.name && (w.name.startsWith("norm_mode.") || w.name.startsWith("animation."))) {
                this.persistence[w.name] = w.value;
            }
        });
    }

    restoreDynamicValues() {
        this.node.widgets.forEach(w => {
            if (w.name && (w.name.startsWith("norm_mode.") || w.name.startsWith("animation."))) {
                if (this.persistence[w.name] !== undefined) {
                    w.value = this.persistence[w.name];
                }
            }
        });
    }

    resetFrameSlider() {
        const frameWidget = this.node.widgets.find(w => w.name === "animation.frame");
        if (frameWidget) {
            frameWidget.label = " "; 
            const drawMethod = frameWidget.draw || frameWidget.drawWidget;
            if (drawMethod) {
                frameWidget.draw = function(ctx, node, width, y, height) {
                    ctx.save();
                    ctx.font = "0px Arial";
                    ctx.fillStyle = "rgba(0,0,0,0)";
                    ctx.strokeStyle = "rgba(0,0,0,0)";
                    drawMethod.apply(this, arguments);
                    ctx.restore();
                };
            }
        }
    }

    updateFrameSlider() {
        const frameWidget = this.node.widgets.find(w => w.name === "animation.frame");
        const numFrames = this.manager.frames;
        if (frameWidget && numFrames > 0) {
            frameWidget.options.min = 0;
            frameWidget.options.max = numFrames - 1;
            frameWidget.options.step = 10;
            frameWidget.options.step2 = 1;
            if (frameWidget.value >= numFrames) {
                frameWidget.value = numFrames - 1;
            }
        }
    }

    update() {
        if (!this.manager || !this.controls) return;

        this.captureDynamicValues();

        const ctrl = this.controls;
        const dm = this.manager;

        if (ctrl.view) {
            const modes = ["conditioning", "unconditioning", "differential"];
            dm.viewMode = modes.indexOf(ctrl.view.value);
        }
        if (ctrl.colormap) {
            dm.colormapName = ctrl.colormap.value;
        }
        if (ctrl.norm) {
            const val = ctrl.norm.value; 
            const modes = ["none", "min_max", "z_score", "percentile"];
            dm.normMode = modes.indexOf(val);

            const settings = dm.normalizer.settings[val];

            if (settings) {
                this.node.widgets.forEach(w => {
                    if (w.name.startsWith("norm_mode.")) {
                        const paramName = w.name.split(".").pop();
                        if (paramName in settings) {
                            settings[paramName] = w.value;
                        }
                    }
                });
            }
        }
        if (ctrl.animation) {
            const val = ctrl.animation.value;
            const option = typeof val === "string" ? val : val.animation;

            if (option === "realtime") {
                const fps = this.node.widgets.find(w => w.name === "animation.FPS")?.value ?? 25;
                const freeze = this.node.widgets.find(w => w.name === "animation.freeze")?.value ?? false;
                this.animator.setFPS(fps);
                this.animator.setFreeze(freeze);
            } 
            else if (option === "frame-by-frame") {
                this.animator.setFreeze(true);
            }
        }
    }
}