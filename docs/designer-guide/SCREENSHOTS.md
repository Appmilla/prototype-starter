# Screenshots for the designer guide

Instructions for a Claude session with **Claude in Chrome**, signed in to GitHub, claude.ai and Claude Design as
Rich, to finish and publish `docs/designer-guide/index.html`.

The page is written. It has screenshot slots, `<img src="shots/NN-name.png">`, whose `alt` text says what each
shot shows. Only change the page's text where a real screen contradicts it, so the text matches the real screen.

## Take the screenshots

Use a phone-sized window (about 430 px wide) where the site allows it: the designer works mostly on his phone.
Crop to the part that matters. No notifications, tokens, emails other than the example ones, or other private data
in any shot.

| File                     | Capture                                                                                                                                                                                                     |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `01-use-template.png`    | github.com/Appmilla/prototype-starter with the **Use this template** menu open, showing "Create a new repository". Don't create anything.                                                                   |
| `02-new-repo.png`        | The **Create a new repository** form from that menu, filled in: Owner Appmilla, name `acme-dashboard-prototype`, **Private** selected. Take the shot, then leave without creating the repository.          |
| `03-new-session.png`     | claude.ai/code new-session screen with `Appmilla/dashboard-prototype-trial`, the prototypes environment and **Opus 5.5 · High** chosen, before sending anything.                                            |
| `04-design-handoff.png`  | In Claude Design, the option for handing the design to Claude Code or downloading it. If Claude Design isn't reachable, ask Rich.                                                                           |
| `05-attach.png`          | The claude.ai/code message box with a design .zip attached, not sent. If claude.ai/code can't attach a zip, tell Rich and remove that half of step 3 from the page.                                         |
| `07-build-reply.png`     | Claude's reply in the trial session after "Build the clickable prototype from the design." Only if that trial session exists.                                                                              |
| `08-screens.png`         | The trial prototype's `/screens` page. Same condition as 07.                                                                                                                                                |
| `09-share-reply.png`     | Claude's reply after "Share this with the client." Only once a real share has happened.                                                                                                                     |
| `10-client-sign-in.png`  | The sign-in page a client sees when opening a shared link (email, then one-time code), in a private window. Only once a real share has happened.                                                            |
| `11-prototype-sign-in.png` | The prototype's own (pretend) sign-in page, which appears after the Cloudflare sign-in. Only once a real share has happened. |

Don't run the trial build or a share just to get a shot; ask Rich first.

## Publish

- Publish `docs/designer-guide/index.html` with the Artifact tool, passing the screenshots as `files` at their
  `shots/...` paths. Icon: `guide`. Description: "Step-by-step guide for designers: from the template to a shared,
  signed-off clickable prototype."
- For a shot that can't be taken yet, leave its `<figure class="shot">` out of the published copy instead of
  shipping a broken image, and list what's missing.
- **Don't commit the screenshots.** This repository is public and some shots show client work; they live only in
  the published page. If the page's text changed, commit and push that to `main`.

## Done

Rich has the link, and a list of shots still to take (07–10 depend on the trial build and the first share), so the
page can be republished to the same link when they exist.
