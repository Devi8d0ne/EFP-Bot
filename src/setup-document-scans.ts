import { readFile, writeFile } from "node:fs/promises";
import { ChannelType, Client, GatewayIntentBits, PermissionFlagsBits } from "discord.js";
import { config } from "./config.js";
import { matchesDisplayName } from "./server-layout.js";

const CHANNEL_NAME = "app-data-document-scans";
const WEBHOOK_NAME = "EFP Document Scans";
const PRIVATE_ROLES = ["Admin", "Office", "General Manager"];
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

try {
  await client.login(config.token);
  const guild = await client.guilds.fetch(config.guildId);
  await Promise.all([guild.channels.fetch(), guild.roles.fetch()]);

  const category = guild.channels.cache.find(
    (channel) => channel?.type === ChannelType.GuildCategory && matchesDisplayName(channel.name, "APP DATA FEEDS"),
  );
  if (!category || category.type !== ChannelType.GuildCategory) throw new Error("APP DATA FEEDS category not found.");

  const permissionOverwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    ...PRIVATE_ROLES.map((roleName) => {
      const role = guild.roles.cache.find((candidate) => candidate.name === roleName);
      if (!role) throw new Error(`Required role not found: ${roleName}`);
      return {
        id: role.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
        ],
      };
    }),
  ];

  let channel = guild.channels.cache.find(
    (candidate) => candidate?.type === ChannelType.GuildText && matchesDisplayName(candidate.name, CHANNEL_NAME),
  );
  if (channel && channel.type === ChannelType.GuildText) {
    await channel.edit({
      parent: category.id,
      topic: "Restricted administrative copies of verified-agent customer document scan sessions.",
      permissionOverwrites,
      reason: "Configure the document scanner admin feed",
    });
  } else {
    channel = await guild.channels.create({
      name: CHANNEL_NAME,
      type: ChannelType.GuildText,
      parent: category.id,
      topic: "Restricted administrative copies of verified-agent customer document scan sessions.",
      permissionOverwrites,
      reason: "Add the document scanner admin feed",
    });
  }
  if (channel.type !== ChannelType.GuildText) throw new Error("Document scans channel is not a text channel.");

  const hooks = await channel.fetchWebhooks();
  const hook = hooks.find((candidate) => candidate.name === WEBHOOK_NAME)
    ?? await channel.createWebhook({ name: WEBHOOK_NAME, reason: "EFP document scanner integration" });

  let secrets: Record<string, { channelId: string; url: string }> = {};
  try {
    secrets = JSON.parse(await readFile(".discord-webhooks.json", "utf8"));
  } catch {
    // The targeted setup can initialize the local webhook registry when it does not exist yet.
  }
  secrets.documentScans = { channelId: channel.id, url: hook.url };
  await writeFile(".discord-webhooks.json", `${JSON.stringify(secrets, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  console.log("Document scan admin channel and webhook are configured.");
} finally {
  client.destroy();
}
