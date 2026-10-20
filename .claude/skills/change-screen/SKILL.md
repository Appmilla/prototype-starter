---
name: change-screen
description: Add, change, rename, move or remove a screen in the prototype, or change what a screen shows, its links, its made-up data or who can see it. Use for any plain request about a screen ("add a settings page", "the button should go to…", "show the date on the card", "only admins see this").
---

# Add or change a screen

The designer describes what they want on screen. Make the change, keep everything in step, and tell them what
changed on screen with the preview link. Don't ask about Git, tooling or tests.

Keep these in step with every change:

- **Route table.** Every screen is in `src/routes.ts` with `id`, `path`, `page`, `title`, `designScreen`,
  `roles`, `states` (all four) and `example` for addresses with `:params`. A screen added without a design has
  `designScreen: null`. Removing a screen removes its entry and its page, and any links to it.
- **Types.** A new business thing, or a new field on one, goes in `src/data/types.ts`, once. Update the made-up
  records in `src/data/mock/` and the functions in `src/data/index.ts` to match.
- **States.** The page still gets data only through `useData`/`useAction` and draws its content inside
  `DataState`, so empty, loading, error and "not allowed" all work.
- **Components.** Pages use only components from `src/components/`. Prefer an existing component; add a new one
  there rather than markup in the page.
- **Design.** If the change comes with an updated Claude Design handoff, replace `design/` with it and rewrite
  `design/handoff-map.json` as the build-from-design skill describes.

The hook refreshes the screen map and runs the type check and lint after every edit; fix what it reports. Then
commit with a clear message and push, and tell the designer what they'll see differently, with the link to the
screen (and to `/screens` if they'll want to check its states).
