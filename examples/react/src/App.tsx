import { useEffect, useState } from "react";
import { createBrowserRouter, Outlet, RouterProvider } from "react-router";
import { ReactRouterDevDock } from "@chuvenger/devdock/react-router";
import {
  Billing,
  Dashboard,
  Home,
  NotFound,
  Secret,
  Settings,
  StyleGuide,
  User,
} from "./pages";
import {
  FrameRate,
  SessionFacts,
  SignInButton,
  ThemeControl,
  type Theme,
} from "./dev-views";

function DevTools() {
  const [theme, setTheme] = useState<Theme>("light");
  const [frozen, setFrozen] = useState(false);

  // The dev dock drives the real app, not a copy of it.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.toggleAttribute("data-frozen", frozen);
  }, [theme, frozen]);

  return (
    /* Auto-detects the dev-marked routes below (the ones with a `handle.dev*`
       entry) and navigates via the SPA router. Add `staticRoutes` to list
       every static route instead — `/settings` shows up only then. */
    <ReactRouterDevDock
      title="Example Dev Menu"
      hotkey="mod+."
      // The views below are built from the app's own stylesheet (`app.css`),
      // which a shadow root would otherwise keep out. Drop this and watch them
      // render unstyled.
      shadow="inherit"
      views={[
        {
          id: "fps",
          label: "Frame rate",
          render: () => <FrameRate frozen={frozen} />,
        },
        {
          id: "theme",
          label: "Theme",
          render: () => <ThemeControl value={theme} onChange={setTheme} />,
        },
        // Two views under one heading, below the routes/commands list.
        {
          id: "facts",
          group: "Session",
          order: "after",
          render: () => <SessionFacts />,
        },
        { id: "signin", group: "Session", order: "after", render: () => <SignInButton /> },
      ]}
      commands={[
        // A function label re-reads on every render of the open panel, so the
        // row can show state; `checked` turns a command into a real toggle.
        {
          id: "theme",
          label: () => `Theme: ${theme === "dark" ? "Dark" : "Light"}`,
          group: "State",
          keepOpen: true,
          run: () => setTheme(theme === "dark" ? "light" : "dark"),
        },
        {
          id: "freeze",
          label: "Freeze animations",
          group: "State",
          checked: () => frozen,
          keepOpen: true,
          run: () => setFrozen(!frozen),
        },
        {
          label: "Reset demo state",
          group: "Actions",
          run: () => {
            localStorage.clear();
            alert("Local storage cleared.");
          },
        },
        {
          label: "Log a timestamp (stays open)",
          group: "Actions",
          keepOpen: true,
          run: () => console.log("tick:", new Date().toISOString()),
        },
        {
          label: "Open React docs",
          group: "Links",
          run: () => window.open("https://react.dev", "_blank"),
        },
      ]}
    />
  );
}

function RootLayout() {
  return (
    <>
      <Outlet />
      <DevTools />
    </>
  );
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      { index: true, element: <Home /> },
      {
        path: "dashboard",
        element: <Dashboard />,
        handle: { devLabel: "Dashboard" },
      },
      // No dev marker, so it's listed only with `staticRoutes`.
      { path: "settings", element: <Settings /> },
      {
        path: "billing",
        element: <Billing />,
        handle: { devLabel: "Billing", devGroup: "Internal" },
      },
      {
        path: "style-guide",
        element: <StyleGuide />,
        handle: { devLabel: "Style Guide", devGroup: "Internal" },
      },
      { path: "secret", element: <Secret />, handle: { hidden: true } },
      { path: "users/:id", element: <User /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
