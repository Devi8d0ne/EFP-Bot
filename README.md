# EFP Bot

Discord bot and repeatable server configuration for EFP.

The server is configured as invitation-only: ordinary members cannot create invite
links, and roles are assigned manually by server administrators.

## Requirements

- Node.js 20 or newer
- A Discord application and bot token
- The bot installed in the target server with `bot` and `applications.commands` scopes
- Bot permissions: Manage Roles, Manage Channels, Manage Messages, View Channels,
  Send Messages, and Read Message History

## Local setup

1. Open `.env` and paste the token after `DISCORD_TOKEN=`. Never post or commit it.
2. Install dependencies with `npm install`.
3. Register the server commands with `npm run deploy:commands`.
4. Start the bot with `npm run dev`.
5. In Discord, run `/setup-server` as a server administrator.

To configure the guild directly from this computer without using the slash command,
run `npm run setup:guild`.

`npm run setup:webhooks` creates the wiki-test, private sales-tracker, public daily-wall,
and recruiting webhooks and stores their URLs in the ignored `.discord-webhooks.json` file. The bot
is only a server-management bridge; the deployed sites deliver their own notifications.

Run `npm run setup:lessons` locally after `setup:guild` to copy all nine complete lesson
scripts into their Discord channels and pin the matching hosted MP3 and wiki-test links.

## Wiki identity and certification

Agents run `/connect-wiki` and privately enter the same email and ZIP used by the Wiki.
The bot checks the SHA-256 credential hash against the sibling `efp-wiki/src/agents.js`
registry, then discards the submitted email and ZIP. Persistent links and progress are
stored in the ignored `.data/certification.json` file. Set `EFP_WIKI_AGENTS_PATH` or
`EFP_CERTIFICATION_DATA_PATH` only when the deployed folder layout differs. The bot polls
the private result feed and authenticates through its own ignored webhook configuration,
so Discord's privileged Message Content intent is not required.

Wiki test-result webhook messages update progress automatically. Certification eligibility
requires passing each of the nine distinct lesson tests plus the final assessment. Eligible
agents are sent to private manager review; manager approval grants `EFP Certified` and posts
the graduation to the certification wall. Use `/my-progress` for self-service status and
`/certification` for management actions. Run `npm run setup:certification` to pin the Connect
Wiki, My Progress, and Open Training control panel in the certification roadmap channel.

The bot needs **Read Message History** to reconcile result-feed messages and **Manage
Messages** to pin and maintain certification control messages. Keep both permissions enabled
for the bot in the certification channels.

`.data/certification.json` is runtime state, not a rebuildable cache: it contains account
links, progress, and processed-message history. Local development keeps it on disk. A hosted
deployment must set `EFP_CERTIFICATION_DATA_PATH` to a file on a mounted persistent volume;
an ephemeral filesystem will lose certification state on a restart or redeploy.

`npm run cleanup:legacy` removes the unused default general/rules placeholders and their
empty default categories after native Community settings point to the real EFP channels.
It keeps `moderator-only` and moves it to the bottom.

## Updating the server

Edit `src/server-layout.ts`, then run `/setup-server` again. Existing roles, categories,
and channels with matching names are reused, which prevents duplicates.

The setup command does not delete resources that are removed from the layout. This is
intentional so an accidental edit cannot destroy server content.
