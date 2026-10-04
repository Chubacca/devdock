import { useEffect, useRef } from "react";
import { createDevDock } from "../core/dock";
import type { DevDockInstance, DevDockOptions } from "../core/types";

export type DevDockProps = DevDockOptions;

/**
 * React wrapper around the framework-agnostic core. Renders nothing itself —
 * the dock mounts into `document.body` (or `container`) and is torn down on
 * unmount. Safe to leave mounted; it renders nothing in production.
 */
export function DevDock(props: DevDockProps) {
  const instance = useRef<DevDockInstance | null>(null);
  const latest = useRef(props);
  latest.current = props;

  useEffect(() => {
    const inst = createDevDock(latest.current);
    instance.current = inst;
    return () => {
      inst.destroy();
      instance.current = null;
    };
  }, []);

  useEffect(() => {
    instance.current?.update(props);
  });

  return null;
}
