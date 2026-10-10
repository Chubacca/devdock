import { useEffect, useState, type ReactNode } from "react";

/**
 * The views passed to `<ReactRouterDevDock views={…} />`. They are ordinary
 * components built from the app's own CSS (`app.css`) — which only reaches
 * them because the dock is configured with `shadow="inherit"`.
 */

/**
 * Re-points the design system's tokens at the dock's dark panel, and re-applies
 * any page state the views' CSS keys off. `shadow="inherit"` brings the rules
 * across the shadow boundary but not the element tree, so a selector anchored
 * on `<html data-frozen>` only matches in here if the attribute is here too.
 */
function DevSurface({
  children,
  frozen,
}: {
  children: ReactNode;
  frozen?: boolean;
}) {
  return (
    <div className="ds-surface-dark" data-frozen={frozen ? "" : undefined}>
      {children}
    </div>
  );
}

/**
 * A live frame-rate meter. The rAF loop is the reason view lifecycle matters:
 * it starts when the popup opens and stops when it closes, because React
 * unmounts the component and this effect's cleanup runs.
 */
export function FrameRate({ frozen }: { frozen: boolean }) {
  const [fps, setFps] = useState(0);

  useEffect(() => {
    let frames = 0;
    let since = performance.now();
    let raf = requestAnimationFrame(function tick(now) {
      frames += 1;
      if (now - since >= 500) {
        setFps(Math.round((frames * 1000) / (now - since)));
        frames = 0;
        since = now;
      }
      raf = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <DevSurface frozen={frozen}>
      <div className="ds-meter">
        <span className="ds-pulse" />
        {fps}
        <small>fps</small>
      </div>
    </DevSurface>
  );
}

export type Theme = "light" | "dark";

/** A segmented control — a real input, not a fire-and-forget command. */
export function ThemeControl({
  value,
  onChange,
}: {
  value: Theme;
  onChange: (next: Theme) => void;
}) {
  return (
    <DevSurface>
      <div className="ds-segmented">
        {(["light", "dark"] as const).map((theme) => (
          <button
            key={theme}
            type="button"
            aria-pressed={value === theme}
            onClick={() => onChange(theme)}
          >
            {theme}
          </button>
        ))}
      </div>
    </DevSurface>
  );
}

/** Four lines of state the commands list has no way to show. */
export function SessionFacts() {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  return (
    <DevSurface>
      <dl className="ds-stack">
        <div className="ds-row">
          <dt>status</dt>
          <dd>{online ? "connected" : "offline"}</dd>
        </div>
        <div className="ds-row">
          <dt>rooms</dt>
          <dd>12</dd>
        </div>
        <div className="ds-row">
          <dt>sync</dt>
          <dd>incremental</dd>
        </div>
        <div className="ds-row">
          <dt>device</dt>
          <dd>ABCD1234</dd>
        </div>
      </dl>
    </DevSurface>
  );
}

/** A one-click action that belongs next to the facts it acts on. */
export function SignInButton() {
  const [who, setWho] = useState<string | null>(null);
  return (
    <DevSurface>
      {who ? (
        <div className="ds-row">
          <span>signed in</span>
          <span>{who}</span>
        </div>
      ) : (
        <button
          type="button"
          className="ds-button"
          onClick={() => setWho("@test-user")}
        >
          Sign in as test user
        </button>
      )}
    </DevSurface>
  );
}
