class ModelPatcher:
    def __init__(self, idx, broadcaster, block, node_id):
        self.idx = idx
        self.block = block
        self.node_id = node_id
        self.broadcaster = broadcaster
        self.base_forward = block.__class__.forward

    def __call__(self, *args, **kwargs):
        out = self.base_forward(self.block, *args, **kwargs)
        vx = out[0] # TODO: [Batch, Tokens, Dim] vx dim=4096 / ax dim=2048
        self.broadcaster.push_tensor(self.idx, vx.detach().clone().cpu())
        return out