import { WiringSourceType, WiringTargetType } from "./types";

const CONFIG_SOURCE_PREFIX = "config-out-";
const CONFIG_TARGET_PREFIX = "config-in-";

/** Port keys of wire endpoints; dependency config ports are distinct from outputs and inputs. */
export function parseSourceHandle(handle: string): {
  type: WiringSourceType;
  name: string;
} {
  return handle.startsWith(CONFIG_SOURCE_PREFIX)
    ? {
        type: "dependency_config",
        name: handle.slice(CONFIG_SOURCE_PREFIX.length),
      }
    : { type: "output", name: handle.replace(/^output-/, "") };
}

export function parseTargetHandle(handle: string): {
  type: WiringTargetType;
  name: string;
} {
  return handle.startsWith(CONFIG_TARGET_PREFIX)
    ? {
        type: "dependency_config",
        name: handle.slice(CONFIG_TARGET_PREFIX.length),
      }
    : { type: "variable", name: handle.replace(/^input-/, "") };
}
