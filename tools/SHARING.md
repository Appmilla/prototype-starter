# Sharing prototypes with clients

Prototypes are published to **Cloudflare Pages**, behind **Cloudflare Access**. The link only opens for people
with an `@appmilla.com` email and the people invited to that prototype; they type their email and get a one-time
code. Each prototype is its own Cloudflare Pages project with its own access rule, so one client can't open another
client's prototype.

How a share works (`npm run share`, in `tools/share.ts`):

1. It creates the prototype's Cloudflare Pages project the first time, connected to its GitHub repository and
   building only the `shared` branch, and sets its access rule to the team plus the invited people.
2. It checks the address asks visitors to sign in. If it doesn't, it stops: a link is never public.
3. It pushes the agreed commit to the `shared` branch. Cloudflare builds it and publishes it at the same link as
   before, and the script waits for that and checks the sign-in again.

The Cloudflare API token is never visible to Claude. In Claude Code on the web it is a **network secret**: it is
added to requests to `api.cloudflare.com` on their way out of the session, so it can't be printed or leaked from
the conversation. There is no GitHub Actions workflow, because GitHub's free plan doesn't give organisation
secrets to private repositories.

## One-time setup

Done once by someone with access to Appmilla's Cloudflare account. Nothing here is needed per prototype.

1. **Zero Trust.** In the Cloudflare dashboard open **Zero Trust**, choose a team name and the **Free** plan (up
   to 50 people). Cloudflare may ask for a payment card even on the free plan. Under **Settings → Authentication**,
   make sure **One-time PIN** is a login method.
2. **Connect Cloudflare to GitHub.** In **Workers & Pages**, start creating a Pages application from a Git
   repository and choose **GitHub**. Install the Cloudflare app on the **Appmilla** organisation with access to
   **All repositories**, then leave the create screen without creating anything.
3. **API token.** In **My Profile → API Tokens → Create Token → Custom token**, give it these permissions, for
   Appmilla's account only:
   - Account · **Cloudflare Pages** · Edit
   - Account · **Access: Apps and Policies** · Edit

   Copy it straight into step 4; never paste it into a chat.

4. **Claude Code on the web.** Open the cloud environment's settings (the gear next to the environment's name in a
   session's side panel):
   - **Network secrets:** add the token for the host `api.cloudflare.com`, sent as `Authorization: Bearer <token>`.
   - **Network access:** allow `api.cloudflare.com` and `*.pages.dev` (keep package managers allowed).
   - **Environment variables:** add `CLOUDFLARE_ACCOUNT_ID` set to Appmilla's account ID, from the account's
     **Overview** page in the Cloudflare dashboard. It isn't a secret. A token limited to one account can't list
     accounts, so without this the share can't tell which account to publish to (or give the token Account ·
     **Account Settings** · Read as well).

   New sessions pick these up. Anyone who can use that environment can publish, so keep it for the people making
   prototypes.

5. **Check it.** In a new session, ask Claude to do a test share. The first share of each prototype waits for its new
   address to come online, which can take a few minutes. Open the link in a private browser window: it
   should ask for an email before showing anything. Then ask Claude to take the test offline.

Sharing from the Claude desktop app instead needs `CLOUDFLARE_API_TOKEN` set on that computer, where Claude can
read it; sharing from Claude Code on the web keeps the token out of reach.

## Limits on the free plans

- **50 people** can sign in through Cloudflare Access in total, team and clients together. Each person uses a
  seat the first time they sign in. Free seats from finished projects on the **Users** page in Zero Trust.
- **Cloudflare Pages:** about 100 projects and 500 builds a month per account. Take finished prototypes offline
  with `npm run share -- --unpublish`.

## When a share stops

- **"Cloudflare accepted the API token but won't say which account it belongs to"**: `CLOUDFLARE_ACCOUNT_ID` isn't
  set (step 4). For a one-off, run `CLOUDFLARE_ACCOUNT_ID=<id> npm run share`.
- **"isn't reachable from here"**: usually a new prototype whose address isn't online yet. Run the share again in a
  few minutes. If it keeps happening, check `*.pages.dev` is in the environment's allowed domains.
- **"doesn't ask visitors to sign in yet"**: the address is online but Cloudflare Access isn't protecting it. Check
  Zero Trust (step 1). The share never publishes in this case.

## Day to day

- `npm run share -- --add client@example.com` invites someone and publishes. `--remove` uninvites them.
- `npm run share` publishes the current commit to the same link.
- `npm run share -- --status` shows the link, the version published and who can open it.
- `share.json` in each prototype holds its Cloudflare project name, the invited people and the last version
  published. It belongs to the prototype, not to the template.
