import server
import comfy.patcher_extension
from comfy_api.latest import io

from .broadcaster import Broadcaster
from .patcher import ModelPatcher
from .wrapper import SamplerCallbackWrapper

class LTX2Microscope(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="LTX2Microscope",
            display_name="LTX2 Microscope",
            category="MXP/Experimental",
            inputs=[
                io.Model.Input("model"), 
                io.Combo.Input("view_mode", display_name="View", options=["conditioning", "unconditioning", "differential"], default="conditioning", socketless=True),
                io.DynamicCombo.Input("norm_mode", display_name="Normalization", options=[
                    io.DynamicCombo.Option("none", []),
                    io.DynamicCombo.Option("min_max", [
                        io.Float.Input("min", display_name="Min Value", default=400.0, min=-1000.0, max=10000.0, step=1.0, display_mode=io.NumberDisplay.number, socketless=True),
                        io.Float.Input("max", display_name="Max Value", default=700.0, min=0.0, max=30000.0, step=1.0, display_mode=io.NumberDisplay.number, socketless=True),
                    ]),
                    io.DynamicCombo.Option("z_score", []),
                    io.DynamicCombo.Option("percentile", [
                        io.Float.Input("low", display_name="Low Cut (%)", default=1.0, min=0.0, max=20.0, step=0.1, display_mode=io.NumberDisplay.number, socketless=True),
                        io.Float.Input("high", display_name="High Cut (%)", default=1.0, min=0.0, max=20.0, step=0.1, display_mode=io.NumberDisplay.number, socketless=True),
                    ]),
                ]),
                io.Combo.Input("colormap", display_name="Colormap", options=["cividis", "viridis", "ghostlight", "eclipse", "navia", "batlow", "turbid", "blackbody", "inferno", "plasma", "magma"], default="cividis", socketless=True),
                io.Boolean.Input("maintain_aspect_ratio", display_name="Maintain Aspect Ratio", default=True, socketless=True),
                io.Boolean.Input("show_index_labels", display_name="Show Layers Indexes", default=True, socketless=True),
                io.DynamicCombo.Input("animation", display_name="Animation", options=[
                    io.DynamicCombo.Option("realtime", [
                        io.Int.Input("FPS", default=25, min=1, max=300, display_mode=io.NumberDisplay.slider, socketless=True),
                        io.Boolean.Input("freeze", display_name="Freeze", default=False, socketless=True),
                    ]),
                    io.DynamicCombo.Option("frame-by-frame", [
                        io.Int.Input("frame", display_name="Frame", default=0, min=0, max=8192, step=1, display_mode=io.NumberDisplay.slider, socketless=True),
                    ]),
                ]),
                io.String.Input("ui_status", default="none",  multiline=True, socketless=True),
                io.String.Input("ui_button", default="none",  multiline=True, optional=True, socketless=True),
                io.String.Input("ui_container", default="none", multiline=True, socketless=True),
            ],
            outputs=[io.Model.Output("model")],
        )
        
    @classmethod
    def execute(cls, model, **kwargs) -> io.NodeOutput:
        node_id = kwargs.get("unique_id") or getattr(server.PromptServer.instance, "last_node_id")
        model_clone = model.clone()

        broadcaster = Broadcaster()

        for i in range(48):
            block_path = f"diffusion_model.transformer_blocks.{i}"
            block = model_clone.get_model_object(block_path)
            patcher = ModelPatcher(i, broadcaster, block, node_id)
            model_clone.add_object_patch(f"{block_path}.forward", patcher)

        model_clone.add_wrapper_with_key(
            comfy.patcher_extension.WrappersMP.OUTER_SAMPLE, 
            "microscope_preview",
            SamplerCallbackWrapper(broadcaster, node_id)
        )

        return io.NodeOutput(model_clone)