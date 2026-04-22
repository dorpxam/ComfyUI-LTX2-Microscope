import comfy.utils

class SamplerCallbackWrapper:
    def __init__(self, broadcaster, node_id):
        self.broadcaster = broadcaster
        self.node_id = node_id
        self.lat_w = 1
        self.lat_h = 1
        self.lat_f = 1

    def update_shape(self, latent_shapes):
        if latent_shapes:
            shape = list(latent_shapes)
            self.lat_w = shape[-1]
            self.lat_h = shape[-2]
            self.lat_f = shape[-3]

    def __call__(self, executor, noise, latent_image, sampler, sigmas, denoise_mask, callback, disable_pbar, seed, latent_shapes):
        self.update_shape(latent_shapes[0])

        steps = len(sigmas) - 1
        pbar = comfy.utils.ProgressBar(steps)

        original_callback = callback
        
        def combined_callback(step, x0, x, total_steps):
            pbar.update_absolute(step + 1, total_steps, None) 
            self.broadcaster.push_metadata(step, total_steps, self.lat_f, self.lat_h, self.lat_w, self.node_id)
            if original_callback is not None:
                original_callback(step, x0, x, total_steps)

        return executor(noise, latent_image, sampler, sigmas, denoise_mask, combined_callback, disable_pbar, seed, latent_shapes=latent_shapes)