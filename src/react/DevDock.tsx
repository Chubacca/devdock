import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { createDevDock, keyViews } from "../core/dock";
import type {
  DevDockInstance,
  DevDockOptions,
  DevView,
} from "../core/types";

/**
 * A custom panel rendered by React inside the dock's popup. Same contract as
 * the core's {@link DevView}, with `render` in place of `mount`: the component
 * is portaled into the dock, mounted when the popup opens and unmounted when
 * it closes.
 *
 * A view renders inside the dock's shadow root, which the document's
 * stylesheets don't cross — pass `shadow="inherit"` (or `shadow={false}`) if
 * it uses your app's CSS.
 */
export interface DevDockView extends Omit<DevView, "mount"> {
  /** The view's content. Called on every render of the host `<DevDock>`. */
  render: () => ReactNode;
}

export type DevDockProps = Omit<DevDockOptions, "views"> & {
  /** Custom panels rendered inside the popup. See {@link DevDockView}. */
  views?: DevDockView[];
};

const NO_VIEWS: DevDockView[] = [];

/**
 * React wrapper around the framework-agnostic core. The dock itself mounts
 * into `document.body` (or `container`) and is torn down on unmount; this
 * component renders only the portals for any `views` you pass, so with none it
 * renders nothing. Safe to leave mounted; it renders nothing in production.
 */
export function DevDock({ views = NO_VIEWS, ...options }: DevDockProps) {
  const instance = useRef<DevDockInstance | null>(null);
  // The host elements the core created for our views, keyed the same way it
  // keys them. React draws into these with a portal, which keeps the core free
  // of any React import.
  const [hosts, setHosts] = useState<ReadonlyMap<string, HTMLElement>>(
    () => new Map(),
  );
  // `destroy()` tears views down, which would otherwise ask an unmounting
  // component to set state.
  const alive = useRef(true);

  // Keyed exactly the way the core keys the host elements, so each portal
  // finds its own.
  const keyed = useMemo(() => keyViews(views), [views]);

  const coreViews = useMemo<DevView[]>(
    () =>
      keyed.map(({ key, view }) => ({
        id: key,
        label: view.label,
        group: view.group,
        order: view.order,
        mount: (host) => {
          setHosts((prev) => new Map(prev).set(key, host));
          return () => {
            if (!alive.current) return;
            setHosts((prev) => {
              const next = new Map(prev);
              next.delete(key);
              return next;
            });
          };
        },
      })),
    [keyed],
  );

  // The core reconciles views by id and no-ops when their shape is unchanged,
  // so handing it a fresh array on every render costs nothing and never
  // remounts a view.
  const latest = useRef({ options, coreViews });
  latest.current = { options, coreViews };

  useEffect(() => {
    alive.current = true;
    const inst = createDevDock({
      ...latest.current.options,
      views: latest.current.coreViews,
    });
    instance.current = inst;
    return () => {
      alive.current = false;
      inst.destroy();
      instance.current = null;
    };
  }, []);

  useEffect(() => {
    instance.current?.update({ ...options, views: coreViews });
  });

  return (
    <>
      {keyed.map(({ key, view }) => {
        const host = hosts.get(key);
        return host ? createPortal(view.render(), host, key) : null;
      })}
    </>
  );
}
