export class Animator {
    constructor(fps = 25, compressionFactor = 8) {
        this.fps = fps;
        this.compressionFactor = compressionFactor; 
        this.frameTime = (1000 / fps) * compressionFactor; 
        this.lastTick = performance.now();
        this.currentFrame = 0;
        this.isAnimating = false;
        this.request_id = null;
        this.onFrameTick = null;
    }

    setFreeze(isFrozen) {
        const shouldBeAnimating = !isFrozen;
        if (this.isAnimating === shouldBeAnimating) return;
        this.isAnimating = shouldBeAnimating;
        if (this.isAnimating) {
            this.lastTick = performance.now();
        }
    }

    setFPS(newFps) {
        if (this.fps === newFps) return;
        this.fps = newFps;
        this.frameTime = (1000 / this.fps) * this.compressionFactor;
        this.lastTick = performance.now();
    }
    
    setFrame(frameIdx) {
        this.currentFrame = frameIdx;
        this.lastTick = performance.now();
    }

    update(numFrames, isPaused) {
        if (!this.isAnimating) {
            return Math.floor(this.currentFrame);
        }
        const now = performance.now();
        const elapsed = now - this.lastTick;
        if (elapsed < this.frameTime) {
            return Math.floor(this.currentFrame);
        }
        const framesToAdvance = Math.floor(elapsed / this.frameTime);
        this.currentFrame = (this.currentFrame + framesToAdvance) % numFrames;
        this.lastTick = now - (elapsed % this.frameTime);
        return Math.floor(this.currentFrame);
    }

    reset() {
        this.currentFrame = 0;
        this.lastTick = performance.now();
    }

    start() {
        const loop = () => {
            if (this.isAnimating && this.onFrameTick) {
                this.onFrameTick(); 
            }
            this.request_id = requestAnimationFrame(loop);
        };
        this.request_id = requestAnimationFrame(loop);
    }

    stop() {
        if (this.request_id) {
            cancelAnimationFrame(this.request_id);
            this.request_id = null;
        }
    }
}