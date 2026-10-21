---
name: share-with-client
description: Give the designer a link to share the prototype with their client, or change who can open it. Use when the designer asks to share, send, publish or show the prototype to a client or anyone else, asks for "the link", or asks to invite, add or remove someone, or to take the prototype offline.
---

# Share with the client

Prototypes are published to Cloudflare Pages behind Cloudflare Access: the link opens only for the Appmilla team
and the people invited to this prototype, who sign in with a one-time code sent to their email. The link is never
public. How it works and the one-time setup are in `tools/SHARING.md`.

Share the agreed version: what the designer has looked at and is happy with, not work in progress.

1. **Who should see it.** Check `npm run share -- --status`. If no one outside Appmilla is invited and the
   designer hasn't said who the client is, ask for the email addresses of the people who should see it. That's
   the one question to ask; never ask about tooling.
2. **Ready.** Commit and push everything, and make sure `npm run check` passes.
3. **Publish.** `npm run share -- --add <emails>` for new people, otherwise `npm run share`. It builds, publishes
   to this prototype's link (the same link every time) and checks the link asks for a sign-in.
4. **Record it.** Commit `share.json` ("Share the prototype with the client"), tag the commit
   `shared/<yyyy-mm-dd>` (add `-2`, `-3`… if taken) and push the commit and the tag.
5. **Tell the designer**, in plain words: the link, who can open it, that each person signs in with a code sent to
   their email, and which version it is ("the version with the new checkout screens"). Later changes don't
   reach the client until the next share.

Other requests:

- **Invite or remove someone:** `npm run share -- --add <emails>` or `--remove <emails>`. Both republish the
  current version, so only do this from a commit the designer is happy to show; otherwise say so first.
- **Take it offline** (only when the designer asks): `npm run share -- --unpublish`, then commit `share.json`.

If publishing isn't set up (the command says `CLOUDFLARE_API_TOKEN` is missing) or Cloudflare can't be reached,
don't look for another way to publish. Tell the designer that sharing isn't switched on for their Claude Code
environment yet and that whoever looks after Appmilla's Cloudflare account can follow `tools/SHARING.md`; in the
meantime they can show the client the prototype on a call.

If the command refuses to publish because the link doesn't ask for a sign-in, never work around it: the
prototype would be public. Tell the designer it's blocked on the Cloudflare Access setup in `tools/SHARING.md`.
