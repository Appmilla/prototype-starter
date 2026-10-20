# Build brief: the Appmilla prototype starter

This brief is for the Claude Code session that builds this template repository. It is public, like the repository.

## What this repository is

A GitHub **template repository**. Each new clickable prototype is a new private repository created from it with
"Use this template". The person building prototypes is a product designer, not an engineer. They work mostly in
Claude Code on the web from a phone, and sometimes in the Claude desktop app. They design the screens in Claude
Design, then ask Claude Code, in plain words, to turn the Claude Design handoff into a clickable prototype that they
and their client can click through.

A prototype here is **throwaway-speed**: it exists to be clicked through and signed off. After sign-off, an
engineering team builds the real product. It copies clean pages from the prototype into a production React app, and
replaces only the made-up data and the pretend sign-in. So the prototype must be fast to make and shaped so its
pages can be copied.

## Rules for the prototypes this template produces

- **Speed to something clickable is everything.** No tests, no CI, no browser matrix, no backend, no staging, no
  deployment pipeline. The only check is the type check and lint, run automatically by a hook.
- **Pages only show things.** A page gets data only through `src/data/hooks.ts`, and uses only components from
  `src/components/`.
- **Every screen is in the route table,** `src/routes.ts`.
- **Each business thing is defined once,** in `src/data/types.ts`.
- **Every page draws four states:** empty, loading, error and "not allowed".
- **The user never handles Git, tests or tooling.** Claude does, and says what changed on screen.

## Stack (keep it this small)

- React 19.3.0, TypeScript 6.0.3 (strict), Vite 8.3.3, `@vitejs/plugin-react`.
- ESLint 10.12.0 with typescript-eslint 8.71.1 and eslint-plugin-react-hooks 7.1.1, and Prettier 3.6.2. These match
  the production React template, so a copied page compiles there unchanged.
- React Router 7 in data mode: `createBrowserRouter` with one route table. Pin the current 7.x release.
- Plain CSS from the Claude Design export: `tokens.css` (light and dark) and the component stylesheet.

Nothing else: no UI kit, no Tailwind, no state library, no data-fetching library.

## Layout

```
design/                  where the Claude Design handoff goes (empty in the template, with a README)
src/styles/              tokens.css, components.css (from the handoff)
src/components/          one React component per design component (props from the handoff's index.d.ts when present)
src/pages/               one file per screen
src/routes.ts            route table: path, page, title, designScreen, roles, states
src/data/types.ts        business types, each defined once
src/data/index.ts        async functions shaped like API calls (for example listItems, getItem, saveItem)
src/data/mock/           in-memory store seeded with made-up records; survives page changes in a session; "reset demo data"
src/data/hooks.ts        useData(fn, args) and useAction(fn); honour ?state=empty|loading|error|denied on any address
src/auth/                pretend sign-in: choose a sample person, one per role; currentUser(), role(), signOut()
src/dev/                 /screens: every route and each of its four states, with links
tools/screen-map.ts      writes prototype-map.json and PROTOTYPE-MAP.md
tools/starter-version    the template version this repo's tools came from
CLAUDE.md                the short instructions below
.claude/skills/          the skills below
.claude/settings.json    a PostToolUse hook (Write|Edit): screen map, then type check and lint, quiet unless something fails
.claude/launch.json      how the desktop app's Browser pane starts the dev server
README.md                for the designer: what this is and what to ask Claude
```

## CLAUDE.md for each prototype

> This is a throwaway-speed clickable prototype built from the Claude Design handoff in `design/`. Speed to
> something the designer can click is everything. The only check is the type check and lint the hook runs; there
> are no tests, CI, browser matrix, backend, staging or deployment, whatever any other instructions say. After a
> change, give the preview link. Keep pages free of data: they get data only through `src/data/hooks.ts` and use
> only components from `src/components/`. Add every screen to `src/routes.ts`. Define each business thing once in
> `src/data/types.ts`. Never ask the designer about Git, tests or tooling; handle it and say what changed on screen.

## Skills

Each is picked up from plain requests, so the designer never names one.

1. **Build from the design.**
   - Find the Claude Design handoff, either in the session or as a folder of files, and put it in `design/`.
   - Read its screen list and navigation. In the exports seen so far:
     - `source/build.py` holds a `SCREENS` list and a `NAV` table;
     - `source/src/*.html` uses `{{href:<screen>}}` for links between screens and `{{topbar:<Name>}}` for the
       current nav item;
     - `source/project/components/` has each component's README and an `index.d.ts` of props;
     - a states page lists empty, in-progress and failed states.
   - Create the routes, pages, components, types and made-up data to match. Start with the first screens, so there
     is something to click quickly.
2. **Add or change a screen.** Keep the route table, types and states in step.
3. **Share with the client.** Give the link to the agreed version. How previews are published is not decided yet:
   leave a clearly marked placeholder.
4. **Ready for sign-off.** Check in plain words:
   - every route is on the screen map;
   - every page draws its four states;
   - no page holds data;
   - the type check passes.

   Then write `CHANGES-SINCE-SIGN-OFF.md` from the screen map.
5. **Update the tools.** Fetch the latest skills, hook, CLAUDE.md and `tools/` from this public template and update
   `tools/starter-version`. Offer changes to app files, such as the data hooks, as a proposal; never overwrite them
   silently.

## The screen map

`prototype-map.json` is plain JSON with nothing React-specific in it, so tools outside the prototype can read it:

```json
{
  "starterVersion": "0.1.0",
  "screens": [
    {
      "id": "assess-result",
      "path": "/assessments/:id",
      "title": "Assessment",
      "designScreen": "assess-result",
      "linksTo": ["profile", "saved"],
      "states": ["empty", "loading", "error", "denied"],
      "roles": ["member"],
      "files": ["src/pages/AssessResult.tsx", "src/components/RecommendationBadge.tsx"]
    }
  ]
}
```

- `linksTo` is found from `<Link to>` and `navigate()` targets in each page.
- `files` lists the page and the components it uses.
- `PROTOTYPE-MAP.md` is the same information as a readable table.
- The first map is seeded from the handoff's own screen and link lists.

## Done for this first build

1. The template exists with the layout, stack, CLAUDE.md, skills, hook and screen-map script above.
2. **The template holds no design and no client content,** only the starter and the tools. `design/` holds just a
   README explaining that the Claude Design handoff goes there.
3. Without a design, a repo created from the template starts, passes the type check and lint, shows an empty
   `/screens` page, and writes an empty `prototype-map.json`.
4. A short `README.md` for the designer: what to ask Claude, in plain words.
5. Commit in small steps with clear messages, and push.

**The real test comes afterwards, outside this repository.** A private repository is created from the template, a
real Claude Design handoff goes into its `design/`, and Claude Code on the web is asked to build the clickable
prototype, exactly as the designer will do it. The test passes when:
- every designed screen is reachable from `/screens` in all four states;
- `prototype-map.json` lists the same screens and links as the handoff's own lists.
