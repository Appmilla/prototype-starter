---
name: update-tools
description: Update this prototype's skills, hook, CLAUDE.md and tools from the latest Appmilla prototype starter template. Use when the designer asks to update the tools, get the latest starter or template, or says a newer version is out.
---

# Update the tools

The starter template is public: https://github.com/Appmilla/prototype-starter (branch `main`). This repository's
tools came from the version in `tools/starter-version`.

1. Fetch the latest template without touching the working tree:

   ```sh
   git fetch --depth 1 https://github.com/Appmilla/prototype-starter.git main
   git show FETCH_HEAD:tools/starter-version
   ```

   If the version is the same as `tools/starter-version`, say the tools are up to date and stop.

2. **Tools: update these directly.** They belong to the template, not to this prototype:
   - `.claude/skills/`, `.claude/settings.json`, `.claude/launch.json`
   - `tools/` (including `tools/starter-version`)
   - `CLAUDE.md`: take the template's, then put back anything this prototype added below it.

   ```sh
   git checkout FETCH_HEAD -- .claude/skills .claude/settings.json .claude/launch.json tools
   git show FETCH_HEAD:CLAUDE.md > CLAUDE.md   # then restore this prototype's own additions
   ```

   Skills removed from the template: remove them here too.

3. **App files: propose, never overwrite silently.** Compare the template's versions of the starter's app files
   with this prototype's: `src/data/hooks.ts`, `src/data/errors.ts`, `src/data/mock/store.ts`, `src/auth/`,
   `src/dev/`, `src/router.tsx`, `src/main.tsx`, `src/components/DataState.tsx`, `package.json`, `tsconfig*.json`,
   `eslint.config.js`, `vite.config.ts`, `index.html` (`git diff HEAD FETCH_HEAD -- <path>`). This prototype has
   probably changed some of them on purpose. Describe each useful difference in plain words and what it would
   change on screen, and apply it only when the designer agrees.

4. Run `npm install` if `package.json` changed, then `npm run check`, and fix anything the new tools report.
5. Commit ("Update the starter tools to <version>") and push. Tell the designer what's new in plain words.
