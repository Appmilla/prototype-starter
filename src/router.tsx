// Builds the app's router from the route table in src/routes.ts, plus the starter's own screens:
// /screens (every screen and state), /sign-in (pretend sign-in) and a fallback for unknown addresses.

import { useEffect } from 'react';
import { createBrowserRouter, Outlet, redirect, type LoaderFunctionArgs, type RouteObject } from 'react-router';
import { currentUser, signInAs } from './auth';
import { SignIn } from './auth/SignIn';
import { ScreenContext } from './data/hooks';
import { NotFound } from './dev/NotFound';
import { Screens } from './dev/Screens';
import { routes, type ScreenRoute } from './routes';

function ScreenElement({ route }: { route: ScreenRoute }) {
  useEffect(() => {
    document.title = route.title;
  }, [route.title]);
  return (
    <ScreenContext value={route}>
      <route.page />
    </ScreenContext>
  );
}

/** ?as=<role> signs in as that role's sample person; screens with roles need someone signed in. */
function guard(route: ScreenRoute) {
  return ({ request }: LoaderFunctionArgs) => {
    const url = new URL(request.url);
    const as = url.searchParams.get('as');
    if (as) {
      signInAs(as);
      url.searchParams.delete('as');
      throw redirect(url.pathname + url.search);
    }
    if (route.roles.length > 0 && !currentUser() && !url.searchParams.has('state')) {
      throw redirect(`/sign-in?next=${encodeURIComponent(url.pathname + url.search)}`);
    }
    return null;
  };
}

const screens: RouteObject[] = routes.map((route) => ({
  path: route.path,
  loader: guard(route),
  element: <ScreenElement route={route} />,
}));

const hasHome = routes.some((route) => route.path === '/');

export const router = createBrowserRouter([
  {
    element: <Outlet />,
    HydrateFallback: () => null,
    children: [
      ...screens,
      ...(hasHome ? [] : [{ path: '/', loader: () => redirect('/screens') }]),
      { path: '/screens', element: <Screens /> },
      { path: '/sign-in', element: <SignIn /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);
