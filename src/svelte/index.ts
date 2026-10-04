import { createDevDock } from "../core/dock";
import type { DevDockOptions } from "../core/types";

/** Return type compatible with Svelte's `Action` contract. */
export interface DevDockAction {
  update(options?: DevDockOptions): void;
  destroy(): void;
}

/**
 * Svelte action that mounts a dev dock. Use it on any element:
 *
 * ```svelte
 * <script>
 *   import { devdock } from "devdock/svelte";
 *   const routes = [{ path: "/admin", label: "Admin" }];
 * </script>
 *
 * <div use:devdock={{ routes, hotkey: "mod+." }}></div>
 * ```
 *
 * The dock mounts into `document.body` (or `options.container`), so the host
 * element is just an anchor. Reactive `options` flow through automatically.
 */
export function devdock(
  _node: HTMLElement,
  options: DevDockOptions = {},
): DevDockAction {
  const instance = createDevDock(options);
  return {
    update(next: DevDockOptions = {}) {
      instance.update(next);
    },
    destroy() {
      instance.destroy();
    },
  };
}

export { createDevDock } from "../core/dock";
export type {
  DevDockOptions,
  DevDockInstance,
  DevRoute,
  DevCommand,
  DockPosition,
} from "../core/types";
