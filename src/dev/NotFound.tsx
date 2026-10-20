import { Link, useLocation } from 'react-router';

export function NotFound() {
  const { pathname } = useLocation();
  return (
    <main className="dev-page">
      <h1>No screen here</h1>
      <p className="dev-muted">
        Nothing in the prototype lives at <code>{pathname}</code>.
      </p>
      <p>
        <Link to="/screens">All screens</Link>
      </p>
    </main>
  );
}
