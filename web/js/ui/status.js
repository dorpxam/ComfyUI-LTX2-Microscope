import { UI_CONFIG } from "./config.js";

export const BAR_STYLE = {
    backgroundColor: LiteGraph.WIDGET_BGCOLOR,
    strokeColor: LiteGraph.WIDGET_OUTLINE_COLOR,
    font: `${LiteGraph.NODE_SUBTEXT_SIZE}px sans-serif`,
    subfont: `${LiteGraph.NODE_SUBTEXT_SIZE - 2}px sans-serif`,
    colorLabel: LiteGraph.NODE_TITLE_COLOR,
    colorValue: LiteGraph.NODE_TEXT_HIGHLIGHT_COLOR,
    colorStatusIdle: "#666",
    colorStatusActive: "#0F0",
    barHeight: LiteGraph.NODE_WIDGET_HEIGHT,
};

export const BAR_SECTIONS = [
    { id: "res", label: "Latent Resolution: ", worstCase: "0000 x 0000", format: (v) => (v.w && v.h) ? `${v.w} x ${v.h}  |  ${v.wx} x ${v.hx} real` : "--- x ---" },
    { id: "frm", label: "Latent Frames: ",     worstCase: "000 / 000",   format: (v) => v.total ? `${v.cur} / ${v.total}  |  ${v.curx} / ${v.totalx} real` : "--- / ---" },
    { id: "stp", label: "Steps: ",             worstCase: "000 / 000",   format: (v) => v.total ? `${v.cur} / ${v.total}` : "--- / ---" },
    { id: "sts", label: "Status: ",            worstCase: "SAMPLING",    format: (v) => v.status || "IDLE" }
];

export class StatusBar {
    constructor(node) {
        this.node = node;
        this.ratios = [];
    }

    calculateRatios(ctx) {
        ctx.font = BAR_STYLE.font;
        const widths = BAR_SECTIONS.map(s => ctx.measureText(s.label + s.worstCase).width);
        const total = widths.reduce((a, b) => a + b, 0);
        this.ratios = widths.map(w => w / total);
        return this.ratios;
    }

    prepareData(visualizer) {
        const dm = visualizer.manager;
        const anim = visualizer.animator;

        return {
            res: { w: dm.width, h: dm.height, wx: dm.width * 32, hx: dm.height * 32 },
            frm: { cur: anim.currentFrame + 1, total: dm.frames, curx: (anim.currentFrame + 1) * 8 + 1, totalx: dm.frames * 8 + 1 },
            stp: { cur: dm.step + 1, total: dm.total_steps },
            sts: { status: visualizer.node.isWorking ? "SAMPLING" : "IDLE" }
        };
    }

    drawBackground(ctx, x, y, width, height) {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(x, y, width, height, height/2);
        ctx.fillStyle = BAR_STYLE.backgroundColor;
        ctx.fill();
        ctx.strokeStyle = BAR_STYLE.strokeColor;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
    }

    getFormattedString(ctx, left, right, separator = "/") {
        const sLeft = String(left);
        const sRight = String(right);
        if (separator === "/") {
            const paddedLeft = sLeft.padStart(sRight.length, '0');
            return `${paddedLeft} / ${sRight}`;
        }
        return `${sLeft} ${separator} ${sRight}`;
    }

    drawLabel(ctx, text, x, y) {
        ctx.font = BAR_STYLE.font;
        ctx.fillStyle = BAR_STYLE.colorLabel;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(text, x, y);
    }

    drawValue(ctx, text, x, y) {
        ctx.font = BAR_STYLE.font;
        ctx.fillStyle = BAR_STYLE.colorValue;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(text, x, y);
    }

    drawReals(ctx, text, x, y) {
        ctx.font = BAR_STYLE.subfont;
        ctx.fillStyle = BAR_STYLE.colorLabel;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(text, x, y);
    }

