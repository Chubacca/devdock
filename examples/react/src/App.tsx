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

function RootLayout() {
  return (
    <>
      <Outlet />

      {/* Auto-detects the dev-marked routes below (the ones with a `handle.dev*`
          entry) and navigates via the SPA router. Add `staticRoutes` to list
          every static route instead — `/settings` shows up only then. */}
      <ReactRouterDevDock
        title="Example Dev Menu"
        hotkey="mod+."
        commands={[
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
