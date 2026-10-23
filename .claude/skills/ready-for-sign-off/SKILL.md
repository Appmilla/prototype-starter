---
name: ready-for-sign-off
description: Check the prototype is ready for the client to sign off, and write what changed since the last sign-off. Use when the designer asks whether it's ready, done, finished or complete, mentions sign-off or approval, or asks what changed since the client last saw it.
---

# Ready for sign-off

1. Run `npm run map -- --check --changes`. It refreshes the screen map, checks it, and writes
   `CHANGES-SINCE-SIGN-OFF.md` against the last `sign-off/*` tag.
2. Run `npm run check` for the type check and lint.
3. Run `npm run a11y`, the accessibility scan: every screen in every state, at phone and desktop width, in light
   and dark. It takes a few minutes and writes `ACCESSIBILITY-REPORT.md`.
4. Fix what you safely can (a missing state, a page that holds records, a broken link, a missing label, a text
   colour that undoes the design's), then run them again. Fixes that change how a screen looks, such as a
   colour, a layout or an interaction, go to the designer first.
5. Tell the designer, in plain words, one line each:
   - **Every route is on the screen map:** how many screens, and whether every screen in the design is there.
   - **Every page draws its four states:** empty, loading, error and "not allowed"; name any that don't.
   - **No page holds data:** pages get data only through the data hooks; name any that don't.
   - **The type check passes.**
   - **Accessibility:** what the scan found, in plain words, with where and what it would change on screen.
     Automated checks catch only part of what matters, so say a person still needs to try it with a keyboard and
     a screen reader before production.

   Then summarise `CHANGES-SINCE-SIGN-OFF.md`: new, changed and removed screens.

6. Commit and push `CHANGES-SINCE-SIGN-OFF.md`, `ACCESSIBILITY-REPORT.md` and the map.

When the designer says the client has signed off, tag that commit and push the tag, so the next
`CHANGES-SINCE-SIGN-OFF.md` starts from here:

```sh
git tag sign-off/$(date +%Y-%m-%d) && git push origin --tags
```

(If a tag for today exists, add `-2`, `-3`…)
