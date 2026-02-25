import type { PluginRuntime } from "openclaw/plugin-sdk";

let runtime: PluginRuntime | null = null;

export function setChannelRuntime(next: PluginRuntime): void {
  runtime = next;
}

export function getChannelRuntime(): PluginRuntime {
  if (!runtime) {
    throw new Error("iOS channel runtime not initialized");
  }
  return runtime;
}
