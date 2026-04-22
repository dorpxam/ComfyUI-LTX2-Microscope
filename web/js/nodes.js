import { app } from "../../../scripts/app.js";
import { api } from "../../../scripts/api.js";

import { UI_CONFIG } from "./ui/config.js";
import { Visualizer } from "./ui/visualizer.js";
import { StatusBar, BAR_STYLE } from "./ui/status.js";

app.registerExtension({
    name: "MXP.LTX2.Microscope",
    async setup() {
        api.addEventListener("execution_start", (e) => {
            app.graph._nodes.forEach(node => {
                if (node.type === "LTX2Microscope") 
                    node.isWorking = true;
            });
        });
        api.addEventListener("executing", (e) => {
            if (e.detail === null) {
                app.graph._nodes.forEach(node => {
                    if (node.type === "LTX2Microscope") 
                        node.isWorking = false;
                });
            }
        });
        api.addEventListener("ltx2_sampling_update", (e) => {
            const { node_id, layers, metadata } = e.detail;
            const node = app.graph.getNodeById(node_id);
            if (node && node.visualizer) {
                node.visualizer.onEventListener(layers, metadata);
            }
        });
    },
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name === "LTX2Microscope") {
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                const result = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;
                const node = this;

                this.visualizer = new Visualizer(this);
                this.status = new StatusBar(this); 

                const ui_container = this.widgets.find(w => w.name === "ui_container");

                if (ui_container) {
                    ui_container.type = "MONITOR"; 
                    ui_container.value = "";
                    
                    if (ui_container.element) {
                        ui_container.element.remove();
                        delete ui_container.element;
                    }

                    ui_container.draw = function(ctx, node, widgetWidth, y, widgetHeight) {
                        if (node.visualizer) {
                            node.visualizer.draw(ctx, widgetWidth, y, widgetHeight);
                        }
                    };

                    ui_container.computeSize = function(width) {
                        return [UI_CONFIG.min_width, UI_CONFIG.min_height]
                    };
                }

                const ui_status = this.widgets.find(w => w.name === "ui_status");

                if (ui_status) {
                    ui_status.type = "MONITOR"; 
                    ui_status.value = "";
                    
                    if (ui_status.element) {
                        ui_status.element.remove();
                        delete ui_status.element;
                    }

                    ui_status.draw = function(ctx, node, widgetWidth, y, widgetHeight) {
                        if (node.status) {
                            node.status.draw(ctx, widgetWidth, y, widgetHeight, node.visualizer);
                        }
                    };

                    ui_status.computeSize = function(width) {
                        return [UI_CONFIG.min_width, BAR_STYLE.barHeight + UI_CONFIG.margin]
                    };
                }

                const ui_button = this.widgets.find(w => w.name === "ui_button");

                if (ui_button) {
                    ui_button.type = "MONITOR"; 
                    ui_button.value = "";

                    const natif_button = this.addWidget("button", "RESET", null, () => {
                        if (this.visualizer) 
                            this.visualizer.onReset();
                    }, { serialize: false });

                    const statusIndex = this.widgets.indexOf(ui_status);
                    const buttonIndex = this.widgets.indexOf(ui_button);

                    const widget = this.widgets.pop();
                    this.widgets.splice(buttonIndex, 1);
                    this.widgets.splice(statusIndex + 1, 0, natif_button);
                    
                    if (ui_button.element) {
                        ui_button.element.remove();
                        delete ui_button.element;
                    }
                }

                return result;
            };
            
            const onWidgetChanged = nodeType.prototype.onWidgetChanged;
            nodeType.prototype.onWidgetChanged = function(name, value) {
                onWidgetChanged?.apply(this, arguments);
                if (this.visualizer) {
                    this.visualizer.onWidgetChange(name, value);
                }
            };

            const onResize = nodeType.prototype.onResize;
            nodeType.prototype.onResize = function(size) {
                if (this.visualizer) {
                    this.visualizer.onResize(size);
                }
            };

            const onConfigure = nodeType.prototype.onConfigure;
            nodeType.prototype.onConfigure = function() {
                onConfigure?.apply(this, arguments);
                if (this.visualizer) {
                    this.visualizer.onConfigure();
                }
            };
        }
    }
});