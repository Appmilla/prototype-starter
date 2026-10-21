# Sharing prototypes with clients

Prototypes are published to **Cloudflare Pages**, behind **Cloudflare Access**. The link only opens for people
with an `@appmilla.com` email and the people invited to that prototype; they type their email and get a one-time
code. Each prototype is its own Cloudflare Pages project with its own access rule, so one client can't open another
client's prototype.

Claude publishes with `npm run share` (`tools/share.ts`), from the Claude Code session. There is no CI: GitHub's
free plan doesn't give organisation secrets to private repositories, so publishing from GitHub Actions would mean
adding keys to every prototype repository by hand.

`tools/share.ts` never publishes unless the address already asks visitors to sign in, so a mistake in the setup
stops publishing rather than making a prototype public.

## One-time setup

Done once by someone with access to Appmilla's Cloudflare account. Nothing here is needed per prototype.

1. **Cloudflare account.** Use Appmilla's existing account, or create a free one.
2. **Zero Trust.** In the Cloudflare dashboard open **Zero Trust**, choose a team name and the **Free** plan (up
   to 50 people). Cloudflare may ask for a payment card even on the free plan. Under **Settings → Authentication**,
   make sure **One-time PIN** is a login method.
3. **API token.** In **My Profile → API Tokens → Create Token → Custom token**, give it these permissions, for
   Appmilla's account only:
   - Account · **Cloudflare Pages** · Edit
   - Account · **Access: Apps and Policies** · Edit

   Note the token, and the **Account ID** (shown on the account's overview page).

4. **Claude Code on the web.** In the cloud environment the designers use (the environment menu in a session's
   title bar, then **Edit**):
   - add environment variables `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`;
   - under **Network access**, allow `api.cloudflare.com` and `*.pages.dev` (keep package managers allowed).

   New sessions pick these up. Anyone who can use that environment can publish, so keep it for the people making
   prototypes.

5. **Claude desktop app.** Set the same two environment variables on the designer's computer.
6. **Check it.** In a prototype, ask Claude to share it with the client. Open the link in a private browser
   window: it should ask for an email before showing anything.

## Limits on the free plans

- **50 people** can sign in through Cloudflare Access in total, team and clients together. Each person uses a
  seat the first time they sign in. Free seats from finished projects on the **Users** page in Zero Trust.
- **Cloudflare Pages:** about 100 projects per account. Take finished prototypes offline with
  `npm run share -- --unpublish`.

## Day to day

- `npm run share -- --add client@example.com` invites someone and publishes. `--remove` uninvites them.
- `npm run share` publishes the current version to the same link.
- `npm run share -- --status` shows the link, the version published and who can open it.
- `share.json` in each prototype holds its Cloudflare project name, the invited people and the last version
  published. It belongs to the prototype, not to the template.
