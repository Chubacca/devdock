import { useEffect, useState } from "react";
import { act, render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DevDock } from "../src/react";
import { dialog, root, toggle, viewHost, viewHosts } from "./shadow";

afterEach(() => {
  document.head.querySelectorAll("style").forEach((n) => n.remove());
});

const view = (id: string) => viewHost(id)!;

/** Calls `fn` when the component unmounts. */
function useUnmounted(fn: () => void) {
  useEffect(() => fn, [fn]);
}

describe("DevDock views (React)", () => {
  it("portals a view's React tree into the dock", async () => {
    const user = userEvent.setup();
    render(
      <DevDock
        enabled
        views={[
          { id: "facts", label: "Session", render: () => <p>device: ABC123</p> },
        ]}
      />,
    );
    // Views exist only while the popup is open.
    expect(viewHosts()).toHaveLength(0);

    await user.click(toggle());
    await waitFor(() =>
      expect(view("facts").textContent).toContain("device: ABC123"),
    );
    expect(root()!.textContent).toContain("Session"); // the heading
  });

  it("unmounts the React tree on close and mounts it again on reopen", async () => {
    const user = userEvent.setup();
    const mounted = vi.fn();
    const unmounted = vi.fn();

    function Facts() {
      useState(() => mounted());
      useUnmounted(unmounted);
      return <p>facts</p>;
    }

    render(<DevDock enabled views={[{ id: "f", render: () => <Facts /> }]} />);
    await user.click(toggle());
    await waitFor(() => expect(mounted).toHaveBeenCalledTimes(1));

    await user.click(toggle());
    await waitFor(() => expect(unmounted).toHaveBeenCalledTimes(1));
    expect(viewHosts()).toHaveLength(0);

    await user.click(toggle());
    await waitFor(() => expect(mounted).toHaveBeenCalledTimes(2));
  });

  it("does not remount a view when the host component re-renders", async () => {
    const user = userEvent.setup();
    const mounted = vi.fn();
    let bump = () => {};

    function Facts() {
      useState(() => mounted());
      return <p>facts</p>;
    }

    function Host() {
      const [n, setN] = useState(0);
      bump = () => setN((prev) => prev + 1);
      return (
        // A fresh array, a fresh view object and new options every render.
        <DevDock
          enabled
          title={`Dev ${n}`}
          views={[{ id: "f", render: () => <Facts /> }]}
        />
      );
    }

    render(<Host />);
    await user.click(toggle());
    await waitFor(() => expect(mounted).toHaveBeenCalledTimes(1));

    await act(async () => bump());
    await act(async () => bump());
    expect(mounted).toHaveBeenCalledTimes(1);
    expect(dialog()).not.toBeNull();
  });

  it("re-renders a view's content from the host's state", async () => {
    const user = userEvent.setup();
    let bump = () => {};
    function Host() {
      const [n, setN] = useState(0);
      bump = () => setN((prev) => prev + 1);
      return (
        <DevDock enabled views={[{ id: "f", render: () => <p>n: {n}</p> }]} />
      );
    }
    render(<Host />);
    await user.click(toggle());
    await waitFor(() => expect(view("f").textContent).toBe("n: 0"));

    await act(async () => bump());
    await waitFor(() => expect(view("f").textContent).toBe("n: 1"));
  });

  it("tears the view down when the component unmounts", async () => {
    const user = userEvent.setup();
    const unmounted = vi.fn();

    function Facts() {
      useUnmounted(unmounted);
      return <p>facts</p>;
    }

    const { unmount } = render(
      <DevDock enabled views={[{ id: "f", render: () => <Facts /> }]} />,
    );
    await user.click(toggle());
    await waitFor(() => expect(viewHosts()).toHaveLength(1));

    unmount();
    expect(unmounted).toHaveBeenCalledTimes(1);
    expect(viewHosts()).toHaveLength(0);
  });

  it("renders nothing of its own when there are no views", () => {
    const { container } = render(<DevDock enabled />);
    expect(container.innerHTML).toBe("");
  });
});

