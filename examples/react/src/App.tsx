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

      {/* Auto-detects all the routes below and navigates via the SPA router. */}
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
      { path: "dashboard", element: <Dashboard />, handle: { devLabel: "Dashboard" } },
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
