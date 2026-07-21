import { writeFile } from "node:fs/promises";
import { ChannelType, Client, GatewayIntentBits, PermissionFlagsBits } from "discord.js";
import { config } from "./config.js";
import { webhookFeeds } from "./server-layout.js";
import { matchesDisplayName } from "./server-layout.js";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

try {
  await client.login(config.token);
  const guild = await client.guilds.fetch(config.guildId);
  const member = await guild.members.fetchMe();
  if (!member.permissions.has(PermissionFlagsBits.ManageWebhooks)) {
    throw new Error("The bot role needs the Manage Webhooks permission.");
  }

  const channels = await guild.channels.fetch();
  const secrets: Record<string, { channelId: string; url: string }> = {};

  for (const feed of webhookFeeds) {
    const channel = channels.find((candidate) => candidate?.type === ChannelType.GuildText && matchesDisplayName(candidate.name, feed.channel));
    if (!channel || channel.type !== ChannelType.GuildText) throw new Error(`Webhook channel not found: ${feed.channel}`);
    const hooks = await channel.fetchWebhooks();
    const hook = hooks.find((candidate) => candidate.name === feed.name) ?? await channel.createWebhook({ name: feed.name, reason: "EFP application integration" });
    secrets[feed.key] = { channelId: channel.id, url: hook.url };
  }

  await writeFile(".discord-webhooks.json", `${JSON.stringify(secrets, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  console.log(`Configured ${Object.keys(secrets).length} webhooks. URLs saved to .discord-webhooks.json.`);
} finally {
  client.destroy();
}