// React's event system attaches to the portal container, which here sits
// inside the dock's shadow root. Focus/blur and controlled-input onChange are
// where that has historically broken, so both shadow modes are exercised
// rather than assumed.
describe.each([
  ["shadow: true", true] as const,
  ['shadow: "inherit"', "inherit"] as const,
])("React events across the shadow boundary (%s)", (_name, shadow) => {
  /**
   * Type into an input the way a browser does.
   *
   * `user.type()` can't reach inside a shadow root: user-event installs its
   * value interceptor from a capture-phase `focus` listener on the *document*,
   * where the event has already been retargeted to the shadow host, so the
   * real input is never prepared. Its write then lands on React's own `value`
   * setter, which marks the value as seen and suppresses `onChange` — an
   * artifact of the harness, not of the shadow boundary. A browser writes the
   * value underneath React, so that is what this does.
   */
  const typeNative = async (input: HTMLInputElement, text: string) => {
    const nativeValue = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!;
    for (const char of text) {
      await act(async () => {
        nativeValue.call(input, input.value + char);
        input.dispatchEvent(
          new Event("input", { bubbles: true, composed: true }),
        );
      });
    }
  };

  function ControlledForm({
    onFocusSeen,
    onBlurSeen,
  }: {
    onFocusSeen: () => void;
    onBlurSeen: () => void;
  }) {
    const [value, setValue] = useState("");
    const [clicks, setClicks] = useState(0);
    return (
      <div>
        <input
          aria-label="token"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={onFocusSeen}
          onBlur={onBlurSeen}
        />
        <p>value: {value}</p>
        <button type="button" onClick={() => setClicks(clicks + 1)}>
          clicked {clicks}
        </button>
      </div>
    );
  }

  const open = async () => {
    const user = userEvent.setup();
    const onFocusSeen = vi.fn();
    const onBlurSeen = vi.fn();
    render(
      <DevDock
        enabled
        shadow={shadow}
        views={[
          {
            id: "form",
            render: () => (
              <ControlledForm
                onFocusSeen={onFocusSeen}
                onBlurSeen={onBlurSeen}
              />
            ),
          },
        ]}
      />,
    );
    await user.click(toggle());
    await waitFor(() => expect(viewHosts()).toHaveLength(1));
    const input = view("form").querySelector("input")!;
    return { user, input, onFocusSeen, onBlurSeen };
  };

  it("drives a controlled input through onChange", async () => {
    const { input } = await open();
    await typeNative(input, "hunter2");
    expect(input.value).toBe("hunter2");
    expect(view("form").textContent).toContain("value: hunter2");
  });

  it("fires onFocus and onBlur", async () => {
    const { user, input, onFocusSeen, onBlurSeen } = await open();
    await user.click(input);
    await waitFor(() => expect(onFocusSeen).toHaveBeenCalled());

    input.blur();
    await waitFor(() => expect(onBlurSeen).toHaveBeenCalled());
  });

  it("fires onClick, and the click does not close the popup", async () => {
    const { user } = await open();
    const button = view("form").querySelector("button")!;
    await user.click(button);
    await waitFor(() => expect(button.textContent).toBe("clicked 1"));
    expect(dialog()).not.toBeNull();
  });
});

describe("DevDock view keys (React)", () => {
  // Two views with the same id would otherwise share one host element, so
  // only one of the portals would ever be visible.
  it("renders both views when they share an id", async () => {
    const user = userEvent.setup();
    render(
      <DevDock
        enabled
        views={[
          { id: "dupe", render: () => <p>first</p> },
          { id: "dupe", render: () => <p>second</p> },
        ]}
      />,
    );
    await user.click(toggle());
    await waitFor(() => expect(viewHosts()).toHaveLength(2));
    expect(viewHosts().map((h) => h.textContent)).toEqual(["first", "second"]);
  });
});
