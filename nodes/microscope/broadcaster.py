import base64
import server
import threading
import time
import torch

from collections import deque

class Broadcaster:
    def __init__(self):
        self.q_bundles = deque()
        self.q_metadata = deque()
        self.current_bundle = {}
        self.frames = 1
        self.height = 1
        self.width = 1
        self.active = True
        self.need_purge = False
        self.lock = threading.RLock()
        self.monitor_thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self.monitor_thread.start()

    def push_tensor(self, idx, tensor):
        with self.lock:
            current_b = tensor.shape[0]
            # split batching case
            if current_b == 2:
                self.current_bundle[idx] = tensor
            elif current_b == 1:
                if idx not in self.current_bundle:
                    self.current_bundle[idx] = tensor
                    return 
                else:
                    self.current_bundle[idx] = torch.cat([self.current_bundle[idx], tensor], dim=0)
            
            if idx == 47 and self.current_bundle[idx].shape[0] == 2:
                self.q_bundles.append(dict(self.current_bundle))
                self.current_bundle.clear()

    def push_metadata(self, step, total_steps, frames, height, width, node_id):
        with self.lock:
            self.q_metadata.append({
                "step": step,
                "total_steps": total_steps,
                "frames": frames,
                "height": height,
                "width": width,
                "node_id": node_id
            })

    def _monitor_loop(self):
        while self.active:
            bundle, meta = None, None
            with self.lock:
                lb, lm = len(self.q_bundles), len(self.q_metadata)
                if lb > 0 and lm > 0 and lb == lm:
                    bundle = self.q_bundles.popleft()
                    meta = self.q_metadata.popleft()
            
            if bundle and meta:
                self.broadcast(bundle, meta)

            time.sleep(0.01)

    def process_layer(self, vx_tensor):
        mag = torch.norm(vx_tensor.detach().float(), dim=-1)
        B = mag.shape[0] # B = Cond / Uncond | shape [B, F, H, W] 
        spatial = mag.view(B, self.frames, self.height, self.width).cpu()
        raw_bytes = spatial.to(torch.float32).numpy().tobytes()
        return base64.b64encode(raw_bytes).decode('utf-8')

    def broadcast(self, bundle, meta):
        try:
            self.frames = meta["frames"]
            self.height = meta["height"]
            self.width = meta["width"]
            
            layers_encoded = {
                str(idx): self.process_layer(vx) 
                for idx, vx in bundle.items()
            }

            server.PromptServer.instance.send_sync("ltx2_sampling_update", {
                "node_id": meta["node_id"],
                "layers": layers_encoded,
                "metadata": {
                    "frames": self.frames,
                    "height": self.height,
                    "width": self.width,
                    "step": meta["step"],
                    "total_steps": meta["total_steps"],
                }
            })
        except Exception as e:
            print(f"Broadcaster error: {e}")