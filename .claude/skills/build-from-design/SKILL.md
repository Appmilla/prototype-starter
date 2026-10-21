---
name: build-from-design
description: Turn a Claude Design handoff into the clickable prototype. Use when the designer shares a Claude Design export, handoff, zip or folder of design files, or asks in any words to build, make or start the prototype from the design ("here's the design", "build this", "make it clickable").
---

# Build from the design

The designer is not an engineer. Don't ask about Git, tooling or tests; do it, and tell them what they can now
click. Speed to something clickable is everything: get the first screens working, give the preview link, then
fill in the rest.

## 1. Put the handoff in `design/`

- Find it: files attached in this session (a zip or a folder), files already in the repository (anywhere outside
  `design/`), or a link the designer gave. Unzip if needed.
- Copy it into `design/` keeping its own folder structure (so `design/source/build.py` and so on). Don't edit
  the handoff after copying; it is the record of what was designed. Leave `design/README.md` in place.
- If nothing can be found, ask the designer, in plain words, to attach the Claude Design export.

## 2. Read the screen list and navigation

In the exports seen so far:

- `source/build.py` holds a `SCREENS` list (each screen's id, title and source file) and a `NAV` table (the
  top-level navigation).
- `source/src/*.html` are the screens. `{{href:<screen>}}` is a link to another screen; `{{topbar:<Name>}}` draws
  the top bar with `<Name>` as the current nav item.
- `source/project/components/` has a folder per component with a README and an `index.d.ts` of props.
- A states page lists the empty, in-progress (loading) and failed (error) states.
- `tokens.css` (light and dark) and the component stylesheet.

Other exports may differ: look for the same information (screen list, links, components, states, styles) and
say briefly what you used.

Then write `design/handoff-map.json`, the handoff's own screens and links, which the sign-off check compares with
the prototype:

```json
{
  "screens": [{ "id": "assess-result", "title": "Assessment", "linksTo": ["profile", "saved"] }]
}
```

- `id` and `title` come from `SCREENS`, in its order.
- `linksTo` is every other screen the screen's HTML links to with `{{href:…}}`, plus the `NAV` targets when the
  screen draws the top bar (the top bar's links are links too). No duplicates, not the screen itself.

## 3. Build

Work screen by screen in `SCREENS` order. For the first two or three screens, do everything below, start the
preview (`npm run dev`, installing first if needed) and give the designer the link to `/screens` before going on.

- **Styles.** Replace `src/styles/tokens.css` and `src/styles/components.css` with the handoff's files. Add any
  web fonts they use to `index.html`. Then run `npm run contrast`. If it reports pairs below WCAG AA, tell the
  designer in plain words which colours, where they're used (a hover state, a status label…) and by how much, and
  suggest fixing them in Claude Design. Keep building either way: colours are tokens and easy to swap later.
- **Types.** Each business thing the screens show (an assessment, a profile, an order…) is defined once in
  `src/data/types.ts`. Replace the placeholder `Role` with the roles in the design (who signs in); if the design
  has no roles, keep `member`.
- **Made-up data.** Seed records in `src/data/mock/<thing>.ts`, believable and varied, with one sample person per
  role in `src/data/mock/people.ts`. Add API-shaped functions to `src/data/index.ts` (`listX`, `getX`, `saveX`)
  over `table()` from `src/data/mock/store.ts`, with `delay()` and, where a role matters, `allow(...)`.
- **Components.** One React component per design component in `src/components/`, props from its `index.d.ts`
  when present, class names from the stylesheet. Build the top bar as one component that takes the current item
  and links to the `NAV` screens. Restyle `DataState` from the states page, keeping its props.
- **Pages.** One file per screen in `src/pages/`, translating the screen's HTML into JSX made only of components.
  `{{href:x}}` becomes `<Link to="…">` with screen x's address (use real ids from the made-up data for addresses
  with `:params`). Data comes only from `useData(fn, args)` and changes go through `useAction(fn)`; the page
  draws its content inside `<DataState result={…}>` so all four states work. No records, lists or copy that
  belongs to records in a page.
- **Routes.** Add each screen to `src/routes.ts`: `id` and `designScreen` are the screen's id from `SCREENS`,
  the first screen's path is `/`, `roles` from the design (empty means anyone), `states` all four, and
  `example` for addresses with `:params`.

The hook refreshes the screen map and runs the type check and lint after every edit; fix whatever it reports
before moving on.

## 4. Finish

- Run `npm run map -- --check`. Fix every "to fix" item; look at the "worth a look" notes.
- Open `/screens` and click through each screen and its four states.
- Commit in small steps as you go, with clear messages, and push.
- Tell the designer, in plain words, which screens are clickable, anything in the design you couldn't follow and
  what you did instead, and give the preview link.
