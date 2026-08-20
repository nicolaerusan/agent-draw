import { apiPlugin } from "./api";
import { corePlugin } from "./core";
import { PluginRegistry } from "./types";

export const pluginRegistry = new PluginRegistry();
pluginRegistry.register(corePlugin);
pluginRegistry.register(apiPlugin);
