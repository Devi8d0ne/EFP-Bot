import { ChannelType, Client, GatewayIntentBits } from "discord.js";
import { config } from "./config.js";
import { matchesDisplayName } from "./server-layout.js";

const feedNames = ["wiki-test-results", "sales-tracker-feed", "recruiting-site-feed", "integration-alerts"];
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

try {
  await client.login(config.token);
  const guild = await client.guilds.fetch(config.guildId);
  const channels = await guild.channels.fetch();
  for (const name of feedNames) {
    const channel = channels.find((candidate) => candidate?.type === ChannelType.GuildText && matchesDisplayName(candidate.name, name));
    if (!channel || channel.type !== ChannelType.GuildText) continue;
    const messages = await channel.messages.fetch({ limit: 10 });
    console.log(`\n${name}: ${messages.size} recent posts`);
    for (const message of messages.values()) {
      const embed = message.embeds[0];
      console.log(`- ${embed?.title ?? "no title"} | fields=${embed?.fields.map((field) => field.name).join(", ") || "none"}`);
    }
  }
} finally {
  client.destroy();
}
