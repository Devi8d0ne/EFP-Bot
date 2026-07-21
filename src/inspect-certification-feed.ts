import { ChannelType, Client, GatewayIntentBits } from "discord.js";
import { config } from "./config.js";
import { matchesDisplayName } from "./server-layout.js";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
try {
  await client.login(config.token);
  const guild = await client.guilds.fetch(config.guildId);
  const channels = await guild.channels.fetch();
  const feed = channels.find((channel) => channel?.type === ChannelType.GuildText && matchesDisplayName(channel.name, "wiki-test-results"));
  if (!feed || feed.type !== ChannelType.GuildText) throw new Error("wiki-test-results channel not found");
  const messages = await feed.messages.fetch({ limit: 5 });
  console.log(`Certification feed REST check: ${messages.size} messages; ${messages.filter((message) => message.webhookId && message.embeds.length > 0).size} readable webhook embeds.`);
  for (const message of messages.values()) console.log(`- webhook=${Boolean(message.webhookId)} embeds=${message.embeds.length} title=${message.embeds[0]?.title ?? "none"}`);
} finally {
  client.destroy();
}
