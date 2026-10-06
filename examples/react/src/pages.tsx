import { Link, useParams } from "react-router";

const wrap: React.CSSProperties = {
  fontFamily: "ui-sans-serif, system-ui, sans-serif",
  maxWidth: 640,
  margin: "0 auto",
  padding: "48px 24px",
  lineHeight: 1.6,
  color: "#1a1a1a",
};

function Page({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div style={wrap}>
      <h1 style={{ marginBottom: 4 }}>{title}</h1>
      {children}
    </div>
  );
}

export function Home() {
  return (
    <Page title="devdock example">
      <p>
        This app has several routes. Open the green <strong>DEV</strong> button
        in the bottom-right (or press <kbd>⌘/Ctrl</kbd> + <kbd>.</kbd>) to jump
        between them or run a command.
      </p>
      <p>
        Routes are <em>auto-detected</em> from React Router — dynamic routes
        like <code>/users/:id</code> are skipped automatically.
      </p>
      <ul>
        <li>
          <Link to="/users/42">Visit a dynamic route (/users/42)</Link> — note
          it won't appear in the dock.
        </li>
      </ul>
    </Page>
  );
}

export const Dashboard = () => (
  <Page title="Dashboard">
    <p>Pretend there are charts here.</p>
  </Page>
);

export const Settings = () => (
  <Page title="Settings">
    <p>Toggles and knobs would live here.</p>
  </Page>
);

export const Billing = () => (
  <Page title="Billing">
    <p>Invoices, plans, the usual.</p>
  </Page>
);

export const StyleGuide = () => (
  <Page title="Style Guide">
    <p>Buttons, colors, typography.</p>
  </Page>
);

export const Secret = () => (
  <Page title="Secret (hidden from dock)">
    <p>
      This route exists but is marked <code>handle.hidden</code>, so it never
      shows in the dock.
    </p>
  </Page>
);

export function User() {
  const { id } = useParams();
  return (
    <Page title={`User #${id}`}>
      <p>A dynamic route. The dock skips these since they need an argument.</p>
      <Link to="/">← Home</Link>
    </Page>
  );
}

export const NotFound = () => (
  <Page title="404">
    <Link to="/">← Home</Link>
  </Page>
);
