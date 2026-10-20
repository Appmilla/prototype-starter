---
name: ready-for-sign-off
description: Check the prototype is ready for the client to sign off, and write what changed since the last sign-off. Use when the designer asks whether it's ready, done, finished or complete, mentions sign-off or approval, or asks what changed since the client last saw it.
---

# Ready for sign-off

1. Run `npm run map -- --check --changes`. It refreshes the screen map, checks it, and writes
   `CHANGES-SINCE-SIGN-OFF.md` against the last `sign-off/*` tag.
2. Run `npm run check` for the type check and lint.
3. Fix what you safely can (a missing state, a page that holds records, a broken link), then run both again.
4. Tell the designer, in plain words, one line each:
   - **Every route is on the screen map:** how many screens, and whether every screen in the design is there.
   - **Every page draws its four states:** empty, loading, error and "not allowed"; name any that don't.
   - **No page holds data:** pages get data only through the data hooks; name any that don't.
   - **The type check passes.**

   Then summarise `CHANGES-SINCE-SIGN-OFF.md`: new, changed and removed screens.

5. Commit and push `CHANGES-SINCE-SIGN-OFF.md` and the map.

When the designer says the client has signed off, tag that commit and push the tag, so the next
`CHANGES-SINCE-SIGN-OFF.md` starts from here:

```sh
git tag sign-off/$(date +%Y-%m-%d) && git push origin --tags
```

(If a tag for today exists, add `-2`, `-3`…)
