export class Normalizer {
    constructor() {
        this.settings = {
            none: {},
            min_max: { min: 0.0, max: 1000.0 },
            z_score: {},
            percentile: { low: 1.0, high: 1.0 },
        };
    }

    process(buffer, size, mode) {
        if (!buffer || size <= 0) return;
        
        switch (mode) {
            case 0: this._applyNone(buffer, size); break;
            case 1: this._applyMinMax(buffer, size); break;
            case 2: this._applyZScore(buffer, size); break;
            case 3: this._applyPercentile(buffer, size); break;
        }
    }

    _applyNone(buffer, size) {
        let vMin = Infinity, vMax = -Infinity;
        for (let i = 0; i < size; i++) {
            if (buffer[i] < vMin) vMin = buffer[i];
            if (buffer[i] > vMax) vMax = buffer[i];
        }
        const range = (vMax - vMin) + 1e-8;
        for (let i = 0; i < size; i++) {
            buffer[i] = (buffer[i] - vMin) / range;
        }
    }

    _applyMinMax(buffer, size) {
        const s = this.settings.min_max;
        const range = (s.max - s.min) + 1e-8;
        for (let i = 0; i < size; i++) {
            let val = (buffer[i] - s.min) / range;
            buffer[i] = Math.max(0, Math.min(1, val));
        }
    }

    _applyZScore(buffer, size) {
        let sum = 0;
        for (let i = 0; i < size; i++) sum += buffer[i];
        const mean = sum / size;

        let sumSqDiff = 0;
        for (let i = 0; i < size; i++) {
            const diff = buffer[i] - mean;
            sumSqDiff += diff * diff;
        }
        const stdDev = Math.sqrt(sumSqDiff / size);

        if (stdDev < 1e-10) {
            for (let i = 0; i < size; i++) buffer[i] = 0.5;
            return;
        }

        for (let i = 0; i < size; i++) {
            const z = (buffer[i] - mean) / stdDev;
            let norm = (z + 3) / 6;
            buffer[i] = Math.max(0, Math.min(1, norm));
        }
    }

    _applyPercentile(buffer, size) {
        const s = this.settings.percentile;
        
        let vMin = Infinity, vMax = -Infinity;
        for (let i = 0; i < size; i++) {
            if (buffer[i] < vMin) vMin = buffer[i];
            if (buffer[i] > vMax) vMax = buffer[i];
        }

        const range = vMax - vMin;
        if (range < 1e-10) return;

        const binCount = 1024;
        const hist = new Int32Array(binCount);
        for (let i = 0; i < size; i++) {
            const bin = Math.floor(((buffer[i] - vMin) / range) * (binCount - 1));
            hist[bin]++;
        }

        const lowPixelsToCut = size * (s.low / 100);
        const highPixelsToCut = size * (s.high / 100);
        
        let cutMin = vMin;
        let cutMax = vMax;
        
        let acc = 0;
        for (let i = 0; i < binCount; i++) {
            acc += hist[i];
            if (acc >= lowPixelsToCut) {
                cutMin = vMin + (i / binCount) * range;
                break;
            }
        }

        acc = 0;
        for (let i = binCount - 1; i >= 0; i--) {
            acc += hist[i];
            if (acc >= highPixelsToCut) {
                cutMax = vMin + (i / binCount) * range;
                break;
            }
        }

        const newRange = (cutMax - cutMin) + 1e-10;
        for (let i = 0; i < size; i++) {
            let val = (buffer[i] - cutMin) / newRange;
            buffer[i] = Math.max(0, Math.min(1, val));
        }
    }
}