    drawSubSections(ctx, x, y, w, h, label, value, reals) {
        ctx.font = BAR_STYLE.font;
        const labelW = ctx.measureText(label).width;
        const valueW = ctx.measureText(value).width;
        ctx.font = BAR_STYLE.subfont;
        const realsW = ctx.measureText(reals).width;
        const totalW = labelW + valueW + realsW;

        const startX = x + (w / 2) - (totalW / 2);
        const centerY = y + (h / 2);

        this.drawLabel(ctx, label, startX, centerY);
        this.drawValue(ctx, value, startX + labelW, centerY);
        this.drawReals(ctx, reals, startX + labelW + valueW, centerY);
    }

    drawSections(ctx, x, y, w, h, label, value) {
        ctx.font = BAR_STYLE.font;
        const labelW = ctx.measureText(label).width;
        const valueW = ctx.measureText(value).width;
        const totalW = labelW + valueW;

        const startX = x + (w / 2) - (totalW / 2);
        const centerY = y + (h / 2);

        this.drawLabel(ctx, label, startX, centerY);
        this.drawValue(ctx, value, startX + labelW, centerY);
    }

    drawStatus(ctx, x, y, width, height, visualizer, working) {
        //     { id: "stp", label: "Steps: ",             worstCase: "000 / 000",   format: (v) => v.total ? `${v.cur} / ${v.total}` : "--- / ---" },
        //     { id: "sts", label: "Status: ",            worstCase: "SAMPLING",    format: (v) => v.status || "IDLE" }
        // stp: { cur: dm.step + 1, total: dm.total_steps },
        // sts: { status: visualizer.node.isWorking ? "SAMPLING" : "IDLE" }
        ctx.save();
        const dm = visualizer.manager;
        const anim = visualizer.animator;
        const label = "Status:  ";
        if (working) {
            const value = "SAMPLING";
            const steps = dm.total_steps > 0 ? this.getFormattedString(ctx, dm.step + 1, dm.total_steps) : "waiting";
            const reals = "  (step: " + steps + ")";
            this.drawSubSections(ctx, x, y, width, height, label, value, reals);

        } else {
            const value = "IDLE";
            this.drawSections(ctx, x, y, width, height, label, value);
        }
        ctx.restore();
    }

    drawFrame(ctx, x, y, width, height, visualizer) {
        ctx.save();
        const dm = visualizer.manager;
        const anim = visualizer.animator;
        const label = "Latent Frame:  ";
        if (dm.width !== 0 && dm.height !== 0) {
            const value = this.getFormattedString(ctx, anim.currentFrame + 1, dm.frames);
            const reals = "  (" + this.getFormattedString(ctx, anim.currentFrame * 8 + 1, dm.frames * 8 + 1) + ")";
            this.drawSubSections(ctx, x, y, width, height, label, value, reals);
        }
        else {
            const value = "waiting";
            this.drawSections(ctx, x, y, width, height, label, value);
        }
        ctx.restore();
    }

    drawResolution(ctx, x, y, width, height, visualizer) {
        ctx.save();
        const dm = visualizer.manager;
        const label = "Latent Resolution:  ";
        if (dm.width !== 0 && dm.height !== 0) {
            const value = this.getFormattedString(ctx, dm.width, dm.height, "x");
            const reals = "  (" + this.getFormattedString(ctx, dm.width*32, dm.height*32, "x") + ")";
            this.drawSubSections(ctx, x, y, width, height, label, value, reals);
        }
        else {
            const value = "waiting";
            this.drawSections(ctx, x, y, width, height, label, value);
        }
        ctx.restore();
    }

    draw(ctx, widgetWidth, y, widgetHeight, visualizer) {
        const margin = UI_CONFIG.margin;
        const width = widgetWidth - (margin * 2);
        const height = BAR_STYLE.barHeight;
        const dx = margin;
        const dy = y + margin;

        ctx.save();

        this.drawBackground(ctx, dx, dy, width, height);

        if (!visualizer) return;

        const cw = width * (1/3);
        this.drawResolution(ctx, dx, dy, cw, height, visualizer);
        this.drawFrame(ctx, dx + cw, dy, cw, height, visualizer);
        this.drawStatus(ctx, dx + cw + cw, dy, cw, height, visualizer, visualizer.node.isWorking);

        ctx.restore();
    }
}