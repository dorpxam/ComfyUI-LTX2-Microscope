from typing_extensions import override
from comfy_api.latest import ComfyExtension

WEB_DIRECTORY = "./web/js"

__all__ = ["WEB_DIRECTORY"]

REGISTER_MESSAGE = "Register LTX2 Microscope Extension"

class LTX2MicroscopeExtension(ComfyExtension):
    async def on_load(self) -> None:
        print(f"\033[32m{REGISTER_MESSAGE}\033[0m")

    @override
    async def get_node_list(self):
        from .nodes import NODE_CLASSES
        return NODE_CLASSES
    
async def comfy_entrypoint() -> LTX2MicroscopeExtension:
    return LTX2MicroscopeExtension()