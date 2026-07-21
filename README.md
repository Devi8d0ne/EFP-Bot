# EFP Bot

Discord bot and repeatable server configuration for EFP.

The server is configured as invitation-only: ordinary members cannot create invite
links, and roles are assigned manually by server administrators.

## Requirements

- Node.js 20 or newer
- A Discord application and bot token
- The bot installed in the target server with `bot` and `applications.commands` scopes
- Bot permissions: Manage Roles, Manage Channels, View Channels, Send Messages

## Local setup

1. Open `.env` and paste the token after `DISCORD_TOKEN=`. Never post or commit it.
2. Install dependencies with `npm install`.
3. Register the server commands with `npm run deploy:commands`.
4. Start the bot with `npm run dev`.
5. In Discord, run `/setup-server` as a server administrator.

To configure the guild directly from this computer without using the slash command,
run `npm run setup:guild`.

## Updating the server

Edit `src/server-layout.ts`, then run `/setup-server` again. Existing roles, categories,
and channels with matching names are reused, which prevents duplicates.

The setup command does not delete resources that are removed from the layout. This is
intentional so an accidental edit cannot destroy server content.
