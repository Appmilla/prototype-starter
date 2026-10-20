import { useSyncExternalStore } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { currentUser, people, signIn, signOut, subscribe } from '.';

/** Pretend sign-in: pick a sample person. Replaced by real sign-in in the production app. */
export function SignIn() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const user = useSyncExternalStore(subscribe, currentUser);
  const next = params.get('next') ?? '/';

  return (
    <main className="dev-page">
      <h1>Sign in</h1>
      <p className="dev-muted">This is a prototype. Choose who to be; nothing is checked.</p>
      <ul className="dev-list">
        {people().map((person) => (
          <li key={person.id}>
            <button
              type="button"
              className="dev-button"
              onClick={() => {
                signIn(person.id);
                navigate(next);
              }}
            >
              {person.name} <span className="dev-muted">({person.role})</span>
            </button>
          </li>
        ))}
      </ul>
      {user && (
        <p>
          Signed in as {user.name}.{' '}
          <button type="button" className="dev-link" onClick={signOut}>
            Sign out
          </button>
        </p>
      )}
      <p>
        <Link to="/screens">All screens</Link>
      </p>
    </main>
  );
}
