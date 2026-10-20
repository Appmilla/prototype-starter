# Appmilla prototype starter

A starting point for clickable prototypes built from a Claude Design handoff. Each prototype is its own private
repository, made from this one with **Use this template**. You and your client click through it on made-up data
until it's signed off; then the engineering team builds the real product from its pages.

You never need to deal with code, Git or tooling. Open the prototype's repository in Claude Code (on the web, on
your phone, or in the desktop app) and ask in plain words.

## What to ask Claude

**To start:** attach your Claude Design export (the zip or folder) and say

> Build the clickable prototype from this design.

Claude puts the design in `design/`, builds the first screens and gives you a link, then builds the rest.

**While you work:**

- "Show me all the screens." Opens `/screens`: every screen, each in its normal state and its four other states
  (empty, loading, error and not allowed).
- "Add a settings screen with…", "The Save button should go back to the list", "Show the date on each card",
  "Only admins should see this page."
- "Reset the demo data." Puts the made-up records back as they started (also a button on `/screens`).
- "Sign me in as an admin." Or pick a sample person on the sign-in screen; there is one per role.

**With the client:**

- "Share this with the client." Gives you the link to the version you've agreed.
- "Is it ready for sign-off?" Claude checks every screen and its states, and writes what changed since the last
  sign-off.
- "The client signed it off." Claude marks this version as signed off.

**Now and then:** "Update the tools." Gets the latest version of these instructions and checks from this
template.

## Good to know

- It's fast on purpose: no tests, no backend, no deployment. Everything is made up, including sign-in.
- Add `?state=empty`, `?state=loading`, `?state=error` or `?state=denied` to any address to see that state.
- `PROTOTYPE-MAP.md` lists every screen, where it lives and what it links to. Claude keeps it up to date.

How this template is built: [BUILD-BRIEF.md](BUILD-BRIEF.md).
