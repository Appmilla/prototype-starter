import { useEffect, useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router';
import { currentUser, signOut, subscribe } from '../auth';
import { resetDemoData } from '../data';
import { PAGE_STATES, type PageState } from '../data/hooks';
import { routes, type ScreenRoute } from '../routes';

const STATE_LABELS: Record<PageState, string> = {
  empty: 'Empty',
  loading: 'Loading',
  error: 'Error',
  denied: 'Not allowed',
};

function address(route: ScreenRoute, state?: PageState) {
  const base = route.example ?? route.path.replace(/:(\w+)\??/g, 'example-$1');
  const url = new URL(base, window.location.origin);
  if (state) url.searchParams.set('state', state);
  if (route.roles.length > 0) url.searchParams.set('as', route.roles[0]);
  return url.pathname + url.search;
}

/** Every screen in the route table, each in its normal state and its four other states. */
export function Screens() {
  const user = useSyncExternalStore(subscribe, currentUser);
  const [reset, setReset] = useState(false);

  useEffect(() => {
    document.title = 'Screens';
  }, []);

  return (
    <main className="dev-page">
      <h1>Screens</h1>
      <p className="dev-muted">
        Every screen in the prototype. Each opens normally or in one of its four states; screens that need someone
        signed in open as the first role allowed to see them.
      </p>

      {routes.length === 0 ? (
        <div className="dev-empty">
          <p>
            <strong>No screens yet.</strong>
          </p>
          <p className="dev-muted">
            Give Claude the Claude Design handoff and ask it to build the clickable prototype.
          </p>
        </div>
      ) : (
        <table className="dev-table">
          <thead>
            <tr>
              <th>Screen</th>
              <th>Address</th>
              <th>Who</th>
              <th>States</th>
            </tr>
          </thead>
          <tbody>
            {routes.map((route) => (
              <tr key={route.id}>
                <td>
                  <Link to={address(route)}>{route.title}</Link>
                  {route.designScreen && <div className="dev-muted">{route.designScreen}</div>}
                </td>
                <td>
                  <code>{route.path}</code>
                </td>
                <td>{route.roles.length > 0 ? route.roles.join(', ') : 'Anyone'}</td>
                <td className="dev-states">
                  {PAGE_STATES.map((state) =>
                    route.states.includes(state) ? (
                      <Link key={state} to={address(route, state)}>
                        {STATE_LABELS[state]}
                      </Link>
                    ) : (
                      <span key={state} className="dev-missing" title="This page does not draw this state yet">
                        {STATE_LABELS[state]} missing
                      </span>
                    ),
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Demo</h2>
      <p>
        {user ? (
          <>
            Signed in as {user.name} ({user.role}).{' '}
            <button type="button" className="dev-link" onClick={signOut}>
              Sign out
            </button>
          </>
        ) : (
          <>
            Not signed in. <Link to="/sign-in?next=/screens">Sign in</Link>
          </>
        )}
      </p>
      <p>
        <button
          type="button"
          className="dev-button"
          onClick={() => {
            resetDemoData();
            setReset(true);
          }}
        >
          Reset demo data
        </button>{' '}
        {reset && <span className="dev-muted">Made-up records are back to how they started.</span>}
      </p>
    </main>
  );
}
