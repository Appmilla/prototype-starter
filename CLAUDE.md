# Prototype

This is a throwaway-speed clickable prototype built from the Claude Design handoff in `design/`. Speed to
something the designer can click is everything. The check after each change is the type check and lint the hook
runs. There are no tests, CI, browser matrix, backend, staging or deployment in this repository. Accessibility
is checked twice, not after every change: the design's colours when the handoff arrives (`npm run contrast`), and
every screen before client sign-off (`npm run a11y`). After a change, give the preview link. Keep pages free of data: they get data only through `src/data/hooks.ts` and use
only components from `src/components/`. Add every screen to `src/routes.ts`. Define each business thing once in
`src/data/types.ts`. Never ask the designer about Git, tests or tooling; handle it and say what changed on screen.

## Where things are

- `src/routes.ts` route table; `src/pages/` one file per screen; `src/components/` one per design component.
- `src/data/index.ts` API-shaped functions over the made-up store in `src/data/mock/`; pages call them only
  through `useData` and `useAction` in `src/data/hooks.ts`, and draw their states with `DataState`.
- `?state=empty|loading|error|denied` on any address shows that state; `?as=<role>` signs in as that role.
- `/screens` lists every screen and state. `src/auth/` is the pretend sign-in.
- `prototype-map.json` and `PROTOTYPE-MAP.md` are written by `tools/screen-map.ts` (the hook runs it); don't edit
  them by hand.
- Start the preview with `npm run dev` (port 5173), installing packages first if `node_modules` is missing.
- The only publishing is sharing with the client: `npm run share`, as the share-with-client skill describes.
