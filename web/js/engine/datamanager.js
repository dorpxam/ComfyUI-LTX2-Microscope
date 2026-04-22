import { Normalizer } from "./normalizer.js"

import { TURBID_LUT } from "../colormaps/cmocean.js"
import { CIVIDIS_LUT } from "../colormaps/cividis.js"
import { BLACKBODY_LUT } from "../colormaps/paraview.js"
import { ECLIPSE_LUT, GHOSTLIGHT_LUT } from "../colormaps/cmasher.js"
import { BATLOW_LUT, NAVIA_LUT } from "../colormaps/crameri.js"
import { INFERNO_LUT, MAGMA_LUT, PLASMA_LUT, VIRIDIS_LUT } from "../colormaps/bids.js"

const COLORMAPS = {
    "cividis": CIVIDIS_LUT,
    "batlow": BATLOW_LUT,
    "navia": NAVIA_LUT,
    "turbid": TURBID_LUT,
    "blackbody": BLACKBODY_LUT,
    "eclipse": ECLIPSE_LUT,
    "ghostlight": GHOSTLIGHT_LUT,
    "inferno": INFERNO_LUT,
    "magma": MAGMA_LUT,
    "plasma": PLASMA_LUT,
    "viridis": VIRIDIS_LUT
};

class DataManagerBase {
    constructor() {
        this.layers = new Map();
        this.frames = 0; 
        this.height = 0; 
        this.width = 0;
        this.step = 0;
        this.total_steps = 0;
        this.frameSize = 0;
        this.batchSize = 0;
    }

    clear() {
        this.layers.clear(); // Vide les 48 layers (Float32Arrays)
        this.frames = 0; 
        this.height = 0; 
        this.width = 0;
        this.step = 0;
        this.total_steps = 0;
        this.frameSize = 0;
        this.batchSize = 0;
    }

    update(rawLayers, metadata) {
        this.frames = metadata.frames;
        this.height = metadata.height;
        this.width = metadata.width;
        this.step = metadata.step;
        this.total_steps = metadata.total_steps;
        this.frameSize = this.height * this.width;
        this.batchSize = this.frames * this.frameSize;

        this.layers.clear();
        for (const [idx, b64] of Object.entries(rawLayers)) {
            const bin = atob(b64);
            const buf = new ArrayBuffer(bin.length);
            const view = new Uint8Array(buf);
            for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i);
            
            const floatData = new Float32Array(buf);
            this.layers.set(parseInt(idx), {
                cond: floatData.subarray(0, this.batchSize),
                uncond: floatData.subarray(this.batchSize, this.batchSize * 2)
            });
        }
        if (this.onUpdateComplete) 
            this.onUpdateComplete();
    }
}

export class DataManager extends DataManagerBase {
    constructor() {
        super();
        this.viewMode = 0;
        this.normMode = 0;
        this.normalizer = new Normalizer();
        
        this.workingBuffer = new Float32Array(0);
        this.displayBuffer = new Uint8ClampedArray(0);
    }

    reset() {
        super.clear();
        this.workingBuffer = new Float32Array(0);
        this.displayBuffer = new Uint8ClampedArray(0);
        this.imageData = null;
    }
   
    onUpdateComplete() {
        if (this.workingBuffer.length !== this.frameSize) {
            this.workingBuffer = new Float32Array(this.frameSize);
            this.displayBuffer = new Uint8ClampedArray(this.frameSize * 4);
            this.imageData = new ImageData(this.displayBuffer, this.width, this.height);
        }
    }

    getPixels(layer, frame) {
        if (!this.layers.has(layer)) 
            return null;

        this._conditionning(layer, frame);
        this._normalization();
        this._colormap();

        return this.imageData;
    }

    _conditionning(layerIdx, frameIdx) {
        const layer = this.layers.get(layerIdx);
        const offset = frameIdx * this.frameSize;
        const cond = layer.cond;
        const uncond = layer.uncond;

        for (let i = 0; i < this.frameSize; i++) {
            if (this.viewMode === 0) this.workingBuffer[i] = cond[offset + i];
            else if (this.viewMode === 1) this.workingBuffer[i] = uncond[offset + i];
            else if (this.viewMode === 2) this.workingBuffer[i] = Math.abs(cond[offset + i] - uncond[offset + i]);
        }
    }

    _normalization() {
        this.normalizer.process(this.workingBuffer, this.frameSize, this.normMode);
    }
    
    _colormap() {
        const lut = COLORMAPS[this.colormapName] || COLORMAPS["INFERNO"];
        const size = this.frameSize;

        for (let i = 0; i < size; i++) {
            const x = this.workingBuffer[i] * 255.0;
            const idx_a = Math.floor(x);
            const idx_b = idx_a < 255 ? idx_a + 1 : 255;
            const f = x - idx_a;

            const off_a = idx_a * 3;
            const off_b = idx_b * 3;

            const outIdx = i * 4;
            
            this.displayBuffer[outIdx]     = (lut[off_a]   + (lut[off_b]   - lut[off_a])   * f) * 255; // R
            this.displayBuffer[outIdx + 1] = (lut[off_a+1] + (lut[off_b+1] - lut[off_a+1]) * f) * 255; // G
            this.displayBuffer[outIdx + 2] = (lut[off_a+2] + (lut[off_b+2] - lut[off_a+2]) * f) * 255; // B
            this.displayBuffer[outIdx + 3] = 255; // Alpha
        }
    }
}