import { SettingsManager } from "../engine/settings.js";
import { DataManager } from "../engine/datamanager.js"
import { Animator } from "../engine/animator.js"
import { UI_CONFIG, UI_LOGO } from "./config.js"

export class Visualizer {
    constructor(node) {
        this.node = node;
        this.free_height = 1;
        this.manager = new DataManager();
        this.animator = new Animator(25);
        this.animator.onFrameTick = () => { this.node.setDirtyCanvas(true, false); };
        this.settings = new SettingsManager(node, this.manager, this.animator)
        this.offscreen_canvas = new OffscreenCanvas(1, 1);
        this.offscreen_context = this.offscreen_canvas.getContext('2d');
        this.logo = new Image();
        this.logo.src = UI_LOGO;
        this.logo.onload = () => { this.node.setDirtyCanvas(true); };
        this.attachAspectRatioCallback();
    }

    onReset() {
        this.animator.stop();
        this.manager.reset();
        this.settings.resetFrameSlider();
        this.node.setDirtyCanvas(true, true);
    }

    onEventListener(layers, metadata) {
        this.manager.update(layers, metadata);
        this.settings.updateFrameSlider();
        if (this.isMaintainAspectRatio()) {
            const width = Math.max(UI_CONFIG.min_width, this.node.size[0]);
            const height = this.getY() + this.getGridHeight(this.node.size[0]);
            this.node.setSize([width, height]);
        }
        this.node.setDirtyCanvas(true, true);
        if (!this.animator.isRunning) this.animator.start();
    }

    onResize(size) {
        if (this.isMaintainAspectRatio()) {
            const height = this.getGridHeight(size[0]);
            size[1] = this.getY() + height;
        }
        else {
            this.free_height = size[1];
        }
        size[0] = Math.max(UI_CONFIG.min_width, size[0]);
    }

    onConfigure() {
        this.settings.resetFrameSlider();
    }

    onAspectRatioChange(value) {
        if (value) {
            this.free_height = this.node.size[1];
            const height = this.getGridHeight(this.node.size[0]);
            this.node.setSize([this.node.size[0], this.getY() + height]);
        } else {
            const width = Math.max(UI_CONFIG.min_width, this.node.size[0]);
            const height = this.free_height || UI_CONFIG.min_height;
            this.node.setSize([width, height]);
        }
        this.node.setDirtyCanvas(true, true);
    }

    onWidgetChange(name, value) {
        if (name === "animation" || name === "norm_mode") {
            this.settings.restoreDynamicValues();
            this.settings.updateFrameSlider();
            this.settings.resetFrameSlider();
            this.onResize(this.node.size);
            this.node.setDirtyCanvas(true, true);
        }
    }

    attachAspectRatioCallback() {
        if (this.settings.controls.aspect_ratio) {
            this.settings.controls.aspect_ratio.callback = (value) => {
                this.onAspectRatioChange(value);
            };
        }
    }
    
    resizeOffscreenCanvas = function() {
        if (!this.manager || !this.offscreen_canvas) return;
        if (this.offscreen_canvas.width !== this.manager.width || 
            this.offscreen_canvas.height !== this.manager.height) {
            this.offscreen_canvas.width = this.manager.width;
            this.offscreen_canvas.height = this.manager.height;
        }
    };

    isMaintainAspectRatio() {
        return !!this.settings.controls.aspect_ratio.value;
    }

    getFrameIndex() {
        if (!this.manager || !this.manager.frames) return 0;
        const frame = this.node.widgets.find(w => w.name === "animation.frame");
        if (!this.animator.isAnimating && frame) {
            this.animator.setFrame(frame.value);
        }
        return this.animator.update(this.manager.frames);
    };
 
    getY() {
        return (this.settings.controls.container?.y || 0);
    }
   
    getGridHeight(current_width) {
        if (!this.manager || !this.manager.height) 
            return UI_CONFIG.min_height;

        const { height: latH, width: latW } = this.manager;
        const { cols, rows, gap } = UI_CONFIG;
        
        const cell_width = current_width / cols;
        const cell_height = cell_width * (latH / latW);
        return cell_height * rows;
    };

    drawBackground(ctx, y, width, height) {
        ctx.fillStyle = "#000";
        ctx.fillRect(UI_CONFIG.margin, y, width, height);
        if (!this.manager || this.manager.layers.size === 0) {
            const x = 0;
            ctx.drawImage(this.logo, x + (width - this.logo.width) / 2, y + (height - this.logo.height) / 2, this.logo.width, this.logo.height);
            ctx.restore();
            return true;
        }
        return false;
    };

    drawStatusBar(ctx, x, y, width, barH) {
        const dm = this.manager;

        ctx.fillStyle = "#555";
        ctx.fillRect(x, y, width, barH);
    }

    drawIndexBox(ctx, index, dx, dy) {
        const text = (index + 1).toString().padStart(2, '0');
        const padding = 4;
        const fontSize = 10;
        
        ctx.font = `${fontSize}px Arial`;
        const metrics = ctx.measureText(text);
        const boxW = metrics.width + (padding * 2);
        const boxH = fontSize + padding;

        ctx.fillStyle = "#000";
        ctx.fillRect(dx, dy, boxW, boxH);

        ctx.fillStyle = "#FFF";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(text, dx + padding, dy + (padding / 2));
    };

    drawLayerGrid(ctx, y, grid_width, grid_height, frame_index) {
        if (!this.manager || this.manager.layers.size === 0) return;

        const { cols, rows, gap, margin } = UI_CONFIG;
        const { w, h } = this.manager;

        const cell_width = (grid_width - ((cols + 1) * gap)) / cols;
        const cell_height = (grid_height - ((rows + 1) * gap)) / rows;

        ctx.imageSmoothingEnabled = false;

        this.resizeOffscreenCanvas();

        const x = margin;
        for (let layer = 0; layer < (cols * rows); layer++) {
            const r = Math.floor(layer / cols);
            const c = layer % cols;
            
            const dx = x + ((c + 1) * gap) + (c * cell_width);
            const dy = y + ((r + 1) * gap) + (r * cell_height);
                        
            const pixelsRGBA  = this.manager.getPixels(layer, frame_index);
            if (pixelsRGBA) {
                this.offscreen_context.putImageData(pixelsRGBA, 0, 0);
                ctx.drawImage(this.offscreen_canvas, dx, dy, cell_width, cell_height);
            }

            if (this.settings.controls.index_labels.value)
                this.drawIndexBox(ctx, layer, dx, dy);
        }
    };

    draw(ctx, widgetWidth, y, widgetHeight) {
        ctx.save();

        this.settings.update();

        const margin = UI_CONFIG.margin;
        const width = widgetWidth - (margin * 2);
        const height = this.node.size[1] - y - margin; // (margin * 2);

        let should_return = this.drawBackground(ctx, y, width, height);
        if (should_return) return;

        const frame_index = this.getFrameIndex();

        this.drawLayerGrid(ctx, y, width, height, frame_index);

        ctx.restore();
    }
}